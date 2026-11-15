package io.nova.app.data.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import io.nova.app.NovaApplication
import io.nova.app.data.remote.ApiFailure

class OutboxWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val repository = (applicationContext as NovaApplication).container.repository
        return try {
            repository.flushOutbox()
            Result.success()
        } catch (error: ApiFailure) {
            if (error.retryable || error.code == 401) Result.retry() else Result.failure()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}
