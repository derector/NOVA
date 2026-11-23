package io.nova.app.feature.updates

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

internal const val UPDATE_PACKAGE = "io.nova.app"
internal const val MAX_APK_BYTES = 256L * 1024 * 1024
private val sha256Pattern = Regex("[0-9a-fA-F]{64}")
private val versionPattern = Regex("[0-9][0-9A-Za-z.+-]{0,63}")

internal data class UpdateRelease(
    val packageName: String,
    val versionCode: Int,
    val versionName: String,
    val minimumVersionCode: Int,
    val apkUrl: HttpUrl,
    val apkSha256: String,
    val apkSizeBytes: Long,
    val signerSha256: String,
) {
    fun isRequiredFor(installedVersion: Int): Boolean = installedVersion < minimumVersionCode
}

internal fun parseUpdateRelease(body: String): UpdateRelease {
    val json = JsonParser.parseString(body).asJsonObject
    val packageName = json.requiredString("packageName")
    val versionCode = json.requiredInteger("versionCode")
    val versionName = json.requiredString("versionName")
    val minimumVersionCode = json.requiredInteger("minimumVersionCode")
    val apkUrl = requireNotNull(updateHttpsUrl(json.requiredString("apkUrl")))
    val apkSha256 = json.requiredString("apkSha256")
    val apkSizeBytes = json.requiredInteger("apkSizeBytes")
    val signerSha256 = json.requiredString("signerSha256")

    require(packageName == UPDATE_PACKAGE)
    require(versionCode in 1L..Int.MAX_VALUE.toLong() && minimumVersionCode in 0L..versionCode)
    require(versionPattern.matches(versionName))
    require(apkSizeBytes in 1..MAX_APK_BYTES)
    require(sha256Pattern.matches(apkSha256) && sha256Pattern.matches(signerSha256))
    return UpdateRelease(
        packageName,
        versionCode.toInt(),
        versionName,
        minimumVersionCode.toInt(),
        apkUrl,
        apkSha256.lowercase(),
        apkSizeBytes,
        signerSha256.lowercase(),
    )
}

internal fun updateHttpsUrl(value: String): HttpUrl? = value.toHttpUrlOrNull()?.takeIf {
    it.isHttps && it.username.isEmpty() && it.password.isEmpty() && it.fragment == null
}

private fun JsonObject.requiredString(name: String): String {
    val value = getAsJsonPrimitive(name)
    require(value != null && value.isString)
    return value.asString
}

private fun JsonObject.requiredInteger(name: String): Long {
    val value = getAsJsonPrimitive(name)
    require(value != null && value.isNumber)
    return value.asBigDecimal.longValueExact()
}
