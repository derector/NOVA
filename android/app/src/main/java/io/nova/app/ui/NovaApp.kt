package io.nova.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.nova.app.data.local.ChatEntity
import io.nova.app.data.local.MessageEntity
import io.nova.app.data.remote.PublicUserDto
import io.nova.app.domain.MessageRules
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val Night = Color(0xFF101722)
private val Panel = Color(0xFF182230)
private val Accent = Color(0xFF70E1C1)
private val Muted = Color(0xFF9EADBD)

@Composable
fun NovaApp(viewModel: MainViewModel = viewModel()) {
    MaterialTheme(colorScheme = darkColorScheme(
        primary = Accent,
        onPrimary = Color(0xFF05251D),
        background = Night,
        surface = Panel,
        onSurface = Color(0xFFF1F5F8),
        onBackground = Color(0xFFF1F5F8),
        secondary = Muted,
    )) {
        val state by viewModel.state.collectAsStateWithLifecycle()
        val online by viewModel.online.collectAsStateWithLifecycle()
        Surface(Modifier.fillMaxSize(), color = Night) {
            Column(Modifier.fillMaxSize()) {
                if (!online) OfflineBanner()
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    when {
                        !state.signedIn -> AuthScreen(state, viewModel)
                        state.profileRequired -> ProfileScreen(state, viewModel)
                        state.selectedChatId != null -> {
                            val chat = viewModel.chats.collectAsState(initial = emptyList()).value.firstOrNull { it.id == state.selectedChatId }
                            ChatScreen(state, chat, viewModel)
                        }
                        else -> HomeScreen(state, viewModel)
                    }
                }
            }
        }
    }
}

@Composable
private fun AuthScreen(state: MainUiState, viewModel: MainViewModel) {
    var code by remember { mutableStateOf("") }
    val focusManager = LocalFocusManager.current
    val emailValid = AuthValidation.isEmailValid(state.email)
    val emailError = state.email.isNotBlank() && !emailValid
    val codeValid = code.length in 6..12 && code.all(Char::isDigit)

    BoxWithConstraints(Modifier.fillMaxSize().background(Night).imePadding()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = maxHeight)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 26.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            BrandMark()
            Spacer(Modifier.height(30.dp))
            Text(
                if (state.codeRequested) "Проверьте почту" else "Вход в NOVA",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                if (state.codeRequested) "Введите одноразовый код из письма." else "Укажите email — отправим код для входа. Пароль не нужен.",
                color = Muted,
            )
            Spacer(Modifier.height(24.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Panel,
                shape = RoundedCornerShape(24.dp),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (state.codeRequested) "Адрес для входа" else "Ваша почта", style = MaterialTheme.typography.titleSmall, color = Muted)
                    OutlinedTextField(
                        value = state.email,
                        onValueChange = viewModel::setEmail,
                        label = { Text("Email") },
                        placeholder = { Text("name@example.com") },
                        leadingIcon = { Text("@", color = Muted, style = MaterialTheme.typography.titleMedium) },
                        trailingIcon = if (!state.codeRequested && state.email.isNotBlank()) {
                            { TextButton(onClick = { viewModel.setEmail("") }) { Text("Очистить") } }
                        } else {
                            null
                        },
                        supportingText = {
                            Text(
                                if (emailError) "Проверьте адрес, например name@example.com."
                                else "На этот адрес придёт одноразовый код.",
                            )
                        },
                        isError = emailError,
                        enabled = !state.busy && !state.codeRequested,
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Done,
                            autoCorrectEnabled = false,
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                if (emailValid && !state.codeRequested) viewModel.requestCode()
                            },
                        ),
                        shape = RoundedCornerShape(18.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )

                    if (state.codeRequested) {
                        Spacer(Modifier.height(4.dp))
                        OutlinedTextField(
                            value = code,
                            onValueChange = { input ->
                                if (input.length <= 12 && input.all(Char::isDigit)) code = input
                            },
                            label = { Text("Одноразовый код") },
                            placeholder = { Text("Введите код из письма") },
                            supportingText = { Text("Введите цифры из письма NOVA.") },
                            enabled = !state.busy,
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.NumberPassword,
                                imeAction = ImeAction.Done,
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = {
                                    focusManager.clearFocus()
                                    if (codeValid) viewModel.verify(code)
                                },
                            ),
                            shape = RoundedCornerShape(18.dp),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Button(
                onClick = {
                    focusManager.clearFocus()
                    if (state.codeRequested) viewModel.verify(code) else viewModel.requestCode()
                },
                enabled = !state.busy && if (state.codeRequested) codeValid else emailValid,
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) {
                if (state.busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text(if (state.codeRequested) "Подтвердить" else "Отправить код")
            }

            if (state.codeRequested) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    TextButton(onClick = { code = ""; viewModel.editEmail() }, enabled = !state.busy) {
                        Text("Изменить email")
                    }
                    TextButton(onClick = viewModel::requestCode, enabled = !state.busy && emailValid) {
                        Text("Отправить ещё раз")
                    }
                }
            }
            Notice(state.notice)
        }
    }
}

