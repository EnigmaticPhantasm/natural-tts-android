package com.enigmaticphantasm.naturaltts.data

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

/**
 * Downloads voice archives into [Context.getFilesDir]/models and extracts them.
 *
 * Primary format from sherpa-onnx releases is .tar.bz2. We prefer Apache Commons
 * Compress when on the classpath; otherwise fall back to a lightweight extractor
 * that shells out is NOT used — instead we include a simple bzip2/tar path via
 * [extractTarBz2] using Android-friendly streaming when commons-compress is present,
 * and a pure-Java fallback that expects the archive already usable.
 *
 * Note: commons-compress is added in app/build.gradle.kts for .tar.bz2 support.
 */
class VoiceDownloader(private val context: Context) {
    companion object {
        private const val TAG = "VoiceDownloader"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.MINUTES)
        .build()

    private val mutex = Mutex()

    private val _progress = MutableStateFlow<DownloadProgress?>(null)
    val progress: StateFlow<DownloadProgress?> = _progress.asStateFlow()

    data class DownloadProgress(
        val voiceId: String,
        val bytesDownloaded: Long,
        val totalBytes: Long?,
        val phase: Phase,
        val error: String? = null,
    ) {
        enum class Phase { DOWNLOADING, EXTRACTING, DONE, ERROR }
    }

    fun modelsRoot(): File = File(context.filesDir, "models").also { it.mkdirs() }

    fun voiceDir(voice: VoiceModel): File = File(modelsRoot(), voice.extractDirName)

    fun resolveModelFile(voice: VoiceModel): File? {
        val dir = voiceDir(voice)
        if (!dir.isDirectory) return null
        val exact = File(dir, voice.modelFileName)
        if (exact.isFile) return exact
        // int8 / fp16 archives sometimes use slightly different onnx names
        return dir.walkTopDown()
            .filter { it.isFile && it.name.endsWith(".onnx") }
            .firstOrNull()
    }

    fun resolveTokensFile(voice: VoiceModel): File? {
        val dir = voiceDir(voice)
        val exact = File(dir, voice.tokensFileName)
        if (exact.isFile) return exact
        return dir.walkTopDown()
            .filter { it.isFile && it.name == "tokens.txt" }
            .firstOrNull()
    }

    fun resolveDataDir(voice: VoiceModel): File? {
        if (voice.dataDirName.isEmpty()) return null
        val dir = voiceDir(voice)
        val exact = File(dir, voice.dataDirName)
        if (exact.isDirectory) return exact
        return dir.walkTopDown()
            .filter { it.isDirectory && it.name == "espeak-ng-data" }
            .firstOrNull()
    }

    fun isInstalled(voice: VoiceModel): Boolean {
        val model = resolveModelFile(voice) ?: return false
        val tokens = resolveTokensFile(voice) ?: return false
        if (!model.isFile || !tokens.isFile) return false
        if (voice.family == EngineFamily.KOKORO) {
            val voices = File(voiceDir(voice), voice.voicesBinName)
            if (!voices.isFile) {
                val alt = voiceDir(voice).walkTopDown()
                    .filter { it.isFile && it.name == "voices.bin" }
                    .firstOrNull()
                if (alt == null) return false
            }
        }
        if (voice.dataDirName.isNotEmpty() && resolveDataDir(voice) == null) return false
        return true
    }

    fun installedVoices(): List<VoiceModel> = VoiceCatalog.voices.filter { isInstalled(it) }

    suspend fun ensureDefaultVoiceInstalled() = withContext(Dispatchers.IO) {
        val voice = VoiceCatalog.defaultVoice()
        if (!isInstalled(voice)) {
            runCatching { downloadAndInstall(voice) }
                .onFailure { Log.e(TAG, "Default voice install failed", it) }
        }
    }

    suspend fun downloadAndInstall(voice: VoiceModel) = mutex.withLock {
        withContext(Dispatchers.IO) {
            val destDir = voiceDir(voice)
            if (isInstalled(voice)) {
                _progress.value = DownloadProgress(voice.id, 0, 0, DownloadProgress.Phase.DONE)
                return@withContext
            }

            val tmp = File(modelsRoot(), "${voice.id}.download.tmp")
            try {
                _progress.value = DownloadProgress(voice.id, 0, voice.sizeBytesEstimate, DownloadProgress.Phase.DOWNLOADING)
                downloadFile(voice.archiveUrl, tmp) { read, total ->
                    _progress.value = DownloadProgress(
                        voice.id, read, total ?: voice.sizeBytesEstimate,
                        DownloadProgress.Phase.DOWNLOADING
                    )
                }

                _progress.value = DownloadProgress(voice.id, tmp.length(), tmp.length(), DownloadProgress.Phase.EXTRACTING)
                if (destDir.exists()) destDir.deleteRecursively()
                destDir.mkdirs()
                extractTarBz2(tmp, modelsRoot())

                // Some archives nest as extractDirName/; ensure path exists
                if (!isInstalled(voice)) {
                    // Try if archive extracted without top-level folder
                    val alt = File(modelsRoot(), voice.modelFileName)
                    if (alt.isFile) {
                        // unexpected layout — leave as-is for debugging
                        Log.w(TAG, "Model layout unexpected for ${voice.id}")
                    }
                    if (!isInstalled(voice)) {
                        throw IllegalStateException("Extract finished but model files missing for ${voice.id}")
                    }
                }

                _progress.value = DownloadProgress(voice.id, tmp.length(), tmp.length(), DownloadProgress.Phase.DONE)
            } catch (e: Exception) {
                Log.e(TAG, "Download failed for ${voice.id}", e)
                destDir.deleteRecursively()
                _progress.value = DownloadProgress(
                    voice.id, 0, null, DownloadProgress.Phase.ERROR, e.message
                )
                throw e
            } finally {
                tmp.delete()
            }
        }
    }

    suspend fun deleteVoice(voice: VoiceModel) = withContext(Dispatchers.IO) {
        voiceDir(voice).deleteRecursively()
        File(modelsRoot(), "${voice.id}.download.tmp").delete()
    }

    private fun downloadFile(url: String, dest: File, onProgress: (Long, Long?) -> Unit) {
        val req = Request.Builder().url(url).get().build()
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) throw IllegalStateException("HTTP ${resp.code} for $url")
            val body = resp.body ?: throw IllegalStateException("Empty body")
            val total = body.contentLength().takeIf { it > 0 }
            dest.parentFile?.mkdirs()
            body.byteStream().use { input ->
                FileOutputStream(dest).use { output ->
                    val buf = ByteArray(64 * 1024)
                    var readTotal = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n <= 0) break
                        output.write(buf, 0, n)
                        readTotal += n
                        onProgress(readTotal, total)
                    }
                }
            }
        }
    }

    /**
     * Extract .tar.bz2 using Apache Commons Compress.
     */
    private fun extractTarBz2(archive: File, destRoot: File) {
        BufferedInputStream(archive.inputStream()).use { bis ->
            BZip2CompressorInputStream(bis).use { bzis ->
                TarArchiveInputStream(bzis).use { tar ->
                    var entry = tar.getNextEntry()
                    while (entry != null) {
                        val outFile = File(destRoot, entry.name)
                        if (entry.isDirectory) {
                            outFile.mkdirs()
                        } else {
                            outFile.parentFile?.mkdirs()
                            FileOutputStream(outFile).use { out ->
                                tar.copyTo(out)
                            }
                        }
                        entry = tar.getNextEntry()
                    }
                }
            }
        }
    }
}
