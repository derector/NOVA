package io.nova.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.nova.app.R
import io.nova.app.data.local.ChatEntity
import io.nova.app.data.local.MessageEntity
import io.nova.app.data.remote.PublicUserDto
import io.nova.app.domain.MessageRules
import io.nova.app.feature.assistant.NovaAssistantAccess
import io.nova.app.feature.updates.NovaUpdateNotice
import io.nova.app.feature.updates.NovaUpdateSettings
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private enum class Screen { AUTH, PROFILE, CHATS, SETTINGS, CHAT }
private enum class AuthMode(val label: String) { REGISTER("Регистрация"), SIGN_IN("Вход") }

@Composable
fun NovaApp(viewModel: MainViewModel = viewModel()) {
    val context = LocalContext.current
    val appearance = remember(context) { NovaAppearance(context.applicationContext) }
    val weather = observeNovaWeather(appearance.city, appearance.atmosphere)
    val state by viewModel.state.collectAsStateWithLifecycle()
    val online by viewModel.online.collectAsStateWithLifecycle()
    val chats by viewModel.chats.collectAsStateWithLifecycle(initialValue = emptyList())
    val chatDrafts = key(state.userId) { rememberSaveableStateHolder() }
    var settingsOpen by rememberSaveable(state.userId) { mutableStateOf(false) }
    var assistantOpen by rememberSaveable(state.userId) { mutableStateOf(false) }
    val screen = when {
        !state.signedIn -> Screen.AUTH
        state.profileRequired -> Screen.PROFILE
        state.selectedChatId != null -> Screen.CHAT
        settingsOpen -> Screen.SETTINGS
        else -> Screen.CHATS
    }

    BackHandler(screen == Screen.CHAT || screen == Screen.SETTINGS) {
        if (screen == Screen.CHAT) viewModel.selectChat(null) else settingsOpen = false
    }

    NovaGlassTheme(appearance) {
        Box(Modifier.fillMaxSize()) {
            NovaAtmosphere(appearance.atmosphere, weather, Modifier.fillMaxSize())
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                if (!online) OfflineBanner(state.signedIn)
                AnimatedContent(
                    targetState = screen to state,
                    contentKey = { (route, value) -> if (route == Screen.CHAT) value.selectedChatId else route },
                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    label = "Переход между экранами NOVA",
                ) { (route, value) ->
                    when (route) {
                        Screen.AUTH -> AuthScreen(value, viewModel)
                        Screen.PROFILE -> OnboardingScreen(value, viewModel)
                        Screen.CHATS -> HomeScreen(value, chats, viewModel) { assistantOpen = true }
                        Screen.SETTINGS -> SettingsScreen(value, appearance, weather, viewModel)
                        Screen.CHAT -> value.selectedChatId?.let { chatId ->
                            chatDrafts.SaveableStateProvider("${value.userId}:$chatId") {
                                ChatScreen(chatId, value, chats.firstOrNull { it.id == chatId }, viewModel)
                            }
                        }
                    }
                }
                if (screen == Screen.CHATS || screen == Screen.SETTINGS) {
                    GlassTabs(
                        labels = listOf("Чаты", "Настройки"),
                        index = if (settingsOpen) 1 else 0,
                        onSelect = { settingsOpen = it == 1 },
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
            }
            NovaUpdateNotice()
            if (state.signedIn && !state.profileRequired && assistantOpen) {
                NovaAssistantAccess(onDismissRequest = { assistantOpen = false }, accessToken = viewModel::assistantAccessToken)
            }
        }
    }
}

@Composable
private fun AuthScreen(state: MainUiState, viewModel: MainViewModel) {
    var mode by rememberSaveable { mutableStateOf(AuthMode.REGISTER) }
    var code by rememberSaveable(state.email) { mutableStateOf("") }
    val submit = {
        if (state.codeRequested) viewModel.verify(code) else viewModel.requestCode()
    }
    GateLayout {
        Text(
            when {
                state.codeRequested -> "Проверьте почту"
                mode == AuthMode.REGISTER -> "Создать аккаунт"
                else -> "Войти в NOVA"
            },
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            if (state.codeRequested) "Введите одноразовый код из письма."
            else "Подтвердите адрес электронной почты, чтобы начать общаться.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (!state.codeRequested) {
            GlassTabs(AuthMode.entries.map { it.label }, mode.ordinal, { mode = AuthMode.entries[it] })
        }
        OutlinedTextField(
            value = state.email,
            onValueChange = viewModel::setEmail,
            label = { Text("Электронная почта") },
            enabled = !state.busy && !state.codeRequested,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            modifier = Modifier.fillMaxWidth(),
        )
        if (state.codeRequested) {
            OutlinedTextField(
                value = code,
                onValueChange = { code = it.filter(Char::isDigit).take(12) },
                label = { Text("Одноразовый код") },
                enabled = !state.busy,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { submit() }),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Button(
            onClick = submit,
            enabled = !state.busy && if (state.codeRequested) code.length >= 6 else state.email.contains('@'),
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) {
            LoadingLabel(state.busy, if (state.codeRequested) "Подтвердить почту" else "Получить код")
        }
        if (state.codeRequested) {
            TextButton(
                onClick = { viewModel.setCodeRequested(false); code = "" },
                enabled = !state.busy,
                modifier = Modifier.heightIn(min = 48.dp),
            ) { Text("Изменить адрес") }
            TextButton(onClick = viewModel::requestCode, enabled = !state.busy, modifier = Modifier.heightIn(min = 48.dp)) {
                Text("Отправить код повторно")
            }
        }
        Notice(state.notice)
    }
}

@Composable
private fun OnboardingScreen(state: MainUiState, viewModel: MainViewModel) {
    var username by rememberSaveable { mutableStateOf("") }
    var displayName by rememberSaveable { mutableStateOf("") }
    GateLayout {
        Text("Создайте профиль", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Другие пользователи смогут найти вас по имени пользователя.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(
            username,
            { username = it.take(32) },
            label = { Text("Имя пользователя") },
            prefix = { Text("@") },
            supportingText = { Text("От 3 до 32 символов. Латиница, цифры и _") },
            singleLine = true,
            enabled = !state.busy,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            displayName,
            { displayName = it.take(80) },
            label = { Text("Отображаемое имя") },
            singleLine = true,
            enabled = !state.busy,
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = { viewModel.completeProfile(username, displayName) },
            enabled = !state.busy && username.isNotBlank() && displayName.isNotBlank(),
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) { LoadingLabel(state.busy, "Сохранить профиль") }
        TextButton(onClick = viewModel::logout, enabled = !state.busy, modifier = Modifier.heightIn(min = 48.dp)) {
            Text("Выйти из аккаунта")
        }
        Notice(state.notice)
    }
}

@Composable
private fun GateLayout(content: @Composable ColumnScope.() -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val viewportHeight = maxHeight
        Box(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).heightIn(min = viewportHeight).padding(20.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier.widthIn(max = 420.dp).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(22.dp),
            ) {
                BrandMark()
                NovaGlassSurface(Modifier.fillMaxWidth(), radius = 28.dp) {
                    Column(
                        Modifier.fillMaxWidth().padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        content = content,
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(state: MainUiState, chats: List<ChatEntity>, viewModel: MainViewModel, openAssistant: () -> Unit) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BrandMark()
                TextButton(onClick = openAssistant, modifier = Modifier.heightIn(min = 48.dp)) { Text("Помощник") }
            }
        }
        item {
            NovaGlassSurface(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Найти человека", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    OutlinedTextField(
                        value = state.profileSearchQuery,
                        onValueChange = viewModel::setSearchQuery,
                        label = { Text("Имя пользователя") },
                        prefix = { Text("@") },
                        singleLine = true,
                        enabled = !state.busy,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = { viewModel.searchUsers() }),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Button(
                        onClick = viewModel::searchUsers,
                        enabled = !state.busy && state.profileSearchQuery.isNotBlank(),
                        modifier = Modifier.align(Alignment.End).heightIn(min = 48.dp),
                    ) { Text("Искать") }
                }
            }
        }
        items(state.searchResults, key = { "user:${it.id}" }) { user ->
            UserResult(user, state.busy) { viewModel.createChat(user) }
        }
        item { Notice(state.notice) }
        item {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Чаты", Modifier.weight(1f), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                TextButton(onClick = viewModel::refresh, enabled = !state.busy, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text("Обновить")
                }
            }
        }
        if (chats.isEmpty()) {
            item {
                EmptyPanel(
                    if (state.busy) "Загружаем…" else "Диалогов пока нет",
                    if (state.busy) "Подождите, обновляем список." else "Найдите человека и отправьте ему сообщение.",
                )
            }
        }
        items(chats, key = { "chat:${it.id}" }) { chat ->
            ChatRow(chat) { viewModel.selectChat(chat.id) }
        }
    }
}

