package com.hoteldelvalle.kiosco.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.hoteldelvalle.kiosco.ui.theme.ErrorRed
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White

@Composable
fun PinDialog(
    onDismiss: () -> Unit,
    onPinCorrect: (action: String) -> Unit,
    expectedPin: String
) {
    var pin by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }
    var showOptions by remember { mutableStateOf(false) }

    if (showOptions) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = {
                Text(
                    text = "Admin",
                    style = MaterialTheme.typography.titleLarge,
                    color = Verde900
                )
            },
            text = {
                Column {
                    Button(
                        onClick = { onPinCorrect("settings") },
                        colors = ButtonDefaults.buttonColors(containerColor = Verde900),
                        modifier = Modifier.height(48.dp)
                    ) {
                        Text("Configurar servidor", color = White)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedButton(
                        onClick = { onPinCorrect("exit") },
                        modifier = Modifier.height(48.dp)
                    ) {
                        Text("Salir del quiosco", color = Verde900)
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Cancelar", color = Verde900)
                }
            }
        )
    } else {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = {
                Text(
                    text = "PIN de administrador",
                    style = MaterialTheme.typography.titleLarge,
                    color = Verde900
                )
            },
            text = {
                Column {
                    OutlinedTextField(
                        value = pin,
                        onValueChange = {
                            if (it.length <= 6) {
                                pin = it
                                isError = false
                            }
                        },
                        label = { Text("Ingrese PIN") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        isError = isError,
                        supportingText = if (isError) {
                            { Text("PIN incorrecto", color = ErrorRed) }
                        } else null
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (pin == expectedPin) {
                            showOptions = true
                        } else {
                            isError = true
                            pin = ""
                        }
                    }
                ) {
                    Text("Aceptar", color = Verde900)
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Cancelar", color = Verde900)
                }
            }
        )
    }
}
