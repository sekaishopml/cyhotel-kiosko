package com.hoteldelvalle.kiosco

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.hoteldelvalle.kiosco.data.Prefs
import com.hoteldelvalle.kiosco.navigation.KioskoNavGraph
import com.hoteldelvalle.kiosco.ui.components.AdminButton
import com.hoteldelvalle.kiosco.ui.theme.KioskoTheme
import com.hoteldelvalle.kiosco.util.KioskManager

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        KioskManager.enterKioskMode(this)

        setContent {
            KioskoTheme {
                val prefs = (application as KioskoApp).prefs
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
            KioskManager.reEnter(this)
        }
    }
}
