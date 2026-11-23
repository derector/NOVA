package io.nova.app.feature.calls

import android.content.Context
import androidx.annotation.MainThread
import io.nova.app.data.realtime.CallEvent
import io.nova.app.data.realtime.RealtimeClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.webrtc.IceCandidate
import org.webrtc.PeerConnection
import org.webrtc.SessionDescription

internal enum class CallPhase(val label: String) {
    INCOMING("Входящий аудиозвонок"),
    REQUESTING("Готовим звонок…"),
    RINGING("Звоним…"),
    CONNECTING("Соединяем…"),
    ACTIVE("На связи"),
}

internal data class CallPanel(
    val phase: CallPhase,
    val peerName: String,
    val incomingId: String? = null,
    val muted: Boolean = false,
)

internal class NovaCallController(context: Context, private val realtime: RealtimeClient) {
    private val application = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val engine by lazy { NativeAudioEngine(application) }
    private val mutablePanel = MutableStateFlow<CallPanel?>(null)
    private val mutableNotice = MutableStateFlow<String?>(null)
    val panel = mutablePanel.asStateFlow()
    val notice = mutableNotice.asStateFlow()
    val available = realtime.callsAvailable
    private var current: Session? = null

    init {
        scope.launch { realtime.callEvents.collect(::onEvent) }
        scope.launch {
            realtime.callsAvailable.collect { ready ->
                if (!ready) current?.let { terminate(it, "Связь с сервером звонков потеряна.") }
            }
        }
    }

