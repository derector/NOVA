package io.nova.app.feature.updates

import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.Test

class UpdatePushTest {
    @Test
    fun onlyNewReleaseSignalsScheduleManifestChecks() {
        assertTrue(isNewReleaseSignal(mapOf("kind" to "nova_release", "versionCode" to "4"), 3))
        assertFalse(isNewReleaseSignal(mapOf("kind" to "nova_release", "versionCode" to "3"), 3))
        assertFalse(isNewReleaseSignal(mapOf("kind" to "nova_release", "versionCode" to "4.0"), 3))
        assertFalse(isNewReleaseSignal(mapOf("kind" to "private_message", "versionCode" to "4"), 3))
        assertFalse(isNewReleaseSignal(mapOf("kind" to "nova_release", "apkUrl" to "https://example.org/wrong.apk"), 3))
    }
}
