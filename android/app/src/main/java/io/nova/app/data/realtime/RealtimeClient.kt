package io.nova.app.data.realtime

import android.util.Log
import com.google.gson.Gson
import io.nova.app.data.remote.MessageDto
import io.nova.app.data.repo.NovaRepository
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import org.json.JSONObject

class RealtimeClient(private val repository: NovaRepository, private val baseUrl: String) {
    private val gson = Gson()
    private var socket: Socket? = null
    private var scope: CoroutineScope? = null
    private var chatsJob: Job? = null

    @Synchronized
    fun start() {
        if (socket?.connected() == true || scope != null) return
        if (repository.sessionStore.read() == null) return
        val activeScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        scope = activeScope
        chatsJob = activeScope.launch {
            runCatching { repository.syncChats() }.onFailure { Log.w(TAG, "Initial REST sync failed", it) }
            repository.observeChats().collectLatest { chats ->
                if (socket?.connected() == true) chats.forEach { join(it.id) }
            }
        }
        activeScope.launch {
            runCatching {
                val token = repository.socketAccessToken()
                val options = IO.Options().apply {
                    auth = mapOf("token" to token)
                    reconnection = true
                    reconnectionAttempts = Int.MAX_VALUE
                    reconnectionDelay = 1_000
                    reconnectionDelayMax = 30_000
                    timeout = 15_000
                }
                val connection = IO.socket(baseUrl.trimEnd('/'), options)
                socket = connection
                connection.on(Socket.EVENT_CONNECT) {
                    activeScope.launch {
                        connection.emit("presence:heartbeat")
                        repository.chatIds().forEach { join(it) }
                    }
                }
                activeScope.launch {
                    while (true) {
                        delay(30_000)
                        if (connection.connected()) connection.emit("presence:heartbeat")
                    }
                }
                connection.on(Socket.EVENT_CONNECT_ERROR) { args ->
                    Log.w(TAG, "Socket connection failed: ${args.firstOrNull()}")
                }
                connection.on("message:new") { args ->
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    runCatching { gson.fromJson(payload.toString(), MessageDto::class.java) }
                        .onSuccess { message -> activeScope.launch { repository.acceptSocketMessage(message) } }
                        .onFailure { Log.w(TAG, "Ignoring malformed message:new event", it) }
                }
                connection.on("message:read") { args ->
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    val ids = payload.optJSONArray("messageIds") ?: return@on
                    val messageIds = buildList { for (index in 0 until ids.length()) add(ids.optString(index)) }.filter { it.isNotBlank() }
                    activeScope.launch { repository.acceptReadReceipt(messageIds) }
                }
                connection.connect()
            }.onFailure { Log.w(TAG, "Socket setup failed", it) }
        }
    }

    @Synchronized
    fun stop() {
        chatsJob?.cancel()
        chatsJob = null
        socket?.disconnect()
        socket?.off()
        socket = null
        scope?.cancel()
        scope = null
    }

    private fun join(chatId: String) {
        val current = socket?.takeIf { it.connected() } ?: return
        current.emit("chat:join", JSONObject().put("chatId", chatId), Ack { args ->
            val ack = args.firstOrNull() as? JSONObject
            if (ack?.optBoolean("error", false) == true || ack?.has("error") == true) {
                Log.w(TAG, "chat:join rejected for an authorized chat")
            } else {
                scope?.launch {
                    runCatching { repository.catchUp(chatId) }
                        .onFailure { Log.w(TAG, "REST catch-up failed for $chatId", it) }
                }
            }
        })
    }

    fun setTyping(chatId: String, isTyping: Boolean) {
        socket?.takeIf { it.connected() }?.emit("typing:set", JSONObject().put("chatId", chatId).put("isTyping", isTyping))
    }

    private companion object { const val TAG = "NovaRealtime" }
}
