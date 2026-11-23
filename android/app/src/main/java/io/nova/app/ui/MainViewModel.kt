package io.nova.app.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import io.nova.app.NovaApplication
import io.nova.app.data.local.ChatEntity
import io.nova.app.data.remote.ApiFailure
import io.nova.app.data.remote.ProfileMediaSlot
import io.nova.app.data.remote.PublicUserDto
import io.nova.app.data.remote.UserDto
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
    val profile: UserDto? = null,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val appContainer = (application as NovaApplication).container
    private val repository: NovaRepository = appContainer.repository
    private val mutableState = MutableStateFlow(MainUiState())
    val state: StateFlow<MainUiState> = mutableState.asStateFlow()
    val online = appContainer.networkMonitor.online
    val chats = repository.observeChats()
    private val defaultUsername = Regex("^nova_[a-f0-9]{12}$")

    init {
        repository.sessionStore.read()?.let { session ->
            mutableState.value = MainUiState(
                signedIn = true,
                profileRequired = profileRequired(session.username, session.displayName),
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
    fun setCodeRequested(value: Boolean) { mutableState.value = mutableState.value.copy(codeRequested = value, notice = null) }
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
            profileRequired = profileRequired(session.username, session.displayName),
            userId = session.userId,
            username = session.username,
            displayName = session.displayName,
            notice = null,
        )
    }

    fun completeProfile(username: String, displayName: String, bio: String? = null) = perform {
        require(username.matches(Regex("^[A-Za-z0-9_]{3,32}$"))) { "Имя пользователя: 3–32 символа, латиница, цифры и _" }
        require(displayName.trim().isNotEmpty() && displayName.trim().length <= 80) { "Введите имя (до 80 символов)" }
        require(bio == null || bio.length <= 240) { "Описание должно быть не длиннее 240 символов" }
        applyProfile(repository.completeProfile(username, displayName.trim(), bio?.trim()))
    }

    fun loadProfile() = perform { applyProfile(repository.profile()) }

    internal fun uploadProfileMedia(slot: ProfileMediaSlot, uri: Uri) = perform {
        applyProfile(repository.uploadProfileMedia(slot, uri))
    }

    internal fun removeProfileMedia(slot: ProfileMediaSlot) = perform {
        applyProfile(repository.removeProfileMedia(slot))
    }

    private fun applyProfile(profile: UserDto) {
        mutableState.value = mutableState.value.copy(
            profile = profile,
            profileRequired = profileRequired(profile.username, profile.displayName),
            username = profile.username,
            displayName = profile.displayName,
            notice = null,
        )
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
            try {
                withContext(Dispatchers.IO) { repository.catchUp(chatId) }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                if (mutableState.value.selectedChatId == chatId) setNotice(friendlyError(error))
            }
        }
    }

    fun messages(chatId: String) = repository.observeMessages(chatId)

    suspend fun assistantAccessToken(): String = repository.socketAccessToken()

    fun send(chatId: String, text: String, onQueued: () -> Unit) = perform(clearNotice = true) {
        repository.sendMessage(chatId, text)
        // Clear the draft only after the durable WorkManager outbox accepted it.
        withContext(Dispatchers.Main.immediate) { onQueued() }
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

    private fun profileRequired(username: String, displayName: String): Boolean =
        username.isBlank() || defaultUsername.matches(username) && displayName == "Пользователь NOVA"

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
