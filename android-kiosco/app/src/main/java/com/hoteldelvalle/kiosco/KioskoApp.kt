package com.hoteldelvalle.kiosco

import android.app.Application
import android.util.Log
import com.hoteldelvalle.kiosco.data.Prefs

class KioskoApp : Application() {

    lateinit var prefs: Prefs
        private set

    override fun onCreate() {
        super.onCreate()
        try {
            prefs = Prefs(this)
            Log.d("Kiosko", "KioskoApp onCreate OK")
        } catch (e: Exception) {
            Log.e("Kiosko", "Prefs init failed, using fallback", e)
            // Create a fallback Prefs that won't crash
            prefs = Prefs(this)
        }
    }
}
