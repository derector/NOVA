package io.nova.app.ui

import android.animation.ValueAnimator
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.drawable.Animatable
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.widget.ImageView
import android.widget.VideoView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import io.nova.app.BuildConfig
import io.nova.app.data.remote.ProfileMediaSlot
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

@Composable
internal fun NovaProfileSettings(state: MainUiState, viewModel: MainViewModel) {
    val profile = state.profile
    LaunchedEffect(Unit) {
        if (!state.busy && profile == null) viewModel.loadProfile()
    }
    NovaSettingsGroup("Профиль") {
        if (profile == null) {
            TextButton(
                onClick = viewModel::loadProfile,
                enabled = !state.busy,
                modifier = Modifier.heightIn(min = 48.dp).padding(horizontal = 12.dp),
            ) { Text("Загрузить профиль") }
        } else {
            var username by rememberSaveable(profile.username) { mutableStateOf(profile.username) }
            var displayName by rememberSaveable(profile.displayName) { mutableStateOf(profile.displayName) }
            var bio by rememberSaveable(profile.bio) { mutableStateOf(profile.bio.orEmpty()) }
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                NovaProfileMediaSlot(
                    label = "Обложка",
                    slot = ProfileMediaSlot.COVER,
                    path = profile.coverUrl,
                    mime = profile.coverContentType,
                    viewModel = viewModel,
                    busy = state.busy,
                    modifier = Modifier.fillMaxWidth().height(132.dp),
                )
                NovaProfileMediaSlot(
                    label = "Аватар",
                    slot = ProfileMediaSlot.AVATAR,
                    path = profile.avatarUrl,
                    mime = profile.avatarContentType,
                    viewModel = viewModel,
                    busy = state.busy,
                    modifier = Modifier.size(84.dp).clip(CircleShape),
                )
                Text(
                    "Фото, GIF, WebP или видео MP4/WebM до 8 МБ. Аватар виден в результатах поиска.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    username, { username = it.take(32) }, label = { Text("Имя пользователя") },
                    prefix = { Text("@") }, singleLine = true, enabled = !state.busy, modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    displayName, { displayName = it.take(80) }, label = { Text("Отображаемое имя") },
                    singleLine = true, enabled = !state.busy, modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    bio, { bio = it.take(240) }, label = { Text("О себе") },
                    maxLines = 4, enabled = !state.busy, modifier = Modifier.fillMaxWidth(),
                )
                Button(
                    onClick = { viewModel.completeProfile(username, displayName, bio) },
                    enabled = !state.busy && username.isNotBlank() && displayName.isNotBlank() &&
                        (username != profile.username || displayName != profile.displayName || bio != profile.bio.orEmpty()),
                    modifier = Modifier.heightIn(min = 48.dp),
                ) { Text("Сохранить изменения") }
            }
        }
    }
}

@Composable
private fun NovaProfileMediaSlot(
    label: String,
    slot: ProfileMediaSlot,
    path: String?,
    mime: String?,
    viewModel: MainViewModel,
    busy: Boolean,
    modifier: Modifier,
) {
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) viewModel.uploadProfileMedia(slot, uri)
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = MaterialTheme.typography.titleSmall)
        Box(
            modifier.background(
                Brush.linearGradient(
                    listOf(MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.surfaceVariant),
                ),
            ),
        ) {
            NovaProfileMedia(path, mime, Modifier.fillMaxSize(), allowVideo = true)
        }
        TextButton(
            onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)) },
            enabled = !busy,
            modifier = Modifier.heightIn(min = 48.dp),
        ) { Text(if (path == null) "Выбрать файл" else "Заменить файл") }
        if (path != null) {
            TextButton(
                onClick = { viewModel.removeProfileMedia(slot) },
                enabled = !busy,
                modifier = Modifier.heightIn(min = 48.dp),
            ) { Text("Удалить файл", color = MaterialTheme.colorScheme.error) }
        }
    }
}

