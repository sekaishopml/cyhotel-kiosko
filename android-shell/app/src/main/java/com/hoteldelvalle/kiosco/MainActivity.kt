package com.hoteldelvalle.kiosco

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : Activity() {

    private var webView: WebView? = null
    private val handler = Handler(Looper.getMainLooper())
    private var tapCount = 0
    private var lastTapTime = 0L
    private val tapTimeout = 2000L
    private val tapsRequired = 5
    private var updateUrl: String? = null

    companion object {
        const val PREFS = "kiosko_prefs"
        const val KEY_URL = "server_url"
        const val KEY_PIN = "exit_pin"
        const val DEFAULT_URL = "http://68.168.20.219:8000/kiosco"
        const val DEFAULT_PIN = "12345"
        const val UPDATE_API = "https://api.github.com/repos/sekaishopml/cyhotel-kiosko/releases/latest"
        const val TAG = "KioskoShell"
        const val APP_VERSION = "2.1.0"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installCrashReporter()
        logStep("onCreate")
        applyKioskMode()

        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val savedUrl = prefs.getString(KEY_URL, null)

        if (savedUrl == null) {
            logStep("no saved url -> prompt")
            promptServerUrl()
        } else {
            logStep("saved url -> load $savedUrl")
            loadWebView(savedUrl)
        }
    }

    // ============ DIAGNÓSTICO REMOTO ============

    private var logBuffer = StringBuilder()

    private fun logStep(msg: String) {
        val line = "[${System.currentTimeMillis()}] $msg\n"
        logBuffer.append(line)
        try {
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            prefs.edit().putString("boot_log", logBuffer.toString()).apply()
        } catch (_: Exception) {}
        Log.i(TAG, msg)
        sendServerLog("boot", msg)
    }

    private fun sendServerLog(type: String, msg: String) {
        thread {
            try {
                val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val serverUrl = prefs.getString(KEY_URL, DEFAULT_URL) ?: DEFAULT_URL
                val base = serverUrl.substringBefore("/kiosco").trimEnd('/')
                if (base.isEmpty()) return@thread
                val connection = URL("$base/api/kiosco-crash").openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.connectTimeout = 6000
                connection.readTimeout = 6000
                connection.setRequestProperty("Content-Type", "application/json")
                val json = "{\"type\":\"${jsonEscape(type)}\",\"msg\":${jsonEscape(msg)}," +
                        "\"sdk\":${Build.VERSION.SDK_INT},\"model\":${jsonEscape(Build.MODEL)}," +
                        "\"version\":\"$APP_VERSION\"}"
                OutputStreamWriter(connection.outputStream).use { it.write(json) }
                connection.inputStream.close()
                connection.disconnect()
            } catch (_: Exception) {}
        }
    }

    private fun installCrashReporter() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val stack = Log.getStackTraceString(throwable)
                val report = "Thread: ${thread.name}\n${throwable.javaClass.name}: ${throwable.message}\n$stack"
                sendCrashReport(report)
            } catch (_: Exception) {
            } finally {
                previous?.uncaughtException(thread, throwable) ?: run {
                    android.os.Process.killProcess(android.os.Process.myPid())
                }
            }
        }
    }

    private fun sendCrashReport(report: String) {
        try {
            val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val serverUrl = prefs.getString(KEY_URL, DEFAULT_URL) ?: DEFAULT_URL
            val base = serverUrl.substringBefore("/kiosco").trimEnd('/')
            if (base.isEmpty()) return
            val connection = URL("$base/api/kiosco-crash").openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.setRequestProperty("Content-Type", "application/json")
            val json = "{\"type\":\"crash\",\"crash\":${jsonEscape(report)}," +
                    "\"sdk\":${Build.VERSION.SDK_INT},\"model\":${jsonEscape(Build.MODEL)}," +
                    "\"version\":\"$APP_VERSION\",\"log\":${jsonEscape(logBuffer.toString())}}"
            OutputStreamWriter(connection.outputStream).use { it.write(json) }
            connection.inputStream.close()
            connection.disconnect()
        } catch (_: Exception) {
        }
    }

    private fun jsonEscape(s: String): String =
        "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\""

    // ============ UI / KIOSK ============

    private fun applyKioskMode() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= 30) {
            window.insetsController?.let { ctrl ->
                ctrl.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                ctrl.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
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
    }

    private fun restoreKioskMode() {
        applyKioskMode()
    }

    private fun showFatalError(title: String, detail: String) {
        logStep("FATAL: $title - $detail")
        sendCrashReport("$title\n$detail")
        val scroll = ScrollView(this)
        val tv = TextView(this).apply {
            text = "$title\n\n$detail"
            textSize = 18f
            setPadding(48, 48, 48, 48)
            setTextColor(Color.WHITE)
        }
        scroll.addView(tv)
        scroll.setBackgroundColor(Color.parseColor("#143A2A"))
        setContentView(scroll)
    }

    private fun loadWebView(url: String) {
        logStep("loadWebView: $url")
        try {
            logStep("verificando WebView del sistema...")
            val wvPackage = WebView.getCurrentWebViewPackage()
            logStep("WebView package: ${wvPackage?.packageName} v${wvPackage?.longVersionCode}")
            if (wvPackage == null) {
                logStep("WebView NO disponible")
                showFatalError(
                    "WebView no disponible",
                    "Android System WebView no está instalado o está deshabilitado.\n\n" +
                            "1. Abre Ajustes → Apps\n" +
                            "2. Busca 'Android System WebView' o 'WebView'\n" +
                            "3. Habilítalo o actualízalo desde Play Store\n\n" +
                            "Modelo: ${Build.MODEL}\nAndroid ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})"
                )
                return
            }
            logStep("creando WebView...")
            val wv = WebView(this)
            webView = wv
            logStep("WebView creado OK")
            wv.settings.javaScriptEnabled = true
            wv.settings.domStorageEnabled = true
            wv.settings.databaseEnabled = true
            wv.settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            wv.settings.cacheMode = WebSettings.LOAD_DEFAULT
            wv.settings.allowFileAccess = false
            wv.settings.allowContentAccess = false

            wv.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    return false
                }
            }
            logStep("configurando WebView OK, cargando URL...")
            wv.loadUrl(url)
            logStep("URL cargada: $url")

            val container = FrameLayout(this)
            container.addView(wv, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ))
            setContentView(container)
            logStep("setContentView OK")
        } catch (e: Throwable) {
            logStep("WebView FAIL: ${e.javaClass.name}: ${e.message}")
            showFatalError(
                "Error de WebView",
                "No se pudo inicializar WebView:\n${e.javaClass.name}: ${e.message}\n\n" +
                        "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})\nModelo: ${Build.MODEL}\n\n" +
                        "Verifica en Ajustes → Apps que 'Android System WebView' esté habilitado y actualizado.\n\n" +
                        "Detalle técnico:\n${Log.getStackTraceString(e)}"
            )
        }
    }

    override fun dispatchTouchEvent(ev: MotionEvent?): Boolean {
        if (ev != null && ev.action == MotionEvent.ACTION_DOWN) {
            handleTap()
        }
        return try {
            super.dispatchTouchEvent(ev)
        } catch (e: Exception) {
            false
        }
    }

    private fun handleTap() {
        val now = System.currentTimeMillis()
        if (now - lastTapTime > tapTimeout) {
            tapCount = 0
        }
        lastTapTime = now
        tapCount++
        if (tapCount >= tapsRequired) {
            tapCount = 0
            promptPin()
        }
    }

    private fun promptServerUrl() {
        val input = EditText(this).apply {
            hint = "http://IP:8000/kiosco"
            setText(DEFAULT_URL)
            setPadding(48, 32, 48, 32)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
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
                    logStep("URL guardada: $url")
                    loadWebView(url)
                } else {
                    Toast.makeText(this, "URL no puede estar vacía", Toast.LENGTH_SHORT).show()
                    promptServerUrl()
                }
            }
            .setCancelable(false)
            .show()
    }

    private fun promptPin() {
        val input = EditText(this).apply {
            hint = "PIN"
            inputType = InputType.TYPE_CLASS_NUMBER or
                    InputType.TYPE_NUMBER_VARIATION_PASSWORD
            setPadding(48, 32, 48, 32)
        }
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val expectedPin = prefs.getString(KEY_PIN, DEFAULT_PIN) ?: DEFAULT_PIN

        AlertDialog.Builder(this)
            .setTitle("PIN de administrador")
            .setView(input)
            .setPositiveButton("Aceptar") { _, _ ->
                if (input.text.toString() == expectedPin) {
                    showAdminMenu()
                } else {
                    Toast.makeText(this, "PIN incorrecto", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun showAdminMenu() {
        val items = arrayOf("Configurar servidor", "Buscar actualización", "Salir del quiosco")
        AlertDialog.Builder(this)
            .setTitle("Administración")
            .setItems(items) { _, which ->
                when (which) {
                    0 -> promptServerUrl()
                    1 -> checkForUpdate()
                    2 -> {
                        exitKioskMode()
                        finish()
                    }
                }
            }
            .show()
    }

    private fun exitKioskMode() {
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= 30) {
            window.insetsController?.show(
                WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars()
            )
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        }
    }

    private fun checkForUpdate() {
        Toast.makeText(this, "Buscando actualización...", Toast.LENGTH_SHORT).show()
        thread {
            try {
                val connection = URL(UPDATE_API).openConnection() as HttpURLConnection
                connection.setRequestProperty("Accept", "application/vnd.github.v3+json")
                connection.connectTimeout = 10000
                connection.readTimeout = 10000
                val responseCode = connection.responseCode
                val body = if (responseCode == 200) {
                    connection.inputStream.bufferedReader().readText()
                } else {
                    null
                }
                connection.disconnect()

                val tagName = body?.let { json ->
                    val idx = json.indexOf("\"tag_name\"")
                    if (idx >= 0) {
                        val start = json.indexOf("\"", idx + 11) + 1
                        val end = json.indexOf("\"", start)
                        json.substring(start, end)
                    } else null
                }

                val htmlUrl = body?.let { json ->
                    val idx = json.indexOf("\"html_url\"")
                    if (idx >= 0) {
                        val start = json.indexOf("\"", idx + 10) + 1
                        val end = json.indexOf("\"", start)
                        json.substring(start, end)
                    } else null
                }

                handler.post {
                    if (tagName != null) {
                        val msg = if (tagName != "v$APP_VERSION") {
                            updateUrl = htmlUrl
                            "Nueva versión disponible: $tagName\n\nVersión actual: v$APP_VERSION"
                        } else {
                            "Ya tienes la última versión: v$APP_VERSION"
                        }
                        AlertDialog.Builder(this)
                            .setTitle("Actualización")
                            .setMessage(msg)
                            .setPositiveButton("OK", null)
                            .show()
                    } else {
                        Toast.makeText(this, "No se pudo verificar actualización", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                handler.post {
                    Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    override fun onBackPressed() {
        // Blocked in kiosk mode
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            applyKioskMode()
        }
    }

    override fun onResume() {
        super.onResume()
        applyKioskMode()
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            webView?.stopLoading()
            webView?.destroy()
        } catch (_: Exception) {
        }
    }
}