    @MainThread
    fun start(chatId: String, peerName: String) {
        if (current != null || !available.value) return
        val session = Session(peerName = peerName, outgoing = true)
        current = session
        mutableNotice.value = null
        updatePanel(session, CallPhase.REQUESTING)
        scope.launch {
            try {
                val result = realtime.requestCall("call:start", JSONObject().put("chatId", chatId).put("kind", "audio"))
                val id = acceptedCallId(result)
                session.id = id
                if (current !== session) {
                    sendEnd(id)
                    return@launch
                }
                session.iceServers = parseIceServers(result.optJSONArray("iceServers"))
                val earlyEnd = session.earlyEnd
                if (earlyEnd != null && earlyEnd.optString("callId") == id) {
                    terminate(session, endReason(earlyEnd.optString("reason")))
                } else if (session.earlyAcceptedId == id) {
                    connect(session)
                } else {
                    updatePanel(session, CallPhase.RINGING)
                    armDeadline(session, 40_000, "Собеседник не ответил.")
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                terminate(session, error.message ?: "Не удалось начать звонок.", notifyPeer = true)
            }
        }
    }

    @MainThread
    fun accept(id: String) {
        val session = current?.takeIf { it.id == id && mutablePanel.value?.phase == CallPhase.INCOMING } ?: return
        updatePanel(session, CallPhase.CONNECTING)
        scope.launch {
            try {
                val result = realtime.requestCall("call:accept", JSONObject().put("callId", id))
                check(acceptedCallId(result) == id)
                if (current !== session) return@launch
                session.iceServers = parseIceServers(result.optJSONArray("iceServers"))
                connect(session)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                terminate(session, error.message ?: "Не удалось принять звонок.", notifyPeer = true)
            }
        }
    }

    @MainThread fun hangUp() { current?.let { terminate(it, notifyPeer = true) } }
    @MainThread fun clearNotice() { mutableNotice.value = null }

    @MainThread
    fun permissionDenied() {
        mutableNotice.value = "Для аудиозвонков разрешите NOVA доступ к микрофону."
    }

    @MainThread
    fun toggleMute() {
        val session = current ?: return
        val peer = session.peer ?: return
        val screen = mutablePanel.value ?: return
        if (screen.phase != CallPhase.ACTIVE) return
        peer.setMuted(!screen.muted)
        mutablePanel.value = screen.copy(muted = !screen.muted)
    }

    private fun onEvent(event: CallEvent) {
        val payload = event.payload
        if (event.name == "call:invite") {
            if (!available.value || current != null || payload.optString("kind") != "audio") return
            val id = payload.optString("id").takeIf(String::isNotBlank) ?: return
            val name = payload.optJSONObject("caller")?.optString("displayName").orEmpty().ifBlank { "Пользователь NOVA" }
            val session = Session(peerName = name, outgoing = false, id = id)
            current = session
            mutableNotice.value = null
            updatePanel(session, CallPhase.INCOMING)
            return
        }

        val session = current ?: return
        val id = payload.optString("callId").takeIf(String::isNotBlank) ?: return
        if (session.id == null && session.outgoing) {
            if (event.name == "call:accepted") session.earlyAcceptedId = id
            if (event.name == "call:ended") session.earlyEnd = payload
            return
        }
        if (session.id != id) return
        when (event.name) {
            "call:accepted" -> if (session.outgoing) connect(session)
            "call:signal" -> session.signals.trySend(payload)
            "call:ended" -> terminate(session, endReason(payload.optString("reason")))
            "call:dismissed" -> terminate(session, "Звонок принят на другом устройстве.")
        }
    }

    private fun connect(session: Session) {
        if (session.connection != null || current !== session) return
        val id = session.id ?: return
        updatePanel(session, CallPhase.CONNECTING)
        armDeadline(session, 25_000, "Аудиосоединение не установилось вовремя.")
        session.connection = scope.launch {
            try {
                session.audioFocus = NativeCallAudioFocus(application) {
                    scope.launch { terminate(session, "Аудиоустройство занято другим приложением.", notifyPeer = true) }
                }
                val peer = engine.open(
                    session.iceServers,
                    onCandidate = { candidate -> scope.launch { transmitCandidate(session, id, candidate) } },
                    onConnectionState = { state -> scope.launch { onPeerConnectionState(session, state) } },
                )
                session.peer = peer
                if (session.outgoing) sendDescription(peer, id, peer.makeOffer())
                for (payload in session.signals) applySignal(session, peer, id, payload)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                terminate(session, "Не удалось открыть аудиосоединение.", notifyPeer = true)
            } catch (_: LinkageError) {
                terminate(session, "Аудиозвонки недоступны на этом устройстве.", notifyPeer = true)
            }
        }
    }

    private suspend fun applySignal(session: Session, peer: NativeAudioPeer, id: String, payload: JSONObject) {
        payload.optJSONObject("candidate")?.let { candidate ->
            if (peer.remoteDescriptionSet) peer.addCandidate(candidate)
            else if (session.pendingCandidates.size < 128) session.pendingCandidates.add(candidate)
            return
        }
        val remote = payload.optJSONObject("description") ?: return
        val expectedType = if (session.outgoing) SessionDescription.Type.ANSWER else SessionDescription.Type.OFFER
        if (remote.optString("type") != expectedType.canonicalForm() || peer.remoteDescriptionSet) return
        peer.setRemoteDescription(SessionDescription(expectedType, remote.getString("sdp")))
        session.pendingCandidates.forEach(peer::addCandidate)
        session.pendingCandidates.clear()
        if (!session.outgoing) sendDescription(peer, id, peer.makeAnswer())
    }

    private suspend fun sendDescription(peer: NativeAudioPeer, id: String, description: SessionDescription) {
        peer.setLocalDescription(description)
        val payload = JSONObject().put("callId", id).put(
            "description",
            JSONObject().put("type", description.type.canonicalForm()).put("sdp", description.description),
        )
        check(realtime.requestCall("call:signal", payload).optBoolean("ok"))
    }

    private fun transmitCandidate(session: Session, id: String, candidate: IceCandidate) {
        if (current !== session || candidate.sdp.isBlank()) return
        val body = JSONObject()
            .put("candidate", candidate.sdp)
            .put("sdpMid", candidate.sdpMid ?: JSONObject.NULL)
            .put("sdpMLineIndex", candidate.sdpMLineIndex.takeIf { it >= 0 } ?: JSONObject.NULL)
        realtime.sendCall("call:signal", JSONObject().put("callId", id).put("candidate", body))
    }

    private fun onPeerConnectionState(session: Session, state: PeerConnection.PeerConnectionState) {
        if (current !== session) return
        when (state) {
            PeerConnection.PeerConnectionState.CONNECTED -> {
                session.deadline?.cancel()
                updatePanel(session, CallPhase.ACTIVE)
            }
            PeerConnection.PeerConnectionState.DISCONNECTED -> {
                updatePanel(session, CallPhase.CONNECTING)
                armDeadline(session, 10_000, "Аудиосоединение прервалось.")
            }
            PeerConnection.PeerConnectionState.FAILED, PeerConnection.PeerConnectionState.CLOSED ->
                terminate(session, "Не удалось установить аудиосоединение.", notifyPeer = true)
            else -> Unit
        }
    }

    private fun armDeadline(session: Session, delayMillis: Long, reason: String) {
        session.deadline?.cancel()
        session.deadline = scope.launch {
            delay(delayMillis)
            terminate(session, reason, notifyPeer = true)
        }
    }

    private fun updatePanel(session: Session, phase: CallPhase) {
        mutablePanel.value = CallPanel(
            phase = phase,
            peerName = session.peerName,
            incomingId = session.id.takeIf { phase == CallPhase.INCOMING },
            muted = mutablePanel.value?.muted ?: false,
        )
    }

    private fun terminate(session: Session, message: String? = null, notifyPeer: Boolean = false) {
        if (current !== session) return
        current = null
        session.deadline?.cancel()
        session.connection?.cancel()
        session.signals.cancel()
        runCatching { session.peer?.close() }
        runCatching { session.audioFocus?.close() }
        if (notifyPeer) session.id?.let(::sendEnd)
        mutablePanel.value = null
        mutableNotice.value = message
    }

    private fun sendEnd(id: String) = realtime.sendCall("call:end", JSONObject().put("callId", id))

    private fun acceptedCallId(result: JSONObject): String {
        if (!result.optBoolean("ok")) {
            error(result.optJSONObject("error")?.optString("message").orEmpty().ifBlank { "Звонок недоступен." })
        }
        return result.getString("callId")
    }

    private fun endReason(reason: String): String = when (reason) {
        "declined" -> "Собеседник отклонил звонок."
        "missed" -> "Собеседник не ответил."
        "disconnected" -> "Связь с собеседником прервалась."
        else -> "Звонок завершён."
    }

    private class Session(val peerName: String, val outgoing: Boolean, var id: String? = null) {
        val signals = Channel<JSONObject>(capacity = 129)
        val pendingCandidates = mutableListOf<JSONObject>()
        var iceServers = emptyList<PeerConnection.IceServer>()
        var earlyAcceptedId: String? = null
        var earlyEnd: JSONObject? = null
        var connection: Job? = null
        var deadline: Job? = null
        var peer: NativeAudioPeer? = null
        var audioFocus: NativeCallAudioFocus? = null
    }
}
