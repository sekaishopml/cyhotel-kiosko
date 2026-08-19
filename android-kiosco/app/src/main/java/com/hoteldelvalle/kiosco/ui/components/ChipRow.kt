package com.hoteldelvalle.kiosco.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hoteldelvalle.kiosco.data.model.RoomType
import com.hoteldelvalle.kiosco.ui.theme.Verde15
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White
import com.hoteldelvalle.kiosco.util.money

@Composable
fun ChipRow(
    room: RoomType,
    product: String,
    selectedExtra: String?,
    selectedDays: Int,
    onExtraChange: (String?) -> Unit,
    onDaysChange: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Row(
        modifier = modifier.horizontalScroll(scrollState),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (product == "hospedaje") {
            (1..7).forEach { days ->
                val isActive = selectedDays == days
                val totalPrice = (room.price ?: 0) * days

                ChipItem(
                    text = "$days día${if (days > 1) "s" else ""} · ${money(totalPrice)}",
                    isActive = isActive,
                    onClick = { onDaysChange(days) }
                )
            }
        } else {
            val basePrice = room.price ?: 0

            ChipItem(
                text = "3 horas · ${money(basePrice)}",
                isActive = selectedExtra == null,
                onClick = { onExtraChange(null) }
            )

            room.extras["1h"]?.let { extra ->
                ChipItem(
                    text = "4 horas · ${money(basePrice + extra.price)}",
                    isActive = selectedExtra == "1h",
                    onClick = { onExtraChange("1h") }
                )
            }

            room.extras["6h"]?.let { extra ->
                ChipItem(
                    text = "6 horas · ${money(extra.price)}",
                    isActive = selectedExtra == "6h",
                    onClick = { onExtraChange("6h") }
                )
            }
        }
    }
}

@Composable
private fun ChipItem(
    text: String,
    isActive: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .height(36.dp)
            .clip(RoundedCornerShape(50))
            .background(if (isActive) Verde900 else White)
            .border(
                width = 1.dp,
                color = if (isActive) Verde900 else Verde15,
                shape = RoundedCornerShape(50)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = if (isActive) White else Verde900
        )
    }
}
