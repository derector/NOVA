package io.nova.app.ui

import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import java.time.LocalDate
import kotlin.math.PI
import kotlin.math.sin
import kotlin.random.Random

internal val NovaMint = Color(0xFF70E1C1)
internal val NovaGraphite = Color(0xFF101722)

internal enum class NovaTint(val label: String, val light: Color, val dark: Color) {
    EMERALD("Изумруд", Color(0xFF17654F), NovaMint),
    ICE("Лёд", Color(0xFF226385), Color(0xFF9DDBF8)),
    RUBY("Рубин", Color(0xFF932E53), Color(0xFFFFAEC8)),
    AMETHYST("Аметист", Color(0xFF6A42A7), Color(0xFFD4BAFF)),
    AMBER("Янтарь", Color(0xFF874B10), Color(0xFFFFD195)),
}

internal enum class NovaThemeMode(val label: String) {
    SYSTEM("Системная"), LIGHT("Светлая"), DARK("Тёмная"),
}

internal class NovaAppearance(context: Context) {
    private val prefs = context.getSharedPreferences("nova-appearance", Context.MODE_PRIVATE)

    var tint by mutableStateOf(
        NovaTint.entries.firstOrNull { it.name == prefs.getString("tint", null) } ?: NovaTint.EMERALD,
    )
        private set
    var theme by mutableStateOf(
        NovaThemeMode.entries.firstOrNull { it.name == prefs.getString("theme", null) } ?: NovaThemeMode.DARK,
    )
        private set
    var atmosphere by mutableStateOf(prefs.getBoolean("atmosphere", true))
        private set
    var city by mutableStateOf(
        prefs.getString("weatherCity", null)?.let { label ->
            val lat = prefs.getString("weatherLat", null)?.toDoubleOrNull()
            val lon = prefs.getString("weatherLon", null)?.toDoubleOrNull()
            if (lat != null && lon != null) WeatherCity(label, lat, lon) else null
        },
    )
        private set

    fun chooseTint(value: NovaTint) {
        tint = value
        prefs.edit().putString("tint", value.name).apply()
    }

    fun chooseTheme(value: NovaThemeMode) {
        theme = value
        prefs.edit().putString("theme", value.name).apply()
    }

    fun updateAtmosphere(value: Boolean) {
        atmosphere = value
        prefs.edit().putBoolean("atmosphere", value).apply()
    }

    fun selectCity(value: WeatherCity?) {
        city = value
        prefs.edit().putString("weatherCity", value?.label)
            .putString("weatherLat", value?.latitude?.toString())
            .putString("weatherLon", value?.longitude?.toString()).apply()
    }
}

@Composable
internal fun NovaGlassTheme(appearance: NovaAppearance, content: @Composable () -> Unit) {
    val dark = when (appearance.theme) {
        NovaThemeMode.SYSTEM -> isSystemInDarkTheme()
        NovaThemeMode.DARK -> true
        NovaThemeMode.LIGHT -> false
    }
    val context = LocalContext.current
    val scheme = remember(dark, appearance.tint) { novaColorScheme(dark, appearance.tint) }
    SideEffect {
        (context as? Activity)?.window?.let { window ->
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.isAppearanceLightStatusBars = !dark
            controller.isAppearanceLightNavigationBars = !dark
        }
    }

    MaterialTheme(colorScheme = scheme) {
        CompositionLocalProvider(LocalContentColor provides scheme.onBackground, content = content)
    }
}

