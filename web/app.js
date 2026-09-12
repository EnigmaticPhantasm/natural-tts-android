/**
 * Natural Reader — browser edition
 * Free Web Speech API + optional Kokoro neural TTS (CDN / Transformers.js).
 * No paid APIs, no keys, static-host friendly.
 */

const STORAGE_KEYS = {
  voiceURI: "nr.voiceURI",
  rate: "nr.rate",
  engine: "nr.engine",
  kokoroVoice: "nr.kokoroVoice",
  text: "nr.text",
  corsProxy: "nr.corsProxy",
};

const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const KOKORO_CDN = "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";

/** Curated Kokoro voices (American / British). */
const KOKORO_VOICES = [
  { id: "af_heart", label: "Heart (US ♀)" },
  { id: "af_bella", label: "Bella (US ♀)" },
  { id: "af_nicole", label: "Nicole (US ♀)" },
  { id: "af_sarah", label: "Sarah (US ♀)" },
  { id: "af_sky", label: "Sky (US ♀)" },
  { id: "am_adam", label: "Adam (US ♂)" },
  { id: "am_michael", label: "Michael (US ♂)" },
  { id: "am_fenrir", label: "Fenrir (US ♂)" },
  { id: "bf_emma", label: "Emma (GB ♀)" },
  { id: "bf_isabella", label: "Isabella (GB ♀)" },
  { id: "bm_george", label: "George (GB ♂)" },
  { id: "bm_lewis", label: "Lewis (GB ♂)" },
];

/** Public CORS proxies — only used when user explicitly enables the toggle. */
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const els = {
  text: document.getElementById("text-input"),
  url: document.getElementById("url-input"),
  corsProxy: document.getElementById("cors-proxy-toggle"),
  speak: document.getElementById("btn-speak"),
  pause: document.getElementById("btn-pause"),
  stop: document.getElementById("btn-stop"),
  loadUrl: document.getElementById("btn-load-url"),
  status: document.getElementById("status"),
  settingsBtn: document.getElementById("btn-settings"),
  settingsPanel: document.getElementById("settings-panel"),
  engine: document.getElementById("engine-select"),
  voice: document.getElementById("voice-select"),
  kokoroVoice: document.getElementById("kokoro-voice-select"),
  browserVoiceBlock: document.getElementById("browser-voice-block"),
  kokoroVoiceBlock: document.getElementById("kokoro-voice-block"),
  loadKokoro: document.getElementById("btn-load-kokoro"),
  kokoroProgress: document.getElementById("kokoro-progress"),
  rate: document.getElementById("rate-slider"),
  rateValue: document.getElementById("rate-value"),
};

const state = {
  voices: [],
  speaking: false,
  paused: false,
  engine: "browser",
  /** @type {SpeechSynthesisUtterance | null} */
  utterance: null,
  /** Remaining text for resume-after-cancel fallback */
  resumeText: "",
  /** Char index bookmark for pause/resume */
  charIndex: 0,
  /** @type {import("kokoro-js").KokoroTTS | null} */
  kokoro: null,
  kokoroLoading: false,
  /** @type {AudioContext | null} */
  audioCtx: null,
  /** @type {AudioBufferSourceNode | null} */
  audioSource: null,
  /** Playback clock for neural pause/resume */
  neural: {
    buffer: null,
    startedAt: 0,
    offset: 0,
    rate: 1,
  },
};

function setStatus(message, kind = "idle") {
  els.status.textContent = message;
  els.status.className = "status" + (kind !== "idle" ? ` is-${kind}` : "");
}

function updateTransport() {
  const active = state.speaking || state.paused;
  els.pause.disabled = !active;
  els.stop.disabled = !active;
  els.pause.textContent = state.paused ? "Resume" : "Pause";
  els.speak.disabled = state.speaking && !state.paused;
}

