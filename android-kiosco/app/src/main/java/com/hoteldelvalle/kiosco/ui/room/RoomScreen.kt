package com.hoteldelvalle.kiosco.ui.room

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.hoteldelvalle.kiosco.data.api.ApiClient
import com.hoteldelvalle.kiosco.data.api.ApiException
import com.hoteldelvalle.kiosco.data.model.Plan
import com.hoteldelvalle.kiosco.data.model.RoomType
import com.hoteldelvalle.kiosco.ui.components.ChipRow
import com.hoteldelvalle.kiosco.ui.components.ErrorOverlay
import com.hoteldelvalle.kiosco.ui.components.RoomCard
import com.hoteldelvalle.kiosco.ui.components.ShimmerRoomCard
import com.hoteldelvalle.kiosco.ui.components.Stepper
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White
import com.hoteldelvalle.kiosco.util.money
import com.hoteldelvalle.kiosco.util.totalOf
import kotlinx.coroutines.launch

@Composable
fun RoomScreen(
    plan: Plan,
    onBack: () -> Unit,
    onContinue: () -> Unit,
    onRoomSelected: (RoomType) -> Unit,
    onExtraSelected: (String?) -> Unit,
    onDaysChanged: (Int) -> Unit,
    baseUrl: String,
    modifier: Modifier = Modifier
) {
    var rooms by remember { mutableStateOf<List<RoomType>>(emptyList()) }
    var selectedRoom by remember { mutableStateOf<RoomType?>(null) }
    var selectedExtra by remember { mutableStateOf<String?>(null) }
    var selectedDays by remember { mutableIntStateOf(1) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(plan.key) {
        isLoading = true
        error = null
        try {
            val response = ApiClient.getTypes(baseUrl, plan.key)
            rooms = response.types.filter { it.eligible }
        } catch (e: ApiException) {
            error = e.message
        } catch (e: Exception) {
            error = "Error de conexión"
        } finally {
            isLoading = false
        }
    }

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
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Atrás",
                        tint = Verde900
                    )
                }

                Stepper(
                    steps = listOf("Plan", "Habitación", "Check-in"),
                    currentStep = 1,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (isLoading) {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    contentPadding = PaddingValues(bottom = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(3) {
                        ShimmerRoomCard()
                    }
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(bottom = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(rooms) { room ->
                        RoomCard(
                            room = room,
                            isSelected = selectedRoom?.key == room.key,
                            baseUrl = baseUrl,
                            onClick = {
                                selectedRoom = room
                                selectedExtra = null
                                selectedDays = 1
                                onRoomSelected(room)
                                onExtraSelected(null)
                                onDaysChanged(1)
                            }
                        )
                    }
                }
            }
        }

        if (selectedRoom != null) {
            DockBar(
                room = selectedRoom!!,
                product = plan.key,
                selectedExtra = selectedExtra,
                selectedDays = selectedDays,
                onExtraChange = { selectedExtra = it; onExtraSelected(it) },
                onDaysChange = { selectedDays = it; onDaysChanged(it) },
                onBack = onBack,
                onContinue = onContinue,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        ErrorOverlay(
            message = error ?: "",
            onRetry = {
                scope.launch {
                    isLoading = true
                    error = null
                    try {
                        val response = ApiClient.getTypes(baseUrl, plan.key)
                        rooms = response.types.filter { it.eligible }
                    } catch (e: ApiException) {
                        error = e.message
                    } catch (e: Exception) {
                        error = "Error de conexión"
                    } finally {
                        isLoading = false
                    }
                }
            },
            visible = error != null
        )
    }
}

@Composable
private fun DockBar(
    room: RoomType,
    product: String,
    selectedExtra: String?,
    selectedDays: Int,
    onExtraChange: (String?) -> Unit,
    onDaysChange: (Int) -> Unit,
    onBack: () -> Unit,
    onContinue: () -> Unit,
    modifier: Modifier = Modifier
) {
    val total = totalOf(product, room.price, selectedExtra, selectedDays, room.extras)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(White)
            .padding(horizontal = 24.dp, vertical = 12.dp)
    ) {
        if (room.extras.isNotEmpty() || product == "hospedaje") {
            ChipRow(
                room = room,
                product = product,
                selectedExtra = selectedExtra,
                selectedDays = selectedDays,
                onExtraChange = onExtraChange,
                onDaysChange = onDaysChange
            )

            Spacer(modifier = Modifier.height(8.dp))
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (total != null) money(total) else "",
                style = MaterialTheme.typography.headlineMedium,
                color = Verde900
            )

            Row {
                OutlinedButton(
                    onClick = onBack,
                    modifier = Modifier.height(48.dp),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text("Atrás", color = Verde900)
                }

                Spacer(modifier = Modifier.width(8.dp))

                Button(
                    onClick = onContinue,
                    modifier = Modifier.height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Verde900),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Text("Continuar", color = White)
                }
            }
        }
    }
}