@Composable
private fun ProfileScreen(state: MainUiState, viewModel: MainViewModel) {
    var username by remember { mutableStateOf(state.username) }
    var displayName by remember { mutableStateOf(state.displayName) }
    Column(Modifier.fillMaxSize().imePadding().padding(24.dp), verticalArrangement = Arrangement.Center) {
        BrandMark()
        Spacer(Modifier.height(30.dp))
        Text("Создайте профиль", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        Text("Username нужен, чтобы другие могли найти вас.", color = Muted)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(username, { username = it }, label = { Text("Username") }, prefix = { Text("@") }, singleLine = true, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(displayName, { displayName = it }, label = { Text("Отображаемое имя") }, singleLine = true, enabled = !state.busy, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(20.dp))
        Button(onClick = { viewModel.completeProfile(username, displayName) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            if (state.busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Сохранить профиль")
        }
        Notice(state.notice)
    }
}

@Composable
private fun HomeScreen(state: MainUiState, viewModel: MainViewModel) {
    val chats by viewModel.chats.collectAsStateWithLifecycle(initialValue = emptyList())
    Scaffold(containerColor = Night, contentWindowInsets = WindowInsets(0.dp)) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).imePadding().padding(horizontal = 20.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                BrandMark(Modifier.weight(1f))
                TextButton(onClick = viewModel::refresh, enabled = !state.busy) { Text("Обновить") }
                TextButton(onClick = viewModel::logout, enabled = !state.busy) { Text("Выйти") }
            }
            Text("Найти человека", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = state.profileSearchQuery,
                    onValueChange = viewModel::setSearchQuery,
                    label = { Text("Поиск по username") },
                    singleLine = true,
                    enabled = !state.busy,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Button(onClick = viewModel::searchUsers, enabled = !state.busy) { Text("Искать") }
            }
            state.searchResults.forEach { user -> UserResult(user, state.busy) { viewModel.createChat(user) } }
            Notice(state.notice)
            Spacer(Modifier.height(18.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Сообщения", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Text("@${state.username}", color = Muted, style = MaterialTheme.typography.labelMedium)
            }
            Spacer(Modifier.height(8.dp))
            if (chats.isEmpty()) {
                EmptyPanel(
                    if (state.busy) "Загружаем диалоги…" else "Пока пусто",
                    if (state.busy) "Подождите, синхронизируем данные." else "Найдите человека по username, чтобы начать личный диалог.",
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(chats, key = { it.id }) { chat -> ChatRow(chat) { viewModel.selectChat(chat.id) } }
                }
            }
        }
    }
}

@Composable
private fun ChatScreen(state: MainUiState, chat: ChatEntity?, viewModel: MainViewModel) {
    val chatId = state.selectedChatId ?: return
    val messagesFlow = remember(chatId) { viewModel.messages(chatId) }
    val messages by messagesFlow.collectAsState(initial = emptyList())
    var draft by remember(chatId) { mutableStateOf("") }
    Column(Modifier.fillMaxSize().imePadding()) {
        Row(
            Modifier.fillMaxWidth().background(Panel).padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = { viewModel.selectChat(null) }, modifier = Modifier.semantics { contentDescription = "Назад к списку диалогов" }) { Text("‹") }
            Column(Modifier.weight(1f)) {
                Text(chat?.participantDisplayName?.ifBlank { "Диалог" } ?: "Диалог", fontWeight = FontWeight.SemiBold)
                Text(chat?.let { "@${it.participantUsername}" } ?: "Подключаемся…", color = Muted, style = MaterialTheme.typography.labelSmall)
            }
            TextButton(onClick = { viewModel.selectChat(chatId) }, modifier = Modifier.semantics { contentDescription = "Обновить диалог" }) { Text("↻") }
        }
        Notice(state.notice)
        if (messages.isEmpty()) {
            EmptyPanel("Начните разговор", "Сообщения будут синхронизироваться с сервером.", Modifier.weight(1f).fillMaxWidth())
        } else {
            LazyColumn(
                Modifier.weight(1f).fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(messages, key = { it.clientMessageId }) { message ->
                    MessageBubble(message, own = message.senderId == state.userId, onRetry = { viewModel.retry(message.clientMessageId) })
                }
            }
        }
        HorizontalDivider(color = Color(0xFF2A3543))
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = draft,
                onValueChange = { if (it.length <= 10_000) draft = it },
                placeholder = { Text("Сообщение") },
                enabled = !state.busy,
                maxLines = 4,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            Button(onClick = { viewModel.send(chatId, draft); draft = "" }, enabled = draft.isNotBlank() && !state.busy, modifier = Modifier.semantics { contentDescription = "Отправить сообщение" }) {
                Text("➤")
            }
        }
    }
}

