package io.nova.app.data.repo

import android.content.Context
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
import io.nova.app.data.remote.PublicUserDto
import io.nova.app.data.remote.UserDto
import io.nova.app.data.security.SessionData
import io.nova.app.data.security.SessionStore
import io.nova.app.data.work.OutboxWorker
import io.nova.app.domain.MessageRules
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
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

    fun observeChats(): Flow<List<ChatEntity>> = dao.observeChats()
    fun observeMessages(chatId: String): Flow<List<MessageEntity>> = dao.observeMessages(chatId)
    suspend fun findChat(chatId: String): ChatEntity? = dao.findChat(chatId)
    suspend fun chatIds(): List<String> = dao.allChatIds()
    suspend fun socketAccessToken(): String = accessToken()

    suspend fun requestCode(email: String) = api.requestCode(email.trim())

    suspend fun verify(email: String, code: String) {
        val verified = api.verify(email.trim(), code.trim())
        sessionStore.save(SessionData(
            email = verified.user.email,
            accessToken = verified.accessToken,
            accessTokenExpiresAt = verified.accessTokenExpiresAt,
            refreshToken = verified.refreshToken,
            userId = verified.user.id,
            username = verified.user.username,
            displayName = verified.user.displayName,
        ))
        syncChats()
    }

    suspend fun completeProfile(username: String, displayName: String) {
        val user = authorized { api.updateProfile(it, username, displayName) }
        sessionStore.read()?.let { old -> sessionStore.save(old.copy(username = user.username, displayName = user.displayName)) }
        syncChats()
    }

    suspend fun searchUsers(username: String): List<PublicUserDto> = authorized {
        api.searchUsers(it, username.trim().removePrefix("@"))
    }

    suspend fun createDirectChat(userId: String): ChatEntity {
        val chat = authorized { api.createDirectChat(it, userId) }
        return chat.toEntity().also { dao.upsertChats(listOf(it)); catchUp(it.id) }
    }

    suspend fun syncChats() {
        val chats = authorized { api.listChats(it) }.map { it.toEntity() }
        dao.upsertChats(chats)
        chats.forEach { catchUp(it.id) }
    }

    suspend fun catchUp(chatId: String) {
        var cursor = dao.findChat(chatId)?.lastMessageCursor
        repeat(100) {
            val page = authorized { api.listMessages(it, chatId, cursor) }
            for (message in page.items) upsertServerMessage(message, fromSocket = false)
            if (page.items.isEmpty()) return
            val resolved = page.nextCursor ?: page.items.last().id
            if (resolved == cursor) return
            cursor = resolved
            dao.updateCursor(chatId, cursor)
            if (page.items.size < 100) return
        }
    }

    suspend fun acceptSocketMessage(message: MessageDto) {
        upsertServerMessage(message, fromSocket = true)
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
        for (item in dao.pendingOutbox()) {
            try {
                val ack = authorized { api.sendMessage(it, item.chatId, item.clientMessageId, item.text) }
                confirmAck(ack)
            } catch (failure: ApiFailure) {
                if (failure.retryable || failure.code == 401) throw failure
                dao.failOutbox(item.clientMessageId, failure.message)
                dao.failMessage(item.clientMessageId)
            }
        }
    }

    suspend fun logout() {
        val current = sessionStore.read()
        try { if (current != null) api.logout(current.accessToken) } finally { sessionStore.clear() }
    }

    internal suspend fun refreshAfterUnauthorized() {
        tokenMutex.withLock {
            val session = sessionStore.read() ?: throw ApiFailure(401, "Session expired", false)
            val refreshed = api.refresh(session.refreshToken)
            sessionStore.save(session.copy(
                accessToken = refreshed.accessToken,
                accessTokenExpiresAt = refreshed.accessTokenExpiresAt,
                refreshToken = refreshed.refreshToken,
            ))
        }
    }

    private suspend fun accessToken(): String {
        var session = sessionStore.read() ?: throw ApiFailure(401, "Please sign in", false)
        val expiry = runCatching { Instant.parse(session.accessTokenExpiresAt) }.getOrNull()
        if (expiry != null && expiry.isBefore(Instant.now().plusSeconds(30))) {
            refreshAfterUnauthorized()
            session = sessionStore.read() ?: throw ApiFailure(401, "Session expired", false)
        }
        return session.accessToken
    }

    private suspend fun <T> authorized(request: suspend (String) -> T): T {
        val token = accessToken()
        return try {
            request(token)
        } catch (failure: ApiFailure) {
            if (failure.code != 401) throw failure
            refreshAfterUnauthorized()
            val rotated = sessionStore.read()?.accessToken ?: throw failure
            request(rotated)
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
        if (!fromSocket) dao.updateCursor(dto.chatId, dto.id)
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
            WorkManager.getInstance(context).enqueueUniqueWork("nova-outbox-send", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    private fun ChatDto.toEntity() = ChatEntity(id, participant.id, participant.username, participant.displayName, updatedAt)
}