private fun novaColorScheme(dark: Boolean, tint: NovaTint): ColorScheme =
    if (dark) darkColorScheme(
        primary = tint.dark,
        onPrimary = NovaGraphite,
        primaryContainer = lerp(Color(0xFF233348), tint.dark, 0.1f),
        onPrimaryContainer = Color(0xFFF1F5F8),
        background = NovaGraphite,
        surface = Color(0xFF182230),
        onSurface = Color(0xFFF1F5F8),
        onBackground = Color(0xFFF1F5F8),
        surfaceVariant = Color(0xFF223247),
        onSurfaceVariant = Color(0xFFB3C2D2),
        outline = Color(0xFF8A9CAF),
        outlineVariant = Color(0xFF34465A),
        secondary = Color(0xFFB3C2D2),
    ) else lightColorScheme(
        primary = tint.light,
        onPrimary = Color.White,
        primaryContainer = lerp(Color(0xFFE7EFF5), tint.light, 0.1f),
        onPrimaryContainer = Color(0xFF152333),
        background = Color(0xFFEDF3F7),
        surface = Color(0xFFFAFCFE),
        onSurface = Color(0xFF152333),
        onBackground = Color(0xFF152333),
        surfaceVariant = Color(0xFFE8EFF5),
        onSurfaceVariant = Color(0xFF455770),
        outline = Color(0xFF667A90),
        outlineVariant = Color(0xFFB6C8D3),
        secondary = Color(0xFF455770),
    )

@Composable
internal fun NovaGlassSurface(
    modifier: Modifier = Modifier,
    radius: Dp = 24.dp,
    highlighted: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(radius)
    val fill = if (highlighted) colors.primaryContainer else colors.surface
    Box(
        modifier.clip(shape)
            .background(
                Brush.linearGradient(
                    listOf(
                        lerp(fill, colors.primary, if (highlighted) 0.14f else 0.05f).copy(alpha = 0.91f),
                        fill.copy(alpha = 0.72f),
                    ),
                ),
            )
            .border(
                1.dp,
                Brush.verticalGradient(
                    listOf(
                        lerp(colors.outlineVariant, colors.primary, if (highlighted) 0.6f else 0.35f),
                        colors.outlineVariant.copy(alpha = 0.45f),
                    ),
                ),
                shape,
            ),
        content = content,
    )
}

@Composable
internal fun NovaAtmosphere(enabled: Boolean, weather: WeatherTone?, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    val month = LocalDate.now().monthValue
    val season = when (month) {
        12, 1, 2 -> Season.WINTER
        3, 4, 5 -> Season.SPRING
        6, 7, 8 -> Season.SUMMER
        else -> Season.AUTUMN
    }
    val activeWeather = weather.takeIf { enabled }
    val accent = when (activeWeather) {
        WeatherTone.SUN -> Season.SUMMER.color
        WeatherTone.RAIN, WeatherTone.SNOW -> Season.WINTER.color
        WeatherTone.CLOUD, WeatherTone.FOG -> Color(0xFFB8CBDD)
        null -> if (enabled) season.color else colors.primary
    }
    Box(modifier.background(colors.background)) {
        // Blur the decorative light layer, leaving text, controls, and gestures untouched.
        Canvas(Modifier.fillMaxSize().blur(36.dp)) {
            val radius = size.maxDimension * 0.48f
            val upper = Offset(size.width * 0.73f, size.height * 0.08f)
            val lower = Offset(size.width * 0.05f, size.height * 0.72f)
            drawCircle(
                Brush.radialGradient(listOf(colors.primary.copy(alpha = 0.16f), Color.Transparent), upper, radius),
                radius,
                upper,
            )
            drawCircle(
                Brush.radialGradient(listOf(accent.copy(alpha = 0.09f), Color.Transparent), lower, radius),
                radius,
                lower,
            )
            when (activeWeather) {
                WeatherTone.SUN -> drawCircle(accent.copy(alpha = 0.22f), radius * 0.45f, upper)
                WeatherTone.CLOUD, WeatherTone.FOG -> drawRect(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, accent.copy(alpha = 0.16f), Color.Transparent),
                    ),
                )
                else -> Unit
            }
        }
        if (enabled && (activeWeather == null || activeWeather == WeatherTone.RAIN || activeWeather == WeatherTone.SNOW)) {
            SeasonParticles(season, activeWeather)
        }
    }
}

private enum class Season(val color: Color) {
    WINTER(Color(0xFFBCDDF9)),
    SPRING(Color(0xFFF0A9D5)),
    SUMMER(Color(0xFFF9D887)),
    AUTUMN(Color(0xFFF3A171)),
}

