package com.hoteldelvalle.kiosco.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val KioskoColorScheme = lightColorScheme(
    primary = Verde900,
    onPrimary = White,
    primaryContainer = Verde600,
    onPrimaryContainer = White,
    secondary = Verde700,
    background = White,
    surface = White,
    onBackground = Ink,
    onSurface = Ink,
    error = ErrorRed
)

@Composable
fun KioskoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = KioskoColorScheme,
        typography = KioskoTypography,
        content = content
    )
}
