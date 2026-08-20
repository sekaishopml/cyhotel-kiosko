package com.hoteldelvalle.kiosco.ui.plan

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.hoteldelvalle.kiosco.data.model.Plan
import com.hoteldelvalle.kiosco.ui.components.PlanCard
import com.hoteldelvalle.kiosco.ui.theme.White

@Composable
fun PlanScreen(
    onPlanSelected: (Plan) -> Unit,
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
        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(bottom = 24.dp, top = 4.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            itemsIndexed(Plan.PLANS) { index, plan ->
                AnimatedVisibility(
                    visible = visible,
                    enter = fadeIn(tween(500, delayMillis = index * 100)) +
                            slideInVertically(
                                tween(500, delayMillis = index * 100)
                            ) { it / 4 }
                ) {
                    PlanCard(
                        plan = plan,
                        isSelected = false,
                        onClick = { onPlanSelected(plan) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}