function loadPrefs() {
  const rate = parseFloat(localStorage.getItem(STORAGE_KEYS.rate) || "1");
  els.rate.value = String(Number.isFinite(rate) ? rate : 1);
  els.rateValue.textContent = `${Number(els.rate.value).toFixed(2)}×`;

  const engine = localStorage.getItem(STORAGE_KEYS.engine) || "browser";
  els.engine.value = engine === "kokoro" ? "kokoro" : "browser";
  state.engine = els.engine.value;

  const text = localStorage.getItem(STORAGE_KEYS.text);
  if (text) els.text.value = text;

  els.corsProxy.checked = localStorage.getItem(STORAGE_KEYS.corsProxy) === "1";
}

function savePrefs() {
  localStorage.setItem(STORAGE_KEYS.rate, els.rate.value);
  localStorage.setItem(STORAGE_KEYS.engine, els.engine.value);
  localStorage.setItem(STORAGE_KEYS.voiceURI, els.voice.value || "");
  localStorage.setItem(STORAGE_KEYS.kokoroVoice, els.kokoroVoice.value || "");
  localStorage.setItem(STORAGE_KEYS.corsProxy, els.corsProxy.checked ? "1" : "0");
}

function persistTextSoon() {
  clearTimeout(persistTextSoon._t);
  persistTextSoon._t = setTimeout(() => {
    localStorage.setItem(STORAGE_KEYS.text, els.text.value);
  }, 400);
}

/* ----------------------------- Web Speech ----------------------------- */

function populateBrowserVoices() {
  if (!("speechSynthesis" in window)) {
    els.voice.innerHTML = `<option value="">Web Speech API not supported</option>`;
    return;
  }

  const voices = speechSynthesis.getVoices().slice();
  state.voices = voices;

  const byLang = new Map();
  for (const v of voices) {
    const lang = v.lang || "unknown";
    if (!byLang.has(lang)) byLang.set(lang, []);
    byLang.get(lang).push(v);
  }

  const preferred = localStorage.getItem(STORAGE_KEYS.voiceURI);
  const frag = document.createDocumentFragment();

  const sortedLangs = [...byLang.keys()].sort((a, b) => {
    const score = (l) => (l.toLowerCase().startsWith("en") ? 0 : 1);
    return score(a) - score(b) || a.localeCompare(b);
  });

  for (const lang of sortedLangs) {
    const group = document.createElement("optgroup");
    group.label = `Browser · ${lang}`;
    const list = byLang.get(lang).sort((a, b) => a.name.localeCompare(b.name));
    for (const v of list) {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = `${v.name}${v.localService ? "" : " (network)"}`;
      if (preferred && preferred === v.voiceURI) opt.selected = true;
      group.appendChild(opt);
    }
    frag.appendChild(group);
  }

  els.voice.innerHTML = "";
  els.voice.appendChild(frag);

  if (!preferred && voices.length) {
    const en = voices.find((v) => /^en(-|_)/i.test(v.lang) && v.localService)
      || voices.find((v) => /^en(-|_)/i.test(v.lang))
      || voices[0];
    els.voice.value = en.voiceURI;
  }
}

function selectedBrowserVoice() {
  return state.voices.find((v) => v.voiceURI === els.voice.value) || null;
}

function stopBrowserSpeech() {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
  state.utterance = null;
}

