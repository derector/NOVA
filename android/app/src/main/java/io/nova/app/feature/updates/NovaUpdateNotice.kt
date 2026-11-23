package io.nova.app.feature.updates

import android.Manifest
import android.app.Application
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import io.nova.app.BuildConfig
import java.io.File
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal data class UpdateScreenState(
    val release: UpdateRelease? = null,
    val dismissedVersion: Int? = null,
    val checking: Boolean = false,
    val status: String? = null,
    val progress: Int? = null,
    val prepared: File? = null,
    val installing: Boolean = false,
    val installPermissionNeeded: Boolean = false,
) {
    val required: Boolean get() = release?.isRequiredFor(BuildConfig.VERSION_CODE) == true
}

internal class NovaUpdateViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = UpdateRepository(application)
    private val mutableState = MutableStateFlow(UpdateScreenState())
    val state = mutableState.asStateFlow()
    private var checkJob: Job? = null
    private var downloadJob: Job? = null
    private val app: Application get() = getApplication()

    fun check(explicitly: Boolean = false) {
        if (checkJob?.isActive == true || downloadJob?.isActive == true || mutableState.value.installing) return
        checkJob = viewModelScope.launch {
            mutableState.update { it.copy(checking = true, status = if (explicitly) null else it.status) }
            try {
                val release = repository.latest()
                mutableState.update { previous ->
                    if (!explicitly && release == previous.release) return@update previous
                    if (release == previous.release && release != null) {
                        return@update previous.copy(dismissedVersion = null, status = null)
                    }
                    UpdateScreenState(
                        release = release,
                        dismissedVersion = if (explicitly) null else previous.dismissedVersion,
                        status = if (explicitly && release == null) "У вас установлена актуальная версия" else null,
                    )
                }
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                if (explicitly) mutableState.update { it.copy(status = "Не удалось проверить обновления. Повторите попытку.") }
            } finally {
                mutableState.update { it.copy(checking = false) }
            }
        }
    }

    fun resume() {
        NovaUpdatePush.syncSubscription(app)
        if (app.packageManager.canRequestPackageInstalls()) {
            mutableState.update { it.copy(installPermissionNeeded = false) }
        }
        check()
    }

    fun download() {
        val release = mutableState.value.release ?: return
        if (downloadJob?.isActive == true || mutableState.value.installing) return
        checkJob?.cancel()
        downloadJob = viewModelScope.launch {
            mutableState.update { it.copy(status = null, progress = 0, installPermissionNeeded = false) }
            try {
                val apk = repository.download(release) { progress ->
                    mutableState.update { it.copy(progress = progress) }
                }
                mutableState.update { it.copy(prepared = apk, progress = null) }
            } catch (error: CancellationException) {
                throw error
            } catch (_: InvalidUpdateApkException) {
                mutableState.update { it.copy(progress = null, status = "APK не прошёл проверку. Скачайте файл снова.") }
            } catch (_: Exception) {
                mutableState.update { it.copy(progress = null, status = "Не удалось скачать обновление. Повторите попытку.") }
            }
        }
    }

    fun dismiss() {
        mutableState.update { current ->
            if (current.required || current.progress != null || current.installing) current
            else current.copy(dismissedVersion = current.release?.versionCode)
        }
    }

    fun install() {
        val current = mutableState.value
        val release = current.release ?: return
        val apk = current.prepared ?: return
        if (current.installing) return
        if (!app.packageManager.canRequestPackageInstalls()) {
            mutableState.update { it.copy(installPermissionNeeded = true, status = null) }
            return
        }
        viewModelScope.launch {
            mutableState.update { it.copy(installing = true, installPermissionNeeded = false, status = null) }
            try {
                val valid = withContext(Dispatchers.IO) { ApkVerifier.verify(app, apk, release) }
                if (!valid) {
                    mutableState.update { it.copy(prepared = null, status = "APK повреждён или удалён. Скачайте его снова.") }
                    return@launch
                }
                ApkVerifier.launchInstaller(app, apk)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                mutableState.update { it.copy(status = "Не удалось открыть установщик Android. Повторите попытку.") }
            } finally {
                mutableState.update { it.copy(installing = false) }
            }
        }
    }

    fun allowInstall() {
        try {
            app.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:${app.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            })
        } catch (_: ActivityNotFoundException) {
            mutableState.update { it.copy(status = "Установка из NOVA недоступна в настройках устройства.") }
        } catch (_: SecurityException) {
            mutableState.update { it.copy(status = "Установка из NOVA ограничена настройками устройства.") }
        }
    }
}

