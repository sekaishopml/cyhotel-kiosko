package com.hoteldelvalle.kiosco

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.rememberNavController
import com.hoteldelvalle.kiosco.data.Prefs
import com.hoteldelvalle.kiosco.navigation.KioskoNavGraph
import com.hoteldelvalle.kiosco.ui.components.AdminButton
import com.hoteldelvalle.kiosco.ui.theme.Crema
import com.hoteldelvalle.kiosco.ui.theme.KioskoTheme
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White
import com.hoteldelvalle.kiosco.util.KioskManager
import com.hoteldelvalle.kiosco.util.UpdateChecker
import com.hoteldelvalle.kiosco.util.UpdateResult
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var prefs: Prefs

    @OptIn(ExperimentalMaterial3Api::class)
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
                val scope = rememberCoroutineScope()

                var updateResult by remember { mutableStateOf<UpdateResult?>(null) }
                var isCheckingUpdate by remember { mutableStateOf(false) }
                var showUpdateDialog by remember { mutableStateOf(false) }

                if (showUpdateDialog && updateResult != null) {
                    UpdateDialog(
                        result = updateResult!!,
                        isChecking = isCheckingUpdate,
                        onDownload = { url ->
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                startActivity(intent)
                            } catch (_: Exception) {}
                            showUpdateDialog = false
                        },
                        onCheckAgain = {
                            scope.launch {
                                isCheckingUpdate = true
                                updateResult = UpdateChecker.checkForUpdates(
                                    try { packageManager.getPackageInfo(packageName, 0).versionName } catch (_: Exception) { "0.0.0" } ?: "0.0.0"
                                )
                                isCheckingUpdate = false
                            }
                        },
                        onDismiss = { showUpdateDialog = false }
                    )
                }

                Scaffold(
                    topBar = {
                        TopAppBar(
                            title = {
                                Text(
                                    text = "Hotel del Valle",
                                    fontFamily = FontFamily.Serif,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 22.sp,
                                    letterSpacing = 0.14.sp
                                )
                            },
                            actions = {
                                IconButton(onClick = {
                                    showUpdateDialog = true
                                    if (updateResult == null) {
                                        scope.launch {
                                            isCheckingUpdate = true
                                            updateResult = UpdateChecker.checkForUpdates(
                                                try { packageManager.getPackageInfo(packageName, 0).versionName } catch (_: Exception) { "0.0.0" } ?: "0.0.0"
                                            )
                                            isCheckingUpdate = false
                                        }
                                    }
                                }) {
                                    Icon(
                                        imageVector = Icons.Default.Refresh,
                                        contentDescription = "Buscar actualización"
                                    )
                                }
                            },
                            colors = TopAppBarDefaults.topAppBarColors(
                                containerColor = Verde900,
                                titleContentColor = White,
                                actionIconContentColor = White
                            )
                        )
                    }
                ) { paddingValues ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(paddingValues)
                    ) {
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

@Composable
private fun UpdateDialog(
    result: UpdateResult,
    isChecking: Boolean,
    onDownload: (String) -> Unit,
    onCheckAgain: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (result.hasUpdate) "Actualización disponible" else "Kiosko al día",
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.SemiBold,
                color = Verde900
            )
        },
        text = {
            when {
                isChecking -> {
                    Text("Buscando actualizaciones...")
                }
                result.error != null -> {
                    Text("Error: ${result.error}")
                }
                result.hasUpdate -> {
                    Text(
                        "Versión actual: v${result.currentVersion}\n" +
                        "Nueva versión: v${result.latestVersion}\n\n" +
                        (result.releaseName?.let { "$it\n\n" } ?: "") +
                        "¿Deseas descargar la actualización?"
                    )
                }
                else -> {
                    Text("Ya tienes la última versión (v${result.currentVersion})")
                }
            }
        },
        confirmButton = {
            when {
                isChecking -> {}
                result.hasUpdate && result.downloadUrl != null -> {
                    Button(
                        onClick = { onDownload(result.downloadUrl!!) },
                        colors = ButtonDefaults.buttonColors(containerColor = Verde900)
                    ) {
                        Text("Descargar", color = White)
                    }
                }
                result.error != null -> {
                    TextButton(onClick = onCheckAgain) {
                        Text("Reintentar", color = Verde900)
                    }
                }
                else -> {
                    TextButton(onClick = onDismiss) {
                        Text("Cerrar", color = Verde900)
                    }
                }
            }
        },
        dismissButton = {
            if (!isChecking) {
                TextButton(onClick = onDismiss) {
                    Text("Cancelar", color = Verde900)
                }
            }
        }
    )
}
