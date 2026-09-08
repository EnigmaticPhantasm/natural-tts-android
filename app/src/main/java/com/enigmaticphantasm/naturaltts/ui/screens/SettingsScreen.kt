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
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.enigmaticphantasm.naturaltts.data.EngineFamily
import com.enigmaticphantasm.naturaltts.data.PreferencesRepository
import com.enigmaticphantasm.naturaltts.data.UserPreferences
import com.enigmaticphantasm.naturaltts.data.VoiceCatalog
import com.enigmaticphantasm.naturaltts.data.VoiceDownloader
import com.enigmaticphantasm.naturaltts.data.VoiceModel
import com.enigmaticphantasm.naturaltts.tts.TtsController
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    preferences: PreferencesRepository,
    voiceDownloader: VoiceDownloader,
    ttsController: TtsController,
    onBack: () -> Unit,
) {
    val prefs by preferences.preferencesFlow.collectAsState(initial = UserPreferences())
    val progress by voiceDownloader.progress.collectAsState()
    val scope = rememberCoroutineScope()
    var refreshTick by remember { mutableStateOf(0) }
    var actionError by remember { mutableStateOf<String?>(null) }

    // Force recomposition after install/delete
    @Suppress("UNUSED_EXPRESSION")
    refreshTick

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Engine family", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = prefs.engineFamily == EngineFamily.PIPER && !prefs.useSystemFallback,
                    onClick = {
                        scope.launch {
                            preferences.setUseSystemFallback(false)
                            preferences.setEngineFamily(EngineFamily.PIPER)
                            val first = VoiceCatalog.forFamily(EngineFamily.PIPER).first()
                            preferences.setVoiceId(first.id)
                            ttsController.reloadEngine()
                        }
                    },
                    label = { Text("Piper") }
                )
                FilterChip(
                    selected = prefs.engineFamily == EngineFamily.KOKORO && !prefs.useSystemFallback,
                    onClick = {
                        scope.launch {
                            preferences.setUseSystemFallback(false)
                            preferences.setEngineFamily(EngineFamily.KOKORO)
                            val first = VoiceCatalog.forFamily(EngineFamily.KOKORO).first()
                            preferences.setVoiceId(first.id)
                            ttsController.reloadEngine()
                        }
                    },
                    label = { Text("Kokoro") }
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Use Android system TTS (fallback)")
                    Text(
                        "When on, Piper/Kokoro are skipped. Useful if sherpa-onnx natives fail to load.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = prefs.useSystemFallback,
                    onCheckedChange = { enabled ->
                        scope.launch {
                            preferences.setUseSystemFallback(enabled)
                            if (enabled) {
                                preferences.setEngineFamily(EngineFamily.SYSTEM_FALLBACK)
                            } else {
                                val voice = VoiceCatalog.byId(prefs.voiceId)
                                preferences.setEngineFamily(voice?.family ?: EngineFamily.PIPER)
                                ttsController.reloadEngine()
                            }
                        }
                    }
                )
            }

            Text("Speech rate: ${"%.1f".format(prefs.speechRate)}×", style = MaterialTheme.typography.titleMedium)
            Slider(
                value = prefs.speechRate,
                onValueChange = { v -> scope.launch { preferences.setSpeechRate(v) } },
                valueRange = 0.5f..2.0f,
                steps = 14
            )

            if (prefs.engineFamily == EngineFamily.KOKORO ||
                (VoiceCatalog.byId(prefs.voiceId)?.speakerCount ?: 1) > 1
            ) {
                Text("Speaker ID: ${prefs.speakerId}", style = MaterialTheme.typography.titleMedium)
                Slider(
                    value = prefs.speakerId.toFloat(),
                    onValueChange = { v -> scope.launch { preferences.setSpeakerId(v.toInt()) } },
                    valueRange = 0f..10f,
                    steps = 9
                )
            }

            Text("Voices", style = MaterialTheme.typography.titleMedium)
            Text(
                "Models are stored under the app files directory. Downloads use direct GitHub release URLs.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            actionError?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            val family = when {
                prefs.useSystemFallback -> null
                prefs.engineFamily == EngineFamily.KOKORO -> EngineFamily.KOKORO
                else -> EngineFamily.PIPER
            }

            val list = if (family == null) emptyList() else VoiceCatalog.forFamily(family)
            list.forEach { voice ->
                VoiceCard(
                    voice = voice,
                    selected = prefs.voiceId == voice.id,
                    installed = voiceDownloader.isInstalled(voice),
                    progress = progress?.takeIf { it.voiceId == voice.id },
                    onSelect = {
                        scope.launch {
                            preferences.setVoiceId(voice.id)
                            preferences.setEngineFamily(voice.family)
                            ttsController.reloadEngine()
                        }
                    },
                    onDownload = {
                        scope.launch {
                            actionError = null
                            runCatching { voiceDownloader.downloadAndInstall(voice) }
                                .onFailure { actionError = it.message }
                            refreshTick++
                        }
                    },
                    onDelete = {
                        scope.launch {
                            voiceDownloader.deleteVoice(voice)
                            refreshTick++
                            ttsController.reloadEngine()
                        }
                    }
                )
            }

            // Also show other family voices for management
            Text("All catalog voices", style = MaterialTheme.typography.titleSmall)
            VoiceCatalog.voices.forEach { voice ->
                if (family != null && voice.family == family) return@forEach
                VoiceCard(
                    voice = voice,
                    selected = prefs.voiceId == voice.id,
                    installed = voiceDownloader.isInstalled(voice),
                    progress = progress?.takeIf { it.voiceId == voice.id },
                    onSelect = {
                        scope.launch {
                            preferences.setUseSystemFallback(false)
                            preferences.setVoiceId(voice.id)
                            preferences.setEngineFamily(voice.family)
                            ttsController.reloadEngine()
                        }
                    },
                    onDownload = {
                        scope.launch {
                            actionError = null
                            runCatching { voiceDownloader.downloadAndInstall(voice) }
                                .onFailure { actionError = it.message }
                            refreshTick++
                        }
                    },
                    onDelete = {
                        scope.launch {
                            voiceDownloader.deleteVoice(voice)
                            refreshTick++
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun VoiceCard(
    voice: VoiceModel,
    selected: Boolean,
    installed: Boolean,
    progress: VoiceDownloader.DownloadProgress?,
    onSelect: () -> Unit,
    onDownload: () -> Unit,
    onDelete: () -> Unit,
) {
    val downloading = progress?.phase == VoiceDownloader.DownloadProgress.Phase.DOWNLOADING ||
        progress?.phase == VoiceDownloader.DownloadProgress.Phase.EXTRACTING

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onSelect),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surface
        )
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = selected, onClick = onSelect)
                Column(Modifier.weight(1f)) {
                    Text(voice.displayName, style = MaterialTheme.typography.titleSmall)
                    Text(
                        "${voice.family} · ${voice.sizeLabel} · ${voice.language}" +
                            if (voice.speakerCount > 1) " · ${voice.speakerCount} speakers" else "",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                if (installed) {
                    IconButton(onClick = onDelete, enabled = !downloading) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete")
                    }
                } else {
                    IconButton(onClick = onDownload, enabled = !downloading) {
                        if (downloading) {
                            CircularProgressIndicator(Modifier.height(20.dp).width(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Download, contentDescription = "Download")
                        }
                    }
                }
            }
            Text(voice.description, style = MaterialTheme.typography.bodySmall)
            Text(
                if (installed) "Installed" else "Not installed",
                style = MaterialTheme.typography.labelMedium,
                color = if (installed) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (progress != null && progress.phase != VoiceDownloader.DownloadProgress.Phase.DONE) {
                val frac = when {
                    progress.totalBytes != null && progress.totalBytes > 0 ->
                        (progress.bytesDownloaded.toFloat() / progress.totalBytes).coerceIn(0f, 1f)
                    else -> 0f
                }
                LinearProgressIndicator(progress = { frac }, modifier = Modifier.fillMaxWidth())
                Text(
                    when (progress.phase) {
                        VoiceDownloader.DownloadProgress.Phase.DOWNLOADING -> "Downloading…"
                        VoiceDownloader.DownloadProgress.Phase.EXTRACTING -> "Extracting…"
                        VoiceDownloader.DownloadProgress.Phase.ERROR -> "Error: ${progress.error}"
                        else -> ""
                    },
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