@Composable
private fun SeasonParticles(season: Season, weather: WeatherTone?) {
    val rain = weather == WeatherTone.RAIN
    val snow = weather == WeatherTone.SNOW || weather == null && season == Season.WINTER
    val color = if (rain || snow) Season.WINTER.color else season.color
    val particles = remember(season, weather) {
        val random = Random(season.ordinal)
        List(if (rain) 34 else 22) { Triple(random.nextFloat(), random.nextFloat(), random.nextFloat()) }
    }
    val animate = ValueAnimator.areAnimatorsEnabled()
    val motion = if (animate) {
        val transition = rememberInfiniteTransition(label = "Season")
        transition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(if (rain) 5500 else 36_000, easing = LinearEasing), RepeatMode.Restart),
            label = "Drift",
        )
    } else null
    Canvas(Modifier.fillMaxSize()) {
        val progress = motion?.value ?: 0f
        particles.forEach { (x, y, scale) ->
            val phase = (progress + y) % 1f
            val sway = sin((progress + x) * 2 * PI).toFloat() * 0.024f
            val point = Offset((x + sway) * size.width, phase * size.height)
            val radius = (1.2f + 2.3f * scale).dp.toPx()
            val opacity = sin(phase * PI).toFloat() * (0.18f + scale * 0.2f)
            val paint = color.copy(alpha = opacity)
            when {
                rain -> drawLine(paint, point, point + Offset(-4.dp.toPx(), 16.dp.toPx()), strokeWidth = 1.dp.toPx())
                snow -> drawCircle(paint, radius, point)
                season == Season.AUTUMN || season == Season.SPRING -> drawOval(
                    paint,
                    topLeft = point,
                    size = androidx.compose.ui.geometry.Size(radius * 2.4f, radius * 1.45f),
                )
                else -> drawCircle(paint, radius * 0.75f, point)
            }
        }
    }
}

@Composable
internal fun NovaSettingsGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            title,
            modifier = Modifier.padding(horizontal = 6.dp),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        NovaGlassSurface(Modifier.fillMaxWidth(), radius = 20.dp) {
            Column(Modifier.fillMaxWidth(), content = content)
        }
    }
}

@Composable
internal fun NovaSettingsChoice(label: String, selected: Boolean, onClick: () -> Unit, color: Color? = null) {
    val colors = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth()
            .heightIn(min = 48.dp)
            .selectable(selected, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (color != null) {
            Canvas(Modifier.size(18.dp)) {
                drawCircle(color, radius = 8.dp.toPx())
            }
        }
        Text(label, Modifier.weight(1f), fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
        if (selected) Text("✓", color = colors.primary, fontWeight = FontWeight.Bold)
    }
}

@Composable
internal fun NovaAppearanceSettings(appearance: NovaAppearance, currentWeather: WeatherTone?) {
    NovaSettingsGroup("Тема") {
        Column(Modifier.selectableGroup()) {
            NovaThemeMode.entries.forEach { theme ->
                NovaSettingsChoice(theme.label, appearance.theme == theme, { appearance.chooseTheme(theme) })
            }
        }
    }
    NovaSettingsGroup("Оттенок стекла") {
        Column(Modifier.selectableGroup()) {
            NovaTint.entries.forEach { tint ->
                NovaSettingsChoice(tint.label, appearance.tint == tint, { appearance.chooseTint(tint) }, tint.light)
            }
        }
    }
    NovaSettingsGroup("Атмосфера") {
        Row(
            Modifier.fillMaxWidth()
                .heightIn(min = 64.dp)
                .toggleable(appearance.atmosphere, role = Role.Switch, onValueChange = appearance::updateAtmosphere)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Времена года")
                Text(
                    "Фон меняется в зависимости от месяца",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Switch(appearance.atmosphere, onCheckedChange = null)
        }
        if (appearance.atmosphere) NovaWeatherSettings(appearance, currentWeather)
    }
}
