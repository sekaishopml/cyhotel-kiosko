package com.hoteldelvalle.kiosco.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.hoteldelvalle.kiosco.data.model.RoomType
import com.hoteldelvalle.kiosco.ui.theme.Crema
import com.hoteldelvalle.kiosco.ui.theme.Verde08
import com.hoteldelvalle.kiosco.ui.theme.Verde500
import com.hoteldelvalle.kiosco.ui.theme.Verde700
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White
import com.hoteldelvalle.kiosco.util.money

@Composable
fun RoomCard(
    room: RoomType,
    isSelected: Boolean,
    baseUrl: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor by animateColorAsState(
        targetValue = if (isSelected) Verde700 else White,
        animationSpec = tween(300),
        label = "roomBg"
    )

    val borderColor by animateColorAsState(
        targetValue = if (isSelected) Verde700 else Verde08,
        animationSpec = tween(300),
        label = "roomBorder"
    )

    val textColor = if (isSelected) White else Verde900

    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(116.dp)
            .border(2.dp, borderColor, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(modifier = Modifier.fillMaxHeight()) {
            AsyncImage(
                model = "$baseUrl${room.photo}",
                contentDescription = room.label,
                modifier = Modifier
                    .size(116.dp)
                    .clip(RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp)),
                contentScale = ContentScale.Crop
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(12.dp),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = room.label,
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = textColor,
                    maxLines = 2
                )

                Spacer(modifier = Modifier.height(4.dp))

                room.price?.let { price ->
                    Text(
                        text = money(price),
                        fontFamily = FontFamily.Serif,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isSelected) White else Verde700
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                if (room.free > 0) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(if (isSelected) White.copy(alpha = 0.2f) else Verde08)
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "${room.free} libres",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isSelected) White else Verde700
                        )
                    }
                }
            }
        }
    }
}
