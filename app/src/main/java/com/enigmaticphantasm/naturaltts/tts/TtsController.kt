package com.enigmaticphantasm.naturaltts.tts

import android.content.Context
import android.util.Log
import com.enigmaticphantasm.naturaltts.data.EngineFamily
import com.enigmaticphantasm.naturaltts.data.PreferencesRepository
import com.enigmaticphantasm.naturaltts.data.VoiceCatalog
import com.enigmaticphantasm.naturaltts.data.VoiceDownloader
import com.enigmaticphantasm.naturaltts.util.TextChunker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class TtsController(
    context: Context,
    private val preferences: PreferencesRepository,
    private val voiceDownloader: VoiceDownloader,
) {
    companion object {
        private const val TAG = "TtsController"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutex = Mutex()

    private val sherpa = SherpaOnnxTtsEngine()
    private val system = SystemTtsEngine(context)
    private val player = AudioPlayer()

    private val _state = MutableStateFlow(PlaybackState.IDLE)
    val state: StateFlow<PlaybackState> = _state.asStateFlow()

    private val _statusMessage = MutableStateFlow("")
    val statusMessage: StateFlow<String> = _statusMessage.asStateFlow()

    private val _activeEngineLabel = MutableStateFlow("—")
    val activeEngineLabel: StateFlow<String> = _activeEngineLabel.asStateFlow()

    @Volatile
    private var cancelRequested = false
    private var playJob: Job? = null

    fun play(text: String) {
        scope.launch {
            mutex.withLock {
                playJob?.cancelAndJoin()
                cancelRequested = false
                player.stop()
                system.stop()
            }
            playJob = scope.launch(Dispatchers.Default) {
                runPlayback(text)
            }
        }
    }

    fun pause() {
        if (_state.value == PlaybackState.SPEAKING) {
            player.pause()
            _state.value = PlaybackState.PAUSED
            _statusMessage.value = "Paused"
        }
    }

    fun resume() {
        if (_state.value == PlaybackState.PAUSED) {
            player.resume()
            _state.value = PlaybackState.SPEAKING
            _statusMessage.value = "Speaking…"
        }
    }

    fun stop() {
        scope.launch {
            cancelRequested = true
            player.stop()
            system.stop()
            playJob?.cancelAndJoin()
            _state.value = PlaybackState.IDLE
            _statusMessage.value = "Stopped"
        }
    }

    fun reloadEngine() {
        scope.launch(Dispatchers.IO) {
            sherpa.release()
            _statusMessage.value = "Engine reset — will reload on next play"
        }
    }

    private suspend fun runPlayback(rawText: String) {
        val text = rawText.trim()
        if (text.isEmpty()) {
            _statusMessage.value = "Nothing to read"
            _state.value = PlaybackState.IDLE
            return
        }

        _state.value = PlaybackState.LOADING
        _statusMessage.value = "Preparing…"

        val prefs = preferences.preferencesFlow.first()
        val chunks = TextChunker.chunk(text)

        try {
            if (prefs.useSystemFallback || prefs.engineFamily == EngineFamily.SYSTEM_FALLBACK) {
                _activeEngineLabel.value = system.name
                speakWithSystem(chunks, prefs.speechRate)
                return
            }

            val voice = VoiceCatalog.byId(prefs.voiceId) ?: VoiceCatalog.defaultVoice()
            if (!voiceDownloader.isInstalled(voice)) {
                _statusMessage.value = "Downloading ${voice.displayName}…"
                runCatching { voiceDownloader.downloadAndInstall(voice) }
                    .onFailure {
                        Log.w(TAG, "Voice download failed, falling back to system TTS", it)
                        _activeEngineLabel.value = system.name
                        _statusMessage.value = "Using system TTS (fallback)"
                        speakWithSystem(chunks, prefs.speechRate)
                        return
                    }
            }

            val loaded = sherpa.loadVoice(voice, voiceDownloader.voiceDir(voice))
            if (!loaded || !SherpaOnnxTtsEngine.nativeAvailable) {
                Log.w(TAG, "Sherpa unavailable — system fallback")
                _activeEngineLabel.value = system.name
                _statusMessage.value = "sherpa-onnx unavailable — system TTS fallback"
                speakWithSystem(chunks, prefs.speechRate)
                return
            }

            _activeEngineLabel.value = "${sherpa.name} · ${voice.displayName}"
            for ((index, chunk) in chunks.withIndex()) {
                if (cancelRequested || !scope.isActive) break
                _statusMessage.value = "Synthesizing ${index + 1}/${chunks.size}…"
                val result = sherpa.synthesize(
                    text = chunk,
                    speed = prefs.speechRate,
                    speakerId = prefs.speakerId,
                    onCancelCheck = { cancelRequested },
                ) ?: break
                if (cancelRequested) break
                _state.value = PlaybackState.SPEAKING
                _statusMessage.value = "Speaking ${index + 1}/${chunks.size}…"
                player.play(result)
                while (player.paused && !cancelRequested) {
                    kotlinx.coroutines.delay(50)
                }
            }
            if (!cancelRequested) {
                _state.value = PlaybackState.IDLE
                _statusMessage.value = "Done"
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Playback error", t)
            _state.value = PlaybackState.ERROR
            _statusMessage.value = t.message ?: "Error"
        }
    }

    private suspend fun speakWithSystem(chunks: List<String>, rate: Float) {
        for ((index, chunk) in chunks.withIndex()) {
            if (cancelRequested) break
            _state.value = PlaybackState.SPEAKING
            _statusMessage.value = "Speaking ${index + 1}/${chunks.size} (system)…"
            val ok = system.speakDirectly(chunk, rate)
            if (!ok) break
        }
        if (!cancelRequested) {
            _state.value = PlaybackState.IDLE
            _statusMessage.value = "Done"
        }
    }

    fun release() {
        stop()
        sherpa.release()
        system.release()
        player.release()
    }
}
