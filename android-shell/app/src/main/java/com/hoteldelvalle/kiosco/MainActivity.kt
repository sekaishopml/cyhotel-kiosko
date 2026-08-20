package com.hoteldelvalle.kiosco

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
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
import android.widget.Toast
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : Activity() {

    private lateinit var webView: WebView
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
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyKioskMode()

        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val savedUrl = prefs.getString(KEY_URL, null)

        if (savedUrl == null) {
            promptServerUrl()
        } else {
            loadWebView(savedUrl)
        }
    }

    private fun applyKioskMode() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        if (android.os.Build.VERSION.SDK_INT >= 30) {
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

    private fun loadWebView(url: String) {
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.allowFileAccess = false
            settings.allowContentAccess = false

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    return false
                }
            }
            loadUrl(url)
        }

        val tapZone = View(this).apply {
            setBackgroundColor(0x00000000)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        }

        tapZone.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_DOWN) {
                handleTap()
            }
            false
        }

        val container = FrameLayout(this)
        container.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        container.addView(tapZone, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        setContentView(container)
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
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or
                    android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
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
        if (android.os.Build.VERSION.SDK_INT >= 30) {
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
                        val currentVersion = "1.0.0"
                        val msg = if (tagName != "v$currentVersion") {
                            updateUrl = htmlUrl
                            "Nueva versión disponible: $tagName\n\nVersión actual: v$currentVersion"
                        } else {
                            "Ya tienes la última versión: v$currentVersion"
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
}
