package io.nova.app.feature.updates

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.FileProvider
import androidx.core.content.pm.PackageInfoCompat
import java.io.File
import java.security.MessageDigest

internal object ApkVerifier {
    fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(32 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().hex()
    }

    fun installedSignerSha256(context: Context): String? {
        @Suppress("DEPRECATION")
        val installed = context.packageManager.getPackageInfo(context.packageName, signingFlags)
        return installed.signerDigests().singleOrNull()
    }

    fun verify(context: Context, file: File, release: UpdateRelease): Boolean {
        if (context.packageName != release.packageName ||
            file.length() != release.apkSizeBytes ||
            sha256(file) != release.apkSha256
        ) {
            return false
        }
        @Suppress("DEPRECATION")
        val candidate = context.packageManager.getPackageArchiveInfo(file.absolutePath, signingFlags)
            ?: return false
        @Suppress("DEPRECATION")
        val installed = context.packageManager.getPackageInfo(context.packageName, signingFlags)
        val candidateVersion = PackageInfoCompat.getLongVersionCode(candidate)
        val installedSigner = installed.signerDigests().singleOrNull() ?: return false
        return candidate.packageName == installed.packageName &&
            candidateVersion == release.versionCode.toLong() &&
            candidate.versionName == release.versionName &&
            candidateVersion > PackageInfoCompat.getLongVersionCode(installed) &&
            installedSigner == release.signerSha256 &&
            candidate.signerDigests() == setOf(installedSigner)
    }

    fun launchInstaller(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", file)
        context.startActivity(Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
        })
    }

    private val signingFlags: Int
        @Suppress("DEPRECATION")
        get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }

    @Suppress("DEPRECATION")
    private fun PackageInfo.signerDigests(): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            signingInfo?.apkContentsSigners
        } else {
            this.signatures
        }
        return signatures.orEmpty().mapTo(mutableSetOf()) { signature ->
            MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).hex()
        }
    }

    private fun ByteArray.hex(): String = joinToString("") { "%02x".format(it) }
}
