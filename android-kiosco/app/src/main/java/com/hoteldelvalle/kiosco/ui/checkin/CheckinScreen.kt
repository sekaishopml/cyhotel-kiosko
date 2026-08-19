package com.hoteldelvalle.kiosco.ui.checkin

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hoteldelvalle.kiosco.data.api.ApiClient
import com.hoteldelvalle.kiosco.data.api.ApiException
import com.hoteldelvalle.kiosco.data.model.Order
import com.hoteldelvalle.kiosco.data.model.OrderRequest
import com.hoteldelvalle.kiosco.data.model.Plan
import com.hoteldelvalle.kiosco.data.model.RoomType
import com.hoteldelvalle.kiosco.ui.components.Stepper
import com.hoteldelvalle.kiosco.ui.theme.Crema
import com.hoteldelvalle.kiosco.ui.theme.ErrorRed
import com.hoteldelvalle.kiosco.ui.theme.Verde600
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White
import com.hoteldelvalle.kiosco.util.durationText
import com.hoteldelvalle.kiosco.util.money
import com.hoteldelvalle.kiosco.util.totalOf
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun CheckinScreen(
    plan: Plan,
    room: RoomType,
    extra: String?,
    days: Int,
    baseUrl: String,
    onBack: () -> Unit,
    onSuccess: (Order) -> Unit,
    modifier: Modifier = Modifier
) {
    var guestName by remember { mutableStateOf("") }
    var idDocument by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var showConfirmation by remember { mutableStateOf(false) }
    var confirmedOrder by remember { mutableStateOf<Order?>(null) }
    val scope = rememberCoroutineScope()

    val total = totalOf(plan.key, room.price, extra, days, room.extras)

    Box(modifier = modifier.fillMaxSize().background(White)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Atrás",
                        tint = Verde900
                    )
                }

                Stepper(
                    steps = listOf("Plan", "Habitación", "Check-in"),
                    currentStep = 2,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            SummaryCard(
                plan = plan,
                room = room,
                duration = durationText(plan.key, extra, days),
                total = total
            )

            Spacer(modifier = Modifier.height(24.dp))

            OutlinedTextField(
                value = guestName,
                onValueChange = { guestName = it },
                label = { Text("Nombre del huésped *") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = error != null && guestName.isBlank()
            )

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = idDocument,
                onValueChange = { idDocument = it },
                label = { Text("Documento de identidad (opcional)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
            )

            if (error != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = error!!,
                    color = ErrorRed,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                OutlinedButton(
                    onClick = onBack,
                    modifier = Modifier.height(48.dp),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text("Atrás", color = Verde900)
                }

                Spacer(modifier = Modifier.width(8.dp))

                Button(
                    onClick = {
                        if (guestName.isBlank()) {
                            error = "El nombre es obligatorio"
                            return@Button
                        }

                        isSubmitting = true
                        error = null

                        scope.launch {
                            try {
                                val request = OrderRequest(
                                    product = plan.key,
                                    roomType = room.key,
                                    guestName = guestName.trim(),
                                    idDocument = idDocument.trim().ifBlank { null },
                                    clientRef = "${idDocument.trim()}-${UUID.randomUUID()}",
                                    extra = extra,
                                    days = if (plan.key == "hospedaje") days else null
                                )
                                val response = ApiClient.createOrder(baseUrl, request)
                                if (response.order != null) {
                                    confirmedOrder = response.order
                                    showConfirmation = true
                                } else {
                                    error = response.error ?: "Error desconocido"
                                }
                            } catch (e: ApiException) {
                                error = e.message
                            } catch (e: Exception) {
                                error = "Error de conexión"
                            } finally {
                                isSubmitting = false
                            }
                        }
                    },
                    enabled = !isSubmitting,
                    modifier = Modifier.height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Verde900),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.height(20.dp).width(20.dp),
                            color = White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("Confirmar", color = White)
                    }
                }
            }
        }

        AnimatedVisibility(
            visible = showConfirmation,
            enter = fadeIn(tween(300)) + scaleIn(tween(300)),
            modifier = Modifier.fillMaxSize()
        ) {
            ConfirmationModal(
                order = confirmedOrder,
                onDismiss = {
                    showConfirmation = false
                    confirmedOrder?.let { onSuccess(it) }
                }
            )
        }
    }
}

@Composable
private fun SummaryCard(
    plan: Plan,
    room: RoomType,
    duration: String,
    total: Int?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Crema)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Resumen",
                style = MaterialTheme.typography.titleMedium,
                color = Verde900
            )

            Spacer(modifier = Modifier.height(12.dp))

            SummaryRow("Plan", plan.name)
            SummaryRow("Habitación", room.label)
            SummaryRow("Duración", duration)
            if (total != null) {
                SummaryRow("Total", money(total))
            }
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            color = Verde900
        )
    }
}

@Composable
private fun ConfirmationModal(
    order: Order?,
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.6f)),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.padding(32.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = White)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = Verde600,
                    modifier = Modifier.height(64.dp).width(64.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "¡Reserva confirmada!",
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 24.sp,
                    color = Verde900
                )

                Spacer(modifier = Modifier.height(16.dp))

                order?.let {
                    Text(
                        text = "Habitación ${it.roomNumber}",
                        style = MaterialTheme.typography.headlineMedium,
                        color = Verde900
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Check-in: ${it.checkIn ?: ""}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.Gray
                    )

                    Text(
                        text = "Check-out: ${it.checkOut ?: ""}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.Gray
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = money(it.amount?.toInt() ?: 0),
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 28.sp,
                        color = Verde900
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Verde900),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text("Cerrar", color = White)
                }
            }
        }
    }
}