function speakBrowser(text, fromIndex = 0) {
  if (!("speechSynthesis" in window)) {
    setStatus("Web Speech API is not available in this browser.", "error");
    return;
  }

  const slice = text.slice(fromIndex).trim();
  if (!slice) {
    setStatus("Nothing to speak — paste some text first.", "error");
    return;
  }

  stopBrowserSpeech();
  // Chrome quirk: cancel can leave synth stuck; brief resume/pause dance helps.
  try {
    speechSynthesis.resume();
  } catch (_) { /* ignore */ }

  const u = new SpeechSynthesisUtterance(slice);
  const voice = selectedBrowserVoice();
  if (voice) u.voice = voice;
  u.rate = Number(els.rate.value) || 1;
  u.pitch = 1;
  u.volume = 1;

  state.charIndex = fromIndex;
  state.resumeText = text;
  state.utterance = u;
  state.speaking = true;
  state.paused = false;
  updateTransport();
  setStatus(`Speaking (browser)${voice ? ` · ${voice.name}` : ""}…`, "speaking");

  u.onboundary = (ev) => {
    if (typeof ev.charIndex === "number") {
      state.charIndex = fromIndex + ev.charIndex;
    }
  };

  u.onend = () => {
    if (state.paused) return;
    state.speaking = false;
    state.paused = false;
    state.utterance = null;
    updateTransport();
    setStatus("Idle");
  };

  u.onerror = (ev) => {
    if (ev.error === "canceled" || ev.error === "interrupted") return;
    state.speaking = false;
    state.paused = false;
    updateTransport();
    setStatus(`Speech error: ${ev.error || "unknown"}`, "error");
  };

  speechSynthesis.speak(u);
}

function pauseBrowser() {
  if (!state.speaking && !state.paused) return;

  if (state.paused) {
    // Resume
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      state.paused = false;
      state.speaking = true;
      updateTransport();
      setStatus("Speaking (browser)…", "speaking");
      return;
    }
    // Fallback: re-speak from last boundary
    speakBrowser(state.resumeText || els.text.value, state.charIndex || 0);
    return;
  }

  // Pause
  if (typeof speechSynthesis.pause === "function") {
    speechSynthesis.pause();
    // Some browsers ignore pause — detect and use cancel+resume pattern later
    setTimeout(() => {
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        // Pause unsupported: cancel and keep bookmark
        speechSynthesis.cancel();
      }
      state.paused = true;
      state.speaking = false;
      updateTransport();
      setStatus("Paused", "idle");
    }, 50);
  }
}

/* ----------------------------- Kokoro neural ----------------------------- */

function populateKokoroVoices() {
  const preferred = localStorage.getItem(STORAGE_KEYS.kokoroVoice) || "af_heart";
  els.kokoroVoice.innerHTML = "";
  const us = document.createElement("optgroup");
  us.label = "Neural · Kokoro · American";
  const gb = document.createElement("optgroup");
  gb.label = "Neural · Kokoro · British";
  for (const v of KOKORO_VOICES) {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.label;
    if (v.id === preferred) opt.selected = true;
    if (v.id.startsWith("b")) gb.appendChild(opt);
    else us.appendChild(opt);
  }
  els.kokoroVoice.appendChild(us);
  els.kokoroVoice.appendChild(gb);
}

async function ensureKokoro() {
  if (state.kokoro) return state.kokoro;
  if (state.kokoroLoading) {
    throw new Error("Kokoro is already loading — please wait.");
  }

  state.kokoroLoading = true;
  els.kokoroProgress.hidden = false;
  els.kokoroProgress.textContent = "Loading Kokoro model (first time ~50–100 MB over the network)…";
  setStatus("Loading Kokoro neural model…", "loading");
  els.loadKokoro.disabled = true;

  try {
    const mod = await import(/* @vite-ignore */ KOKORO_CDN);
    const KokoroTTS = mod.KokoroTTS || mod.default?.KokoroTTS;
    if (!KokoroTTS) throw new Error("KokoroTTS export not found in CDN bundle.");

    const device = navigator.gpu ? "webgpu" : "wasm";
    const dtype = device === "webgpu" ? "fp32" : "q8";

    els.kokoroProgress.textContent = `Initializing on ${device} (${dtype})…`;

    state.kokoro = await KokoroTTS.from_pretrained(KOKORO_MODEL, {
      dtype,
      device,
      progress_callback: (p) => {
        if (!p) return;
        if (p.status === "progress" && p.total) {
          const pct = Math.round((p.loaded / p.total) * 100);
          els.kokoroProgress.textContent = `Downloading ${p.file || "model"}… ${pct}%`;
          setStatus(`Downloading Kokoro… ${pct}%`, "loading");
        } else if (p.status === "done") {
          els.kokoroProgress.textContent = `Loaded ${p.file || "asset"}`;
        }
      },
    });

    els.kokoroProgress.textContent = "Kokoro ready (cached by the browser for offline reuse).";
    setStatus("Kokoro ready", "idle");
    return state.kokoro;
  } catch (err) {
    state.kokoro = null;
    const msg = err?.message || String(err);
    els.kokoroProgress.textContent = `Failed to load Kokoro: ${msg}`;
    setStatus(`Kokoro load failed — use Browser voices. ${msg}`, "error");
    throw err;
  } finally {
    state.kokoroLoading = false;
    els.loadKokoro.disabled = false;
  }
}

