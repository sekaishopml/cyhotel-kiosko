package com.hoteldelvalle.kiosco

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class ApkUpdaterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ApkUpdater"

  private fun emitProgress(loaded: Long, total: Long) {
    val map = Arguments.createMap()
    map.putDouble("loaded", loaded.toDouble())
    map.putDouble("total", total.toDouble())
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("apkDownloadProgress", map)
  }

  @ReactMethod
  fun canInstall(promise: Promise) {
    val ctx = reactApplicationContext
    val can = if (Build.VERSION.SDK_INT >= 26) {
      ctx.packageManager.canRequestPackageInstalls()
    } else {
      true
    }
    promise.resolve(can)
  }

  @ReactMethod
  fun openInstallSettings(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val ctx = reactApplicationContext
        val intent = if (Build.VERSION.SDK_INT >= 26) {
          Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}"))
        } else {
          Intent(Intent.ACTION_INSTALL_PACKAGE)
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(intent)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("install_settings", e.message)
      }
    }
  }

  @ReactMethod
  fun downloadAndInstall(url: String, promise: Promise) {
    Thread {
      var conn: HttpURLConnection? = null
      try {
        val ctx = reactApplicationContext
        val target = File(ctx.cacheDir, "kiosco-update.apk")

        conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 30000
        conn.readTimeout = 120000
        conn.setRequestProperty("Accept", "application/vnd.android.package-archive")
        conn.connect()

        if (conn.responseCode !in 200..299) {
          throw IllegalStateException("HTTP ${conn.responseCode} — No se pudo descargar el APK")
        }

        val contentLength = conn.contentLength.toLong()
        if (contentLength <= 0L) {
          throw IllegalStateException("El servidor no informó el tamaño del archivo")
        }

        emitProgress(0, contentLength)

        var downloaded = 0L
        FileOutputStream(target).use { out ->
          conn.inputStream.use { inp ->
            val buf = ByteArray(64 * 1024)
            var read: Int
            while (inp.read(buf).also { read = it } != -1) {
              out.write(buf, 0, read)
              downloaded += read
              emitProgress(downloaded, contentLength)
            }
          }
        }

        if (target.length() != contentLength) {
          target.delete()
          throw IllegalStateException("Descarga incompleta: se esperaban ${contentLength} bytes, se recibieron ${target.length()}")
        }

        val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.fileprovider", target)
        val intent = Intent(Intent.ACTION_VIEW)
        intent.setDataAndType(uri, "application/vnd.android.package-archive")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        ctx.startActivity(intent)
        promise.resolve(true)
      } catch (e: ActivityNotFoundException) {
        promise.reject("no_installer", "Sin instalador de paquetes en el dispositivo")
      } catch (e: Exception) {
        promise.reject("download_failed", e.message ?: "Error al descargar")
      } finally {
        conn?.disconnect()
      }
    }.start()
  }
}
