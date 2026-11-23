package io.nova.app.feature.calls

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONArray
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.audio.JavaAudioDeviceModule
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class NativeAudioEngine(context: Context) {
    private val factory: PeerConnectionFactory

    init {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions(),
        )
        val audioModule = JavaAudioDeviceModule.builder(context).createAudioDeviceModule()
        factory = try {
            PeerConnectionFactory.builder().setAudioDeviceModule(audioModule).createPeerConnectionFactory()
        } finally {
            audioModule.release()
        }
    }

    fun open(
        iceServers: List<PeerConnection.IceServer>,
        onCandidate: (IceCandidate) -> Unit,
        onConnectionState: (PeerConnection.PeerConnectionState) -> Unit,
    ): NativeAudioPeer {
        val config = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }
        val connection = factory.createPeerConnection(config, object : PeerConnection.Observer {
            override fun onConnectionChange(state: PeerConnection.PeerConnectionState) = onConnectionState(state)
            override fun onIceCandidate(candidate: IceCandidate) = onCandidate(candidate)
            override fun onSignalingChange(state: PeerConnection.SignalingState) = Unit
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) = Unit
            override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) = Unit
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit
            override fun onAddStream(stream: MediaStream) = Unit
            override fun onRemoveStream(stream: MediaStream) = Unit
            override fun onDataChannel(channel: DataChannel) = Unit
            override fun onRenegotiationNeeded() = Unit
        }) ?: error("Не удалось запустить аудиозвонок.")
        var source: AudioSource? = null
        var track: AudioTrack? = null
        try {
            source = factory.createAudioSource(MediaConstraints())
            track = factory.createAudioTrack("nova-audio", source)
            checkNotNull(connection.addTrack(track, listOf("nova-call")))
            return NativeAudioPeer(connection, source, track)
        } catch (error: Throwable) {
            connection.dispose()
            track?.dispose()
            source?.dispose()
            throw error
        }
    }
}

internal class NativeAudioPeer(
    private val connection: PeerConnection,
    private val source: AudioSource,
    private val track: AudioTrack,
) {
    var remoteDescriptionSet = false
        private set

    suspend fun makeOffer(): SessionDescription = createDescription(offer = true)
    suspend fun makeAnswer(): SessionDescription = createDescription(offer = false)

    suspend fun setRemoteDescription(description: SessionDescription) {
        setDescription(description, local = false)
        remoteDescriptionSet = true
    }

    suspend fun setLocalDescription(description: SessionDescription) = setDescription(description, local = true)

    fun addCandidate(payload: JSONObject) {
        val candidate = payload.optString("candidate")
        if (!candidate.startsWith("candidate:")) return
        val index = payload.optInt("sdpMLineIndex", -1)
        val mid = payload.optString("sdpMid").takeUnless { payload.isNull("sdpMid") || it.isBlank() }
            ?: remoteMediaId(index)
            ?: return
        connection.addIceCandidate(IceCandidate(mid, index, candidate))
    }

    private fun remoteMediaId(index: Int): String? {
        if (index < 0) return null
        return connection.remoteDescription?.description
            ?.split("\nm=")?.drop(1)?.getOrNull(index)
            ?.lineSequence()?.firstOrNull { it.startsWith("a=mid:") }
            ?.removePrefix("a=mid:")?.trim()
    }

    fun setMuted(muted: Boolean) { track.setEnabled(!muted) }

    fun close() {
        connection.dispose()
        track.dispose()
        source.dispose()
    }

    private suspend fun createDescription(offer: Boolean): SessionDescription =
        suspendCancellableCoroutine { continuation ->
            val callback = object : SdpCallback() {
                override fun onCreateSuccess(description: SessionDescription) {
                    if (continuation.isActive) continuation.resume(description)
                }

                override fun onCreateFailure(reason: String) {
                    if (continuation.isActive) continuation.resumeWithException(IllegalStateException("Не удалось подготовить аудиосоединение."))
                }
            }
            val constraints = MediaConstraints()
            if (offer) connection.createOffer(callback, constraints) else connection.createAnswer(callback, constraints)
        }

    private suspend fun setDescription(description: SessionDescription, local: Boolean) =
        suspendCancellableCoroutine<Unit> { continuation ->
            val callback = object : SdpCallback() {
                override fun onSetSuccess() {
                    if (continuation.isActive) continuation.resume(Unit)
                }

                override fun onSetFailure(reason: String) {
                    if (continuation.isActive) continuation.resumeWithException(IllegalStateException("Не удалось согласовать аудиосоединение."))
                }
            }
            if (local) connection.setLocalDescription(callback, description) else connection.setRemoteDescription(callback, description)
        }
}

private abstract class SdpCallback : SdpObserver {
    override fun onCreateSuccess(description: SessionDescription) = Unit
    override fun onSetSuccess() = Unit
    override fun onCreateFailure(reason: String) = Unit
    override fun onSetFailure(reason: String) = Unit
}

internal fun parseIceServers(payload: JSONArray?): List<PeerConnection.IceServer> =
    List(payload?.length() ?: 0) { payload?.optJSONObject(it) }.mapNotNull { entry ->
        val urls = entry?.optJSONArray("urls") ?: return@mapNotNull null
        val addressList = List(urls.length()) { urls.optString(it) }.filter(String::isNotBlank)
        if (addressList.isEmpty()) return@mapNotNull null
        PeerConnection.IceServer.builder(addressList)
            .setUsername(entry.optString("username"))
            .setPassword(entry.optString("credential"))
            .createIceServer()
    }

internal class NativeCallAudioFocus(context: Context, onLost: () -> Unit) : AutoCloseable {
    private val manager = context.getSystemService(AudioManager::class.java)
    private val previousMode = manager.mode
    private val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
        )
        .setOnAudioFocusChangeListener { change ->
            if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) onLost()
        }
        .build()

    init {
        check(manager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            "Аудиоустройство сейчас занято."
        }
        try {
            manager.mode = AudioManager.MODE_IN_COMMUNICATION
        } catch (error: RuntimeException) {
            manager.abandonAudioFocusRequest(request)
            throw error
        }
    }

    override fun close() {
        if (manager.mode == AudioManager.MODE_IN_COMMUNICATION) manager.mode = previousMode
        manager.abandonAudioFocusRequest(request)
    }
}
