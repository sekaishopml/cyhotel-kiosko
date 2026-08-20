package com.hoteldelvalle.kiosco

import android.app.ActivityManager
import android.app.Application
import android.content.Context
import android.opengl.GLES10
import android.os.Build
import android.os.Process
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun attachBaseContext(base: Context) {
    super.attachBaseContext(base)
    beacon("attachBaseContext")
  }

  override fun onCreate() {
    super.onCreate()
    installCrashHandler()
    beacon("onCreate", withFingerprint = true)
    SoLoader.init(this, OpenSourceMergedSoMapping)
    beacon("soloLoader")
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
  }

  fun beaconOnActivityCreated() {
    beacon("activityCreated")
  }

  private fun installCrashHandler() {
    try {
      val prev = Thread.getDefaultUncaughtExceptionHandler()
      Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
        try {
          beacon("uncaught:${thread.name}", extra = Log.getStackTraceString(throwable))
        } catch (ignored: Throwable) {
        }
        prev?.uncaughtException(thread, throwable)
      }
    } catch (ignored: Throwable) {
    }
  }

  private fun beacon(stage: String, withFingerprint: Boolean = false, extra: String? = null) {
    try {
      val body = StringBuilder()
      body.append("{\"app\":\"rn\",\"version\":\"6.0.2\",\"stage\":\"").append(stage).append("\"")
      body.append(",\"pid\":").append(Process.myPid())
      body.append(",\"time\":\"").append(java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ").format(java.util.Date())).append("\"")
      if (withFingerprint) {
        val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        var gl = "unknown"
        try {
          gl = GLES10.glGetString(GLES10.GL_RENDERER) ?: "null"
        } catch (ignored: Throwable) {
        }
        body.append(",\"fingerprint\":{")
        body.append("\"model\":\"").append(Build.MODEL).append("\"")
        body.append(",\"manufacturer\":\"").append(Build.MANUFACTURER).append("\"")
        body.append(",\"product\":\"").append(Build.PRODUCT).append("\"")
        body.append(",\"sdk\":").append(Build.VERSION.SDK_INT)
        body.append(",\"release\":\"").append(Build.VERSION.RELEASE).append("\"")
        body.append(",\"abis\":\"").append(Build.SUPPORTED_ABIS.joinToString(",")).append("\"")
        body.append(",\"abis32\":\"").append(Build.SUPPORTED_32_BIT_ABIS.joinToString(",")).append("\"")
        body.append(",\"abis64\":\"").append(Build.SUPPORTED_64_BIT_ABIS.joinToString(",")).append("\"")
        body.append(",\"totalMem\":").append(mi.totalMem)
        body.append(",\"maxHeap\":").append(Runtime.getRuntime().maxMemory())
        body.append(",\"gl\":\"").append(gl.replace("\"", "'")).append("\"")
        body.append("}")
      }
      if (extra != null) {
        body.append(",\"stack\":").append(quote(extra))
      }
      body.append("}")
      send(body.toString())
    } catch (ignored: Throwable) {
    }
  }

  private fun quote(s: String): String {
    val sb = StringBuilder("\"")
    for (c in s) {
      when (c) {
        '\\' -> sb.append("\\\\")
        '"' -> sb.append("\\\"")
        '\n' -> sb.append("\\n")
        '\r' -> sb.append("\\r")
        '\t' -> sb.append("\\t")
        else -> if (c.code < 32) sb.append(String.format("\\u%04x", c.code)) else sb.append(c)
      }
    }
    return sb.append("\"").toString()
  }

  private fun send(payload: String) {
    Thread {
      try {
        val url = URL("http://68.168.20.219:8000/api/kiosco-crash")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 4000
        conn.readTimeout = 4000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        OutputStreamWriter(conn.outputStream).use { it.write(payload) }
        conn.inputStream.use { it.readBytes() }
        conn.disconnect()
      } catch (ignored: Throwable) {
      }
    }.start()
  }
}