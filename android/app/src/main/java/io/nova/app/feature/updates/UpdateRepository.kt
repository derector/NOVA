package io.nova.app.feature.updates

import android.content.Context
import io.nova.app.BuildConfig
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.CacheControl
import okhttp3.OkHttpClient
import okhttp3.Request

internal class UpdateRepository(private val context: Context) {
    suspend fun latest(): UpdateRelease? = withContext(Dispatchers.IO) {
        val url = updateHttpsUrl(BuildConfig.UPDATE_MANIFEST_URL) ?: return@withContext null
        val request = Request.Builder().url(url).cacheControl(CacheControl.FORCE_NETWORK).build()
        manifestClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Update manifest HTTP ${response.code}")
            val body = response.body ?: throw IOException("Missing update manifest")
            val source = body.source()
            if (source.request(MAX_MANIFEST_BYTES + 1)) throw IOException("Update manifest too large")
            val release = parseUpdateRelease(source.readUtf8())
            if (release.versionCode <= BuildConfig.VERSION_CODE) return@withContext null
            if (ApkVerifier.installedSignerSha256(context) != release.signerSha256) {
                throw IOException("APK signing certificate differs from the installed app")
            }
            release
        }
    }

    suspend fun download(release: UpdateRelease, onProgress: (Int) -> Unit): File =
        withContext(Dispatchers.IO) {
            val scope = currentCoroutineContext()
            val directory = File(context.cacheDir, "updates")
            val staging = File(context.cacheDir, "update-downloads")
            listOf(directory, staging).forEach {
                if (!it.mkdirs() && !it.isDirectory) throw IOException("Update cache unavailable")
            }
            val apk = File(directory, "nova-${release.versionCode}-${release.apkSha256}.apk")
            if (apk.isFile && ApkVerifier.verify(context, apk, release)) {
                onProgress(100)
                return@withContext apk
            }
            val temporary = File.createTempFile("nova-download-", ".apk", staging)
            try {
                val request = Request.Builder().url(release.apkUrl).build()
                apkClient.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) throw IOException("Update APK HTTP ${response.code}")
                    val body = response.body ?: throw IOException("Missing update APK")
                    val reportedSize = body.contentLength()
                    if (reportedSize >= 0 && reportedSize != release.apkSizeBytes) throw IOException("Invalid APK size")
                    body.byteStream().use { input ->
                        temporary.outputStream().buffered().use { output ->
                            val buffer = ByteArray(64 * 1024)
                            var downloaded = 0L
                            var lastProgress = -1
                            while (true) {
                                scope.ensureActive()
                                val count = input.read(buffer)
                                if (count < 0) break
                                downloaded += count
                                if (downloaded > release.apkSizeBytes) throw IOException("Invalid APK size")
                                output.write(buffer, 0, count)
                                val progress = (downloaded * 100 / release.apkSizeBytes).toInt()
                                if (progress != lastProgress) {
                                    onProgress(progress)
                                    lastProgress = progress
                                }
                            }
                        }
                    }
                }
                if (!ApkVerifier.verify(context, temporary, release)) throw InvalidUpdateApkException()
                scope.ensureActive()
                if (!temporary.renameTo(apk)) throw IOException("Failed to move verified APK")
                val expiration = System.currentTimeMillis() - TimeUnit.DAYS.toMillis(7)
                listOf(directory, staging).forEach { cache ->
                    cache.listFiles()?.filter { it != apk && it.lastModified() < expiration }?.forEach(File::delete)
                }
                apk
            } finally {
                temporary.delete()
            }
        }

    companion object {
        private const val MAX_MANIFEST_BYTES = 16L * 1024
        private val manifestClient = OkHttpClient.Builder()
            .followSslRedirects(false)
            .callTimeout(20, TimeUnit.SECONDS)
            .build()
        private val apkClient = manifestClient.newBuilder()
            .callTimeout(12, TimeUnit.MINUTES)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
        val configured: Boolean get() = updateHttpsUrl(BuildConfig.UPDATE_MANIFEST_URL) != null
    }
}

internal class InvalidUpdateApkException : IOException("APK verification failed")
