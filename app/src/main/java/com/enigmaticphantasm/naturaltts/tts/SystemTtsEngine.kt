package com.enigmaticphantasm.naturaltts.tts

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume

/**
 * Android system [TextToSpeech] fallback — labeled clearly as fallback in the UI.
 * Does not produce PCM for AudioPlayer; speak() is used via [speakDirectly].
 */
class SystemTtsEngine(context: Context) : TtsEngine {
    override val name: String = "Android System TTS (fallback)"

    private val ready = AtomicBoolean(false)
    private var tts: TextToSpeech? = null
    private var initError: String? = null

    init {
        tts = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                ready.set(true)
            } else {
                initError = "TextToSpeech init failed: $status"
            }
        }
    }

    override val isAvailable: Boolean
        get() = ready.get()

    override suspend fun synthesize(
        text: String,
        speed: Float,
        speakerId: Int,
        onCancelCheck: () -> Boolean,
    ): SynthResult? {
        // System TTS is utterance-based; use speakDirectly from controller instead.
        return null
    }

    suspend fun speakDirectly(text: String, speed: Float): Boolean {
        val engine = tts ?: return false
        if (!ready.get()) return false
        engine.setSpeechRate(speed.coerceIn(0.5f, 2.0f))
        return suspendCancellableCoroutine { cont ->
            val id = UUID.randomUUID().toString()
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) {
                    if (utteranceId == id && cont.isActive) cont.resume(true)
                }
                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    if (utteranceId == id && cont.isActive) cont.resume(false)
                }
                override fun onError(utteranceId: String?, errorCode: Int) {
                    if (utteranceId == id && cont.isActive) cont.resume(false)
                }
            })
            cont.invokeOnCancellation {
                engine.stop()
            }
            val result = engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
            if (result != TextToSpeech.SUCCESS && cont.isActive) {
                cont.resume(false)
            }
        }
    }

    fun stop() {
        tts?.stop()
    }

    override fun release() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        ready.set(false)
    }
}
