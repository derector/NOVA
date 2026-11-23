package io.nova.app

import android.app.Application
import io.nova.app.data.NetworkMonitor
import io.nova.app.data.local.NovaDatabase
import io.nova.app.data.realtime.RealtimeClient
import io.nova.app.data.remote.NovaApi
import io.nova.app.data.repo.NovaRepository
import io.nova.app.data.security.SessionStore
import io.nova.app.feature.calls.NovaCallController
import io.nova.app.feature.updates.scheduleUpdateNotifications

class NovaApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        val baseUrl = BuildConfig.API_BASE_URL
        if (!BuildConfig.DEBUG && !baseUrl.startsWith("https://", ignoreCase = true)) {
            throw IllegalStateException("Release requires NOVA_API_BASE_URL with HTTPS")
        }
        container = AppContainer(this, baseUrl)
        scheduleUpdateNotifications(this)
    }
}

class AppContainer internal constructor(application: Application, baseUrl: String) {
    private val database = NovaDatabase.create(application)
    private val sessionStore = SessionStore(application)
    val networkMonitor = NetworkMonitor(application)
    val repository = NovaRepository(application, database, NovaApi(baseUrl), sessionStore)
    val realtime = RealtimeClient(repository, baseUrl)
    internal val calls = NovaCallController(application, realtime)
}
