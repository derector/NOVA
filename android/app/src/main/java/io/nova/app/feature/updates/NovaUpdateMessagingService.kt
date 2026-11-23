package io.nova.app.feature.updates

import android.content.Context
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.nova.app.BuildConfig

internal const val NOVA_RELEASE_TOPIC = "nova-apk-updates"
private const val RELEASE_MESSAGE = "nova_release"

class NovaUpdateMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        if (isNewReleaseSignal(message.data, BuildConfig.VERSION_CODE)) {
            checkForUpdateNotification(applicationContext)
        }
    }

    override fun onDeletedMessages() {
        checkForUpdateNotification(applicationContext)
    }

    override fun onNewToken(token: String) {
        NovaUpdatePush.syncSubscription(applicationContext, tokenChanged = true)
    }
}

internal fun isNewReleaseSignal(data: Map<String, String>, installedVersion: Int): Boolean =
    data["kind"] == RELEASE_MESSAGE && data["versionCode"]?.toIntOrNull()?.let { it > installedVersion } == true

internal object NovaUpdatePush {
    private var subscribed: Boolean? = null

    @Synchronized
    fun syncSubscription(context: Context, tokenChanged: Boolean = false) {
        if (!UpdateRepository.configured || FirebaseApp.getApps(context).isEmpty()) return
        val enabled = updateNotificationsEnabled(context)
        if (subscribed == enabled && !(tokenChanged && enabled)) return
        val prefs = context.getSharedPreferences("nova_fcm_updates", Context.MODE_PRIVATE)
        if (!enabled && !prefs.getBoolean("topic_requested", false)) return
        if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) != ConnectionResult.SUCCESS) return

        val messaging = FirebaseMessaging.getInstance()
        subscribed = enabled
        messaging.isAutoInitEnabled = enabled
        val subscription = if (enabled) {
            prefs.edit().putBoolean("topic_requested", true).apply()
            messaging.subscribeToTopic(NOVA_RELEASE_TOPIC)
        } else {
            messaging.unsubscribeFromTopic(NOVA_RELEASE_TOPIC)
        }
        subscription.addOnCompleteListener { result ->
            synchronized(this) {
                if (subscribed == enabled) {
                    if (!result.isSuccessful) subscribed = null
                    else if (!enabled) prefs.edit().remove("topic_requested").apply()
                }
            }
        }
    }
}
