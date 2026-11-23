package io.nova.app.data.repo

import android.content.Context
import android.net.Uri
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.room.withTransaction
import io.nova.app.data.local.ChatEntity
import io.nova.app.data.local.MessageEntity
import io.nova.app.data.local.NovaDatabase
import io.nova.app.data.remote.ApiFailure
import io.nova.app.data.remote.ChatDto
import io.nova.app.data.remote.MessageDto
import io.nova.app.data.remote.NovaApi
import io.nova.app.data.remote.ProfileMediaSlot
import io.nova.app.data.remote.PublicUserDto
import io.nova.app.data.remote.UserDto
import io.nova.app.data.security.SessionData
import io.nova.app.data.security.SessionStore
import io.nova.app.data.work.OutboxWorker
import io.nova.app.domain.MessageRules
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.time.Instant
import java.util.concurrent.TimeUnit

class NovaRepository internal constructor(
    private val context: Context,
    private val db: NovaDatabase,
    private val api: NovaApi,
    val sessionStore: SessionStore,
) {
    private val dao = db.dao()
    private val tokenMutex = Mutex()
    private val localDataMutex = Mutex()

    fun observeChats(): Flow<List<ChatEntity>> = dao.observeChats()
    fun observeMessages(chatId: String): Flow<List<MessageEntity>> = dao.observeMessages(chatId)
    suspend fun findChat(chatId: String): ChatEntity? = dao.findChat(chatId)
    suspend fun chatIds(): List<String> = dao.allChatIds()
    suspend fun socketAccessToken(): String = accessToken()

    suspend fun requestCode(email: String) = api.requestCode(email.trim())

    suspend fun verify(email: String, code: String) {
        val verified = api.verify(email.trim(), code.trim())
        localDataMutex.withLock {
            if (sessionStore.read()?.userId != verified.user.id) clearLocalMessages()
            sessionStore.save(SessionData(
                email = verified.user.email,
                accessToken = verified.accessToken,
                accessTokenExpiresAt = verified.accessTokenExpiresAt,
                refreshToken = verified.refreshToken,
                userId = verified.user.id,
                username = verified.user.username,
                displayName = verified.user.displayName,
            ))
        }
    }

    suspend fun profile(): UserDto = authorized { api.me(it) }

    suspend fun completeProfile(username: String, displayName: String, bio: String? = null): UserDto {
        val user = authorized { api.updateProfile(it, username, displayName, bio) }
        sessionStore.read()?.let { old -> sessionStore.save(old.copy(username = user.username, displayName = user.displayName)) }
        return user
    }

    internal suspend fun uploadProfileMedia(slot: ProfileMediaSlot, uri: Uri): UserDto {
        val temp = File.createTempFile("nova-profile-", ".upload", context.cacheDir)
        try {
            val source = context.contentResolver.openInputStream(uri)
                ?: throw IllegalArgumentException("Не удалось открыть файл")
            source.use { input ->
                temp.outputStream().use { output ->
                    val buffer = ByteArray(32 * 1024)
                    var total = 0
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        require(total <= 8 * 1024 * 1024) { "Размер файла должен быть не больше 8 МБ" }
                        output.write(buffer, 0, count)
                    }
                    require(total > 0) { "Выберите непустой файл" }
                }
            }
            return authorized { api.uploadProfileMedia(it, slot, temp) }
        } finally {
            temp.delete()
        }
    }

    internal suspend fun removeProfileMedia(slot: ProfileMediaSlot): UserDto =
        authorized { api.removeProfileMedia(it, slot) }

    suspend fun searchUsers(username: String): List<PublicUserDto> = authorized {
        api.searchUsers(it, username.trim().removePrefix("@"))
    }

    suspend fun createDirectChat(userId: String): ChatEntity {
        val chat = authorized { api.createDirectChat(it, userId) }
        val existing = dao.findChat(chat.id)
        val entity = chat.toEntity().copy(lastMessageCursor = existing?.lastMessageCursor)
        if (entity != existing) dao.upsertChats(listOf(entity))
        return entity
    }

    suspend fun syncChats() {
        val account = sessionStore.read()?.userId ?: return
        val chats = authorized(account) { api.listChats(it) }
        localDataMutex.withLock {
            if (sessionStore.read()?.userId != account) return
            db.withTransaction {
                val changed = chats.mapNotNull { dto ->
                    val existing = dao.findChat(dto.id)
                    val updated = dto.toEntity().copy(lastMessageCursor = existing?.lastMessageCursor)
                    updated.takeIf { it != existing }
                }
                if (changed.isNotEmpty()) dao.upsertChats(changed)
            }
        }
        chats.forEach { catchUp(it.id, account) }
    }

    suspend fun catchUp(chatId: String, account: String? = sessionStore.read()?.userId) {
        if (account == null) return
        var cursor = dao.findChat(chatId)?.lastMessageCursor
        repeat(100) {
            if (sessionStore.read()?.userId != account) return
            val page = authorized(account) { api.listMessages(it, chatId, cursor) }
            if (page.items.isEmpty()) return
            val resolved = page.nextCursor ?: page.items.last().id
            if (resolved == cursor) return
            localDataMutex.withLock {
                if (sessionStore.read()?.userId != account) return
                db.withTransaction {
                    page.items.forEach { upsertServerMessage(it, fromSocket = false) }
                    dao.updateCursor(chatId, resolved)
                }
            }
            cursor = resolved
            if (page.items.size < 100) return
        }
    }

    suspend fun acceptSocketMessage(message: MessageDto, account: String) {
        localDataMutex.withLock {
            if (sessionStore.read()?.userId == account) upsertServerMessage(message, fromSocket = true)
        }
    }

    suspend fun sendMessage(chatId: String, rawText: String): String {
        val text = MessageRules.normalizedText(rawText) ?: throw IllegalArgumentException("Введите сообщение (до 10 000 символов)")
        val session = sessionStore.read() ?: throw ApiFailure(401, "Войдите снова", false)
        val id = MessageRules.newIdempotencyKey()
        val now = Instant.now().toString()
        db.withTransaction {
            dao.enqueue(
                MessageEntity(id, null, id, chatId, session.userId, text, now, null, "PENDING"),
                io.nova.app.data.local.OutboxEntity(id, chatId, text, now),
            )
        }
        enqueueWorker()
        return id
    }

    suspend fun retryMessage(clientMessageId: String) {
        db.dao().resetMessage(clientMessageId)
        db.dao().resetOutbox(clientMessageId)
        enqueueWorker()
    }

    suspend fun flushOutbox() {
        val account = sessionStore.read()?.userId ?: return
        for (item in dao.pendingOutbox()) {
            if (sessionStore.read()?.userId != account) return
            try {
                val ack = authorized(account) { api.sendMessage(it, item.chatId, item.clientMessageId, item.text) }
                localDataMutex.withLock {
                    if (sessionStore.read()?.userId == account) {
                        db.withTransaction { confirmAck(ack) }
                    }
                }
            } catch (failure: ApiFailure) {
                if (sessionStore.read()?.userId != account) return
                if (failure.retryable || failure.code == 401) throw failure
                localDataMutex.withLock {
                    if (sessionStore.read()?.userId == account) {
                        db.withTransaction {
                            dao.failOutbox(item.clientMessageId, failure.message)
                            dao.failMessage(item.clientMessageId)
                        }
                    }
                }
            }
        }
    }

    suspend fun logout() {
        val current = sessionStore.read()
        try {
            if (current != null) api.logout(current.accessToken)
        } finally {
            localDataMutex.withLock {
                sessionStore.clear()
                clearLocalMessages()
            }
        }
    }

    private fun clearLocalMessages() {
        WorkManager.getInstance(context).cancelUniqueWork(OUTBOX_WORK)
        db.clearAllTables()
    }

    private suspend fun refreshAfterUnauthorized(account: String, observedToken: String) {
        tokenMutex.withLock {
            val session = sessionFor(account)
            if (session.accessToken != observedToken) return
            val refreshed = api.refresh(session.refreshToken)
            localDataMutex.withLock {
                if (sessionStore.read()?.refreshToken != session.refreshToken) return
                sessionStore.save(session.copy(
                    accessToken = refreshed.accessToken,
                    accessTokenExpiresAt = refreshed.accessTokenExpiresAt,
                    refreshToken = refreshed.refreshToken,
                ))
            }
        }
    }

    private fun sessionFor(account: String): SessionData =
        sessionStore.read()?.takeIf { it.userId == account } ?: throw ApiFailure(401, "Войдите снова", false)

    private fun currentAccount(): String = sessionStore.read()?.userId ?: throw ApiFailure(401, "Войдите снова", false)

    private suspend fun accessToken(account: String = currentAccount()): String {
        val session = sessionFor(account)
        val expiry = runCatching { Instant.parse(session.accessTokenExpiresAt) }.getOrNull()
        if (expiry == null || !expiry.isBefore(Instant.now().plusSeconds(30))) return session.accessToken
        refreshAfterUnauthorized(account, session.accessToken)
        return sessionFor(account).accessToken
    }

    private suspend fun <T> authorized(account: String = currentAccount(), request: suspend (String) -> T): T {
        val token = accessToken(account)
        return try {
            request(token)
        } catch (failure: ApiFailure) {
            if (failure.code != 401) throw failure
            refreshAfterUnauthorized(account, token)
            request(sessionFor(account).accessToken)
        }
    }

    private suspend fun upsertServerMessage(dto: MessageDto, fromSocket: Boolean) {
        val current = sessionStore.read()
        val old = dao.findMessage(dto.clientMessageId)
        val isLocalOwnPending = old?.status == "PENDING" && dto.senderId == current?.userId && fromSocket
        dao.upsertMessage(MessageEntity(
            localKey = dto.clientMessageId,
            serverId = dto.id,
            clientMessageId = dto.clientMessageId,
            chatId = dto.chatId,
            senderId = dto.senderId,
            text = dto.text,
            createdAt = dto.createdAt,
            deliveredAt = dto.deliveredAt,
            status = if (isLocalOwnPending) "PENDING" else "SENT",
        ))
    }

    private suspend fun confirmAck(dto: MessageDto) {
        dao.confirmMessage(dto.clientMessageId, dto.id, dto.createdAt, dto.deliveredAt)
        dao.deleteOutbox(dto.clientMessageId)
    }

    private fun enqueueWorker() {
        val request = OneTimeWorkRequestBuilder<OutboxWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
            WorkManager.getInstance(context).enqueueUniqueWork(OUTBOX_WORK, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    private companion object { const val OUTBOX_WORK = "nova-outbox-send" }

    private fun ChatDto.toEntity() = ChatEntity(id, participant.id, participant.username, participant.displayName, updatedAt)
}
