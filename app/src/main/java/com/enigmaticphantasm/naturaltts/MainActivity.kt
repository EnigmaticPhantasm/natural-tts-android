package com.enigmaticphantasm.naturaltts

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.enigmaticphantasm.naturaltts.ui.screens.MainScreen
import com.enigmaticphantasm.naturaltts.ui.screens.SettingsScreen
import com.enigmaticphantasm.naturaltts.ui.theme.NaturalReaderTheme

class MainActivity : ComponentActivity() {
    private var sharedText by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleSendIntent(intent)

        val app = application as NaturalTtsApp

        setContent {
            NaturalReaderTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val nav = rememberNavController()
                    NavHost(navController = nav, startDestination = "main") {
                        composable("main") {
                            MainScreen(
                                ttsController = app.ttsController,
                                preferences = app.preferences,
                                initialSharedText = sharedText,
                                onSharedTextConsumed = { sharedText = null },
                                onOpenSettings = { nav.navigate("settings") }
                            )
                        }
                        composable("settings") {
                            SettingsScreen(
                                preferences = app.preferences,
                                voiceDownloader = app.voiceDownloader,
                                ttsController = app.ttsController,
                                onBack = { nav.popBackStack() }
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleSendIntent(intent)
    }

    private fun handleSendIntent(intent: Intent?) {
        if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
        }
    }
}
