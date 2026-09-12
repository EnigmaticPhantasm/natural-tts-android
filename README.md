# Natural Reader

Free, on-device text-to-speech Android app. Paste text or a URL, pick a **Piper** or **Kokoro** voice, and listen — **no paid APIs**, no cloud TTS keys.

- **App name:** Natural Reader  
- **applicationId:** `com.enigmaticphantasm.naturaltts`  
- **Stack:** Kotlin · Jetpack Compose · Material 3 · OkHttp · Jsoup · DataStore · [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) via JitPack  

## Features

1. Multiline editor with Play / Pause / Stop and speaking status  
2. **Load from URL** — fetches the page and extracts readable text (scripts/nav stripped via Jsoup)  
3. Settings: Piper vs Kokoro, voice picker, speech rate, download/delete models  
4. Curated English voice catalog with direct GitHub release URLs and size estimates  
5. Auto-downloads a small **Amy low int8** Piper voice on first launch  
6. `ACTION_SEND` `text/plain` share target (e.g. share from browser)  
7. Long-text chunking for TTS  
8. Preferences persisted with DataStore  


## Browser version

A free static web twin lives in [`web/`](web/):

- Paste text or load a URL (readable-text extract; optional third-party CORS proxy, **off** by default)
- **Web Speech API** voices with rate + pause/resume, plus optional **Kokoro** neural TTS in-browser (CDN / onnx, no paid APIs)
- Open `web/index.html` locally, serve the folder (`python3 -m http.server`), or host on GitHub Pages — see [`web/README.md`](web/README.md)

## Open in Android Studio

1. Install [Android Studio](https://developer.android.com/studio) (Ladybug / 2024.2+ recommended) with SDK 35 and a device/emulator (API 26+).  
2. **File → Open** → select this folder (`natural-tts-android`).  
3. Let Gradle sync. First sync pulls Compose, OkHttp, Jsoup, commons-compress, and **sherpa-onnx from JitPack** (can take several minutes).  
4. Run on a device or emulator (`app` configuration).  

Command line (with Android SDK configured):

```bash
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> This Linux workspace may not have the Android SDK; building here is optional. Prefer Android Studio on a developer machine.

## How voices are downloaded

- Catalog: `VoiceCatalog.kt` — direct `.tar.bz2` URLs under  
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/…`  
- Stored under: `context.filesDir/models/<extractDirName>/`  
- First launch: `VoiceDownloader.ensureDefaultVoiceInstalled()` pulls **vits-piper-en_US-amy-low-int8** (~20 MB).  
- Settings → download / delete per voice. Progress is shown in the UI.  
- Archives are extracted with Apache Commons Compress (bzip2 + tar).  

No Hugging Face HTML scraping — only direct file URLs.

### Included catalog (approx. archive sizes)

| Voice | Family | Archive (approx.) |
|-------|--------|-------------------|
| Amy US low int8 (default) | Piper | ~20 MB |
| Amy US low | Piper | ~64 MB |
| Lessac US medium | Piper | ~63 MB |
| Alan GB low | Piper | ~64 MB |
| Cori GB medium | Piper | ~63 MB |
| Kokoro EN v0.19 | Kokoro | ~80 MB |

Exact sizes vary with release assets.

## TTS engines

### Primary: sherpa-onnx (Piper / Kokoro)

```kotlin
implementation("com.github.k2-fsa.sherpa-onnx:sherpa-onnx:v1.13.5")
```

JitPack is enabled in `settings.gradle.kts`. Native lib: `libsherpa-onnx-jni.so` inside the AAR.

`SherpaOnnxTtsEngine` builds `OfflineTts` configs for:

- **Piper (VITS):** `model` + `tokens` + `espeak-ng-data`  
- **Kokoro:** `model` + `voices.bin` + `tokens` + `espeak-ng-data`  

### Fallback: Android system TextToSpeech

If sherpa-onnx JNI fails to load, a voice is missing, or the user enables **Use Android system TTS (fallback)** in Settings, playback uses the device’s system TTS (clearly labeled in the UI).

### Manual AAR (if JitPack fails)

1. Download a release Android package from  
   https://github.com/k2-fsa/sherpa-onnx/releases  
   (e.g. `sherpa-onnx-v1.13.x-android.tar.bz2` or the published AAR used by the Java demos).  
2. Place the AAR under `app/libs/` and in `app/build.gradle.kts`:

```kotlin
implementation(files("libs/sherpa-onnx.aar"))
```

3. Or follow the official Android Java docs:  
   https://k2-fsa.github.io/sherpa/onnx/java-api/anroid-java.html  

## Architecture

```
TtsEngine (interface)
├── SherpaOnnxTtsEngine   // Piper + Kokoro via OfflineTts
└── SystemTtsEngine       // android.speech.tts.TextToSpeech fallback

TtsController             // chunking, engine selection, AudioTrack playback
VoiceDownloader           // OkHttp download + tar.bz2 extract
UrlTextExtractor          // OkHttp + Jsoup
PreferencesRepository     // DataStore
```

## Licenses (models & runtime)

| Component | License (typical) | Notes |
|-----------|-------------------|--------|
| **sherpa-onnx** | Apache-2.0 | Runtime / JNI |
| **Piper voices** | MIT (rhasspy/piper-voices) | Check each voice’s card on Hugging Face / Piper docs |
| **Kokoro** | Apache-2.0 (hexgrad Kokoro / kLegacy lineage) | Confirm upstream LICENSE for the exact package you ship |
| **espeak-ng-data** | GPL-compatible espeak-ng data | Bundled inside sherpa-onnx TTS archives |

This app ships **no** model binaries in the APK by default; users download them in-app. Redistribute models only according to their licenses.

## Privacy / offline

- Speech synthesis runs on-device once models are installed.  
- Network is used only to: fetch a URL you request, or download voice archives you choose.  
- No analytics SDKs, no TTS API keys.

## Project layout

```
natural-tts-android/
├── app/src/main/java/com/enigmaticphantasm/naturaltts/
│   ├── MainActivity.kt
│   ├── NaturalTtsApp.kt
│   ├── data/          # catalog, DataStore, downloader
│   ├── tts/           # engines + controller + AudioTrack player
│   ├── ui/            # Compose screens + theme
│   └── util/          # URL extract, text chunker
├── web/               # static browser twin (HTML/CSS/JS)
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── README.md
├── app/build.gradle.kts
├── settings.gradle.kts
└── README.md
```

## Build caveats

- **SDK may be missing** on CI/headless Linux boxes — open in Android Studio to compile.  
- First JitPack build of sherpa-onnx can be slow or occasionally flake; retry sync or use a manual AAR.  
- Prefer a real **arm64-v8a** device for performance; emulators work but are slower.  
- Large voices need free storage under the app’s private files dir.  
- `minSdk 26`, `compileSdk`/`targetSdk` **35**.  

## Share intent

Sharing `text/plain` into the app fills the editor. If the shared content is a single `http(s)` URL, the app auto-fetches readable text.
