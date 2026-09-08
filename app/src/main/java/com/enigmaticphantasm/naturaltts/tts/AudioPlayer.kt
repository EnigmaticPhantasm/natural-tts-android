package com.enigmaticphantasm.naturaltts.tts

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import kotlin.coroutines.coroutineContext
import kotlin.math.min

/**
 * Plays float PCM via AudioTrack. Supports pause by stopping write loop externally.
 */
class AudioPlayer {
    @Volatile
    private var track: AudioTrack? = null

    @Volatile
    var paused: Boolean = false

    @Volatile
    var stopped: Boolean = false

    suspend fun play(result: SynthResult) = withContext(Dispatchers.IO) {
        stopped = false
        paused = false
        val sampleRate = result.sampleRate
        val minBuf = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val at = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(minBuf * 2)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        track = at
        at.play()

        val floats = result.samples
        val chunk = 2048
        var i = 0
        while (i < floats.size && coroutineContext.isActive && !stopped) {
            while (paused && !stopped && coroutineContext.isActive) {
                Thread.sleep(40)
            }
            if (stopped || !coroutineContext.isActive) break
            val end = min(i + chunk, floats.size)
            val shorts = ShortArray(end - i)
            for (j in shorts.indices) {
                val s = floats[i + j].coerceIn(-1f, 1f)
                shorts[j] = (s * Short.MAX_VALUE).toInt().toShort()
            }
            at.write(shorts, 0, shorts.size)
            i = end
        }
        try {
            at.stop()
        } catch (_: Exception) {
        }
        at.release()
        if (track === at) track = null
    }

    fun pause() {
        paused = true
        track?.pause()
    }

    fun resume() {
        paused = false
        track?.play()
    }

    fun stop() {
        stopped = true
        paused = false
        try {
            track?.pause()
            track?.flush()
            track?.stop()
        } catch (_: Exception) {
        }
    }

    fun release() {
        stop()
        track?.release()
        track = null
    }
}
