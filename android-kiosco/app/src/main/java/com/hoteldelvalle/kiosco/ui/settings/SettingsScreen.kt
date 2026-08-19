package com.hoteldelvalle.kiosco.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.hoteldelvalle.kiosco.data.Prefs
import com.hoteldelvalle.kiosco.ui.theme.ErrorRed
import com.hoteldelvalle.kiosco.ui.theme.SuccessGreen
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

@Composable
fun SettingsScreen(
    prefs: Prefs,
    onDismiss: () -> Unit
) {
    var url by remember { mutableStateOf(Prefs.DEFAULT_URL) }
    var pin by remember { mutableStateOf(Prefs.DEFAULT_PIN) }
    var isTesting by remember { mutableStateOf(false) }
    var testResult by remember { mutableStateOf<TestResult?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(White)
            .padding(24.dp)
    ) {
        Text(
            text = "Configuración",
            style = MaterialTheme.typography.headlineLarge,
            color = Verde900
        )

        Spacer(modifier = Modifier.height(24.dp))

        OutlinedTextField(
            value = url,
            onValueChange = { url = it },
            label = { Text("URL del servidor") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri)
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = pin,
            onValueChange = { if (it.length <= 6) pin = it },
            label = { Text("PIN de administrador") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = {
                isTesting = true
                testResult = null
                scope.launch {
                    testResult = testConnection(url)
                    isTesting = false
                }
            },
            enabled = !isTesting,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Verde900),
            shape = RoundedCornerShape(6.dp)
        ) {
            if (isTesting) {
                CircularProgressIndicator(
                    modifier = Modifier.height(20.dp),
                    color = White,
                    strokeWidth = 2.dp
                )
            } else {
                Text("Probar conexión", color = White)
            }
        }

        if (testResult != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = when (testResult) {
                    TestResult.SUCCESS -> "Conexión exitosa"
                    TestResult.ERROR -> "Error de conexión"
                    else -> ""
                },
                color = if (testResult == TestResult.SUCCESS) SuccessGreen else ErrorRed,
                style = MaterialTheme.typography.bodyMedium
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        Button(
            onClick = {
                scope.launch {
                    prefs.setUrl(url)
                    prefs.setPin(pin)
                    onDismiss()
                }
            },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Verde900),
            shape = RoundedCornerShape(6.dp)
        ) {
            Text("Guardar", color = White)
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = onDismiss,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(6.dp)
        ) {
            Text("Cancelar", color = Verde900)
        }
    }
}

private enum class TestResult {
    SUCCESS, ERROR
}

private suspend fun testConnection(baseUrl: String): TestResult {
    return try {
        val client = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .build()
        val request = Request.Builder()
            .url("$baseUrl/api/types?product=momento")
            .get()
            .build()
        val response = client.newCall(request).execute()
        if (response.code == 200) TestResult.SUCCESS else TestResult.ERROR
    } catch (e: Exception) {
        TestResult.ERROR
    }
}
