# Natural Reader — Browser version

Free, static, single-page text-to-speech that mirrors the Android **Natural Reader** app in the browser.

- Paste text **or** load a page URL (readable-text extract)
- Speak with **browser voices** (Web Speech API) or optional **Kokoro neural** TTS
- No paid APIs, no API keys, no accounts
- Works offline for speech after first load of any neural model assets (browser cache)

## Open locally

Any of these work (no Node build step):

1. **Double-click** `index.html`  
   - Browser voices work.  
   - Some browsers restrict module CDN / WASM from `file://`. If Kokoro fails to load, use a local server (below).

2. **Simple static server** (recommended):

   ```bash
   # Python 3
   cd web
   python3 -m http.server 8080
   # → http://localhost:8080
   ```

   ```bash
   # Node (if installed)
   npx --yes serve .
   ```

3. **VS Code / Cursor** “Live Preview” / Live Server on the `web/` folder.

## GitHub Pages

Point Pages at `/` or `/docs`, or publish the `web/` folder as the site root:

- Settings → Pages → Deploy from branch → folder containing `index.html`
- Or copy `web/*` into `docs/` on `main`

CDN imports (`cdn.jsdelivr.net` for Kokoro) need network on first neural load. After that, the browser cache usually keeps WASM/model assets available offline for that origin.

## Features

| Control | Behavior |
|--------|----------|
| **Text area** | Paste or edit; last draft saved in `localStorage` |
| **Load from URL** | Fetches HTML, strips scripts/nav/chrome, extracts readable text |
| **CORS proxy** | **Off by default.** Optional third-party proxy when direct fetch fails |
| **Speak / Pause / Stop** | Web Speech pause/resume (with cancel+resume fallback); Kokoro offset-based pause |
| **Engine** | Browser voices **or** Kokoro (experimental) |
| **Rate** | 0.5×–2×, persisted |
| **Voice** | Grouped browser voices by language; curated Kokoro US/GB list |

## Voice engines

### 1. Browser voices (default, most reliable)

Uses the built-in [`speechSynthesis`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) API.

- Free, no download for local system voices
- Quality and language set depend on the OS / browser
- Voice + rate remembered in `localStorage`

### 2. Kokoro neural (experimental, free)

Loads [`kokoro-js`](https://www.npmjs.com/package/kokoro-js) from jsDelivr and the public ONNX model `onnx-community/Kokoro-82M-v1.0-ONNX` via Transformers.js.

- First use downloads tens of MB (q8/WASM or fp32/WebGPU) — then cached
- Runs **in the browser** (no server TTS)
- Prefer **Chrome/Edge** with WebGPU when available
- Use **Load / warm up Kokoro model** in Settings before long passages
- If the CDN or WASM backend fails, fall back to Browser voices

### Piper in the browser

Full Piper (phonemizer WASM + onnxruntime-web + voice ONNX) is possible but fragile on plain static hosts (WASM path / MIME / CDN 404 issues). This MVP prioritizes **solid Web Speech + working Kokoro**. To plug Piper later:

1. Self-host matching `onnxruntime-web` WASM next to the page  
2. Add `@mintplex-labs/piper-tts-web` or `@realtimex/piper-tts-web` with explicit `wasmPaths`  
3. Point voice IDs at Piper ONNX models (e.g. `en_US-amy-low`) stored under OPFS or a same-origin `/models/` folder  

The Android app already uses Piper/Kokoro via sherpa-onnx for the best on-device path.

## CORS & URL loading

Browsers block most cross-origin `fetch` calls unless the target site sends permissive CORS headers.

- **Default:** direct fetch only — many news sites will fail with a clear error  
- **Optional toggle:** “Use third-party CORS proxy” sends the URL through a public proxy (`corsproxy.io` / `allorigins`). Treat as **untrusted third-party**; privacy-sensitive pages should be copied manually instead  
- **Always works:** open the article yourself → select all → paste into the textarea  

## Privacy

- Speech synthesis runs in your browser  
- Network is used only to: fetch a URL you request, load CDN libraries / Kokoro weights you choose, or (if enabled) a CORS proxy  
- No analytics, no accounts, no TTS API keys  

## Files

```
web/
├── index.html   # Shell + Material-ish layout
├── styles.css   # Dark-friendly responsive UI
├── app.js       # Web Speech + Kokoro + URL extract
└── README.md
```

## License notes

- App UI code in this folder: same project license as the Android tree  
- Kokoro / Transformers.js / Piper models: see upstream Apache-2.0 / MIT terms before redistributing weights  
