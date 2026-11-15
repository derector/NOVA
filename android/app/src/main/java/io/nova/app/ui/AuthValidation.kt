package io.nova.app.ui

import androidx.core.util.PatternsCompat
import java.net.URI

internal object AuthValidation {
    fun isEmailValid(value: String): Boolean {
        val email = value.trim()
        return email.isNotEmpty() && email.length <= 320 && PatternsCompat.EMAIL_ADDRESS.matcher(email).matches()
    }

    fun normalizedEmail(value: String): String = value.trim()
}

internal object AuthNetworkMessages {
    fun connectionFailure(apiBaseUrl: String, debug: Boolean): String {
        val host = runCatching { URI(apiBaseUrl).host }.getOrNull()
        return if (debug && host.equals("10.0.2.2", ignoreCase = true)) {
            "Этот APK настроен на Android Emulator (10.0.2.2). На обычном телефоне этот адрес недоступен. Для локальной проверки нужен адрес компьютера в той же Wi‑Fi-сети; для обычного входа — доступный HTTPS-сервер NOVA. Запрос не дошёл до сервера, письмо не отправлено."
        } else {
            "Не удалось связаться с сервером NOVA. Проверьте интернет и доступность API. Запрос не завершён, письмо не отправлено."
        }
    }
}