@Composable
fun NovaUpdateNotice() {
    if (!UpdateRepository.configured) return
    val model: NovaUpdateViewModel = viewModel()
    val state by model.state.collectAsState()
    val context = LocalContext.current
    LifecycleResumeEffect(model) {
        model.resume()
        onPauseOrDispose {}
    }
    val release = state.release ?: return
    if (!state.required && state.dismissedVersion == release.versionCode) return
    val progress = state.progress
    val canInstall = context.packageManager.canRequestPackageInstalls()
    val allowInstall = state.prepared != null && state.installPermissionNeeded && !canInstall
    val busy = progress != null || state.installing
    AlertDialog(
        onDismissRequest = model::dismiss,
        properties = DialogProperties(dismissOnBackPress = !state.required && !busy, dismissOnClickOutside = false),
        title = { Text(if (state.required) "Версия NOVA устарела" else "Обновление NOVA") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Доступна версия ${release.versionName}")
                if (progress != null) {
                    LinearProgressIndicator(progress = { progress / 100f }, modifier = Modifier.fillMaxWidth())
                    Text(if (progress == 100) "Проверяем подпись APK…" else "Скачано $progress%")
                } else if (state.prepared != null) {
                    Text(
                        if (allowInstall) "Разрешите Android устанавливать обновления из NOVA и вернитесь сюда."
                        else "Файл проверен. Подтвердите обновление в установщике Android.",
                    )
                }
                state.status?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    when {
                        allowInstall -> model.allowInstall()
                        state.prepared != null -> model.install()
                        else -> model.download()
                    }
                },
                enabled = !busy,
                modifier = Modifier.heightIn(min = 48.dp),
            ) {
                Text(
                    when {
                        allowInstall -> "Открыть настройки"
                        state.prepared != null -> "Установить"
                        else -> "Скачать"
                    },
                )
            }
        },
        dismissButton = if (state.required) null else {
            {
                TextButton(onClick = model::dismiss, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text("Позже")
                }
            }
        },
    )
}

@Composable
fun NovaUpdateSettings() {
    if (!UpdateRepository.configured) return
    val model: NovaUpdateViewModel = viewModel()
    val state by model.state.collectAsState()
    val context = LocalContext.current
    val notificationState = remember { mutableStateOf(updateNotificationsEnabled(context)) }
    val prefs = remember(context) { context.getSharedPreferences("nova_update_notices", android.content.Context.MODE_PRIVATE) }
    val requestPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        notificationState.value = updateNotificationsEnabled(context)
        NovaUpdatePush.syncSubscription(context.applicationContext)
    }
    LifecycleResumeEffect(context) {
        notificationState.value = updateNotificationsEnabled(context)
        onPauseOrDispose {}
    }
    Column(Modifier.padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        TextButton(onClick = { model.check(explicitly = true) }, enabled = !state.checking && state.progress == null) {
            Text(if (state.checking) "Проверяем…" else "Проверить обновления NOVA")
        }
        TextButton(onClick = {
            try {
                if (Build.VERSION.SDK_INT >= 33 &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED &&
                    !prefs.getBoolean("notification_permission_requested", false)
                ) {
                    prefs.edit().putBoolean("notification_permission_requested", true).apply()
                    requestPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    val action = if (notificationState.value) Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS
                    else Settings.ACTION_APP_NOTIFICATION_SETTINGS
                    context.startActivity(Intent(action).apply {
                        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        putExtra(Settings.EXTRA_CHANNEL_ID, UPDATE_CHANNEL_ID)
                    })
                }
            } catch (_: ActivityNotFoundException) {
                context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${context.packageName}")
                })
            }
        }, modifier = Modifier.heightIn(min = 48.dp)) {
            Text(
                if (notificationState.value) "Уведомления об обновлениях"
                else "Включить уведомления об обновлениях",
            )
        }
        state.status?.takeIf { state.release == null }?.let {
            Text(it, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        }
    }
}
