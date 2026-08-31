package com.hoteldelvalle.kiosco

import android.app.Activity
import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : Activity() {

    private var webView: WebView? = null
    private val handler = Handler(Looper.getMainLooper())
    private var updateUrl: String? = null

    // Resiliencia: fallback local + watchdog 24/7
    private var pageLoaded = false
    private var pageError = false
    private var lastUrl: String? = null
    private var usingFallback = false
    private var embeddedFallbackUsed = false
    private var locked = false
    private val FALLBACK_TIMEOUT_MS = 6000L
    private val WATCHDOG_MS = 20000L

    companion object {
        const val PREFS = "kiosko_prefs"
        const val KEY_URL = "server_url"
        const val KEY_PIN = "exit_pin"
        const val DEFAULT_URL = "http://68.168.20.219:8000/kiosco/"
        const val DEFAULT_PIN = "12345"
        const val UPDATE_API = "https://api.github.com/repos/sekaishopml/cyhotel-kiosko/releases/latest"
        const val TAG = "KioskoShell"
        const val APP_VERSION = "1.2.3"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // CRÍTICO: setContentView ANTES de tocar insetsController.
        // En API 30+ window.insetsController lanza NPE si el decor aún no existe.
        setContentView(createLoadingScreen())

        installCrashReporter()
        logBoot("onCreate")
        startWatchdog()
        autoCheckUpdate()

        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val savedUrl = prefs.getString(KEY_URL, null)
        if (savedUrl == null) {
            logBoot("no hay URL guardada -> prompt")
            handler.post { promptServerUrl() }
        } else {
            logBoot("URL guardada -> cargando $savedUrl")
            handler.post { loadWebView(savedUrl) }
        }
    }

    private fun createLoadingScreen(): View {
        val tv = TextView(this).apply {
            text = "Hotel del Valle\n\nCargando kiosco..."
            textSize = 24f
            gravity = android.view.Gravity.CENTER
            setTextColor(Color.WHITE)
            setPadding(32, 32, 32, 32)
        }
        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#143A2A"))
        root.addView(tv, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        return root
    }

    // ================= DIAGNÓSTICO REMOTO =================

    private var bootLog = StringBuilder()

    private fun logBoot(msg: String) {
        bootLog.append("[${System.currentTimeMillis()}] $msg\n")
        Log.i(TAG, msg)
        try {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString("boot_log", bootLog.toString()).apply()
        } catch (_: Exception) {}
        sendServerLog(msg)
    }

    private fun serverBase(): String {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val url = prefs.getString(KEY_URL, DEFAULT_URL) ?: DEFAULT_URL
        return url.substringBefore("/kiosco").trimEnd('/').ifEmpty { DEFAULT_URL.substringBefore("/kiosco").trimEnd('/') }
    }

    private fun sendServerLog(msg: String) {
        thread {
            try {
                val base = serverBase()
                val c = URL("$base/api/kiosco-crash").openConnection() as HttpURLConnection
                c.requestMethod = "POST"
                c.doOutput = true
                c.connectTimeout = 5000
                c.readTimeout = 5000
                c.setRequestProperty("Content-Type", "application/json")
                val json = "{\"type\":\"boot\",\"msg\":${jsonEscape(msg)}," +
                        "\"sdk\":${Build.VERSION.SDK_INT},\"model\":${jsonEscape(Build.MODEL)},\"version\":\"$APP_VERSION\"}"
                OutputStreamWriter(c.outputStream).use { it.write(json) }
                c.inputStream.close()
                c.disconnect()
            } catch (_: Exception) {}
        }
    }

    private fun installCrashReporter() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val stack = Log.getStackTraceString(throwable)
                sendCrashReport("Thread: ${thread.name}\n${throwable.javaClass.name}: ${throwable.message}\n$stack")
            } catch (_: Exception) {
            } finally {
                previous?.uncaughtException(thread, throwable) ?: android.os.Process.killProcess(android.os.Process.myPid())
            }
        }
    }

    private fun sendCrashReport(report: String) {
        thread {
            try {
                val base = serverBase()
                val c = URL("$base/api/kiosco-crash").openConnection() as HttpURLConnection
                c.requestMethod = "POST"
                c.doOutput = true
                c.connectTimeout = 6000
                c.readTimeout = 6000
                c.setRequestProperty("Content-Type", "application/json")
                val json = "{\"type\":\"crash\",\"crash\":${jsonEscape(report)}," +
                        "\"sdk\":${Build.VERSION.SDK_INT},\"model\":${jsonEscape(Build.MODEL)},\"version\":\"$APP_VERSION\"," +
                        "\"log\":${jsonEscape(bootLog.toString())}}"
                OutputStreamWriter(c.outputStream).use { it.write(json) }
                c.inputStream.close()
                c.disconnect()
            } catch (_: Exception) {}
        }
    }

    private fun jsonEscape(s: String): String =
        "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\""

    private fun jsonExtract(json: String, key: String): String? {
        val idx = json.indexOf("\"$key\"")
        if (idx < 0) return null
        val s = json.indexOf("\"", idx + key.length + 2) + 1
        val e = json.indexOf("\"", s)
        return if (s > 0 && e > s) json.substring(s, e) else null
    }

    private fun isVersionNewer(remote: String, local: String): Boolean {
        val r = remote.removePrefix("v")
        val l = local.removePrefix("v")
        val rParts = r.split(".").map { it.toIntOrNull() ?: 0 }
        val lParts = l.split(".").map { it.toIntOrNull() ?: 0 }
        val maxLen = maxOf(rParts.size, lParts.size)
        for (i in 0 until maxLen) {
            val rv = rParts.getOrElse(i) { 0 }
            val lv = lParts.getOrElse(i) { 0 }
            if (rv > lv) return true
            if (rv < lv) return false
        }
        return false
    }

    // ================= KIOSK MODE =================

    private fun applyKioskMode() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                val ctrl = window.insetsController
                ctrl?.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                ctrl?.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    )
            }
        } catch (e: Throwable) {
            Log.w(TAG, "applyKioskMode fallo: ${e.message}")
        }
    }

    private fun exitKioskMode() {
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                window.insetsController?.show(
                    WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()
                )
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
            }
        } catch (e: Throwable) {
            Log.w(TAG, "exitKioskMode fallo: ${e.message}")
        }
    }

    // ================= WEBVIEW =================

    private fun loadWebView(url: String) {
        logBoot("loadWebView: $url")
        try {
            logBoot("Verificando WebView del sistema...")
            val pkg = getWebViewPackage()
            logBoot("WebView: ${pkg ?: "NO DISPONIBLE"}")
            if (pkg == null) {
                showFatal("WebView no disponible",
                    "Android System WebView no está instalado o está deshabilitado.\n\n" +
                    "1. Ajustes → Apps\n2. Busca 'Android System WebView'\n3. Habilítalo o actualízalo\n\n" +
                    "Modelo: ${Build.MODEL}\nAndroid ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
                return
            }

            webView?.let { wv ->
                try {
                    wv.stopLoading()
                    wv.loadDataWithBaseURL(null, "", "text/html", "utf-8", null)
                    (wv.parent as? android.view.ViewGroup)?.removeView(wv)
                    wv.destroy()
                } catch (_: Exception) {}
            }
            webView = null

            logBoot("Creando WebView...")
            val wv = WebView(this)
            webView = wv
            wv.settings.javaScriptEnabled = true
            wv.settings.domStorageEnabled = true
            wv.settings.databaseEnabled = true
            wv.settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            // Sin caché: los cambios del frontend en el server se ven de inmediato.
            wv.settings.cacheMode = WebSettings.LOAD_DEFAULT
            // Necesario para cargar la UI empaquetada localmente (file:///android_asset)
            wv.settings.allowFileAccess = true
            wv.settings.allowContentAccess = true

            pageLoaded = false
            pageError = false
            lastUrl = url

            wv.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = false

                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    pageLoaded = false
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    pageLoaded = true
                    pageError = false
                }

                override fun onReceivedError(view: WebView?, req: WebResourceRequest?, err: android.webkit.WebResourceError?) {
                    super.onReceivedError(view, req, err)
                    val failing = req?.url?.toString()
                    // Solo fallback si falla el frame principal (red/servidor inaccesible)
                    val isMainFrame = req?.isForMainFrame == true
                    if (!embeddedFallbackUsed && (isMainFrame || failing == lastUrl)) {
                        logBoot("WebView error ${err?.errorCode}: ${err?.description}")
                        pageError = true
                        handler.post { loadEmbedded() }
                    }
                }

                override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                    super.onReceivedHttpError(view, request, errorResponse)
                    // Error HTTP del frame principal (ej. 404/500 del server): fallback offline
                    if (!embeddedFallbackUsed && request?.isForMainFrame == true) {
                        logBoot("WebView HTTP error ${errorResponse?.statusCode}")
                        pageError = true
                        handler.post { loadEmbedded() }
                    }
                }
            }

            wv.addJavascriptInterface(object {
                @android.webkit.JavascriptInterface
                fun checkAndUpdate() {
                    checkAndUpdateFromWeb()
                }

                @android.webkit.JavascriptInterface
                fun exitApp() {
                    handler.post { finishAffinity() }
                }

                @android.webkit.JavascriptInterface
                fun getAppVersion(): String = APP_VERSION
            }, "Android")

            logBoot("Cargando URL...")
            wv.loadUrl(url)

            // Si en N segundos no cargó la página principal, usar UI local empaquetada.
            handler.removeCallbacks(fallbackRunnable)
            handler.postDelayed(fallbackRunnable, FALLBACK_TIMEOUT_MS)

            val container = FrameLayout(this)
            container.addView(wv, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ))
            setContentView(container)
            logBoot("WebView mostrado OK")
        } catch (e: Throwable) {
            logBoot("WebView FAIL: ${e.javaClass.name}: ${e.message}")
            showFatal("Error de WebView",
                "${e.javaClass.name}: ${e.message}\n\n" +
                "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})\nModelo: ${Build.MODEL}\n\n" +
                "Verifica que 'Android System WebView' esté habilitado y actualizado.\n\nDetalle:\n${Log.getStackTraceString(e)}")
        }
    }

    // ================= RESILIENCIA / FALLBACK LOCAL =================

    // Fallback a la UI empaquetada en el APK (funciona sin red).
    private val fallbackRunnable = Runnable {
        if (!pageLoaded && !usingFallback) {
            logBoot("Timeout cargando server -> fallback local")
            fallbackToLocal()
        }
    }

    private fun fallbackToLocal() {
        if (usingFallback) return
        usingFallback = true
        handler.removeCallbacks(fallbackRunnable)
        loadEmbedded()
    }

    // Carga la UI empaquetada en el APK (file:///android_asset, funciona sin red).
    private fun loadEmbedded() {
        // Protección anti-bucle: si el embebido también falla, no reintentar.
        if (embeddedFallbackUsed) return
        embeddedFallbackUsed = true
        usingFallback = true
        handler.removeCallbacks(fallbackRunnable)
        val base = serverBase()
        val url = "file:///android_asset/kiosco/index.html?api=$base"
        logBoot("Cargando fallback local embebido: $url")
        val wv = webView ?: return
        wv.stopLoading()
        wv.loadUrl(url)
    }

    // Watchdog 24/7: si la web se queda en blanco o con error, recarga/fallback.
    private fun startWatchdog() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                try {
                    val wv = webView
                    if (wv != null && !usingFallback && (pageError || wv.url == null)) {
                        logBoot("Watchdog: reintentando última URL")
                        if (lastUrl != null) wv.loadUrl(lastUrl!!)
                    }
                } catch (_: Throwable) {
                }
                handler.postDelayed(this, WATCHDOG_MS)
            }
        }, WATCHDOG_MS)
    }

    // Bloquea la app como quiosco si el dispositivo es Device Owner (single-app).
    private fun tryLockTask() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val cn = ComponentName(this, AdminReceiver::class.java)
            if (dpm.isDeviceOwnerApp(packageName)) {
                dpm.setLockTaskPackages(cn, arrayOf(packageName))
                if (!locked) {
                    startLockTask()
                    locked = true
                }
            }
        } catch (e: Throwable) {
            Log.w(TAG, "tryLockTask: ${e.message}")
        }
    }

    private fun getWebViewPackage(): String? {
        return try {
            if (Build.VERSION.SDK_INT >= 26) {
                val p = WebView.getCurrentWebViewPackage()
                if (p == null) null else {
                    val v = if (Build.VERSION.SDK_INT >= 28) p.longVersionCode else p.versionCode.toLong()
                    "${p.packageName} v$v"
                }
            } else {
                // API 23-25: verificar manualmente por nombre de paquete conocido
                val pm = packageManager
                val names = listOf("com.google.android.webview", "com.android.webview", "org.chromium.webview")
                names.firstOrNull { n ->
                    try { pm.getPackageInfo(n, 0); true } catch (e: PackageManager.NameNotFoundException) { false }
                }
            }
        } catch (e: Throwable) {
            null
        }
    }

    private fun showFatal(title: String, detail: String) {
        logBoot("FATAL: $title")
        sendCrashReport("$title\n$detail")
        handler.post {
            val tv = TextView(this).apply {
                text = "$title\n\n$detail"
                textSize = 18f
                setPadding(48, 48, 48, 48)
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.TRANSPARENT)
            }
            val scroll = ScrollView(this).apply {
                setBackgroundColor(Color.parseColor("#143A2A"))
                addView(tv)
            }
            setContentView(scroll)
        }
    }

    // ================= GESTOS / PIN =================

    override fun dispatchTouchEvent(ev: MotionEvent?): Boolean {
        return try {
            super.dispatchTouchEvent(ev)
        } catch (e: Exception) {
            false
        }
    }

    private fun promptServerUrl() {
        val input = EditText(this).apply {
            hint = "http://IP:8000/kiosco/"
            setText(DEFAULT_URL)
            setPadding(48, 32, 48, 32)
        }
        AlertDialog.Builder(this)
            .setTitle("Configurar servidor")
            .setMessage("Ingrese la URL del servidor kiosco")
            .setView(input)
            .setPositiveButton("Guardar") { _, _ ->
                val url = input.text.toString().trim()
                if (url.isNotEmpty()) {
                    getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit().putString(KEY_URL, url).apply()
                    logBoot("URL guardada: $url")
                    loadWebView(url)
                } else {
                    Toast.makeText(this, "URL no puede estar vacía", Toast.LENGTH_SHORT).show()
                    promptServerUrl()
                }
            }
            .setCancelable(false)
            .show()
    }

    // Chequeo automático y silencioso al arrancar: avisa si hay nueva versión.
    private fun autoCheckUpdate() {
        thread {
            try {
                // Intentar servidor local primero
                var found = false
                try {
                    val base = serverBase()
                    val c = URL("$base/api/kiosco-update").openConnection() as HttpURLConnection
                    c.connectTimeout = 5000
                    c.readTimeout = 5000
                    if (c.responseCode == 200) {
                        val body = c.inputStream.bufferedReader().readText()
                        c.disconnect()
                        val v = jsonExtract(body, "version")
                        if (v != null && isVersionNewer(v, APP_VERSION)) {
                            found = true
                            handler.post {
                                if (!isFinishing && !isDestroyed)
                                    Toast.makeText(this, "Nueva versión disponible: v$v", Toast.LENGTH_LONG).show()
                            }
                        }
                    } else { c.disconnect() }
                } catch (_: Exception) {}

                // Fallback: GitHub
                if (!found) {
                    val c = URL(UPDATE_API).openConnection() as HttpURLConnection
                    c.setRequestProperty("Accept", "application/vnd.github.v3+json")
                    c.connectTimeout = 10000
                    c.readTimeout = 10000
                    val code = c.responseCode
                    val body = if (code == 200) c.inputStream.bufferedReader().readText() else null
                    c.disconnect()
                    val tagName = body?.let { jsonExtract(it, "tag_name") }
                    if (tagName != null && isVersionNewer(tagName, "v$APP_VERSION")) {
                        handler.post {
                            if (!isFinishing && !isDestroyed)
                                Toast.makeText(this, "Nueva versión disponible: $tagName", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    private fun checkForUpdate() {
        Toast.makeText(this, "Buscando actualización...", Toast.LENGTH_SHORT).show()
        thread {
            try {
                var tagName: String? = null
                var apkUrl: String? = null
                var source = ""

                // Intentar servidor local primero
                try {
                    val base = serverBase()
                    val c = URL("$base/api/kiosco-update").openConnection() as HttpURLConnection
                    c.connectTimeout = 5000
                    c.readTimeout = 5000
                    if (c.responseCode == 200) {
                        val body = c.inputStream.bufferedReader().readText()
                        c.disconnect()
                        val v = jsonExtract(body, "version")
                        if (v != null && isVersionNewer(v, APP_VERSION)) {
                            tagName = "v$v"
                            apkUrl = jsonExtract(body, "download_url")
                            source = "servidor"
                        }
                    } else { c.disconnect() }
                } catch (_: Exception) {}

                // Fallback: GitHub
                if (tagName == null) {
                    try {
                        val c = URL(UPDATE_API).openConnection() as HttpURLConnection
                        c.setRequestProperty("Accept", "application/vnd.github.v3+json")
                        c.connectTimeout = 10000
                        c.readTimeout = 10000
                        val code = c.responseCode
                        val body = if (code == 200) c.inputStream.bufferedReader().readText() else null
                        c.disconnect()
                        tagName = body?.let { jsonExtract(it, "tag_name") }
                        if (tagName != null && isVersionNewer(tagName, "v$APP_VERSION")) {
                            apkUrl = "https://github.com/sekaishopml/cyhotel-kiosko/releases/download/$tagName/Kiosko-${tagName}.apk"
                            source = "GitHub"
                        } else {
                            tagName = null
                        }
                    } catch (_: Exception) {}
                }

                if (tagName != null && apkUrl != null) {
                    val url = apkUrl!!
                    val tag = tagName!!
                    val src = source
                    handler.post {
                        if (isFinishing || isDestroyed) return@post
                        AlertDialog.Builder(this)
                            .setTitle("Actualización disponible")
                            .setMessage("Nueva versión: $tag\n\nVersión actual: v$APP_VERSION\n\nFuente: $src\n\n¿Descargar e instalar?")
                            .setPositiveButton("Descargar") { _, _ -> downloadAndInstall(url, tag) }
                            .setNegativeButton("Cancelar", null)
                            .show()
                    }
                } else {
                    handler.post {
                        if (!isFinishing && !isDestroyed)
                            Toast.makeText(this, "Ya tienes la última versión: v$APP_VERSION", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                handler.post {
                    if (!isFinishing && !isDestroyed)
                        Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun checkAndUpdateFromWeb() {
        thread {
            try {
                evalJs("window.__updateStatus('checking')")

                // Intentar primero con el servidor local (siempre accesible en la red)
                var tagName: String? = null
                var apkUrl: String? = null
                var source = ""

                try {
                    val base = serverBase()
                    val c = URL("$base/api/kiosco-update").openConnection() as HttpURLConnection
                    c.connectTimeout = 5000
                    c.readTimeout = 5000
                    val code = c.responseCode
                    if (code == 200) {
                        val body = c.inputStream.bufferedReader().readText()
                        c.disconnect()
                        val serverVersion = jsonExtract(body, "version")
                        if (serverVersion != null && isVersionNewer(serverVersion, APP_VERSION)) {
                            tagName = "v$serverVersion"
                            apkUrl = jsonExtract(body, "download_url")
                            source = "servidor"
                        }
                    } else {
                        c.disconnect()
                    }
                } catch (_: Exception) {}

                // Fallback: GitHub API
                if (tagName == null) {
                    try {
                        val c = URL(UPDATE_API).openConnection() as HttpURLConnection
                        c.setRequestProperty("Accept", "application/vnd.github.v3+json")
                        c.connectTimeout = 10000
                        c.readTimeout = 10000
                        val code = c.responseCode
                        val body = if (code == 200) c.inputStream.bufferedReader().readText() else null
                        c.disconnect()
                        tagName = body?.let { jsonExtract(it, "tag_name") }
                        if (tagName != null && isVersionNewer(tagName, "v$APP_VERSION")) {
                            apkUrl = "https://github.com/sekaishopml/cyhotel-kiosko/releases/download/$tagName/Kiosko-${tagName}.apk"
                            source = "GitHub"
                        } else {
                            tagName = null
                        }
                    } catch (_: Exception) {}
                }

                if (tagName != null && apkUrl != null) {
                    val url = apkUrl!!
                    val tag = tagName!!
                    val src = source
                    evalJs("window.__updateStatus('available','$tag')")
                    handler.post {
                        if (isFinishing || isDestroyed) return@post
                        AlertDialog.Builder(this)
                            .setTitle("Actualización disponible")
                            .setMessage("Nueva versión: $tag\n\nVersión actual: v$APP_VERSION\n\nFuente: $src\n\n¿Descargar e instalar?")
                            .setPositiveButton("Descargar") { _, _ -> downloadAndInstallFromWeb(url, tag) }
                            .setNegativeButton("Cancelar") { _, _ -> evalJs("window.__updateStatus('cancelled')") }
                            .show()
                    }
                } else {
                    evalJs("window.__updateStatus('latest')")
                }
            } catch (e: Exception) {
                evalJs("window.__updateStatus('error','${e.message?.replace("'", "\\'")}')")
            }
        }
    }

    private fun downloadAndInstallFromWeb(apkUrl: String, tagName: String) {
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            handler.post {
                AlertDialog.Builder(this)
                    .setTitle("Permiso requerido")
                    .setMessage("Se necesita permiso para instalar apps.")
                    .setPositiveButton("Configurar") { _, _ ->
                        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                        intent.data = Uri.parse("package:$packageName")
                        startActivity(intent)
                    }
                    .setNegativeButton("Cancelar") { _, _ -> evalJs("window.__updateStatus('cancelled')") }
                    .show()
            }
            return
        }

        evalJs("window.__updateStatus('downloading', '0')")

        thread {
            var conn: HttpURLConnection? = null
            try {
                val url = URL(apkUrl)
                conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 30000
                conn.readTimeout = 60000
                val responseCode = conn.responseCode
                if (responseCode != 200) {
                    evalJs("window.__updateStatus('error','HTTP $responseCode')")
                    return@thread
                }

                val totalSize = conn.contentLength.toLong()
                val input: InputStream = conn.inputStream
                val dir = File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "kiosco")
                dir.mkdirs()
                val file = File(dir, "Kiosko-$tagName.apk")
                val output = FileOutputStream(file)

                val buffer = ByteArray(8192)
                var downloaded = 0L
                var read: Int
                while (input.read(buffer).also { read = it } != -1) {
                    output.write(buffer, 0, read)
                    downloaded += read
                    val pct = if (totalSize > 0) (downloaded * 100 / totalSize).toInt() else 0
                    evalJs("window.__updateStatus('downloading', '$pct')")
                }
                output.flush()
                output.close()
                input.close()
                conn.disconnect()

                logBoot("APK descargado: ${file.absolutePath} (${file.length()} bytes)")
                evalJs("window.__updateStatus('installing')")

                handler.post { installApk(file) }
            } catch (e: Exception) {
                logBoot("Error descargando APK: ${e.message}")
                evalJs("window.__updateStatus('error','${e.message?.replace("'", "\\'")}')")
            } finally {
                try { conn?.disconnect() } catch (_: Exception) {}
            }
        }
    }

    private fun evalJs(js: String) {
        handler.post {
            webView?.evaluateJavascript(js, null)
        }
    }

    private fun downloadAndInstall(apkUrl: String, tagName: String) {
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            handler.post {
                AlertDialog.Builder(this)
                    .setTitle("Permiso requerido")
                    .setMessage("Se necesita permiso para instalar apps. Abra la configuración y permita instalación de apps desconocidas.")
                    .setPositiveButton("Configurar") { _, _ ->
                        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                        intent.data = Uri.parse("package:$packageName")
                        startActivity(intent)
                    }
                    .setNegativeButton("Cancelar", null)
                    .show()
            }
            return
        }

        val progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        progressBar.max = 100
        progressBar.progress = 0

        val tv = TextView(this).apply {
            text = "Descargando $tagName..."
            textSize = 16f
            setPadding(48, 32, 48, 16)
            setTextColor(Color.WHITE)
        }

        val container = FrameLayout(this)
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

        val dialog = AlertDialog.Builder(this)
            .setTitle("Actualizando")
            .setView(container)
            .setCancelable(false)
            .create()

        handler.post { dialog.show() }

        thread {
            var conn: HttpURLConnection? = null
            try {
                val url = URL(apkUrl)
                conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 30000
                conn.readTimeout = 60000
                val code = conn.responseCode
                if (code != 200) {
                    handler.post {
                        dialog.dismiss()
                        Toast.makeText(this, "Error HTTP $code al descargar", Toast.LENGTH_LONG).show()
                    }
                    return@thread
                }

                val totalSize = conn.contentLength.toLong()
                val input: InputStream = conn.inputStream

                val dir = File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "kiosco")
                dir.mkdirs()
                val file = File(dir, "Kiosko-$tagName.apk")
                val output = FileOutputStream(file)

                val buffer = ByteArray(8192)
                var downloaded = 0L
                var read: Int
                while (input.read(buffer).also { read = it } != -1) {
                    output.write(buffer, 0, read)
                    downloaded += read
                    val progress = if (totalSize > 0) (downloaded * 100 / totalSize).toInt() else 0
                    handler.post { progressBar.progress = progress }
                }
                output.flush()
                output.close()
                input.close()
                conn.disconnect()

                logBoot("APK descargado: ${file.absolutePath} (${file.length()} bytes)")

                handler.post {
                    dialog.dismiss()
                    installApk(file)
                }
            } catch (e: Exception) {
                logBoot("Error descargando APK: ${e.message}")
                handler.post {
                    dialog.dismiss()
                    Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            } finally {
                try { conn?.disconnect() } catch (_: Exception) {}
            }
        }
    }

    private fun installApk(file: File) {
        try {
            val uri = if (Build.VERSION.SDK_INT >= 24) {
                androidx.core.content.FileProvider.getUriForFile(
                    this, "$packageName.fileprovider", file
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
            startActivity(intent)
        } catch (e: Exception) {
            logBoot("Error instalando APK: ${e.message}")
            Toast.makeText(this, "Error al instalar: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    override fun onBackPressed() {
        // Bloqueado en modo kiosco
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyKioskMode()
    }

    override fun onResume() {
        super.onResume()
        applyKioskMode()
        tryLockTask()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        try {
            if (locked) {
                stopLockTask()
                locked = false
            }
        } catch (_: Throwable) {
        }
        try {
            webView?.let { wv ->
                val parent = wv.parent
                if (parent is android.view.ViewGroup) parent.removeView(wv)
                wv.stopLoading()
                wv.destroy()
            }
        } catch (_: Exception) {
        }
        webView = null
    }
}