@Composable
private fun ChatRow(chat: ChatEntity, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Panel, RoundedCornerShape(16.dp)).clickable(role = Role.Button, onClick = onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(42.dp).background(Color(0xFF263B48), CircleShape), contentAlignment = Alignment.Center) {
            Text(chat.participantDisplayName.take(1).uppercase().ifBlank { "•" }, color = Accent, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(chat.participantDisplayName.ifBlank { "Пользователь" }, fontWeight = FontWeight.SemiBold)
            Text("@${chat.participantUsername}", color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text("›", color = Muted, style = MaterialTheme.typography.titleLarge)
    }
}

@Composable
private fun UserResult(user: PublicUserDto, busy: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 8.dp).background(Panel, RoundedCornerShape(14.dp)).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(user.displayName, fontWeight = FontWeight.SemiBold)
            Text("@${user.username}", color = Muted)
        }
        Button(onClick = onClick, enabled = !busy) { Text("Написать") }
    }
}

@Composable
private fun MessageBubble(message: MessageEntity, own: Boolean, onRetry: () -> Unit) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (own) Alignment.End else Alignment.Start) {
        Column(
            Modifier.background(if (own) Color(0xFF174B43) else Panel, RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Text(message.text, color = Color(0xFFF3F7F8))
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(formatTime(message.createdAt), color = Muted, style = MaterialTheme.typography.labelSmall)
                if (own) {
                    Spacer(Modifier.width(8.dp))
                    Text(if (message.readAt != null) "Прочитано ✓✓" else MessageRules.statusLabel(message.status), color = if (message.status == "FAILED") Color(0xFFFFB4A9) else Accent, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        if (message.status == "FAILED") TextButton(onClick = onRetry) { Text("Повторить отправку") }
    }
}

@Composable
private fun EmptyPanel(title: String, subtitle: String, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().padding(vertical = 25.dp).background(Panel, RoundedCornerShape(18.dp)).padding(18.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(5.dp))
        Text(subtitle, color = Muted, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun BrandMark(modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(34.dp).background(Accent, RoundedCornerShape(11.dp)), contentAlignment = Alignment.Center) {
            Text("N", color = Night, fontWeight = FontWeight.Black)
        }
        Spacer(Modifier.width(10.dp))
        Text("NOVA", fontWeight = FontWeight.Bold, letterSpacing = 2.5.sp)
    }
}

@Composable
private fun Notice(text: String?) {
    if (!text.isNullOrBlank()) {
        val isError = text.startsWith("Не удалось") || text.startsWith("Сервер") || text.startsWith("Слишком") || text.startsWith("Введите")
        val textColor = if (isError) Color(0xFFFFC4BA) else Accent
        Surface(
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
            color = if (isError) Color(0xFF302328) else Color(0xFF18352F),
            shape = RoundedCornerShape(14.dp),
        ) {
            Text(text, color = textColor, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp))
        }
    }
}

@Composable
private fun OfflineBanner() {
    Text(
        "Офлайн — исходящие сообщения остаются в очереди",
        color = Color(0xFF351D00),
        style = MaterialTheme.typography.labelMedium,
        modifier = Modifier.fillMaxWidth().background(Color(0xFFFFD18A)).padding(horizontal = 16.dp, vertical = 9.dp),
    )
}

private fun formatTime(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(value))
}.getOrDefault("")
