package io.nova.app.data.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.google.gson.Gson
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class SessionData(
    val email: String,
    val accessToken: String,
    val accessTokenExpiresAt: String,
    val refreshToken: String,
    val userId: String,
    val username: String,
    val displayName: String,
)

class SessionStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("session_ciphertext", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val alias = "io.nova.app.session.aes"

    @Synchronized
    fun read(): SessionData? = runCatching {
        val encoded = prefs.getString("payload", null) ?: return null
        val iv = Base64.decode(prefs.getString("iv", null), Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        gson.fromJson(String(cipher.doFinal(Base64.decode(encoded, Base64.NO_WRAP)), StandardCharsets.UTF_8), SessionData::class.java)
    }.getOrNull()

    @Synchronized
    fun save(session: SessionData) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.doFinal(gson.toJson(session).toByteArray(StandardCharsets.UTF_8))
        check(prefs.edit()
            .putString("payload", Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .commit()) { "Unable to persist encrypted session" }
    }

    @Synchronized
    fun clear() {
        prefs.edit().clear().commit()
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build())
            generateKey()
        }
    }
}