@Composable
internal fun NovaProfileMedia(
    path: String?,
    mime: String?,
    modifier: Modifier,
    allowVideo: Boolean = false,
) {
    val url = remember(path) { profileMediaUrl(path) } ?: return
    if (mime?.startsWith("video/") == true) {
        if (allowVideo) NovaProfileVideo(url, modifier)
        return
    }
    if (mime?.startsWith("image/") != true) return
    val context = LocalContext.current
    val animate = ValueAnimator.areAnimatorsEnabled()
    val image by produceState<Drawable?>(null, url, animate) {
        value = null
        value = withContext(Dispatchers.IO) {
            try {
                val bytes = profileImageBytes(url)
                if (Build.VERSION.SDK_INT >= 28 && animate) {
                    ImageDecoder.decodeDrawable(ImageDecoder.createSource(ByteBuffer.wrap(bytes))) { decoder, info, _ ->
                        val scale = (760f / maxOf(info.size.width, info.size.height)).coerceAtMost(1f)
                        decoder.setTargetSize(
                            (info.size.width * scale).roundToInt().coerceAtLeast(1),
                            (info.size.height * scale).roundToInt().coerceAtLeast(1),
                        )
                    }
                } else {
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                    val options = BitmapFactory.Options()
                    while (maxOf(bounds.outWidth, bounds.outHeight) / options.inSampleSize.coerceAtLeast(1) > 760) {
                        options.inSampleSize = options.inSampleSize.coerceAtLeast(1) * 2
                    }
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)?.let { BitmapDrawable(context.resources, it) }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                null
            }
        }
    }
    if (image != null) {
        AndroidView(
            modifier = modifier,
            factory = { ImageView(it).apply { scaleType = ImageView.ScaleType.CENTER_CROP } },
            onReset = null,
            onRelease = { (it.drawable as? Animatable)?.stop(); it.setImageDrawable(null) },
            update = { view ->
                if (view.drawable !== image) {
                    (view.drawable as? Animatable)?.stop()
                    view.setImageDrawable(image)
                    (image as? Animatable)?.start()
                }
            },
        )
    }
}

@Composable
private fun NovaProfileVideo(url: String, modifier: Modifier) {
    var playing by remember(url) { mutableStateOf(false) }
    var failed by remember(url) { mutableStateOf(false) }
    Box(modifier, contentAlignment = Alignment.Center) {
        if (playing) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    VideoView(context).apply {
                        setOnPreparedListener { player ->
                            player.isLooping = true
                            player.setVolume(0f, 0f)
                            start()
                        }
                        setOnErrorListener { _, _, _ ->
                            playing = false
                            failed = true
                            true
                        }
                        setVideoURI(Uri.parse(url))
                    }
                },
                onReset = null,
                onRelease = { it.stopPlayback() },
                update = {},
            )
            TextButton(
                onClick = { playing = false },
                modifier = Modifier.align(Alignment.BottomCenter)
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.92f), CircleShape)
                    .heightIn(min = 48.dp),
            ) { Text("Стоп") }
        } else {
            TextButton(
                onClick = { playing = true; failed = false },
                modifier = Modifier.heightIn(min = 48.dp),
            ) { Text(if (failed) "Повторить" else "Видео") }
        }
    }
}

private val profileMediaHttp = OkHttpClient.Builder()
    .followRedirects(false)
    .callTimeout(14, TimeUnit.SECONDS)
    .build()

private fun profileMediaUrl(path: String?): String? {
    if (path == null || !path.matches(Regex("/api/v1/users/media/[a-f0-9-]{36}"))) return null
    return BuildConfig.API_BASE_URL.toHttpUrlOrNull()?.resolve(path)?.toString()
}

private fun profileImageBytes(url: String): ByteArray {
    val maxBytes = 8 * 1024 * 1024
    return profileMediaHttp.newCall(Request.Builder().url(url).build()).execute().use { response ->
        val body = response.body ?: error("Нет содержимого изображения")
        check(response.isSuccessful && body.contentLength() <= maxBytes) { "Изображение недоступно" }
        body.byteStream().use { input ->
            ByteArrayOutputStream().use { output ->
                val buffer = ByteArray(16 * 1024)
                while (true) {
                    val size = input.read(buffer)
                    if (size < 0) break
                    check(output.size() + size <= maxBytes) { "Изображение слишком большое" }
                    output.write(buffer, 0, size)
                }
                output.toByteArray()
            }
        }
    }
}
