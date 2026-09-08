package com.enigmaticphantasm.naturaltts.tts

import android.util.Log
import com.enigmaticphantasm.naturaltts.data.EngineFamily
import com.enigmaticphantasm.naturaltts.data.VoiceModel
import com.k2fsa.sherpa.onnx.GenerationConfig
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * On-device Piper / Kokoro TTS via sherpa-onnx (JitPack AAR + JNI).
 *
 * Dependency: `com.github.k2-fsa.sherpa-onnx:sherpa-onnx:v1.13.5` from JitPack.
 * If Gradle cannot resolve natives for your ABI, see README for manual AAR steps.
 */
class SherpaOnnxTtsEngine : TtsEngine {
    companion object {
        private const val TAG = "SherpaOnnxTts"

        /** True if the sherpa-onnx JNI library loaded. */
        val nativeAvailable: Boolean by lazy {
            runCatching {
                System.loadLibrary("sherpa-onnx-jni")
                true
            }.getOrElse {
                Log.w(TAG, "sherpa-onnx-jni not loadable: ${it.message}")
                false
            }
        }
    }

    override val name: String = "sherpa-onnx (Piper / Kokoro)"

    private var offlineTts: OfflineTts? = null
    private var loadedVoiceId: String? = null

    override val isAvailable: Boolean
        get() = nativeAvailable && offlineTts != null

    suspend fun loadVoice(voice: VoiceModel, modelDir: File): Boolean = withContext(Dispatchers.IO) {
        if (!nativeAvailable) return@withContext false
        if (loadedVoiceId == voice.id && offlineTts != null) return@withContext true

        releaseInternal()

        fun findFile(name: String, predicate: (File) -> Boolean): File? {
            val exact = File(modelDir, name)
            if (exact.exists()) return exact
            return modelDir.walkTopDown().firstOrNull(predicate)
        }
        val modelFile = findFile(voice.modelFileName) { it.isFile && it.name.endsWith(".onnx") }
            ?: run {
                Log.e(TAG, "Missing onnx in $modelDir")
                return@withContext false
            }
        val tokensFile = findFile(voice.tokensFileName) { it.isFile && it.name == "tokens.txt" }
            ?: run {
                Log.e(TAG, "Missing tokens.txt in $modelDir")
                return@withContext false
            }
        val modelPath = modelFile.absolutePath
        val tokensPath = tokensFile.absolutePath
        val dataDir = if (voice.dataDirName.isNotEmpty()) {
            (findFile(voice.dataDirName) { it.isDirectory && it.name == "espeak-ng-data" }
                ?: File(modelDir, voice.dataDirName)).absolutePath
        } else ""
        val voicesBinPath = if (voice.voicesBinName.isNotEmpty()) {
            (findFile(voice.voicesBinName) { it.isFile && it.name == "voices.bin" }
                ?: File(modelDir, voice.voicesBinName)).absolutePath
        } else ""

        val config = when (voice.family) {
            EngineFamily.PIPER -> {
                val vits = OfflineTtsVitsModelConfig(
                    model = modelPath,
                    tokens = tokensPath,
                    dataDir = dataDir,
                )
                OfflineTtsConfig(
                    model = OfflineTtsModelConfig(
                        vits = vits,
                        numThreads = 2,
                        debug = false,
                        provider = "cpu",
                    ),
                    maxNumSentences = 1,
                )
            }
            EngineFamily.KOKORO -> {
                val kokoro = OfflineTtsKokoroModelConfig(
                    model = modelPath,
                    voices = voicesBinPath,
                    tokens = tokensPath,
                    dataDir = dataDir,
                )
                OfflineTtsConfig(
                    model = OfflineTtsModelConfig(
                        kokoro = kokoro,
                        numThreads = 4,
                        debug = false,
                        provider = "cpu",
                    ),
                    maxNumSentences = 1,
                )
            }
            EngineFamily.SYSTEM_FALLBACK -> return@withContext false
        }

        return@withContext try {
            offlineTts = OfflineTts(config = config)
            loadedVoiceId = voice.id
            Log.i(TAG, "Loaded voice ${voice.id}")
            true
        } catch (t: Throwable) {
            Log.e(TAG, "Failed to create OfflineTts for ${voice.id}", t)
            offlineTts = null
            loadedVoiceId = null
            false
        }
    }

    override suspend fun synthesize(
        text: String,
        speed: Float,
        speakerId: Int,
        onCancelCheck: () -> Boolean,
    ): SynthResult? = withContext(Dispatchers.Default) {
        val tts = offlineTts ?: return@withContext null
        if (onCancelCheck()) return@withContext null
        try {
            val gen = GenerationConfig(
                sid = speakerId,
                speed = speed.coerceIn(0.5f, 2.0f),
                silenceScale = 0.2f,
            )
            val audio = tts.generateWithConfigAndCallback(text, gen) {
                if (onCancelCheck()) 0 else 1
            }
            if (onCancelCheck()) return@withContext null
            SynthResult(samples = audio.samples, sampleRate = audio.sampleRate)
        } catch (t: Throwable) {
            Log.e(TAG, "synthesize failed", t)
            null
        }
    }

    private fun releaseInternal() {
        try {
            offlineTts?.release()
        } catch (_: Throwable) {
        }
        offlineTts = null
        loadedVoiceId = null
    }

    override fun release() = releaseInternal()
}
