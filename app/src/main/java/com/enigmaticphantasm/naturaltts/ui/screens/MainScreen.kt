package com.enigmaticphantasm.naturaltts.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.enigmaticphantasm.naturaltts.data.PreferencesRepository
import com.enigmaticphantasm.naturaltts.tts.PlaybackState
import com.enigmaticphantasm.naturaltts.tts.TtsController
import com.enigmaticphantasm.naturaltts.util.UrlTextExtractor
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    ttsController: TtsController,
    preferences: PreferencesRepository,
    initialSharedText: String?,
    onSharedTextConsumed: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    var text by remember { mutableStateOf("") }
    var loadingUrl by remember { mutableStateOf(false) }
    var urlError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val state by ttsController.state.collectAsState()
    val status by ttsController.statusMessage.collectAsState()
    val engineLabel by ttsController.activeEngineLabel.collectAsState()
    val prefs by preferences.preferencesFlow.collectAsState(
        initial = com.enigmaticphantasm.naturaltts.data.UserPreferences()
    )

    LaunchedEffect(initialSharedText) {
        val shared = initialSharedText ?: return@LaunchedEffect
        text = shared
        onSharedTextConsumed()
        if (UrlTextExtractor.looksLikeUrl(shared)) {
            loadingUrl = true
            urlError = null
            runCatching { UrlTextExtractor.fetchReadableText(shared) }
                .onSuccess { text = it }
                .onFailure { urlError = it.message }
            loadingUrl = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Natural Reader") },
                actions = {
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Paste text or a URL. Free on-device TTS — no cloud APIs.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            OutlinedTextField(
                value = text,
                onValueChange = { text = it; urlError = null },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp),
                label = { Text("Text or URL") },
                placeholder = { Text("Paste article text, or https://…") },
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                FilledTonalButton(
                    onClick = {
                        scope.launch {
                            val candidate = text.trim()
                            if (!UrlTextExtractor.looksLikeUrl(candidate)) {
                                urlError = "Enter a single http(s) URL to load"
                                return@launch
                            }
                            loadingUrl = true
                            urlError = null
                            runCatching { UrlTextExtractor.fetchReadableText(candidate) }
                                .onSuccess { text = it }
                                .onFailure { urlError = it.message ?: "Fetch failed" }
                            loadingUrl = false
                        }
                    },
                    enabled = !loadingUrl && state != PlaybackState.LOADING
                ) {
                    if (loadingUrl) {
                        CircularProgressIndicator(modifier = Modifier.height(18.dp).width(18.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                    }
                    Text("Load from URL")
                }
            }

            urlError?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                when (state) {
                    PlaybackState.SPEAKING -> {
                        Button(onClick = { ttsController.pause() }) {
                            Icon(Icons.Default.Pause, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("Pause")
                        }
                    }
                    PlaybackState.PAUSED -> {
                        Button(onClick = { ttsController.resume() }) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("Resume")
                        }
                    }
                    else -> {
                        Button(
                            onClick = { ttsController.play(text) },
                            enabled = text.isNotBlank() && state != PlaybackState.LOADING && !loadingUrl
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("Play")
                        }
                    }
                }
                OutlinedButton(
                    onClick = { ttsController.stop() },
                    enabled = state == PlaybackState.SPEAKING ||
                        state == PlaybackState.PAUSED ||
                        state == PlaybackState.LOADING
                ) {
                    Icon(Icons.Default.Stop, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Stop")
                }
            }

            if (state == PlaybackState.LOADING) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.height(20.dp).width(20.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(10.dp))
                    Text(status.ifBlank { "Loading…" })
                }
            } else {
                Text(
                    text = when (state) {
                        PlaybackState.SPEAKING -> "Speaking — $status"
                        PlaybackState.PAUSED -> "Paused"
                        PlaybackState.ERROR -> "Error — $status"
                        PlaybackState.IDLE -> if (status.isNotBlank()) status else "Ready"
                        else -> status
                    },
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Text(
                text = "Engine: $engineLabel",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Voice preference: ${prefs.voiceId} · rate ${"%.1f".format(prefs.speechRate)}" +
                    if (prefs.useSystemFallback) " · system fallback ON" else "",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
