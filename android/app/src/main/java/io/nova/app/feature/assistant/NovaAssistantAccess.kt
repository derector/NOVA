package io.nova.app.feature.assistant

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
internal fun NovaAssistantAccess(onDismissRequest: () -> Unit, accessToken: suspend () -> String) {
    val context = LocalContext.current
    val currentToken by rememberUpdatedState(accessToken)
    val assistant = remember { AssistantApi { currentToken() } }
    val audio = remember(context) { AssistantAudio(context.applicationContext) }
    val scope = rememberCoroutineScope()
    val owner = LocalLifecycleOwner.current
    val messages = remember { mutableStateListOf<AssistantTurn>() }
    val scroll = rememberScrollState()
    var capabilities by remember { mutableStateOf<AssistantCapabilities?>(null) }
    var task by remember { mutableStateOf<Job?>(null) }
    var activity by remember { mutableStateOf("Подключаю помощника…") }
    var error by remember { mutableStateOf<String?>(null) }
    var input by remember { mutableStateOf("") }
    var voice by remember { mutableStateOf("dmitry") }
    var recording by remember { mutableStateOf(false) }
    var conversation by remember { mutableStateOf(false) }
    var pendingVoice by remember { mutableStateOf(false) }
    val busy = task != null

    LaunchedEffect(assistant) {
        try {
            capabilities = assistant.status()
            activity = if (capabilities?.chat == true) "Голосовой и текстовый помощник" else "Сервис ИИ ещё не подключён"
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (exception: Exception) {
            activity = "Ассистент недоступен"
            error = exception.message
        }
    }

    fun stop() {
        task?.cancel()
        recording = false
        conversation = false
        activity = "Голосовой и текстовый помощник"
    }

    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) stop()
        }
        owner.lifecycle.addObserver(observer)
        onDispose {
            owner.lifecycle.removeObserver(observer)
            task?.cancel()
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            withFrameNanos { }
            scroll.scrollTo(scroll.maxValue)
        }
    }

    fun perform(operation: suspend () -> Unit) {
        if (task != null) return
        error = null
        val job = scope.launch(start = CoroutineStart.LAZY) {
            try { operation() }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (exception: Exception) { error = exception.message ?: "Действие не удалось. Попробуйте ещё раз." }
            finally {
                task = null
                if (isActive) {
                    recording = false
                    conversation = false
                    activity = "Голосовой и текстовый помощник"
                }
            }
        }
        task = job
        job.start()
    }

    suspend fun answer(question: String, read: Boolean) {
        val user = AssistantTurn("user", question)
        activity = "Готовлю ответ…"
        val reply = assistant.chat(messages + user)
        messages.add(user)
        messages.add(AssistantTurn("assistant", reply))
        input = ""
        if (read) {
            activity = "Отвечаю голосом…"
            audio.play(assistant.speech(reply, voice))
        }
    }

    fun startRecording(live: Boolean) = perform {
        conversation = live
        do {
            activity = "Слушаю…"
            recording = true
            val phrase = audio.record(live) { file ->
                recording = false
                activity = "Расшифровываю…"
                assistant.transcribe(file)
            }.trim()
            require(phrase.isNotEmpty()) { "Речь не распознана. Попробуйте ещё раз." }
            if (live) {
                input = phrase.take(2000)
                answer(input, true)
            } else {
                input = listOf(input.trim(), phrase).filter(String::isNotEmpty).joinToString(" ").take(2000)
            }
        } while (live)
    }

    val microphone = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { permitted ->
        if (permitted) startRecording(pendingVoice)
        else error = "Разрешите доступ к микрофону в настройках Android."
    }

    fun record(live: Boolean) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            startRecording(live)
        } else {
            pendingVoice = live
            microphone.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    AlertDialog(
        onDismissRequest = onDismissRequest,
        title = { Text("Ассистент NOVA") },
        text = {
            Column(modifier = Modifier.verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(activity, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
                if (capabilities?.speech == true) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        for ((id, title) in listOf("dmitry" to "Дмитрий", "svetlana" to "Светлана", "dariya" to "Дарья")) {
                            FilterChip(selected = voice == id, enabled = !busy, onClick = { voice = id }, label = { Text(title) })
                        }
                    }
                }
                if (capabilities?.let { it.chat && it.transcription && it.speech } == true) {
                    TextButton(enabled = !busy || conversation, onClick = { if (conversation) stop() else record(true) }) {
                        Text(if (conversation) "Завершить разговор" else "Голосовой разговор")
                    }
                }
                if (messages.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (message in messages.takeLast(18)) {
                            Column {
                                Text(if (message.role == "user") "Вы" else "NOVA", style = MaterialTheme.typography.labelMedium)
                                Text(message.content)
                                if (message.role == "assistant" && capabilities?.speech == true) {
                                    TextButton(enabled = !busy, onClick = {
                                        perform {
                                            activity = "Отвечаю голосом…"
                                            audio.play(assistant.speech(message.content, voice))
                                        }
                                    }) { Text("Озвучить") }
                                }
                            }
                        }
                    }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
                if (capabilities?.chat == true) {
                    OutlinedTextField(
                        value = input,
                        onValueChange = { input = it.take(2000) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !busy,
                        label = { Text("Вопрос для NOVA") },
                        maxLines = 3,
                    )
                    Row {
                        TextButton(
                            enabled = capabilities?.transcription == true && (!busy || recording),
                            onClick = { if (recording) audio.finishTurn() else record(false) },
                        ) { Text(if (recording) "Готово" else "Диктовать") }
                        TextButton(enabled = !busy && input.isNotBlank(), onClick = {
                            perform { answer(input.trim(), false) }
                        }) { Text("Отправить") }
                    }
                    Text("Вопросы и голосовая запись обрабатываются сервисами ИИ.", style = MaterialTheme.typography.labelSmall)
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismissRequest) { Text("Закрыть") } },
    )
}
