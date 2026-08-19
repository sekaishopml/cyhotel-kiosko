package com.hoteldelvalle.kiosco.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hoteldelvalle.kiosco.data.model.Plan
import com.hoteldelvalle.kiosco.ui.theme.Crema
import com.hoteldelvalle.kiosco.ui.theme.Negro
import com.hoteldelvalle.kiosco.ui.theme.Verde500
import com.hoteldelvalle.kiosco.ui.theme.Verde600
import com.hoteldelvalle.kiosco.ui.theme.Verde700
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White

@Composable
fun PlanCard(
    plan: Plan,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor by animateColorAsState(
        targetValue = when {
            plan.key == "suite" -> Negro
            plan.isHero -> Verde600
            else -> Verde900
        },
        animationSpec = tween(300),
        label = "cardBg"
    )

    val scale by animateFloatAsState(
        targetValue = if (isSelected) 0.98f else 1f,
        animationSpec = tween(200),
        label = "cardScale"
    )

    val borderModifier = if (isSelected) {
        Modifier.border(2.dp, Verde500, RoundedCornerShape(14.dp))
    } else {
        Modifier
    }

    Card(
        modifier = modifier
            .scale(scale)
            .then(borderModifier)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = if (plan.isHero && plan.key != "suite") {
                        Brush.horizontalGradient(
                            colors = listOf(Verde600, Verde700)
                        )
                    } else {
                        Brush.horizontalGradient(
                            colors = listOf(backgroundColor, backgroundColor)
                        )
                    },
                    shape = RoundedCornerShape(14.dp)
                )
                .padding(16.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = plan.name.uppercase(),
                            fontFamily = FontFamily.Serif,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 26.sp,
                            color = White,
                            letterSpacing = 0.1.sp
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Text(
                            text = plan.subtitle,
                            fontFamily = FontFamily.Default,
                            fontSize = 13.sp,
                            color = White.copy(alpha = 0.7f)
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .border(
                                width = 1.dp,
                                color = White.copy(alpha = 0.25f),
                                shape = CircleShape
                            )
                            .background(Color.Transparent),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = plan.icon,
                            color = White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                if (plan.isHero && plan.badge != null) {
                    Spacer(modifier = Modifier.height(12.dp))

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(Crema)
                            .padding(horizontal = 12.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = plan.badge,
                            color = Verde900,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
