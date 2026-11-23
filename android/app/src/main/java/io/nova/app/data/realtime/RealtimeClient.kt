package io.nova.app.data.realtime

import android.util.Log
import com.google.gson.Gson
import io.nova.app.data.remote.MessageDto
import io.nova.app.data.repo.NovaRepository
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume

internal data class CallEvent(val name: String, val payload: JSONObject)

class RealtimeClient(private val repository: NovaRepository, private val baseUrl: String) {
    private val gson = Gson()
    @Volatile private var socket: Socket? = null
    private val joinedChats = ConcurrentHashMap.newKeySet<String>()
    private var scope: CoroutineScope? = null
    private var chatsJob: Job? = null
    private val callAvailability = MutableStateFlow(false)
    private val callUpdates = Channel<CallEvent>(capacity = 256)
    internal val callsAvailable = callAvailability.asStateFlow()
    internal val callEvents = callUpdates.receiveAsFlow()

    @Synchronized
    fun start() {
        if (socket?.connected() == true || scope != null) return
        val account = repository.sessionStore.read()?.userId ?: return
        val activeScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        scope = activeScope
        chatsJob = activeScope.launch {
            syncChats()
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
                connection.on(Socket.EVENT_CONNECT) {
                    joinedChats.clear()
                    connection.emit("call:ready", JSONObject().put("audioOnly", true), Ack { args ->
                        val ack = args.firstOrNull() as? JSONObject
                        if (socket === connection && connection.connected()) callAvailability.value = ack?.optBoolean("ok") == true
                    })
                    activeScope.launch {
                        repository.chatIds().forEach { join(it) }
                        syncChats()
                    }
                }
                connection.on(Socket.EVENT_DISCONNECT) {
                    if (socket === connection) callAvailability.value = false
                }
                callEventNames.forEach { name ->
                    connection.on(name) { args ->
                        val payload = args.firstOrNull() as? JSONObject ?: return@on
                        if (socket === connection) callUpdates.trySend(CallEvent(name, payload))
                    }
                }
                connection.on("chat:new") {
                    activeScope.launch { syncChats() }
                }
                connection.on(Socket.EVENT_CONNECT_ERROR) { args ->
                    Log.w(TAG, "Socket connection failed: ${args.firstOrNull()}")
                }
                connection.on("message:new") { args ->
                    val payload = args.firstOrNull() as? JSONObject ?: return@on
                    runCatching { gson.fromJson(payload.toString(), MessageDto::class.java) }
                        .onSuccess { message -> activeScope.launch { repository.acceptSocketMessage(message, account) } }
                        .onFailure { Log.w(TAG, "Ignoring malformed message:new event", it) }
                }
                synchronized(this@RealtimeClient) {
                    if (scope == activeScope) {
                        socket = connection
                        connection.connect()
                    }
                }
            }.onFailure { Log.w(TAG, "Socket setup failed", it) }
        }
    }

    @Synchronized
    fun stop() {
        chatsJob?.cancel()
        chatsJob = null
        joinedChats.clear()
        socket?.disconnect()
        socket?.off()
        socket = null
        callAvailability.value = false
        scope?.cancel()
        scope = null
    }

    internal suspend fun requestCall(event: String, payload: JSONObject): JSONObject =
        withTimeoutOrNull(6_000) {
            val current = socket?.takeIf { it.connected() && callAvailability.value }
                ?: error("Связь с сервером звонков отсутствует.")
            suspendCancellableCoroutine { continuation ->
                current.emit(event, payload, Ack { args ->
                    if (continuation.isActive) continuation.resume(args.firstOrNull() as? JSONObject)
                })
            }
        } ?: error("Сервер звонков не ответил.")

    internal fun sendCall(event: String, payload: JSONObject) {
        socket?.takeIf { it.connected() && callAvailability.value }?.emit(event, payload)
    }

    private suspend fun syncChats() {
        try {
            repository.syncChats()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            Log.w(TAG, "REST chat sync failed", error)
        }
    }

    private fun join(chatId: String) {
        val current = socket?.takeIf { it.connected() } ?: return
        if (!joinedChats.add(chatId)) return
        current.emit("chat:join", JSONObject().put("chatId", chatId), Ack { args ->
            val ack = args.firstOrNull() as? JSONObject
            if (ack?.has("error") == true) {
                joinedChats.remove(chatId)
                Log.w(TAG, "chat:join rejected for an authorized chat")
            } else {
                scope?.launch {
                    try {
                        repository.catchUp(chatId)
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (error: Exception) {
                        Log.w(TAG, "REST catch-up failed for $chatId", error)
                    }
                }
            }
        })
    }

    private companion object {
        const val TAG = "NovaRealtime"
        val callEventNames = listOf("call:invite", "call:accepted", "call:signal", "call:ended", "call:dismissed")
    }
}
