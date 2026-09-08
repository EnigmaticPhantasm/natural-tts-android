package com.enigmaticphantasm.naturaltts

import android.app.Application
import com.enigmaticphantasm.naturaltts.data.PreferencesRepository
import com.enigmaticphantasm.naturaltts.data.VoiceDownloader
import com.enigmaticphantasm.naturaltts.tts.TtsController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class NaturalTtsApp : Application() {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    lateinit var preferences: PreferencesRepository
        private set
    lateinit var voiceDownloader: VoiceDownloader
        private set
    lateinit var ttsController: TtsController
        private set

    override fun onCreate() {
        super.onCreate()
        preferences = PreferencesRepository(this)
        voiceDownloader = VoiceDownloader(this)
        ttsController = TtsController(this, preferences, voiceDownloader)

        appScope.launch(Dispatchers.IO) {
            voiceDownloader.ensureDefaultVoiceInstalled()
        }
    }
}
