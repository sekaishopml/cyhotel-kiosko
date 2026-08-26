package com.hoteldelvalle.kiosco

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

// Arranca el kiosco automáticamente al encender el dispositivo.
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED && context != null) {
            Log.i("KioskoShell", "BOOT_COMPLETED -> lanzando kiosco")
            val launch = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(launch)
        }
    }
}
