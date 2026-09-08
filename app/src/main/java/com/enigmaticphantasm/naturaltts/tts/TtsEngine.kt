package com.enigmaticphantasm.naturaltts.tts

/**
 * Abstraction over on-device TTS backends.
 */
interface TtsEngine {
    val name: String
    val isAvailable: Boolean

    /**
     * Synthesize [text] at [speed] (1.0 = normal) for [speakerId].
     * Returns PCM float samples in [-1, 1] and sample rate, or null on failure/cancel.
     */
    suspend fun synthesize(
        text: String,
        speed: Float = 1.0f,
        speakerId: Int = 0,
        onCancelCheck: () -> Boolean = { false },
    ): SynthResult?

    fun release()
}

data class SynthResult(
    val samples: FloatArray,
    val sampleRate: Int,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is SynthResult) return false
        return sampleRate == other.sampleRate && samples.contentEquals(other.samples)
    }

    override fun hashCode(): Int = 31 * sampleRate + samples.contentHashCode()
}

enum class PlaybackState {
    IDLE,
    LOADING,
    SPEAKING,
    PAUSED,
    ERROR,
}
