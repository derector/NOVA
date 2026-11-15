package io.nova.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import io.nova.app.NovaApplication
import io.nova.app.data.local.ChatEntity
import io.nova.app.data.remote.ApiFailure
import io.nova.app.data.remote.PublicUserDto
import io.nova.app.data.repo.NovaRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class MainUiState(
    val signedIn: Boolean = false,
    val profileRequired: Boolean = false,
    val email: String = "",
    val codeRequested: Boolean = false,
    val userId: String = "",
    val username: String = "",
    val displayName: String = "",
    val selectedChatId: String? = null,
    val searchResults: List<PublicUserDto> = emptyList(),
    val busy: Boolean = false,
    val notice: String? = null,
    val profileSearchQuery: String = "",
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val appContainer = (application as NovaApplication).container
    private val repository: NovaRepository = appContainer.repository
    private val mutableState = MutableStateFlow(MainUiState())
    val state: StateFlow<MainUiState> = mutableState.asStateFlow()
    val online = appContainer.networkMonitor.online
    val chats = repository.observeChats()

    init {
        repository.sessionStore.read()?.let { session ->
            mutableState.value = MainUiState(
                signedIn = true,
                profileRequired = session.username.isBlank(),
                email = session.email,
                userId = session.userId,
                username = session.username,
                displayName = session.displayName,
                busy = true,
            )
            viewModelScope.launch {
                try {
                    withContext(Dispatchers.IO) { repository.syncChats() }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Throwable) {
                    setNotice(friendlyError(error))
                } finally {
                    mutableState.value = mutableState.value.copy(busy = false)
                }
            }
        }
    }

    fun setEmail(value: String) { mutableState.value = mutableState.value.copy(email = value, notice = null) }
    fun setCodeRequested(value: Boolean) { mutableState.value = mutableState.value.copy(codeRequested = value) }
    fun setSearchQuery(value: String) { mutableState.value = mutableState.value.copy(profileSearchQuery = value) }

    fun requestCode() = perform {
        val email = mutableState.value.email.trim()
        require(email.contains('@') && email.length <= 320) { "Введите корректный email" }
        repository.requestCode(email)
        mutableState.value = mutableState.value.copy(codeRequested = true, notice = "Если адрес доступен, письмо с кодом отправлено.")
    }

    fun verify(code: String) = perform {
        val email = mutableState.value.email.trim()
        require(code.trim().length in 6..12) { "Введите код из письма" }
        repository.verify(email, code)
        val session = repository.sessionStore.read() ?: error("Не удалось сохранить сессию")
        appContainer.realtime.start()
        mutableState.value = mutableState.value.copy(
            signedIn = true,
            profileRequired = session.username.isBlank(),
            userId = session.userId,
            username = session.username,
            displayName = session.displayName,
            notice = null,
        )
    }

    fun completeProfile(username: String, displayName: String) = perform {
        require(username.matches(Regex("^[A-Za-z0-9_]{3,32}$"))) { "Username: 3–32 символа, латиница, цифры и _" }
        require(displayName.trim().isNotEmpty() && displayName.trim().length <= 80) { "Введите имя (до 80 символов)" }
        repository.completeProfile(username, displayName.trim())
        mutableState.value = mutableState.value.copy(profileRequired = false, username = username, displayName = displayName.trim(), notice = null)
    }

    fun searchUsers() = perform {
        val query = mutableState.value.profileSearchQuery.trim().removePrefix("@")
        require(query.isNotBlank() && query.length <= 32) { "Введите username для поиска" }
        val ownId = mutableState.value.userId
        val results = repository.searchUsers(query).filterNot { it.id == ownId }
        mutableState.value = mutableState.value.copy(searchResults = results, notice = if (results.isEmpty()) "Пользователи не найдены." else null)
    }

    fun createChat(user: PublicUserDto) = perform {
        val chat = repository.createDirectChat(user.id)
        mutableState.value = mutableState.value.copy(selectedChatId = chat.id, searchResults = emptyList(), profileSearchQuery = "", notice = null)
    }

    fun selectChat(chatId: String?) {
        mutableState.value = mutableState.value.copy(selectedChatId = chatId, notice = null)
        if (chatId != null) viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { repository.catchUp(chatId) } }
                .onFailure { setNotice(friendlyError(it)) }
        }
    }

    fun messages(chatId: String) = repository.observeMessages(chatId)

    fun send(chatId: String, text: String) = perform(clearNotice = true) {
        withContext(Dispatchers.IO) { repository.sendMessage(chatId, text) }
        // The durable WorkManager outbox owns retries; foreground UI never invents a server acknowledgement.
    }

    fun retry(clientMessageId: String) = perform {
        withContext(Dispatchers.IO) { repository.retryMessage(clientMessageId) }
    }

    fun refresh() = perform { repository.syncChats() }

    fun logout() = perform {
        appContainer.realtime.stop()
        try {
            repository.logout()
        } finally {
            mutableState.value = MainUiState()
        }
    }

    fun dismissNotice() { mutableState.value = mutableState.value.copy(notice = null) }

    private fun perform(clearNotice: Boolean = false, action: suspend () -> Unit) {
        if (mutableState.value.busy) return
        mutableState.value = mutableState.value.copy(busy = true, notice = if (clearNotice) null else mutableState.value.notice)
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { action() }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Throwable) {
                setNotice(friendlyError(error))
            } finally {
                mutableState.value = mutableState.value.copy(busy = false)
            }
        }
    }

    private fun setNotice(text: String) { mutableState.value = mutableState.value.copy(notice = text) }

    private fun friendlyError(error: Throwable): String = when (error) {
        is ApiFailure -> when {
            error.code == 401 -> "Сессия истекла. Выйдите и войдите снова."
            error.code == 409 -> "Username занят или ключ сообщения конфликтует с другим текстом."
            error.code == 429 -> "Слишком много запросов. Подождите и попробуйте снова."
            error.code == 503 -> "Email-доставка временно недоступна."
            error.retryable -> "Нет соединения с сервером. Данные сохранены локально; попробуйте ещё раз."
            else -> error.message
        }
        else -> error.message ?: "Не удалось выполнить действие. Проверьте соединение и повторите."
    }
}
