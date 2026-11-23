package io.nova.app.feature.assistant

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class AssistantAudio(private val context: Context) {
    private var stopped = false

    fun finishTurn() { stopped = true }

    suspend fun <T> record(live: Boolean, upload: suspend (File) -> T): T {
        val file = File.createTempFile("assistant-", ".m4a", context.cacheDir)
        try {
            capture(file, live)
            return upload(file)
        } finally {
            file.delete()
        }
    }

    private suspend fun capture(file: File, live: Boolean) {
        @Suppress("DEPRECATION")
        val active = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context) else MediaRecorder()
        stopped = false
        try {
            active.setAudioSource(MediaRecorder.AudioSource.MIC)
            active.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            active.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            active.setAudioChannels(1)
            active.setAudioSamplingRate(24_000)
            active.setAudioEncodingBitRate(48_000)
            active.setOutputFile(file.absolutePath)
            active.prepare()
            active.start()
            var elapsedMillis = 0
            var quietMillis = 0
            var detectedSpeech = false
            while (!stopped && elapsedMillis < 25_000) {
                delay(100)
                elapsedMillis += 100
                if (live) {
                    if (active.maxAmplitude >= 700) {
                        detectedSpeech = true
                        quietMillis = 0
                    } else if (detectedSpeech) {
                        quietMillis += 100
                        if (quietMillis >= 1100) stopped = true
                    }
                }
            }
            active.stop()
        } finally {
            active.release()
        }
    }

    suspend fun play(bytes: ByteArray) {
        val file = File.createTempFile("assistant-", ".mp3", context.cacheDir)
        val active = MediaPlayer()
        try {
            withContext(Dispatchers.IO) { file.writeBytes(bytes) }
            suspendCancellableCoroutine<Unit> { continuation ->
                try {
                    active.setAudioAttributes(
                        AudioAttributes.Builder().setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .setUsage(AudioAttributes.USAGE_MEDIA).build(),
                    )
                    active.setOnPreparedListener { if (continuation.isActive) it.start() }
                    active.setOnCompletionListener { if (continuation.isActive) continuation.resume(Unit) }
                    active.setOnErrorListener { _, _, _ ->
                        if (continuation.isActive) continuation.resumeWithException(IllegalStateException("Не удалось воспроизвести ответ"))
                        true
                    }
                    active.setDataSource(file.absolutePath)
                    active.prepareAsync()
                } catch (error: Exception) {
                    if (continuation.isActive) continuation.resumeWithException(error)
                }
            }
        } finally {
            active.release()
            file.delete()
        }
    }
}
