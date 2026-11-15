package io.nova.app.data.remote

import com.google.gson.Gson
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class ApiFailure(val code: Int?, override val message: String, val retryable: Boolean) : Exception(message)

internal class NovaApi(baseUrl: String) {
    private val base: HttpUrl = (baseUrl.trimEnd('/') + "/").toHttpUrl()
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(25, TimeUnit.SECONDS)
        .callTimeout(35, TimeUnit.SECONDS)
        .build()

    suspend fun requestCode(email: String) {
        execute("POST", "api/v1/auth/request-code", EmailRequest(email), accepted = setOf(202))
    }

    suspend fun verify(email: String, code: String): SessionDto = decode(
        execute("POST", "api/v1/auth/verify-code", VerifyRequest(email, code), accepted = setOf(200)),
    )

    suspend fun refresh(refreshToken: String): RefreshDto = decode(
        execute("POST", "api/v1/auth/refresh", RefreshRequest(refreshToken), accepted = setOf(200)),
    )

    suspend fun logout(token: String) {
        execute("POST", "api/v1/auth/logout", null, token, setOf(204))
    }

    suspend fun me(token: String): UserDto = decode(execute("GET", "api/v1/users/me", token = token, accepted = setOf(200)))

    suspend fun updateProfile(token: String, username: String, displayName: String): UserDto = decode(
        execute("PATCH", "api/v1/users/me", ProfileUpdateRequest(username, displayName), token, setOf(200)),
    )

    suspend fun searchUsers(token: String, username: String): List<PublicUserDto> {
        val url = endpoint("api/v1/users/search").newBuilder().addQueryParameter("username", username).build()
        return decode(execute("GET", url, token = token, accepted = setOf(200)))
    }

    suspend fun listChats(token: String): List<ChatDto> = decode(execute("GET", "api/v1/chats", token = token, accepted = setOf(200)))

    suspend fun createDirectChat(token: String, userId: String): ChatDto = decode(
        execute("POST", "api/v1/chats/direct", DirectChatRequest(userId), token, setOf(200)),
    )

    suspend fun listMessages(token: String, chatId: String, after: String?): MessagePageDto {
        val builder = endpoint("api/v1/chats/$chatId/messages").newBuilder().addQueryParameter("limit", "100")
        after?.let { builder.addQueryParameter("after", it) }
        return decode(execute("GET", builder.build(), token = token, accepted = setOf(200)))
    }

    suspend fun markRead(token: String, chatId: String) {
        execute("POST", "api/v1/chats/$chatId/read", token = token, accepted = setOf(200))
    }

    suspend fun sendMessage(token: String, chatId: String, key: String, text: String): MessageDto {
        val request = Request.Builder()
            .url(endpoint("api/v1/chats/$chatId/messages"))
            .header("Authorization", "Bearer $token")
            .header("Idempotency-Key", key)
            .post(gson.toJson(SendMessageRequest(text)).toRequestBody(jsonType))
            .build()
        return decode(execute(request, setOf(201)))
    }

    private suspend fun execute(
        method: String,
        path: String,
        body: Any? = null,
        token: String? = null,
        accepted: Set<Int>,
    ): String = execute(method, endpoint(path), body, token, accepted)

    private suspend fun execute(
        method: String,
        url: HttpUrl,
        body: Any? = null,
        token: String? = null,
        accepted: Set<Int>,
    ): String {
        val builder = Request.Builder().url(url).header("Accept", "application/json")
        token?.let { builder.header("Authorization", "Bearer $it") }
        val requestBody = body?.let { gson.toJson(it).toRequestBody(jsonType) }
        builder.method(method, when {
            method == "GET" -> null
            requestBody != null -> requestBody
            method == "POST" || method == "PATCH" || method == "PUT" -> ByteArray(0).toRequestBody(null)
            else -> null
        })
        return execute(builder.build(), accepted)
    }

    private suspend fun execute(request: Request, accepted: Set<Int>): String = suspendCancellableCoroutine { continuation ->
        val call = client.newCall(request)
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, failure: IOException) {
                if (continuation.isActive) continuation.resumeWithException(
                    ApiFailure(null, failure.message ?: "Network unavailable", retryable = true),
                )
            }

            override fun onResponse(call: Call, response: Response) {
                val result = runCatching {
                    response.use {
                        val body = it.body?.string().orEmpty()
                        if (it.code !in accepted) {
                            val detail = runCatching { gson.fromJson(body, Map::class.java)?.get("message")?.toString() }.getOrNull()
                            val status = it.code
                            throw ApiFailure(status, detail ?: "Request failed ($status)", status == 408 || status == 429 || status >= 500)
                        }
                        body
                    }
                }
                if (continuation.isActive) result.fold(continuation::resume, continuation::resumeWithException)
            }
        })
    }

    private fun endpoint(path: String): HttpUrl = base.resolve(path) ?: error("Invalid API path")

    private inline fun <reified T> decode(body: String): T = try {
        gson.fromJson(body, T::class.java) ?: throw IllegalStateException("Empty response body")
    } catch (error: Exception) {
        if (error is ApiFailure) throw error
        throw ApiFailure(null, "The server returned an invalid response", retryable = false)
    }
}

internal data class RefreshDto(
    val accessToken: String,
    val accessTokenExpiresAt: String,
    val refreshToken: String,
)
