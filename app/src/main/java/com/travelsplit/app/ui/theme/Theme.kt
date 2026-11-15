package com.travelsplit.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val Light = lightColorScheme(
    primary = Color(0xFF00796B),
    secondary = Color(0xFF4A635F),
    tertiary = Color(0xFF456179),
)
private val Dark = darkColorScheme(
    primary = Color(0xFF80CBC4),
    secondary = Color(0xFFB1CCC6),
    tertiary = Color(0xFFADCAE5),
)

/** Green for "is owed", red for "owes". */
val PositiveColor = Color(0xFF2E7D32)
val NegativeColor = Color(0xFFC62828)

@Composable
fun TravelSplitTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val scheme = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val ctx = LocalContext.current
            if (dark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        }
        dark -> Dark
        else -> Light
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
