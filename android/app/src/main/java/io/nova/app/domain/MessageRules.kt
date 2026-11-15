package io.nova.app.domain

import java.util.UUID

object MessageRules {
    fun normalizedText(input: String): String? = input.trim().takeIf { it.isNotEmpty() && it.length <= 10_000 }

    fun newIdempotencyKey(): String = UUID.randomUUID().toString()

    fun statusLabel(status: String): String = when (status) {
        "PENDING" -> "Отправляется"
        "SENT" -> "Отправлено"
        "FAILED" -> "Не отправлено"
        else -> "Статус неизвестен"
    }
}
