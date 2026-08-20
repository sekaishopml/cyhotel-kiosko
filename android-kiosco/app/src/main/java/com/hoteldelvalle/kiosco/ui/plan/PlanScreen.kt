package com.hoteldelvalle.kiosco.ui.plan

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hoteldelvalle.kiosco.data.model.Plan
import com.hoteldelvalle.kiosco.ui.components.PlanCard
import com.hoteldelvalle.kiosco.ui.components.Stepper
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White

@Composable
fun PlanScreen(
    onPlanSelected: (Plan) -> Unit,
    onContinue: () -> Unit,
    selectedPlan: Plan?,
    modifier: Modifier = Modifier
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        visible = true
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(White)
    ) {
        Stepper(
            steps = listOf("Plan", "Habitación", "Check-in"),
            currentStep = 0,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 16.dp)
        )

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(bottom = 16.dp, top = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            itemsIndexed(Plan.PLANS) { index, plan ->
                AnimatedVisibility(
                    visible = visible,
                    enter = fadeIn(tween(400, delayMillis = index * 80)) +
                            slideInVertically(
                                tween(400, delayMillis = index * 80)
                            ) { it / 3 }
                ) {
                    PlanCard(
                        plan = plan,
                        isSelected = selectedPlan?.key == plan.key,
                        onClick = { onPlanSelected(plan) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
            FooterInfo()

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = onContinue,
                enabled = selectedPlan != null,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Verde900,
                    disabledContainerColor = Verde900.copy(alpha = 0.3f)
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = "Continuar",
                    color = White,
                    style = MaterialTheme.typography.titleMedium
                )
            }
        }
    }
}

@Composable
private fun FooterInfo() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = "⏰", fontSize = 14.sp)
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "Recepción 24 h",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray
        )
        Spacer(modifier = Modifier.width(12.dp))

        Text(text = "📶", fontSize = 14.sp)
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "WiFi gratuito",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray
        )
        Spacer(modifier = Modifier.width(12.dp))

        Text(text = "☕", fontSize = 14.sp)
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "Bebidas y piqueos",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray
        )
    }
}