function stopNeuralAudio() {
  try {
    state.audioSource?.stop();
  } catch (_) { /* already stopped */ }
  state.audioSource = null;
  if (state.audioCtx && state.audioCtx.state !== "closed") {
    // keep ctx for reuse
  }
  state.neural.buffer = null;
  state.neural.offset = 0;
}

function getAudioContext() {
  if (!state.audioCtx || state.audioCtx.state === "closed") {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
}

/**
 * Convert Kokoro RawAudio / Float32Array to AudioBuffer and play.
 */
async function playNeuralAudio(rawAudio, playbackRate = 1) {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  let samples;
  let sampleRate = 24000;

  if (rawAudio?.audio) {
    samples = rawAudio.audio;
    sampleRate = rawAudio.sampling_rate || rawAudio.sample_rate || 24000;
  } else if (rawAudio instanceof Float32Array) {
    samples = rawAudio;
  } else if (ArrayBuffer.isView(rawAudio)) {
    samples = new Float32Array(rawAudio.buffer, rawAudio.byteOffset, rawAudio.byteLength / 4);
  } else if (rawAudio?.data) {
    samples = rawAudio.data;
    sampleRate = rawAudio.sample_rate || sampleRate;
  } else {
    throw new Error("Unrecognized Kokoro audio format");
  }

  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples instanceof Float32Array ? samples : new Float32Array(samples), 0);

  state.neural.buffer = buffer;
  state.neural.rate = playbackRate;
  state.neural.offset = 0;
  startNeuralFromOffset(0);
}

function startNeuralFromOffset(offsetSec) {
  const ctx = getAudioContext();
  const buffer = state.neural.buffer;
  if (!buffer) return;

  try {
    state.audioSource?.stop();
  } catch (_) {}

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = state.neural.rate || 1;
  source.connect(ctx.destination);

  state.audioSource = source;
  state.neural.offset = offsetSec;
  state.neural.startedAt = ctx.currentTime;
  state.speaking = true;
  state.paused = false;
  updateTransport();

  source.onended = () => {
    if (state.paused) return;
    // Natural end vs stop
    if (state.audioSource === source) {
      state.speaking = false;
      state.paused = false;
      state.audioSource = null;
      updateTransport();
      setStatus("Idle");
    }
  };

  source.start(0, offsetSec);
}

function pauseNeural() {
  const ctx = getAudioContext();
  if (state.paused) {
    // Resume
    startNeuralFromOffset(state.neural.offset || 0);
    setStatus("Speaking (Kokoro)…", "speaking");
    return;
  }
  if (!state.speaking || !state.audioSource) return;

  const elapsed = (ctx.currentTime - state.neural.startedAt) * (state.neural.rate || 1);
  state.neural.offset = Math.min(
    (state.neural.offset || 0) + elapsed,
    state.neural.buffer?.duration || 0
  );
  try {
    state.audioSource.stop();
  } catch (_) {}
  state.audioSource = null;
  state.paused = true;
  state.speaking = false;
  updateTransport();
  setStatus("Paused", "idle");
}

