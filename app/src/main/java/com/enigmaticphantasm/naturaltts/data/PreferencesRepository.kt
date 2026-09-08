package com.enigmaticphantasm.naturaltts.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "natural_reader_prefs")

data class UserPreferences(
    val engineFamily: EngineFamily = EngineFamily.PIPER,
    val voiceId: String = VoiceCatalog.defaultVoice().id,
    val speechRate: Float = 1.0f,
    val useSystemFallback: Boolean = false,
    val speakerId: Int = 0,
    val defaultVoiceInstalled: Boolean = false,
)

class PreferencesRepository(private val context: Context) {
    private object Keys {
        val ENGINE = stringPreferencesKey("engine_family")
        val VOICE_ID = stringPreferencesKey("voice_id")
        val RATE = floatPreferencesKey("speech_rate")
        val SYSTEM_FALLBACK = booleanPreferencesKey("use_system_fallback")
        val SPEAKER_ID = stringPreferencesKey("speaker_id")
        val DEFAULT_INSTALLED = booleanPreferencesKey("default_voice_installed")
    }

    val preferencesFlow: Flow<UserPreferences> = context.dataStore.data.map { prefs ->
        UserPreferences(
            engineFamily = runCatching {
                EngineFamily.valueOf(prefs[Keys.ENGINE] ?: EngineFamily.PIPER.name)
            }.getOrDefault(EngineFamily.PIPER),
            voiceId = prefs[Keys.VOICE_ID] ?: VoiceCatalog.defaultVoice().id,
            speechRate = prefs[Keys.RATE] ?: 1.0f,
            useSystemFallback = prefs[Keys.SYSTEM_FALLBACK] ?: false,
            speakerId = prefs[Keys.SPEAKER_ID]?.toIntOrNull() ?: 0,
            defaultVoiceInstalled = prefs[Keys.DEFAULT_INSTALLED] ?: false,
        )
    }

    suspend fun current(): UserPreferences = preferencesFlow.first()

    suspend fun setEngineFamily(family: EngineFamily) {
        context.dataStore.edit { it[Keys.ENGINE] = family.name }
    }

    suspend fun setVoiceId(id: String) {
        context.dataStore.edit { it[Keys.VOICE_ID] = id }
    }

    suspend fun setSpeechRate(rate: Float) {
        context.dataStore.edit { it[Keys.RATE] = rate.coerceIn(0.5f, 2.0f) }
    }

    suspend fun setUseSystemFallback(enabled: Boolean) {
        context.dataStore.edit { it[Keys.SYSTEM_FALLBACK] = enabled }
    }

    suspend fun setSpeakerId(id: Int) {
        context.dataStore.edit { it[Keys.SPEAKER_ID] = id.toString() }
    }

    suspend fun setDefaultVoiceInstalled(installed: Boolean) {
        context.dataStore.edit { it[Keys.DEFAULT_INSTALLED] = installed }
    }
}
