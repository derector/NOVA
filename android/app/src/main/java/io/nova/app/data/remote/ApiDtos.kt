package io.nova.app.data.remote

import com.google.gson.annotations.SerializedName

internal data class EmailRequest(val email: String)
internal data class VerifyRequest(val email: String, val code: String)
internal data class RefreshRequest(val refreshToken: String)
internal data class ProfileUpdateRequest(val username: String, val displayName: String)
internal data class DirectChatRequest(val userId: String)
internal data class SendMessageRequest(val text: String)

data class UserDto(
    val id: String,
    val email: String,
    val username: String,
    val displayName: String,
)

data class PublicUserDto(
    val id: String,
    val username: String,
    val displayName: String,
)

internal data class SessionDto(
    val accessToken: String,
    val accessTokenExpiresAt: String,
    val refreshToken: String,
    val user: UserDto,
)

internal data class ChatDto(
    val id: String,
    val participant: PublicUserDto,
    val updatedAt: String,
)

data class MessageDto(
    val id: String,
    val clientMessageId: String,
    val chatId: String,
    val senderId: String,
    val text: String,
    val createdAt: String,
    val deliveredAt: String? = null,
)

internal data class MessagePageDto(
    val items: List<MessageDto>,
    @SerializedName("nextCursor") val nextCursor: String?,
)