@Composable
private fun SettingsScreen(state: MainUiState, appearance: NovaAppearance, weather: WeatherTone?, viewModel: MainViewModel) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Text("Настройки", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        NovaSettingsGroup("Аккаунт") {
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                InitialAvatar(state.displayName, state.profile?.avatarUrl, state.profile?.avatarContentType)
                Column(Modifier.weight(1f)) {
                    Text(state.displayName, fontWeight = FontWeight.SemiBold)
                    Text("@${state.username}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(state.email, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        NovaProfileSettings(state, viewModel)
        NovaAppearanceSettings(appearance, weather)
        NovaUpdateSettings()
        TextButton(
            onClick = viewModel::logout,
            enabled = !state.busy,
            modifier = Modifier.heightIn(min = 48.dp),
        ) { Text("Выйти из аккаунта", color = MaterialTheme.colorScheme.error) }
        Notice(state.notice)
    }
}

@Composable
private fun ChatScreen(chatId: String, state: MainUiState, chat: ChatEntity?, viewModel: MainViewModel) {
    val messagesFlow = remember(chatId) { viewModel.messages(chatId) }
    val messages by messagesFlow.collectAsStateWithLifecycle(initialValue = emptyList())
    val newestFirst = remember(messages) { messages.asReversed() }
    val scroll = rememberLazyListState()
    val latestMessage = newestFirst.firstOrNull()
    var draft by rememberSaveable(chatId) { mutableStateOf("") }
    val send: () -> Unit = {
        val submitted = draft
        if (MessageRules.normalizedText(submitted) != null && !state.busy) {
            viewModel.send(chatId, submitted) {
                if (draft == submitted) draft = ""
            }
        }
    }

    LaunchedEffect(latestMessage?.clientMessageId) {
        if (latestMessage != null && (scroll.firstVisibleItemIndex <= 1 || latestMessage.senderId == state.userId)) {
            scroll.scrollToItem(0)
        }
    }

    Column(
        Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        NovaGlassSurface(Modifier.fillMaxWidth(), radius = 20.dp) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = { viewModel.selectChat(null) }, modifier = Modifier.heightIn(min = 48.dp)) { Text("Назад") }
                Column(Modifier.weight(1f)) {
                    Text(chat?.participantDisplayName?.ifBlank { "Диалог" } ?: "Диалог", fontWeight = FontWeight.SemiBold)
                    chat?.let {
                        Text("@${it.participantUsername}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }
        Notice(state.notice)
        if (messages.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                EmptyPanel("Начните разговор", "Напишите первое сообщение.")
            }
        } else {
            LazyColumn(
                Modifier.weight(1f).fillMaxWidth(),
                state = scroll,
                reverseLayout = true,
                contentPadding = PaddingValues(vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(newestFirst, key = { it.clientMessageId }) { message ->
                    MessageBubble(message, message.senderId == state.userId) { viewModel.retry(message.clientMessageId) }
                }
            }
        }
        NovaGlassSurface(Modifier.fillMaxWidth(), radius = 20.dp) {
            Row(
                Modifier.fillMaxWidth().padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { if (it.length <= 10_000) draft = it },
                    label = { Text("Сообщение") },
                    maxLines = 4,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { send() }),
                    modifier = Modifier.weight(1f),
                )
                Button(
                    onClick = send,
                    enabled = draft.isNotBlank() && !state.busy,
                    modifier = Modifier.heightIn(min = 48.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                ) { Text("Отправить") }
            }
        }
    }
}

@Composable
private fun GlassTabs(labels: List<String>, index: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    NovaGlassSurface(modifier.fillMaxWidth(), radius = 28.dp) {
        BoxWithConstraints(Modifier.padding(4.dp)) {
            val itemWidth = maxWidth / labels.size
            val indicatorOffset by animateDpAsState(itemWidth * index, spring(stiffness = 380f), label = "Положение вкладки")
            val indicatorShape = RoundedCornerShape(24.dp)
            Box(Modifier.matchParentSize()) {
                NovaGlassSurface(
                    Modifier.offset(x = indicatorOffset).width(itemWidth).fillMaxHeight(),
                    radius = 24.dp,
                    highlighted = true,
                ) {}
            }
            Row(Modifier.fillMaxWidth().selectableGroup()) {
                labels.forEachIndexed { itemIndex, label ->
                    Box(
                        Modifier.weight(1f).heightIn(min = 48.dp).clip(indicatorShape)
                            .selectable(selected = itemIndex == index, role = Role.Tab, onClick = { onSelect(itemIndex) })
                            .padding(horizontal = 4.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            label,
                            color = if (itemIndex == index) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = if (itemIndex == index) FontWeight.Bold else FontWeight.Medium,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatRow(chat: ChatEntity, onClick: () -> Unit) {
    NovaGlassSurface(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).clickable(role = Role.Button, onClick = onClick),
        radius = 20.dp,
    ) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 68.dp).padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            InitialAvatar(chat.participantDisplayName)
            Column(Modifier.weight(1f)) {
                Text(chat.participantDisplayName.ifBlank { "Пользователь" }, fontWeight = FontWeight.SemiBold)
                Text(
                    "@${chat.participantUsername}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text("›", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
private fun UserResult(user: PublicUserDto, busy: Boolean, onClick: () -> Unit) {
    NovaGlassSurface(Modifier.fillMaxWidth(), radius = 20.dp) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            InitialAvatar(user.displayName, user.avatarUrl, user.avatarContentType)
            Column(Modifier.weight(1f)) {
                Text(user.displayName, fontWeight = FontWeight.SemiBold)
                Text("@${user.username}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            TextButton(onClick = onClick, enabled = !busy, modifier = Modifier.heightIn(min = 48.dp)) {
                Text("Написать")
            }
        }
    }
}

@Composable
private fun MessageBubble(message: MessageEntity, own: Boolean, onRetry: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth(), horizontalAlignment = if (own) Alignment.End else Alignment.Start) {
        NovaGlassSurface(Modifier.widthIn(max = 440.dp).fillMaxWidth(0.86f), radius = 20.dp, highlighted = own) {
            Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(message.text)
                Text(
                    listOfNotNull(
                        formatTime(message.createdAt).takeIf(String::isNotBlank),
                        MessageRules.statusLabel(message.status).takeIf { own },
                    ).joinToString(" · "),
                    color = if (message.status == "FAILED") colors.error else colors.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
        if (message.status == "FAILED") {
            TextButton(onClick = onRetry, modifier = Modifier.heightIn(min = 48.dp)) { Text("Повторить отправку") }
        }
    }
}

@Composable
private fun EmptyPanel(title: String, subtitle: String) {
    NovaGlassSurface(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun InitialAvatar(displayName: String, url: String? = null, mime: String? = null) {
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier.size(42.dp).clip(CircleShape).background(lerp(colors.surface, colors.primary, 0.12f), CircleShape)
            .border(1.dp, colors.outlineVariant, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(displayName.trim().take(1).uppercase().ifBlank { "•" }, color = colors.primary, fontWeight = FontWeight.Bold)
        NovaProfileMedia(url, mime, Modifier.fillMaxSize())
    }
}

@Composable
private fun BrandMark() {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(42.dp).background(NovaGraphite, RoundedCornerShape(13.dp))
                .border(1.dp, NovaMint.copy(alpha = 0.6f), RoundedCornerShape(13.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Image(painterResource(R.drawable.ic_launcher_foreground), contentDescription = null, modifier = Modifier.fillMaxSize())
        }
        Text("NOVA", fontWeight = FontWeight.Bold, letterSpacing = 3.sp, style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
private fun LoadingLabel(busy: Boolean, label: String) {
    if (busy) {
        CircularProgressIndicator(
            Modifier.size(20.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            strokeWidth = 2.dp,
        )
    } else {
        Text(label)
    }
}

@Composable
private fun Notice(text: String?) {
    if (!text.isNullOrBlank()) {
        NovaGlassSurface(Modifier.fillMaxWidth(), radius = 16.dp) {
            Text(
                text,
                color = MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
    }
}

@Composable
private fun OfflineBanner(signedIn: Boolean) {
    Text(
        if (signedIn) "Офлайн. Исходящие сообщения остаются в очереди." else "Нет подключения к интернету.",
        color = Color(0xFF352205),
        style = MaterialTheme.typography.labelMedium,
        modifier = Modifier.fillMaxWidth().background(Color(0xFFFFD896))
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .semantics { liveRegion = LiveRegionMode.Polite },
    )
}

private fun formatTime(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(value))
}.getOrDefault("")
