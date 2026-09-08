package com.enigmaticphantasm.naturaltts.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = GreenPrimary,
    onPrimary = Color.White,
    secondary = GreenSecondary,
    tertiary = GreenTertiary,
    background = Cream,
    surface = Color.White,
    onBackground = Ink,
    onSurface = Ink,
    primaryContainer = Mint,
    onPrimaryContainer = GreenPrimary,
)

private val DarkColors = darkColorScheme(
    primary = GreenTertiary,
    onPrimary = Color.White,
    secondary = GreenSecondary,
    tertiary = Mint,
    background = Color(0xFF101412),
    surface = Color(0xFF1A1F1C),
    onBackground = Color(0xFFE8EEE9),
    onSurface = Color(0xFFE8EEE9),
    primaryContainer = GreenPrimary,
    onPrimaryContainer = Mint,
)

@Composable
fun NaturalReaderTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = Typography,
        content = content
    )
}
