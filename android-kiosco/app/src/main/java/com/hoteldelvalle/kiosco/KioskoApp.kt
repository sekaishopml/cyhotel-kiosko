// Dep: DataStore vía Prefs
package com.hoteldelvalle.kiosco

import android.app.Application
import com.hoteldelvalle.kiosco.data.Prefs

class KioskoApp : Application() {

    lateinit var prefs: Prefs
        private set

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
    }
}
