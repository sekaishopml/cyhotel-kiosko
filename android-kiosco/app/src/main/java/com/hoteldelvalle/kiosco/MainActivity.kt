package com.hoteldelvalle.kiosco

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.hoteldelvalle.kiosco.data.Prefs
import com.hoteldelvalle.kiosco.navigation.KioskoNavGraph
import com.hoteldelvalle.kiosco.ui.components.AdminButton
import com.hoteldelvalle.kiosco.ui.theme.KioskoTheme
import com.hoteldelvalle.kiosco.util.KioskManager

class MainActivity : ComponentActivity() {

    private lateinit var prefs: Prefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            KioskManager.enterKioskMode(this)
        } catch (e: Exception) {
            Log.e("Kiosko", "KioskManager failed", e)
        }

        prefs = (application as KioskoApp).prefs

        setContent {
            KioskoTheme {
                val baseUrl by prefs.serverUrl.collectAsState(initial = Prefs.DEFAULT_URL)
                val pin by prefs.pin.collectAsState(initial = Prefs.DEFAULT_PIN)

                Box(modifier = Modifier.fillMaxSize()) {
                    KioskoNavGraph(
                        navController = rememberNavController(),
                        baseUrl = baseUrl,
                        prefs = prefs
                    )

                    AdminButton(
                        modifier = Modifier.align(Alignment.BottomEnd),
                        pin = pin,
                        prefs = prefs
                    )
                }
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            try {
                KioskManager.reEnter(this)
            } catch (_: Exception) {}
        }
    }
}
