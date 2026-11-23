package io.nova.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

internal data class WeatherCity(val label: String, val latitude: Double, val longitude: Double)

internal enum class WeatherTone(val label: String) {
    SUN("Ясно"), RAIN("Дождь"), SNOW("Снег"), CLOUD("Облачно"), FOG("Туман"),
}

private val weatherClient = OkHttpClient.Builder().callTimeout(10, TimeUnit.SECONDS).build()

@Composable
internal fun observeNovaWeather(city: WeatherCity?, enabled: Boolean): WeatherTone? {
    val owner = LocalLifecycleOwner.current
    val tone by produceState<WeatherTone?>(null, city, owner, enabled) {
        value = null
        if (city == null || !enabled) return@produceState
        owner.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                value = try {
                    currentWeather(city)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    null
                }
                delay(25 * 60_000L)
            }
        }
    }
    return tone
}

@Composable
internal fun NovaWeatherSettings(appearance: NovaAppearance, current: WeatherTone?) {
    val scope = rememberCoroutineScope()
    var query by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var notice by rememberSaveable { mutableStateOf<String?>(null) }
    var cities by remember { mutableStateOf<List<WeatherCity>>(emptyList()) }
    val search: () -> Unit = {
        if (!busy && query.trim().length >= 2) {
            busy = true
            scope.launch {
                notice = null
                cities = emptyList()
                try {
                    cities = searchCities(query.trim())
                    if (cities.isEmpty()) notice = "Город не найден."
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    notice = "Сервис погоды недоступен. Попробуйте ещё раз."
                } finally {
                    busy = false
                }
            }
        }
    }

    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Погода", style = MaterialTheme.typography.titleSmall)
        Text(
            appearance.city?.let { city -> "${city.label} · ${current?.label ?: "нет данных"}" }
                ?: "Выберите город, чтобы фон отражал погоду. Данные Open-Meteo.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (appearance.city != null) {
            TextButton(
                onClick = { appearance.selectCity(null) },
                modifier = Modifier.heightIn(min = 48.dp),
            ) { Text("Отключить погоду") }
        }
        if (!appearance.atmosphere) return@Column
        OutlinedTextField(
            value = query,
            onValueChange = { query = it.take(72) },
            label = { Text("Название города") },
            singleLine = true,
            enabled = !busy,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { search() }),
            modifier = Modifier.fillMaxWidth(),
        )
        TextButton(
            onClick = search,
            enabled = !busy && query.trim().length >= 2,
            modifier = Modifier.heightIn(min = 48.dp),
        ) { Text(if (busy) "Ищем…" else "Найти город") }
        cities.forEach { city ->
            TextButton(
                onClick = { appearance.selectCity(city); cities = emptyList(); query = "" },
                modifier = Modifier.heightIn(min = 48.dp),
            ) { Text(city.label) }
        }
        notice?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
    }
}

private suspend fun searchCities(query: String): List<WeatherCity> {
    val url = "https://geocoding-api.open-meteo.com/v1/search".toHttpUrl().newBuilder()
        .addQueryParameter("name", query)
        .addQueryParameter("language", "ru")
        .addQueryParameter("count", "5")
        .build()
    val results = weatherJson(url).optJSONArray("results") ?: return emptyList()
    return (0 until results.length()).mapNotNull { index ->
        val item = results.optJSONObject(index) ?: return@mapNotNull null
        val lat = item.optDouble("latitude")
        val lon = item.optDouble("longitude")
        if (lat !in -90.0..90.0 || lon !in -180.0..180.0) return@mapNotNull null
        val label = listOf(item.optString("name"), item.optString("admin1"), item.optString("country"))
            .filter(String::isNotBlank).distinct().joinToString(", ")
        WeatherCity(label, lat, lon)
    }
}

private suspend fun currentWeather(city: WeatherCity): WeatherTone? {
    val url = "https://api.open-meteo.com/v1/forecast".toHttpUrl().newBuilder()
        .addQueryParameter("latitude", city.latitude.toString())
        .addQueryParameter("longitude", city.longitude.toString())
        .addQueryParameter("current", "weather_code")
        .build()
    val code = weatherJson(url).optJSONObject("current")?.optInt("weather_code", -1)
    return when (code) {
        0, 1 -> WeatherTone.SUN
        2, 3 -> WeatherTone.CLOUD
        45, 48 -> WeatherTone.FOG
        71, 73, 75, 77, 85, 86 -> WeatherTone.SNOW
        51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99 -> WeatherTone.RAIN
        else -> null
    }
}

private suspend fun weatherJson(url: HttpUrl): JSONObject = withContext(Dispatchers.IO) {
    weatherClient.newCall(Request.Builder().url(url).build()).execute().use { response ->
        check(response.isSuccessful) { "Погода недоступна" }
        JSONObject(response.body?.string().orEmpty())
    }
}
