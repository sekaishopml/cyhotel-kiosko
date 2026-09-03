package com.hoteldelvalle.kiosco

import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Calendar
import kotlin.concurrent.thread

/**
 * Fase B-Android del plan OTA.
 *
 * Concentra la única lógica de actualización que antes estaba triplicada en
 * MainActivity (autoCheckUpdate / checkForUpdate / checkAndUpdateFromWeb):
 * una sola [fetchUpdate] que consulta el servidor local `/api/kiosco-update`
 * y usa GitHub solo como fallback.
 *
 * GitHub está CONSERVADO pero PINEADO: solo https, repo fijo
 * sekaishopml/cyhotel-kiosko, tag ^v\d+\.\d+\.\d+$, asset exacto
 * Kiosko-<tag>.apk y Accept header de API v3.
 *
 * Contrato servidor (lo implementa otro agente, se programa contra él):
 * `{version, versionCode, minVersion, apk, download_url, sha256|null,
 * size|null, apkAvailable}`.
 *
 * Estados JS (`window.__updateStatus`): checking / available / latest /
 * downloading / installing / cancelled / error. NO cambiar nombres.
 *
 * Todo el trabajo de red corre en hilos worker; lo que toca UI se postea
 * con [handler]. No tocar build.gradle ni manifest para esta fase.
 */
