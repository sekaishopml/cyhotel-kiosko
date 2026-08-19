package com.hoteldelvalle.kiosco.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hoteldelvalle.kiosco.data.Prefs
import com.hoteldelvalle.kiosco.ui.theme.Verde900
import com.hoteldelvalle.kiosco.ui.theme.White
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun AdminButton(
    pin: String,
    prefs: Prefs,
    modifier: Modifier = Modifier
) {
    var tapCount by remember { mutableIntStateOf(0) }
    var showPinDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    if (showPinDialog) {
        PinDialog(
            onDismiss = { showPinDialog = false },
            onPinCorrect = { action ->
                showPinDialog = false
            },
            expectedPin = pin
        )
    }

    Box(
        modifier = modifier
            .size(48.dp)
            .alpha(0.5f)
            .clip(CircleShape)
            .background(Verde900)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {
                tapCount++
                if (tapCount >= 5) {
                    tapCount = 0
                    showPinDialog = true
                } else {
                    scope.launch {
                        delay(2000)
                        tapCount = 0
                    }
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "K",
            color = White,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
