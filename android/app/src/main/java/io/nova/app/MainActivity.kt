package io.nova.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.lifecycleScope
import io.nova.app.ui.NovaApp

class MainActivity : ComponentActivity() {
    private val app get() = application as NovaApplication

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { NovaApp() }
    }

    override fun onStart() {
        super.onStart()
        app.container.realtime.start()
    }

    override fun onStop() {
        app.container.realtime.stop()
        super.onStop()
    }
}