class UpdateManager(
    private val activity: Activity,
    private val appVersion: String,
    private val serverBaseProvider: () -> String,
    private val logBoot: (String) -> Unit,
    private val evalJs: (String) -> Unit,
) {
    private val handler = Handler(Looper.getMainLooper())

    data class UpdateInfo(
        val version: String,
        val tag: String,
        val apkUrl: String,
        val sha256: String?,
        val size: Long?,
        val minVersion: String?,
        val versionCode: Int?,
        val source: String,
    )

    // ================= ENTRADA ÚNICA =================

    /**
     * Camino único de resolución: servidor local primero, GitHub como
     * fallback. Devuelve null si no hay nada instalable (ya es latest,
     * bloqueado por minVersion o error de red). BLOQUEANTE: llamar desde
     * hilo worker.
     */
    fun fetchUpdate(): UpdateInfo? {
        try {
            fetchFromServer()?.let { return it }
        } catch (e: Exception) {
            Log.w(TAG, "OTA servidor local: ${e.message}")
        }
        try {
            return fetchFromGitHub()
        } catch (e: Exception) {
            Log.w(TAG, "OTA GitHub: ${e.message}")
        }
        return null
    }

    private fun fetchFromServer(): UpdateInfo? {
        val base = serverBaseProvider()
        val c = (URL("$base/api/kiosco-update").openConnection() as HttpURLConnection).apply {
            connectTimeout = 5000
            readTimeout = 5000
        }
        try {
            if (c.responseCode != 200) return null
            val body = c.inputStream.bufferedReader().readText()
            return parseServerBody(body, base)
        } finally {
            c.disconnect()
        }
    }

    private fun parseServerBody(body: String, base: String): UpdateInfo? {
        val o = try {
            JSONObject(body)
        } catch (_: Exception) {
            return null
        }
        val version = o.optString("version", "").trim().takeIf { it.isNotEmpty() } ?: return null
        val minVersion = o.optString("minVersion", "").trim().takeIf { it.isNotEmpty() }
        val versionCode = if (o.isNull("versionCode")) null else o.optInt("versionCode", -1).takeIf { it >= 0 }
        // download_url manda; si falta se resuelve el campo relativo `apk` contra la base.
        var apkUrl = o.optString("download_url", "").trim().takeIf { it.isNotEmpty() }
        if (apkUrl == null) {
            val apk = o.optString("apk", "").trim().takeIf { it.isNotEmpty() } ?: return null
            apkUrl = base.trimEnd('/') + "/" + apk.trimStart('/')
        }
        if (!isServerApkUrlAllowed(apkUrl, base)) {
            logBoot("OTA: URL del servidor rechazada: $apkUrl")
            toast("URL de actualización no permitida", true)
            return null
        }
        if (!shouldInstall(version, appVersion, minVersion)) return null
        val sha256 = o.optString("sha256", "").trim().takeIf { it.isNotEmpty() }
        val size = if (o.isNull("size")) null else o.optLong("size", -1).takeIf { it > 0 }
        val tag = if (version.startsWith("v")) version else "v$version"
        val apkAvailable = o.optBoolean("apkAvailable", true)
        logBoot("OTA servidor: $tag (vc=${versionCode ?: "?"}, min=${minVersion ?: "-"}) apkAvailable=$apkAvailable")
        return UpdateInfo(version, tag, apkUrl, sha256, size, minVersion, versionCode, "servidor")
    }

    private fun fetchFromGitHub(): UpdateInfo? {
        val api = URL(UPDATE_API)
        if (api.protocol != "https" || api.host != GITHUB_API_HOST) {
            logBoot("OTA: UPDATE_API no pineada, se omite GitHub")
            return null
        }
        val c = (api.openConnection() as HttpURLConnection).apply {
            setRequestProperty("Accept", GITHUB_ACCEPT)
            connectTimeout = 10000
            readTimeout = 10000
        }
        try {
            if (c.responseCode != 200) return null
            val body = c.inputStream.bufferedReader().readText()
            val tag = try {
                JSONObject(body).optString("tag_name", "")
            } catch (_: Exception) {
                return null
            }.trim()
            if (tag.isEmpty() || !GITHUB_TAG.matches(tag)) {
                if (tag.isNotEmpty()) logBoot("OTA: tag GitHub no pineado, se ignora: $tag")
                return null
            }
            if (!shouldInstall(tag, appVersion, null)) return null
            // La URL del asset se CONSTRUYE (nunca se confía en la que devuelva la API).
            val asset = buildGitHubAssetUrl(tag)
            if (!isPinnedGitHubAssetUrl(asset, tag)) return null
            return UpdateInfo(tag, tag, asset, null, null, null, null, "GitHub")
        } finally {
            c.disconnect()
        }
    }

    // ================= AUTO (arranque) =================

    /**
     * Chequeo automático al arrancar. Fuera de la ventana 02:00-04:00 solo
     * avisa con Toast (como antes). En ventana: device owner + API 26+
     * instala en silencio vía PackageInstaller; si no es owner (o API < 26)
     * descarga y cae a ACTION_VIEW.
     */
    fun autoCheckUpdate() {
        thread {
            try {
                val info = fetchUpdate() ?: return@thread
                if (!isInSilentWindow()) {
                    toast("Nueva versión disponible: ${info.tag}", true)
                    return@thread
                }
                val file = try {
                    downloadToFile(info.apkUrl, info.tag, null)
                } catch (e: Exception) {
                    logBoot("Error descargando APK: ${e.message}")
                    return@thread
                }
                if (!verifyBeforeInstall(file, info, jsReport = false)) return@thread
                if (isDeviceOwner() && Build.VERSION.SDK_INT >= 26) {
                    logBoot("OTA auto silenciosa: ${info.tag} (ventana 02:00-04:00, device owner)")
                    if (!silentInstall(file)) runUi { installApk(file) }
                } else {
                    logBoot("OTA auto: ${info.tag} sin device owner o API<26 → ACTION_VIEW")
                    runUi { installApk(file) }
                }
            } catch (_: Exception) {
            }
        }
    }

    // ================= MANUAL (diálogo nativo) =================

    fun checkForUpdate() {
        toast("Buscando actualización...")
        thread {
            try {
                val info = fetchUpdate()
                if (info != null) {
                    runUi {
                        AlertDialog.Builder(activity)
                            .setTitle("Actualización disponible")
                            .setMessage("Nueva versión: ${info.tag}\n\nVersión actual: v$appVersion\n\nFuente: ${info.source}\n\n¿Descargar e instalar?")
                            .setPositiveButton("Descargar") { _, _ ->
                                downloadAndInstall(info.apkUrl, info.tag, info.sha256, info.size)
                            }
                            .setNegativeButton("Cancelar", null)
                            .show()
                    }
                } else {
                    toast("Ya tienes la última versión: v$appVersion")
                }
            } catch (e: Exception) {
                toast("Error: ${e.message}", true)
            }
        }
    }

    // ================= WEB (bridge JS) =================

    fun checkAndUpdateFromWeb() {
        thread {
            try {
                jsState("checking")
                val info = fetchUpdate()
                if (info != null) {
                    jsState("available", info.tag)
                    runUi {
                        AlertDialog.Builder(activity)
                            .setTitle("Actualización disponible")
                            .setMessage("Nueva versión: ${info.tag}\n\nVersión actual: v$appVersion\n\nFuente: ${info.source}\n\n¿Descargar e instalar?")
                            .setPositiveButton("Descargar") { _, _ ->
                                downloadAndInstallFromWeb(info.apkUrl, info.tag, info.sha256, info.size)
                            }
                            .setNegativeButton("Cancelar") { _, _ -> jsState("cancelled") }
                            .show()
                    }
                } else {
                    jsState("latest")
                }
            } catch (e: Exception) {
                jsError(e.message)
            }
        }
    }

    /**
     * Bridge JS: la web dispara la descarga directamente.
     * La web debe pasar strings (size como string decimal o null).
     * No aplica política de versión (llamada explícita), pero sí valida
     * la URL y verifica checksum antes de instalar.
     */
    fun downloadUpdate(url: String?, tag: String?, sha256: String?, sizeStr: String?) {
        val u = url?.trim().orEmpty()
        val t = tag?.trim().orEmpty()
        if (u.isEmpty() || t.isEmpty()) {
            jsError("URL o tag vacíos")
            toast("Actualización inválida", true)
            return
        }
        val allowed = isServerApkUrlAllowed(u, serverBaseProvider()) || isPinnedGitHubAssetUrl(u, t)
        if (!allowed) {
            logBoot("OTA downloadUpdate: URL rechazada: $u")
            toast("URL de actualización no permitida", true)
            jsError("URL no permitida")
            return
        }
        val size = sizeStr?.trim().takeIf { !it.isNullOrEmpty() }?.toLongOrNull()
        val sha = sha256?.trim().takeIf { !it.isNullOrEmpty() }
        downloadAndInstallFromWeb(u, t, sha, size)
    }

    // ================= DESCARGA + INSTALACIÓN =================

    fun downloadAndInstall(apkUrl: String, tag: String, sha256: String? = null, size: Long? = null) {
        val info = UpdateInfo("", tag, apkUrl, sha256, size, null, null, "manual")
        withInstallPermission(onDenied = {}, onGranted = {
            handler.post {
                if (!activityAlive()) return@post
                val progressBar = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal)
                progressBar.max = 100
                progressBar.progress = 0
                val tv = TextView(activity).apply {
                    text = "Descargando $tag..."
                    textSize = 16f
                    setPadding(48, 32, 48, 16)
                    setTextColor(Color.WHITE)
                }
                val container = FrameLayout(activity)
                container.setBackgroundColor(Color.parseColor("#0F172A"))
                container.addView(tv, FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT
                ))
                val lp = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT
                )
                lp.setMargins(48, 0, 48, 32)
                lp.gravity = android.view.Gravity.BOTTOM
                container.addView(progressBar, lp)
                val dialog = AlertDialog.Builder(activity)
                    .setTitle("Actualizando")
                    .setView(container)
                    .setCancelable(false)
                    .create()
                dialog.show()
                thread {
                    try {
                        val file = downloadToFile(apkUrl, tag) { p ->
                            handler.post { try { progressBar.progress = p } catch (_: Exception) {} }
                        }
                        if (!verifyBeforeInstall(file, info, jsReport = false)) {
                            handler.post { try { dialog.dismiss() } catch (_: Exception) {} }
                            return@thread
                        }
                        handler.post {
                            try { dialog.dismiss() } catch (_: Exception) {}
                            installApk(file)
                        }
                    } catch (e: Exception) {
                        logBoot("Error descargando APK: ${e.message}")
                        handler.post {
                            try { dialog.dismiss() } catch (_: Exception) {}
                            toast("Error: ${e.message}", true)
                        }
                    }
                }
            }
        })
    }

    fun downloadAndInstallFromWeb(apkUrl: String, tag: String, sha256: String? = null, size: Long? = null) {
        val info = UpdateInfo("", tag, apkUrl, sha256, size, null, null, "web")
        withInstallPermission(onDenied = { jsState("cancelled") }, onGranted = {
            jsState("downloading", "0")
            thread {
                try {
                    val file = downloadToFile(apkUrl, tag) { p -> jsState("downloading", "$p") }
                    if (!verifyBeforeInstall(file, info, jsReport = true)) return@thread
                    jsState("installing")
                    runUi { installApk(file) }
                } catch (e: Exception) {
                    logBoot("Error descargando APK: ${e.message}")
                    jsError(e.message)
                }
            }
        })
    }

    @Throws(Exception::class)
    private fun downloadToFile(apkUrl: String, tag: String, onProgress: ((Int) -> Unit)?): File {
        var conn: HttpURLConnection? = null
        try {
            val c = URL(apkUrl).openConnection() as HttpURLConnection
            conn = c
            c.connectTimeout = 30000
            c.readTimeout = 60000
            val code = c.responseCode
            if (code != 200) throw Exception("HTTP $code al descargar")
            val totalSize = c.contentLength.toLong()
            val dir = File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "kiosco")
            dir.mkdirs()
            val file = File(dir, "Kiosko-$tag.apk")
            c.inputStream.use { input ->
                FileOutputStream(file).use { output ->
                    val buffer = ByteArray(8192)
                    var downloaded = 0L
                    var read: Int
                    while (input.read(buffer).also { read = it } != -1) {
                        output.write(buffer, 0, read)
                        downloaded += read
                        if (onProgress != null && totalSize > 0) {
                            onProgress((downloaded * 100 / totalSize).toInt())
                        }
                    }
                    output.flush()
                }
            }
            logBoot("APK descargado: ${file.absolutePath} (${file.length()} bytes)")
            return file
        } finally {
            try { conn?.disconnect() } catch (_: Exception) {}
        }
    }

    // ================= VERIFICACIÓN =================

    /**
     * Puerta antes de instalar. Si hay sha256: hash y size deben coincidir;
     * si no, estado error + archivo borrado + reporte. Sin sha256 (GitHub o
     * servidor sin APK local): se instala igual que antes, logueando
     * "sin checksum".
     */
    private fun verifyBeforeInstall(file: File, info: UpdateInfo, jsReport: Boolean): Boolean {
        val sha = info.sha256?.trim().takeIf { !it.isNullOrEmpty() }
        if (sha == null) {
            logBoot("OTA ${info.tag}: sin checksum (fuente ${info.source}); se instala igual que antes")
        }
        if (info.size != null && file.length() != info.size) {
            return rejectInstall(file, info, "size: esperado ${info.size}, real ${file.length()}", jsReport)
        }
        if (sha != null) {
            val actual = try {
                sha256Hex(file)
            } catch (e: Exception) {
                return rejectInstall(file, info, "no se pudo calcular sha256: ${e.message}", jsReport)
            }
            if (!actual.equals(sha, ignoreCase = true)) {
                return rejectInstall(file, info, "sha256 no coincide", jsReport)
            }
            logBoot("OTA ${info.tag}: sha256 OK")
        }
        return true
    }

    private fun rejectInstall(file: File, info: UpdateInfo, reason: String, jsReport: Boolean): Boolean {
        try { file.delete() } catch (_: Exception) {}
        logBoot("OTA ${info.tag}: verificación fallida ($reason); archivo borrado")
        if (jsReport) jsError("verificación: $reason") else toast("Actualización rechazada: $reason", true)
        return false
    }

    // ================= INSTALACIÓN =================

    /** Flujo manual actual: instalador del sistema vía FileProvider. */
    fun installApk(file: File) {
        try {
            val uri = if (Build.VERSION.SDK_INT >= 24) {
                androidx.core.content.FileProvider.getUriForFile(
                    activity, "${activity.packageName}.fileprovider", file
                )
            } else {
                Uri.fromFile(file)
            }
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            logBoot("Instalando APK: ${file.absolutePath}")
            activity.startActivity(intent)
        } catch (e: Exception) {
            logBoot("Error instalando APK: ${e.message}")
            toast("Error al instalar: ${e.message}", true)
        }
    }

    /**
     * Instalación silenciosa para device owner (API 26+). Devuelve true si
     * la sesión hizo commit; el llamador cae a [installApk] si es false.
     */
    private fun silentInstall(file: File): Boolean {
        if (Build.VERSION.SDK_INT < 26) return false
        var sessionId = -1
        try {
            val installer = activity.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            params.setAppPackageName(activity.packageName)
            sessionId = installer.createSession(params)
            installer.openSession(sessionId).use { session ->
                FileInputStream(file).use { input ->
                    session.openWrite("package", 0, file.length()).use { out ->
                        val buf = ByteArray(65536)
                        var n: Int
                        while (input.read(buf).also { n = it } != -1) out.write(buf, 0, n)
                        session.fsync(out)
                    }
                }
                val callback = Intent(activity, activity.javaClass).apply {
                    action = ACTION_INSTALL_COMMIT
                }
                var flags = PendingIntent.FLAG_UPDATE_CURRENT
                if (Build.VERSION.SDK_INT >= 23) flags = flags or PendingIntent.FLAG_IMMUTABLE
                val sender = PendingIntent.getActivity(activity, sessionId, callback, flags)
                session.commit(sender.intentSender)
            }
            logBoot("OTA silenciosa: commit sesión $sessionId para ${file.name}")
            return true
        } catch (e: Exception) {
            logBoot("Error instalación silenciosa: ${e.message}")
            try {
                if (sessionId >= 0) activity.packageManager.packageInstaller.abandonSession(sessionId)
            } catch (_: Exception) {}
            return false
        }
    }

    // ================= PERMISO / OWNER / VENTANA =================

    private fun withInstallPermission(onDenied: () -> Unit, onGranted: () -> Unit) {
        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            handler.post {
                if (!activityAlive()) {
                    onDenied()
                    return@post
                }
                AlertDialog.Builder(activity)
                    .setTitle("Permiso requerido")
                    .setMessage("Se necesita permiso para instalar apps. Abra la configuración y permita instalación de apps desconocidas.")
                    .setPositiveButton("Configurar") { _, _ ->
                        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                        intent.data = Uri.parse("package:${activity.packageName}")
                        activity.startActivity(intent)
                    }
                    .setNegativeButton("Cancelar") { _, _ -> onDenied() }
                    .show()
            }
            return
        }
        onGranted()
    }

    fun isDeviceOwner(): Boolean = try {
        val dpm = activity.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        dpm.isDeviceOwnerApp(activity.packageName)
    } catch (_: Throwable) {
        false
    }

    fun isInSilentWindow(): Boolean =
        isInSilentWindowAt(Calendar.getInstance().get(Calendar.HOUR_OF_DAY))

    // ================= UI / JS =================

    private fun activityAlive(): Boolean = try {
        !(activity.isFinishing || activity.isDestroyed)
    } catch (_: Throwable) {
        false
    }

    private fun runUi(block: () -> Unit) {
        handler.post { if (activityAlive()) block() }
    }

    private fun toast(msg: String, long: Boolean = false) {
        handler.post {
            if (activityAlive()) {
                Toast.makeText(activity, msg, if (long) Toast.LENGTH_LONG else Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun jsState(state: String, arg: String? = null) {
        evalJs(if (arg == null) "window.__updateStatus('$state')" else "window.__updateStatus('$state','$arg')")
    }

    private fun jsError(msg: String?) {
        jsState("error", (msg ?: "desconocido").replace("'", "\\'"))
    }

    companion object {
        const val TAG = "KioskoShell"
        const val UPDATE_API = "https://api.github.com/repos/sekaishopml/cyhotel-kiosko/releases/latest"
        const val GITHUB_OWNER = "sekaishopml"
        const val GITHUB_REPO = "cyhotel-kiosko"
        const val GITHUB_API_HOST = "api.github.com"
        const val GITHUB_ACCEPT = "application/vnd.github.v3+json"
        const val ACTION_INSTALL_COMMIT = "com.hoteldelvalle.kiosco.INSTALL_COMMIT"
        const val SILENT_START_HOUR = 2
        const val SILENT_END_HOUR = 4
        val GITHUB_TAG: Regex = Regex("^v\\d+\\.\\d+\\.\\d+$")
        private val IPV4: Regex = Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")
        private val LAN_SUFFIXES = listOf(".local", ".lan", ".home", ".internal")

        /** Asset exacto pineado: Kiosko-<tag>.apk del repo fijo. */
        fun buildGitHubAssetUrl(tag: String): String =
            "https://github.com/$GITHUB_OWNER/$GITHUB_REPO/releases/download/$tag/Kiosko-$tag.apk"

        fun isPinnedGitHubAssetUrl(url: String?, tag: String?): Boolean {
            if (url.isNullOrBlank() || tag.isNullOrBlank()) return false
            if (!GITHUB_TAG.matches(tag)) return false
            return url == buildGitHubAssetUrl(tag)
        }

        /** Comparación semver tolerante (sufijos no numéricos cuentan como 0). */
        fun compareSemver(a: String, b: String): Int {
            val ra = a.removePrefix("v").split(".")
            val lb = b.removePrefix("v").split(".")
            val n = maxOf(ra.size, lb.size)
            for (i in 0 until n) {
                val av = ra.getOrElse(i) { "0" }.toIntOrNull() ?: 0
                val bv = lb.getOrElse(i) { "0" }.toIntOrNull() ?: 0
                if (av != bv) return av.compareTo(bv)
            }
            return 0
        }

        /** Clásico: solo versiones estrictamente mayores (misma semántica que antes). */
        fun isVersionNewer(remote: String, local: String): Boolean =
            compareSemver(remote, local) > 0

        /**
         * Política Fase B: instala si remote != local Y remote >= minVersion
         * (permite downgrade dirigido a una versión buena, bloquea antiguas).
         * Sin minVersion: clásico [isVersionNewer].
         */
        fun shouldInstall(remoteVersion: String, localVersion: String, minVersion: String?): Boolean {
            if (compareSemver(remoteVersion, localVersion) == 0) return false
            val min = minVersion?.trim().orEmpty()
            return if (min.isEmpty()) {
                isVersionNewer(remoteVersion, localVersion)
            } else {
                compareSemver(remoteVersion, min) >= 0
            }
        }

        /**
         * Solo http(s) cuyo host sea IP literal, nombre LAN (corto, localhost,
         * .local/.lan/.home/.internal) o el dominio configurado (host de la
         * base del servidor). Todo lo demás se rechaza.
         */
        fun isServerApkUrlAllowed(apkUrl: String?, serverBase: String?): Boolean {
            if (apkUrl.isNullOrBlank()) return false
            val u = try {
                URL(apkUrl)
            } catch (_: Exception) {
                return false
            }
            if (u.protocol != "http" && u.protocol != "https") return false
            val host = (u.host ?: "").lowercase().trim().trimEnd('.')
            if (host.isEmpty()) return false
            try {
                val baseHost = serverBase?.let { URL(it).host?.lowercase()?.trim()?.trimEnd('.') }
                if (baseHost != null && host == baseHost) return true
            } catch (_: Exception) {}
            if (host == "localhost" || host == "::1" || host == "[::1]") return true
            if (":" in host) return true // literal IPv6
            if (IPV4.matches(host)) return true // IP literal (incluye la pública del server)
            if (!host.contains(".")) return true // nombre LAN corto (ej. kiosco-server)
            if (LAN_SUFFIXES.any { host.endsWith(it) }) return true
            return false
        }

        fun sha256Hex(file: File): String {
            val md = MessageDigest.getInstance("SHA-256")
            FileInputStream(file).use { input ->
                val buf = ByteArray(8192)
                var n: Int
                while (input.read(buf).also { n = it } != -1) md.update(buf, 0, n)
            }
            return md.digest().joinToString("") { "%02x".format(it) }
        }

        /** Ventana silenciosa 02:00-04:00 hora local (testeable por hora). */
        fun isInSilentWindowAt(hour: Int): Boolean =
            hour in SILENT_START_HOUR until SILENT_END_HOUR
    }
}
