package io.nova.app.feature.updates

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class UpdateReleaseTest {
    private val digest = "AB".repeat(32)
    private val manifest = """
        {
          "packageName": "io.nova.app",
          "versionCode": 4,
          "versionName": "0.2.1",
          "minimumVersionCode": 3,
          "apkUrl": "https://downloads.example.org/releases/NOVA-0.2.1-4.apk",
          "apkSha256": "$digest",
          "apkSizeBytes": 12345,
          "signerSha256": "$digest"
        }
    """.trimIndent()

    @Test
    fun manifestUsesExactPackageSizeAndVersionBoundary() {
        val release = parseUpdateRelease(manifest)
        assertEquals("io.nova.app", release.packageName)
        assertEquals(4, release.versionCode)
        assertEquals("0.2.1", release.versionName)
        assertEquals(12345L, release.apkSizeBytes)
        assertEquals(digest.lowercase(), release.apkSha256)
        assertEquals(digest.lowercase(), release.signerSha256)
        assertTrue(release.isRequiredFor(2))
        assertFalse(release.isRequiredFor(3))
    }

    @Test
    fun incompatibleOrMalformedUpdateIsRejected() {
        listOf(
            manifest.replace("io.nova.app", "app.sonora.android"),
            manifest.replace("https://", "http://"),
            manifest.replace("12345", "12345.1"),
            manifest.replace("12345", "\"12345\""),
            manifest.replace("12345", (MAX_APK_BYTES + 1).toString()),
            manifest.replace("\"minimumVersionCode\": 3", "\"minimumVersionCode\": 5"),
            manifest.replace(digest, "not-a-hash"),
        ).forEach { invalid -> assertFails { parseUpdateRelease(invalid) } }
        assertNull(updateHttpsUrl("https://name@downloads.example.org/file"))
        assertNull(updateHttpsUrl("https://downloads.example.org/file#fragment"))
    }
}
