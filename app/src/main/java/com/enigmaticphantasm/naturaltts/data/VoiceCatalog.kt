package com.enigmaticphantasm.naturaltts.data

/**
 * Curated on-device voices with direct download URLs from k2-fsa/sherpa-onnx releases.
 * No HTML scraping — archive URLs only.
 */
enum class EngineFamily {
    PIPER,
    KOKORO,
    SYSTEM_FALLBACK
}

data class VoiceModel(
    val id: String,
    val displayName: String,
    val family: EngineFamily,
    /** Direct .tar.bz2 URL from GitHub releases (tts-models tag). */
    val archiveUrl: String,
    /** Folder name after extract (also used under filesDir/models/). */
    val extractDirName: String,
    /** Relative path to main ONNX inside extract dir. */
    val modelFileName: String,
    /** Relative tokens path. */
    val tokensFileName: String = "tokens.txt",
    /** Relative espeak-ng-data dir (Piper/Kokoro phonemizer). Empty if unused. */
    val dataDirName: String = "espeak-ng-data",
    /** Kokoro voices.bin (empty for Piper). */
    val voicesBinName: String = "",
    val sizeBytesEstimate: Long,
    val sizeLabel: String,
    val language: String = "en",
    val description: String = "",
    val speakerCount: Int = 1,
    val isDefault: Boolean = false,
)

object VoiceCatalog {
    private const val TTS_MODELS =
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models"

    val voices: List<VoiceModel> = listOf(
        VoiceModel(
            id = "piper-en_US-amy-low",
            displayName = "Amy (US, low, int8)",
            family = EngineFamily.PIPER,
            archiveUrl = "$TTS_MODELS/vits-piper-en_US-amy-low-int8.tar.bz2",
            extractDirName = "vits-piper-en_US-amy-low-int8",
            modelFileName = "en_US-amy-low.int8.onnx",
            sizeBytesEstimate = 20L * 1024 * 1024,
            sizeLabel = "~20 MB",
            description = "Compact quantized Piper US English — auto-downloaded on first launch.",
            isDefault = true,
        ),
        VoiceModel(
            id = "piper-en_US-amy-low-fp32",
            displayName = "Amy (US, low)",
            family = EngineFamily.PIPER,
            archiveUrl = "$TTS_MODELS/vits-piper-en_US-amy-low.tar.bz2",
            extractDirName = "vits-piper-en_US-amy-low",
            modelFileName = "en_US-amy-low.onnx",
            sizeBytesEstimate = 64L * 1024 * 1024,
            sizeLabel = "~64 MB",
            description = "Full-precision Amy low Piper voice.",
        ),
        VoiceModel(
            id = "piper-en_US-lessac-medium",
            displayName = "Lessac (US, medium)",
            family = EngineFamily.PIPER,
            archiveUrl = "$TTS_MODELS/vits-piper-en_US-lessac-medium.tar.bz2",
            extractDirName = "vits-piper-en_US-lessac-medium",
            modelFileName = "en_US-lessac-medium.onnx",
            sizeBytesEstimate = 63L * 1024 * 1024,
            sizeLabel = "~63 MB",
            description = "Higher-quality Piper US English.",
        ),
        VoiceModel(
            id = "piper-en_GB-alan-low",
            displayName = "Alan (GB, low)",
            family = EngineFamily.PIPER,
            archiveUrl = "$TTS_MODELS/vits-piper-en_GB-alan-low.tar.bz2",
            extractDirName = "vits-piper-en_GB-alan-low",
            modelFileName = "en_GB-alan-low.onnx",
            sizeBytesEstimate = 64L * 1024 * 1024,
            sizeLabel = "~64 MB",
            description = "British English Piper (alan-low). Prefer int8 variant if you add one.",
        ),
        VoiceModel(
            id = "piper-en_GB-cori-medium",
            displayName = "Cori (GB, medium)",
            family = EngineFamily.PIPER,
            archiveUrl = "$TTS_MODELS/vits-piper-en_GB-cori-medium.tar.bz2",
            extractDirName = "vits-piper-en_GB-cori-medium",
            modelFileName = "en_GB-cori-medium.onnx",
            sizeBytesEstimate = 63L * 1024 * 1024,
            sizeLabel = "~63 MB",
            description = "British English Piper medium quality.",
        ),
        VoiceModel(
            id = "kokoro-en-v0_19",
            displayName = "Kokoro EN v0.19",
            family = EngineFamily.KOKORO,
            archiveUrl = "$TTS_MODELS/kokoro-en-v0_19.tar.bz2",
            extractDirName = "kokoro-en-v0_19",
            modelFileName = "model.onnx",
            voicesBinName = "voices.bin",
            sizeBytesEstimate = 80L * 1024 * 1024,
            sizeLabel = "~80 MB",
            description = "Kokoro English — multiple speakers via voices.bin.",
            speakerCount = 11,
        ),
    )

    fun byId(id: String): VoiceModel? = voices.find { it.id == id }

    fun defaultVoice(): VoiceModel = voices.first { it.isDefault }

    fun forFamily(family: EngineFamily): List<VoiceModel> =
        voices.filter { it.family == family }
}
