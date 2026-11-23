package io.nova.app.feature.updates

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import io.nova.app.BuildConfig
import io.nova.app.MainActivity
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException

internal const val UPDATE_CHANNEL_ID = "nova-app-updates"
private const val UPDATE_NOTIFICATION_ID = 1101

internal fun scheduleUpdateNotifications(context: Context) {
    if (!UpdateRepository.configured) return
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
        NotificationChannel(UPDATE_CHANNEL_ID, "Обновления NOVA", NotificationManager.IMPORTANCE_DEFAULT),
    )
    val request = PeriodicWorkRequestBuilder<UpdateNotificationWorker>(4, TimeUnit.HOURS, 1, TimeUnit.HOURS)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        UPDATE_CHANNEL_ID,
        ExistingPeriodicWorkPolicy.KEEP,
        request,
    )
}

internal fun updateNotificationsEnabled(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= 33 &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
        return false
    }
    val channel = context.getSystemService(NotificationManager::class.java)
        .getNotificationChannel(UPDATE_CHANNEL_ID)
    return NotificationManagerCompat.from(context).areNotificationsEnabled() &&
        channel?.importance != NotificationManager.IMPORTANCE_NONE
}

class UpdateNotificationWorker(context: Context, parameters: WorkerParameters) :
    CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val context = applicationContext
        if (!UpdateRepository.configured || !updateNotificationsEnabled(context)) return Result.success()
        val release = try {
            UpdateRepository(context).latest()
        } catch (error: CancellationException) {
            throw error
        } catch (_: IOException) {
            return if (runAttemptCount < 3) Result.retry() else Result.success()
        } catch (_: RuntimeException) {
            return Result.failure()
        } ?: return Result.success()

        val prefs = context.getSharedPreferences("nova_update_notices", Context.MODE_PRIVATE)
        if (release.versionCode <= prefs.getInt("notified_version", 0)) return Result.success()
        val openApp = PendingIntent.getActivity(
            context,
            UPDATE_NOTIFICATION_ID,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val title = if (release.isRequiredFor(BuildConfig.VERSION_CODE)) {
            "Версия NOVA устарела"
        } else {
            "Доступно обновление NOVA"
        }
        val notification = NotificationCompat.Builder(context, UPDATE_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(title)
            .setContentText("Версия ${release.versionName} готова к скачиванию в приложении")
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
        if (updateNotificationsEnabled(context)) {
            try {
                NotificationManagerCompat.from(context).notify(UPDATE_NOTIFICATION_ID, notification)
                prefs.edit().putInt("notified_version", release.versionCode).apply()
            } catch (_: SecurityException) {
                return Result.success()
            }
        }
        return Result.success()
    }
}
