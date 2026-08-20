package com.hoteldelvalle.kiosco.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hoteldelvalle.kiosco.data.model.Plan
import com.hoteldelvalle.kiosco.ui.theme.Crema
import com.hoteldelvalle.kiosco.ui.theme.Negro
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
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

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
        targetValue = if (isPressed) 0.95f else if (isSelected) 0.98f else 1f,
        animationSpec = spring(dampingRatio = 0.6f),
        label = "cardScale"
    )

    val elevation by animateFloatAsState(
        targetValue = if (isPressed) 2f else 8f,
        animationSpec = tween(200),
        label = "cardElevation"
    )

    val borderModifier = if (isSelected) {
        Modifier.border(3.dp, Crema, RoundedCornerShape(16.dp))
    } else {
        Modifier
    }

    Card(
        modifier = modifier
            .scale(scale)
            .then(borderModifier)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation.dp)
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
                    shape = RoundedCornerShape(16.dp)
                )
                .padding(28.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = plan.name.uppercase(),
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.Bold,
                        fontSize = 38.sp,
                        color = White,
                        letterSpacing = 0.12.sp
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = plan.subtitle,
                        fontFamily = FontFamily.Default,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Medium,
                        color = White.copy(alpha = 0.8f)
                    )

                    if (plan.isHero && plan.badge != null) {
                        Spacer(modifier = Modifier.height(16.dp))

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(Crema)
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = plan.badge,
                                color = Verde900,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .border(
                            width = 2.dp,
                            color = White.copy(alpha = 0.3f),
                            shape = CircleShape
                        )
                        .background(Color.Transparent),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = plan.icon,
                        color = White,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
