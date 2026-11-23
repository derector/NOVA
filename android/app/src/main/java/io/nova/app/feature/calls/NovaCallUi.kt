package io.nova.app.feature.calls

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import io.nova.app.ui.NovaGlassSurface

internal sealed interface CallAction {
    data class Start(val chatId: String, val name: String) : CallAction
    data class Accept(val callId: String) : CallAction
}

@Composable
internal fun rememberCallPermission(controller: NovaCallController): (CallAction) -> Unit {
    val context = LocalContext.current
    var pending by remember { mutableStateOf<CallAction?>(null) }
    val execute = { action: CallAction ->
        when (action) {
            is CallAction.Start -> controller.start(action.chatId, action.name)
            is CallAction.Accept -> controller.accept(action.callId)
        }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val action = pending
        pending = null
        if (action != null) {
            if (granted) execute(action)
            else {
                if (action is CallAction.Accept && controller.panel.value?.incomingId == action.callId) controller.hangUp()
                controller.permissionDenied()
            }
        }
    }
    return { action ->
        if (pending == null) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                execute(action)
            } else {
                pending = action
                permission.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }
}

@Composable
internal fun NovaCallDialog(
    panel: CallPanel,
    onAccept: (String) -> Unit,
    onToggleMute: () -> Unit,
    onEnd: () -> Unit,
) {
    val incoming = panel.incomingId
    Dialog(
        onDismissRequest = onEnd,
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false),
    ) {
        NovaGlassSurface(Modifier.fillMaxWidth(), highlighted = true) {
            Column(
                Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    panel.phase.label,
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                )
                Text(panel.peerName, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                if (incoming != null) {
                    Button(
                        onClick = { onAccept(incoming) },
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    ) { Text("Принять") }
                }
                if (panel.phase == CallPhase.ACTIVE) {
                    TextButton(
                        onClick = onToggleMute,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    ) { Text(if (panel.muted) "Включить микрофон" else "Выключить микрофон") }
                }
                TextButton(onClick = onEnd, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Text(if (incoming != null) "Отклонить" else "Завершить звонок", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