function chunkText(text, maxLen = 380) {
  const parts = [];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > maxLen && buf) {
      parts.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.filter(Boolean);
}

async function speakKokoro(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    setStatus("Nothing to speak — paste some text first.", "error");
    return;
  }

  stopAll();
  let tts;
  try {
    tts = await ensureKokoro();
  } catch {
    return;
  }

  const voice = els.kokoroVoice.value || "af_heart";
  const rate = Number(els.rate.value) || 1;
  const chunks = chunkText(trimmed);

  state.speaking = true;
  state.paused = false;
  updateTransport();
  setStatus(`Synthesizing with Kokoro (${voice})…`, "loading");

  try {
    // Generate chunks sequentially and concatenate for simpler pause/resume
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    const arrays = [];
    let sampleRate = 24000;

    for (let i = 0; i < chunks.length; i++) {
      if (!state.speaking && !state.paused) return; // stopped
      setStatus(`Synthesizing chunk ${i + 1}/${chunks.length}…`, "loading");
      const audio = await tts.generate(chunks[i], { voice });
      let samples;
      if (audio?.audio) {
        samples = audio.audio;
        sampleRate = audio.sampling_rate || audio.sample_rate || sampleRate;
      } else if (typeof audio?.toFloat32Array === "function") {
        samples = audio.toFloat32Array();
        sampleRate = audio.sampling_rate || sampleRate;
      } else if (audio instanceof Float32Array) {
        samples = audio;
      } else {
        throw new Error("Unexpected Kokoro generate() return type");
      }
      arrays.push(samples instanceof Float32Array ? samples : new Float32Array(samples));
    }

    const total = arrays.reduce((n, a) => n + a.length, 0);
    const merged = new Float32Array(total);
    let o = 0;
    for (const a of arrays) {
      merged.set(a, o);
      o += a.length;
    }

    setStatus(`Speaking (Kokoro · ${voice})…`, "speaking");
    await playNeuralAudio({ audio: merged, sampling_rate: sampleRate }, rate);
  } catch (err) {
    state.speaking = false;
    state.paused = false;
    updateTransport();
    setStatus(`Kokoro error: ${err?.message || err}`, "error");
  }
}

/* ----------------------------- URL extract ----------------------------- */

function extractReadableText(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const sel of [
    "script", "style", "noscript", "svg", "iframe", "nav", "footer",
    "header", "aside", "form", "button", "[role='navigation']", "[role='banner']",
  ]) {
    doc.querySelectorAll(sel).forEach((n) => n.remove());
  }

  const article =
    doc.querySelector("article") ||
    doc.querySelector("main") ||
    doc.querySelector("[role='main']") ||
    doc.body;

  if (!article) return "";

  const title = (doc.querySelector("title")?.textContent || "").trim();
  const text = (article.innerText || article.textContent || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const header = title ? `${title}\n\n` : "";
  const note = baseUrl ? `(Source: ${baseUrl})\n\n` : "";
  return `${header}${note}${text}`.trim();
}

async function fetchPage(url) {
  const abs = new URL(url, location.href).href;
  if (!/^https?:/i.test(abs)) {
    throw new Error("Only http(s) URLs are supported.");
  }

  const attempts = [];
  if (els.corsProxy.checked) {
    for (const make of CORS_PROXIES) {
      attempts.push({ label: "CORS proxy", url: make(abs) });
    }
  }
  attempts.push({ label: "direct", url: abs });

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      setStatus(`Fetching (${attempt.label})…`, "fetching");
      const res = await fetch(attempt.url, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const text = extractReadableText(html, abs);
      if (!text || text.length < 40) {
        throw new Error("Page returned little readable text. Try pasting manually.");
      }
      return text;
    } catch (err) {
      lastErr = err;
    }
  }

  const hint = els.corsProxy.checked
    ? "Direct fetch and third-party proxies both failed."
    : "Browser CORS blocked this site. Enable the third-party CORS proxy toggle, or open the page yourself and paste the text.";
  throw new Error(`${hint} (${lastErr?.message || lastErr})`);
}

