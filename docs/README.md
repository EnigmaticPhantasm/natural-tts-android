# Natural Reader — Browser version

Free, static, single-page text-to-speech that mirrors the Android **Natural Reader** app in the browser.

- Paste text **or** load a page URL (readable-text extract)
- **Default engine: Piper neural voices** (100+ free MIT voices via `@mintplex-labs/piper-tts-web`)
- Optional **Kokoro** neural TTS and **browser / system** Web Speech (robotic fallback)
- Per–Piper-voice (and per-speaker) **speed / pitch / volume** saved in `localStorage`
- Multi-speaker voices show nicknamed speakers (e.g. `Iris (p225)`)
- No paid APIs, no API keys, no accounts

## Open locally

Any of these work (no Node build step):

1. **Simple static server** (recommended — required for ESM import maps / WASM):

   ```bash
   cd web
   python3 -m http.server 8080
   # → http://localhost:8080
   ```

2. **VS Code / Cursor** Live Preview / Live Server on the `web/` folder.

3. Double-click `index.html` may fail module/CDN loads on `file://` — prefer a local server.

## GitHub Pages

This repo publishes `docs/` (a mirror of `web/`). After editing `web/`, sync:

```bash
cp -a web/. docs/
```

Then hard-refresh the live site (bypass cache):

- Desktop: Ctrl+Shift+R / Cmd+Shift+R  
- iPhone Safari: clear website data for the Pages host, or open in a Private tab  
- Or append `?v=` + a new number to the URL once

## Features

| Control | Behavior |
|--------|----------|
| **Text area** | Paste or edit; last draft saved in `localStorage` |
| **Load from URL** | Fetches HTML, strips chrome, extracts readable text |
| **CORS proxy** | **Off by default.** Optional third-party proxy when direct fetch fails |
| **Speak / Pause / Stop** | Piper via `<audio>` (iOS-friendly) or AudioContext when pitch ≠ 1 |
| **Engine** | **Piper (default)** · Kokoro · Browser/system (robotic) |
| **Voice tune** | Speed, pitch, volume — **per Piper voice / speaker** |
| **Speaker** | Shown when `num_speakers > 1`; P-codes get human nicknames |

## Voice engines

### 1. Piper neural (default, recommended)

Uses a vendored/patched build of [`@mintplex-labs/piper-tts-web@1.0.5`](https://www.npmjs.com/package/@mintplex-labs/piper-tts-web) (MIT) with:

- Import map → `onnxruntime-web@1.18.0` WASM from jsDelivr (`dist/esm/ort.wasm.min.js`)
- Phonemizer WASM from `@diffusionstudio/piper-wasm` (jsDelivr)
- Voice ONNX models from Hugging Face (`diffusionstudio/piper-voices`) on first use, cached in **OPFS**
- Full catalog from `voices()` (falls back to packaged `PATH_MAP` / static JSON if HF is unreachable)
- Default voice: `en_US-lessac-medium` (fallback `en_US-hfc_female-medium`)
- Multi-speaker `sid` support + iOS-safe single-thread WASM when the page is not cross-origin isolated

### 2. Kokoro neural (experimental)

Loads `kokoro-js` from jsDelivr + public ONNX weights. Prefer Chrome/Edge with WebGPU.

### 3. Browser / system TTS (robotic fallback)

Built-in `speechSynthesis` — quality depends on the OS; labeled clearly as robotic/system fallback.

## iOS / Safari notes

- Needs **HTTPS** (or localhost) for OPFS model cache and secure audio.
- Import maps require **Safari 16.4+**.
- WASM threads: we force **1 thread** unless `crossOriginIsolated` (GitHub Pages usually is not) — avoids SharedArrayBuffer failures on iPhone.
- First Speak must follow a user tap (Speak button). Playback uses `HTMLAudioElement` when pitch is neutral for better mobile behavior.
- Large voices (50–80+ MB): download on Wi‑Fi the first time; progress UI is shown.
- If OPFS write fails, synthesis can still fetch the model for that session (cache may not persist).

## CORS & URL loading

- **Default:** direct fetch only  
- **Optional toggle:** third-party CORS proxy (`corsproxy.io` / `allorigins`)  
- **Always works:** open the article yourself → paste into the textarea  

## Privacy

- Speech runs in your browser  
- Network: URL you request, CDN libs, Hugging Face Piper models you choose, optional CORS proxy  
- No analytics, no accounts, no TTS API keys  

## Files

```
web/
├── index.html
├── styles.css
├── app.js
├── README.md
└── vendor/piper-tts-web/   # patched MIT bundle (speaker id + iOS threads)
```

## License notes

- App UI code: same project license as the Android tree  
- Piper / onnxruntime-web / Kokoro models & runtimes: upstream MIT / Apache-2.0 — check each voice card before redistributing weights  
