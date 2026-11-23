package io.nova.app.feature.assistant

import com.google.gson.Gson
import io.nova.app.BuildConfig
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal data class AssistantCapabilities(val chat: Boolean, val transcription: Boolean, val speech: Boolean)
internal data class AssistantTurn(val role: String, val content: String)
private data class AssistantText(val text: String)

internal class AssistantApi(private val accessToken: suspend () -> String) {
    private val gson = Gson()
    private val jsonType = "application/json".toMediaType()

    suspend fun status(): AssistantCapabilities = decode(request("status"))
    suspend fun chat(messages: List<AssistantTurn>): String = decode<AssistantText>(
        request("chat", gson.toJson(mapOf("messages" to messages.takeLast(11))).toRequestBody(jsonType)),
    ).text

    suspend fun transcribe(file: File): String = decode<AssistantText>(
        request(
            "transcribe",
            MultipartBody.Builder().setType(MultipartBody.FORM)
                .addFormDataPart("audio", "recording.m4a", file.asRequestBody("audio/mp4".toMediaType()))
                .build(),
        ),
    ).text

    suspend fun speech(text: String, voice: String): ByteArray =
        request("speech", gson.toJson(mapOf("text" to text, "voice" to voice)).toRequestBody(jsonType))

    private inline fun <reified T> decode(bytes: ByteArray): T =
        gson.fromJson(bytes.decodeToString(), T::class.java) ?: error("Сервис вернул пустой ответ")

    private suspend fun request(path: String, body: RequestBody? = null): ByteArray {
        val request = Request.Builder()
            .url("${BuildConfig.API_BASE_URL.trimEnd('/')}/api/v1/assistant/$path")
            .header("Authorization", "Bearer ${accessToken()}")
            .apply { if (body != null) post(body) }
            .build()
        return suspendCancellableCoroutine { continuation ->
            val call = client.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (continuation.isActive) continuation.resumeWithException(IOException("Не удалось связаться с ассистентом", e))
                }
                override fun onResponse(call: Call, response: Response) {
                    val result = runCatching {
                        response.use {
                            when (it.code) {
                                401 -> error("Сессия истекла. Войдите снова.")
                                429 -> error("Лимит запросов помощника исчерпан. Попробуйте позже.")
                            }
                            check(it.isSuccessful) { "Сервис помощника временно недоступен." }
                            it.body?.bytes() ?: error("Сервис вернул пустой ответ")
                        }
                    }
                    if (continuation.isActive) result.fold(continuation::resume, continuation::resumeWithException)
                }
            })
        }
    }

    private companion object {
        val client = OkHttpClient.Builder().readTimeout(35, TimeUnit.SECONDS)
            .callTimeout(40, TimeUnit.SECONDS).followRedirects(false).build()
    }
}