/* ----------------------------- Orchestration ----------------------------- */

function stopAll() {
  stopBrowserSpeech();
  stopNeuralAudio();
  state.speaking = false;
  state.paused = false;
  state.resumeText = "";
  state.charIndex = 0;
  updateTransport();
}

function syncEngineUI() {
  const neural = els.engine.value === "kokoro";
  state.engine = els.engine.value;
  els.browserVoiceBlock.hidden = neural;
  els.kokoroVoiceBlock.hidden = !neural;
  savePrefs();
}

async function onSpeak() {
  const text = els.text.value;
  if (els.engine.value === "kokoro") {
    await speakKokoro(text);
  } else {
    speakBrowser(text, 0);
  }
}

function onPause() {
  if (els.engine.value === "kokoro") {
    pauseNeural();
  } else {
    pauseBrowser();
  }
}

function onStop() {
  stopAll();
  setStatus("Stopped");
}

async function onLoadUrl() {
  const raw = els.url.value.trim();
  if (!raw) {
    setStatus("Enter a URL first, or paste text into the editor.", "error");
    return;
  }
  els.loadUrl.disabled = true;
  try {
    const text = await fetchPage(raw);
    els.text.value = text;
    persistTextSoon();
    setStatus(`Loaded ${text.length.toLocaleString()} characters from URL.`, "idle");
  } catch (err) {
    setStatus(err?.message || String(err), "error");
  } finally {
    els.loadUrl.disabled = false;
  }
}

function bind() {
  els.speak.addEventListener("click", () => onSpeak());
  els.pause.addEventListener("click", () => onPause());
  els.stop.addEventListener("click", () => onStop());
  els.loadUrl.addEventListener("click", () => onLoadUrl());
  els.url.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onLoadUrl();
    }
  });

  els.text.addEventListener("input", persistTextSoon);
  els.rate.addEventListener("input", () => {
    els.rateValue.textContent = `${Number(els.rate.value).toFixed(2)}×`;
    savePrefs();
  });
  els.voice.addEventListener("change", savePrefs);
  els.kokoroVoice.addEventListener("change", savePrefs);
  els.engine.addEventListener("change", syncEngineUI);
  els.corsProxy.addEventListener("change", savePrefs);
  els.loadKokoro.addEventListener("click", () => {
    ensureKokoro().catch(() => {});
  });

  els.settingsBtn.addEventListener("click", () => {
    const open = els.settingsPanel.hasAttribute("hidden");
    if (open) els.settingsPanel.removeAttribute("hidden");
    else els.settingsPanel.setAttribute("hidden", "");
    els.settingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // Desktop: settings always visible via CSS; ensure not permanently hidden on wide screens after toggle
  const mq = window.matchMedia("(min-width: 900px)");
  const syncSettingsVisibility = () => {
    if (mq.matches) {
      els.settingsPanel.removeAttribute("hidden");
      els.settingsBtn.setAttribute("aria-expanded", "true");
    }
  };
  mq.addEventListener?.("change", syncSettingsVisibility);
  syncSettingsVisibility();
}

function init() {
  loadPrefs();
  populateKokoroVoices();
  populateBrowserVoices();
  syncEngineUI();
  bind();
  updateTransport();

  if ("speechSynthesis" in window) {
    speechSynthesis.addEventListener("voiceschanged", populateBrowserVoices);
    // Some browsers populate asynchronously
    setTimeout(populateBrowserVoices, 250);
  } else {
    setStatus("Web Speech API missing — try Chrome/Edge/Safari, or load Kokoro neural.", "error");
  }

  setStatus("Idle — paste text or load a URL.");
}

init();
