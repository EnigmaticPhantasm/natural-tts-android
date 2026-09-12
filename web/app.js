/**
 * Natural Reader — browser edition
 * Default: Piper neural TTS (@mintplex-labs/piper-tts-web, MIT)
 * Also: Kokoro experimental + Web Speech robotic fallback.
 * No paid APIs, no keys, static-host friendly (GitHub Pages).
 */

/** Piper is loaded lazily so UI still boots if onnxruntime / Safari fails. */
let piperMod = null;
let piperLoadError = null;
let piperLoadPromise = null;

async function ensurePiper() {
  if (piperMod) return piperMod;
  if (piperLoadError) throw piperLoadError;
  if (!piperLoadPromise) {
    piperLoadPromise = import("@mintplex-labs/piper-tts-web")
      .then((m) => {
        piperMod = m;
        return m;
      })
      .catch((err) => {
        piperLoadError = err;
        piperLoadPromise = null;
        throw err;
      });
  }
  return piperLoadPromise;
}

function piperPathMap() {
  return piperMod?.PATH_MAP || {};
}

const STORAGE_KEYS = {
  voiceURI: "nr.voiceURI",
  rate: "nr.rate",
  engine: "nr.engine",
  kokoroVoice: "nr.kokoroVoice",
  piperVoice: "nr.piperVoice",
  piperSpeaker: "nr.piperSpeaker",
  piperTunes: "nr.piperTunes",
  engineMigrated: "nr.engineMigratedToPiper",
  text: "nr.text",
  corsProxy: "nr.corsProxy",
};

const DEFAULT_PIPER_VOICE = "en_US-lessac-medium";
const FALLBACK_PIPER_VOICE = "en_US-hfc_female-medium";

const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const KOKORO_CDN = "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";

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

const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

/** Friendly first names for hashing P-codes / numeric speaker ids into nicknames. */
const NICK_NAMES = [
  "Ava", "Blair", "Cedar", "Daisy", "Eden", "Finn", "Greta", "Harper", "Iris", "Jules",
  "Kai", "Luna", "Milo", "Nora", "Owen", "Piper", "Quinn", "Remy", "Sage", "Tess",
  "Uma", "Vera", "Wren", "Xander", "Yara", "Zane", "Ada", "Beau", "Cora", "Drew",
  "Elle", "Ford", "Gina", "Hugh", "Ivy", "Jade", "Knox", "Leah", "Moss", "Nell",
  "Orli", "Penn", "Rita", "Shea", "Tara", "Uri", "Vale", "Wade", "Xael", "York",
  "Zora", "Arlo", "Bryn", "Clio", "Dell", "Echo", "Faye", "Glen", "Hana", "Indigo",
  "Joss", "Kira", "Lane", "Mira", "Nico", "Opal", "Pace", "Reed", "Skye", "Theo",
  "Urban", "Vesper", "Willa", "Yael", "Zeke", "Ash", "Brook", "Clay", "Dove", "Ember",
  "Flint", "Gale", "Hazel", "Isle", "Jasper", "Kelvin", "Lark", "Maple", "North", "Olive",
  "Pearl", "Quill", "River", "Storm", "Tide", "Violet", "Willow", "Zephyr", "Ari", "Blake",
  "Casey", "Devon", "Ellis", "Frankie", "Gray", "Harley", "Indie", "Jordan", "Kelly", "Logan",
  "Morgan", "Noel", "Parker", "Reese", "Sidney", "Taylor", "Alex", "Cameron", "Dylan", "Emery",
  "Finley", "Hayden", "Jamie", "Kennedy", "Leslie", "Marley", "Peyton", "Riley", "Shawn", "Tracy",
];

/** Known short speaker codes → display nicknames (arctic / emotions / misc). */
const KNOWN_SPEAKER_NICKS = {
  awb: "Alan",
  rms: "Robert",
  slt: "Shelley",
  ksp: "Kishore",
  clb: "Callie",
  lnh: "Lynn",
  aew: "Andrew",
  bdl: "Bill",
  jmk: "John",
  rxr: "Rex",
  fem: "Faye",
  ljm: "Laura",
  slp: "Sally",
  aup: "August",
  ahw: "Arthur",
  axb: "Alexi",
  eey: "Ellie",
  gka: "Gregor",
  amused: "Amused",
  angry: "Angry",
  disgusted: "Disgusted",
  drunk: "Tipsy",
  neutral: "Neutral",
  sleepy: "Sleepy",
  surprised: "Surprised",
  whisper: "Whisper",
  dsb: "Lower Sorbian",
  hsb: "Upper Sorbian",
  lada: "Lada",
  F: "Female",
  M: "Male",
};

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
  engineHint: document.getElementById("engine-hint"),
  voice: document.getElementById("voice-select"),
  piperVoice: document.getElementById("piper-voice-select"),
  piperSpeaker: document.getElementById("piper-speaker-select"),
  piperSpeakerWrap: document.getElementById("piper-speaker-wrap"),
  kokoroVoice: document.getElementById("kokoro-voice-select"),
  browserVoiceBlock: document.getElementById("browser-voice-block"),
  piperVoiceBlock: document.getElementById("piper-voice-block"),
  kokoroVoiceBlock: document.getElementById("kokoro-voice-block"),
  loadPiper: document.getElementById("btn-load-piper"),
  loadKokoro: document.getElementById("btn-load-kokoro"),
  piperProgress: document.getElementById("piper-progress"),
  kokoroProgress: document.getElementById("kokoro-progress"),
  downloadProgress: document.getElementById("download-progress"),
  progressBar: document.getElementById("progress-bar"),
  progressLabel: document.getElementById("progress-label"),
  rate: document.getElementById("rate-slider"),
  rateValue: document.getElementById("rate-value"),
  pitch: document.getElementById("pitch-slider"),
  pitchValue: document.getElementById("pitch-value"),
  volume: document.getElementById("volume-slider"),
  volumeValue: document.getElementById("volume-value"),
  tuneScope: document.getElementById("tune-scope"),
};

const state = {
  voices: [],
  piperVoiceList: [],
  speaking: false,
  paused: false,
  engine: "piper",
  utterance: null,
  resumeText: "",
  charIndex: 0,
  kokoro: null,
  kokoroLoading: false,
  piperLoading: false,
  audioCtx: null,
  audioSource: null,
  /** @type {HTMLAudioElement | null} */
  audioEl: null,
  audioUrl: null,
  neural: {
    buffer: null,
    startedAt: 0,
    offset: 0,
    rate: 1,
  },
  tune: { rate: 1, pitch: 1, volume: 1 },
  suppressTuneSave: false,
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

function showProgress(pct, label) {
  els.downloadProgress.hidden = false;
  const clamped = Math.max(0, Math.min(100, pct || 0));
  els.progressBar.style.width = `${clamped}%`;
  if (label) els.progressLabel.textContent = label;
}

function hideProgress() {
  els.downloadProgress.hidden = true;
  els.progressBar.style.width = "0%";
}

/* ----------------------------- Nicknames ----------------------------- */

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function nicknameForSpeaker(key) {
  if (key == null || key === "") return "Default";
  const raw = String(key);
  const lower = raw.toLowerCase();
  if (KNOWN_SPEAKER_NICKS[raw]) return KNOWN_SPEAKER_NICKS[raw];
  if (KNOWN_SPEAKER_NICKS[lower]) return KNOWN_SPEAKER_NICKS[lower];

  const pMatch = raw.match(/^p(\d+)$/i);
  if (pMatch) {
    const nick = NICK_NAMES[hashStr(`p:${pMatch[1]}`) % NICK_NAMES.length];
    return nick;
  }

  if (/^\d+$/.test(raw)) {
    return NICK_NAMES[hashStr(`n:${raw}`) % NICK_NAMES.length];
  }

  // Title-case tokens for codes like VIVOSSPK01, ISSAI_...
  if (/^[A-Z0-9_]+$/.test(raw) && raw.length > 2) {
    const nice = raw
      .replace(/_/g, " ")
      .replace(/([A-Z]+)(\d+)/g, "$1 $2")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return nice;
  }

  if (/^[a-z]{2,4}$/i.test(raw)) {
    const nick = NICK_NAMES[hashStr(`c:${lower}`) % NICK_NAMES.length];
    return nick;
  }

  return raw;
}

function formatSpeakerLabel(key) {
  const nick = nicknameForSpeaker(key);
  const code = String(key);
  if (/^p\d+$/i.test(code)) return `${nick} (${code.toLowerCase()})`;
  if (/^\d+$/.test(code)) return `${nick} · ${code}`;
  if (KNOWN_SPEAKER_NICKS[code] || KNOWN_SPEAKER_NICKS[code.toLowerCase()]) {
    return `${nick} · ${code}`;
  }
  if (nick.toLowerCase() === code.toLowerCase()) return code;
  return `${nick} · ${code}`;
}

/* ----------------------------- Prefs / per-voice tune ----------------------------- */

function tuneKey(voiceId, speakerKey) {
  return speakerKey ? `${voiceId}::${speakerKey}` : voiceId;
}

function loadTuneMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.piperTunes) || "{}") || {};
  } catch {
    return {};
  }
}

function saveTuneMap(map) {
  localStorage.setItem(STORAGE_KEYS.piperTunes, JSON.stringify(map));
}

function currentPiperSpeakerKey() {
  if (els.piperSpeakerWrap.hidden) return "";
  return els.piperSpeaker.value || "";
}

function getActiveTune() {
  const engine = els.engine.value;
  if (engine === "piper") {
    const map = loadTuneMap();
    const key = tuneKey(els.piperVoice.value || DEFAULT_PIPER_VOICE, currentPiperSpeakerKey());
    const t = map[key] || {};
    return {
      rate: Number.isFinite(t.rate) ? t.rate : 1,
      pitch: Number.isFinite(t.pitch) ? t.pitch : 1,
      volume: Number.isFinite(t.volume) ? t.volume : 1,
    };
  }
  const rate = parseFloat(localStorage.getItem(STORAGE_KEYS.rate) || "1");
  return {
    rate: Number.isFinite(rate) ? rate : 1,
    pitch: 1,
    volume: 1,
  };
}

function applyTuneToSliders(tune) {
  state.suppressTuneSave = true;
  els.rate.value = String(tune.rate);
  els.pitch.value = String(tune.pitch);
  els.volume.value = String(tune.volume);
  els.rateValue.textContent = `${Number(tune.rate).toFixed(2)}×`;
  els.pitchValue.textContent = Number(tune.pitch).toFixed(2);
  els.volumeValue.textContent = Number(tune.volume).toFixed(2);
  state.tune = { ...tune };
  state.suppressTuneSave = false;
}

function persistCurrentTune() {
  if (state.suppressTuneSave) return;
  const rate = Number(els.rate.value) || 1;
  const pitch = Number(els.pitch.value) || 1;
  const volume = Number(els.volume.value);
  state.tune = { rate, pitch, volume: Number.isFinite(volume) ? volume : 1 };

  if (els.engine.value === "piper") {
    const map = loadTuneMap();
    const key = tuneKey(els.piperVoice.value || DEFAULT_PIPER_VOICE, currentPiperSpeakerKey());
    map[key] = { ...state.tune };
    saveTuneMap(map);
  } else {
    localStorage.setItem(STORAGE_KEYS.rate, String(rate));
  }

  // Live-update playing audio when possible
  if (state.audioEl && !state.audioEl.paused) {
    state.audioEl.playbackRate = rate;
    state.audioEl.volume = Math.max(0, Math.min(1, state.tune.volume));
  }
  if (state.audioSource && state.neural.buffer) {
    try {
      state.audioSource.playbackRate.value = rate;
    } catch (_) { /* ignore */ }
  }
}

function loadPrefs() {
  // One-time migration: previous default was browser → switch stored browser to piper
  const storedEngine = localStorage.getItem(STORAGE_KEYS.engine);
  const migrated = localStorage.getItem(STORAGE_KEYS.engineMigrated) === "1";
  let engine = storedEngine || "piper";
  if (!migrated) {
    if (!storedEngine || storedEngine === "browser") {
      engine = "piper";
    }
    localStorage.setItem(STORAGE_KEYS.engineMigrated, "1");
    localStorage.setItem(STORAGE_KEYS.engine, engine);
  }
  if (!["piper", "kokoro", "browser"].includes(engine)) engine = "piper";
  els.engine.value = engine;
  state.engine = engine;

  const text = localStorage.getItem(STORAGE_KEYS.text);
  if (text) els.text.value = text;
  els.corsProxy.checked = localStorage.getItem(STORAGE_KEYS.corsProxy) === "1";

  applyTuneToSliders(getActiveTune());
}

function savePrefs() {
  localStorage.setItem(STORAGE_KEYS.engine, els.engine.value);
  localStorage.setItem(STORAGE_KEYS.voiceURI, els.voice.value || "");
  localStorage.setItem(STORAGE_KEYS.kokoroVoice, els.kokoroVoice.value || "");
  localStorage.setItem(STORAGE_KEYS.piperVoice, els.piperVoice.value || "");
  localStorage.setItem(STORAGE_KEYS.piperSpeaker, els.piperSpeaker.value || "");
  localStorage.setItem(STORAGE_KEYS.corsProxy, els.corsProxy.checked ? "1" : "0");
  persistCurrentTune();
}

function persistTextSoon() {
  clearTimeout(persistTextSoon._t);
  persistTextSoon._t = setTimeout(() => {
    localStorage.setItem(STORAGE_KEYS.text, els.text.value);
  }, 400);
}

/* ----------------------------- Piper voices ----------------------------- */

function onnxSizeBytes(voice) {
  if (!voice?.files) return 0;
  let n = 0;
  for (const [k, meta] of Object.entries(voice.files)) {
    if (String(k).endsWith(".onnx") && !String(k).endsWith(".onnx.json")) {
      n += meta?.size_bytes || 0;
    }
  }
  return n;
}

function formatMb(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? ` · ~${Math.round(mb)} MB` : ` · ~${mb.toFixed(1)} MB`;
}

function langSortKey(code) {
  const c = (code || "").toLowerCase();
  if (c === "en_us" || c.startsWith("en-us")) return "0-en_US";
  if (c === "en_gb" || c.startsWith("en-gb")) return "1-en_GB";
  if (c.startsWith("en")) return "2-en";
  return `3-${c}`;
}

function qualityRank(q) {
  const order = { high: 0, medium: 1, low: 2, x_low: 3 };
  return order[q] ?? 9;
}

function buildFallbackVoiceList() {
  const ids = Object.keys(piperPathMap());
  return ids.map((id) => {
    const parts = id.split("-");
    const lang = parts[0] || "unknown";
    const quality = parts[parts.length - 1] || "medium";
    const name = parts.slice(1, -1).join("-") || id;
    const [family, region] = lang.includes("_") ? lang.split("_") : [lang, ""];
    return {
      key: id,
      name,
      language: {
        code: lang,
        family: family || "und",
        region: region || "",
        name_english: family === "en" ? "English" : family.toUpperCase(),
        country_english: region || "",
      },
      quality,
      num_speakers: 1,
      speaker_id_map: {},
      files: {},
      aliases: [],
    };
  });
}

function populatePiperVoices(list) {
  state.piperVoiceList = list.slice();
  const preferred =
    localStorage.getItem(STORAGE_KEYS.piperVoice) ||
    (list.some((v) => v.key === DEFAULT_PIPER_VOICE)
      ? DEFAULT_PIPER_VOICE
      : list.some((v) => v.key === FALLBACK_PIPER_VOICE)
        ? FALLBACK_PIPER_VOICE
        : list[0]?.key);

  const byLang = new Map();
  for (const v of list) {
    const code = v.language?.code || v.key.split("-")[0] || "unknown";
    if (!byLang.has(code)) byLang.set(code, []);
    byLang.get(code).push(v);
  }

  const langs = [...byLang.keys()].sort(
    (a, b) => langSortKey(a).localeCompare(langSortKey(b)) || a.localeCompare(b)
  );

  const frag = document.createDocumentFragment();
  for (const code of langs) {
    const voices = byLang.get(code).sort((a, b) => {
      return (
        qualityRank(a.quality) - qualityRank(b.quality) ||
        String(a.name).localeCompare(String(b.name)) ||
        String(a.key).localeCompare(String(b.key))
      );
    });
    const sample = voices[0];
    const langName = sample?.language?.name_english || code;
    const country = sample?.language?.country_english || sample?.language?.region || "";
    const group = document.createElement("optgroup");
    group.label = country ? `${langName} (${country}) · ${code}` : `${langName} · ${code}`;
    for (const v of voices) {
      const opt = document.createElement("option");
      opt.value = v.key;
      const speakers =
        v.num_speakers > 1 ? ` · ${v.num_speakers} speakers` : "";
      opt.textContent = `${v.name} · ${v.quality}${speakers}${formatMb(onnxSizeBytes(v))}`;
      if (v.key === preferred) opt.selected = true;
      group.appendChild(opt);
    }
    frag.appendChild(group);
  }

  els.piperVoice.innerHTML = "";
  els.piperVoice.appendChild(frag);
  if (preferred) els.piperVoice.value = preferred;
  syncPiperSpeakerUI();
  applyTuneToSliders(getActiveTune());
}

function selectedPiperVoice() {
  return state.piperVoiceList.find((v) => v.key === els.piperVoice.value) || null;
}

function syncPiperSpeakerUI() {
  const voice = selectedPiperVoice();
  const map = voice?.speaker_id_map || {};
  const entries = Object.entries(map);
  const multi = (voice?.num_speakers || 0) > 1 && entries.length > 0;

  if (!multi) {
    els.piperSpeakerWrap.hidden = true;
    els.piperSpeaker.innerHTML = "";
    els.tuneScope.textContent = "per Piper voice";
    return;
  }

  els.piperSpeakerWrap.hidden = false;
  els.tuneScope.textContent = "per Piper voice · speaker";
  const preferred = localStorage.getItem(STORAGE_KEYS.piperSpeaker) || "";
  const frag = document.createDocumentFragment();

  const sorted = entries.sort((a, b) => {
    const na = formatSpeakerLabel(a[0]);
    const nb = formatSpeakerLabel(b[0]);
    return na.localeCompare(nb, undefined, { numeric: true });
  });

  for (const [key, id] of sorted) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.dataset.speakerId = String(id);
    opt.textContent = formatSpeakerLabel(key);
    if (key === preferred) opt.selected = true;
    frag.appendChild(opt);
  }
  els.piperSpeaker.innerHTML = "";
  els.piperSpeaker.appendChild(frag);
  if (preferred && [...els.piperSpeaker.options].some((o) => o.value === preferred)) {
    els.piperSpeaker.value = preferred;
  }
}

async function loadPiperVoiceCatalog() {
  try {
    setStatus("Loading Piper voice catalog…", "loading");
    const mod = await ensurePiper();
    const list = await mod.voices();
    if (!Array.isArray(list) || !list.length) throw new Error("Empty voice list");
    populatePiperVoices(list);
    setStatus(`Idle — ${list.length} Piper voices ready.`);
    return list.length;
  } catch (err) {
    console.warn("piper voices() failed, using PATH_MAP fallback", err);
    // Module may have loaded even if voices() failed
    try { await ensurePiper(); } catch (_) { /* keep going */ }
    const fallback = buildFallbackVoiceList();
    if (fallback.length) {
      populatePiperVoices(fallback);
      setStatus(
        `Idle — ${fallback.length} Piper voices (offline catalog). ${err?.message || ""}`.trim()
      );
      return fallback.length;
    }
    // Absolute failure: still leave a usable default option
    populatePiperVoices([
      {
        key: DEFAULT_PIPER_VOICE,
        name: "lessac",
        language: { code: "en_US", family: "en", region: "US", name_english: "English", country_english: "United States" },
        quality: "medium",
        num_speakers: 1,
        speaker_id_map: {},
        files: {},
        aliases: [],
      },
    ]);
    setStatus(`Piper failed to load: ${err?.message || err}. UI still works — try Browser engine or reload.`, "error");
    return 0;
  }
}

function piperProgressCallback(p) {
  if (!p) return;
  if (p.url === "tts://inference-progress") {
    const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
    showProgress(pct, `Synthesizing… ${p.loaded}/${p.total}`);
    setStatus(`Synthesizing chunk ${p.loaded}/${p.total}…`, "loading");
    return;
  }
  const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
  const name = (p.url || "").split("/").pop() || "model";
  showProgress(pct, `Downloading ${name}… ${pct}%`);
  setStatus(`Downloading Piper model… ${pct}%`, "loading");
  els.piperProgress.hidden = false;
  els.piperProgress.textContent = `Downloading ${name}… ${pct}%`;
}

async function ensurePiperVoiceDownloaded(voiceId) {
  els.piperProgress.hidden = false;
  els.loadPiper.disabled = true;
  state.piperLoading = true;
  try {
    showProgress(0, "Preparing Piper voice…");
    const mod = await ensurePiper();
    await mod.download(voiceId, piperProgressCallback);
    els.piperProgress.textContent = "Voice cached in this browser (OPFS).";
    hideProgress();
    setStatus("Piper voice ready", "idle");
  } catch (err) {
    els.piperProgress.textContent = `Download issue (will retry on Speak): ${err?.message || err}`;
    // predict() also downloads — don't hard-fail warm-up
  } finally {
    state.piperLoading = false;
    els.loadPiper.disabled = false;
  }
}

function stopPiperAudio() {
  if (state.audioEl) {
    try {
      state.audioEl.onended = null;
      state.audioEl.onerror = null;
      state.audioEl.pause();
      state.audioEl.removeAttribute("src");
      state.audioEl.load();
    } catch (_) { /* ignore */ }
    state.audioEl = null;
  }
  if (state.audioUrl) {
    try {
      URL.revokeObjectURL(state.audioUrl);
    } catch (_) { /* ignore */ }
    state.audioUrl = null;
  }
  try {
    state.audioSource?.stop();
  } catch (_) { /* ignore */ }
  state.audioSource = null;
}

function getAudioContext() {
  if (!state.audioCtx || state.audioCtx.state === "closed") {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
}

/**
 * Play a WAV/audio Blob. Uses HTMLAudioElement (iOS-friendly) when pitch≈1;
 * AudioBufferSourceNode when pitch must change independently.
 */
async function playPiperBlob(blob, { rate = 1, pitch = 1, volume = 1 } = {}) {
  stopPiperAudio();
  const pitchDelta = Math.abs(pitch - 1) > 0.01;

  if (!pitchDelta) {
    const url = URL.createObjectURL(blob);
    state.audioUrl = url;
    const audio = new Audio();
    audio.src = url;
    audio.playbackRate = rate;
    audio.preservesPitch = true;
    audio.volume = Math.max(0, Math.min(1, volume));
    state.audioEl = audio;
    state.speaking = true;
    state.paused = false;
    updateTransport();

    await new Promise((resolve, reject) => {
      audio.onended = () => {
        if (state.paused) return;
        if (state.audioEl === audio) {
          state.speaking = false;
          state.paused = false;
          updateTransport();
          setStatus("Idle");
          hideProgress();
        }
        resolve();
      };
      audio.onerror = () => reject(new Error("Audio playback failed"));
      const p = audio.play();
      if (p && typeof p.then === "function") p.catch(reject);
    });
    return;
  }

  // Pitch shift via AudioBufferSourceNode.detune (cents)
  const ctx = getAudioContext();
  if (ctx.state === "suspended") await ctx.resume();
  const buffer = await blob.arrayBuffer().then((ab) => ctx.decodeAudioData(ab.slice(0)));
  state.neural.buffer = buffer;
  state.neural.rate = rate;
  state.neural.offset = 0;
  state.neural.pitch = pitch;
  state.neural.volume = volume;
  startPitchedFromOffset(0);
}

function startPitchedFromOffset(offsetSec) {
  const ctx = getAudioContext();
  const buffer = state.neural.buffer;
  if (!buffer) return;
  try {
    state.audioSource?.stop();
  } catch (_) {}

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = state.neural.rate || 1;
  const pitch = state.neural.pitch || 1;
  source.detune.value = 1200 * Math.log2(Math.max(0.25, pitch));

  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, state.neural.volume ?? 1));
  source.connect(gain);
  gain.connect(ctx.destination);

  state.audioSource = source;
  state.neural.offset = offsetSec;
  state.neural.startedAt = ctx.currentTime;
  state.speaking = true;
  state.paused = false;
  updateTransport();

  source.onended = () => {
    if (state.paused) return;
    if (state.audioSource === source) {
      state.speaking = false;
      state.paused = false;
      state.audioSource = null;
      updateTransport();
      setStatus("Idle");
      hideProgress();
    }
  };
  source.start(0, offsetSec);
}

function pausePiper() {
  if (state.audioEl) {
    if (state.paused) {
      state.audioEl.playbackRate = Number(els.rate.value) || 1;
      state.audioEl.volume = Math.max(0, Math.min(1, Number(els.volume.value) || 1));
      state.audioEl.play().then(() => {
        state.paused = false;
        state.speaking = true;
        updateTransport();
        setStatus("Speaking (Piper)…", "speaking");
      }).catch((err) => setStatus(`Resume failed: ${err.message}`, "error"));
      return;
    }
    state.audioEl.pause();
    state.paused = true;
    state.speaking = false;
    updateTransport();
    setStatus("Paused", "idle");
    return;
  }

  // AudioContext path
  const ctx = getAudioContext();
  if (state.paused) {
    startPitchedFromOffset(state.neural.offset || 0);
    setStatus("Speaking (Piper)…", "speaking");
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

async function speakPiper(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    setStatus("Nothing to speak — paste some text first.", "error");
    return;
  }

  stopAll();
  const voiceId = els.piperVoice.value || DEFAULT_PIPER_VOICE;
  const voice = selectedPiperVoice();
  let speakerId = 0;
  let speakerKey = "";
  if (!els.piperSpeakerWrap.hidden && els.piperSpeaker.value) {
    speakerKey = els.piperSpeaker.value;
    const opt = els.piperSpeaker.selectedOptions[0];
    speakerId = Number(opt?.dataset?.speakerId ?? voice?.speaker_id_map?.[speakerKey] ?? 0);
  }
  const tune = getActiveTune();
  applyTuneToSliders(tune);

  state.speaking = true;
  state.paused = false;
  updateTransport();
  const who = speakerKey ? ` · ${formatSpeakerLabel(speakerKey)}` : "";
  setStatus(`Synthesizing with Piper (${voiceId}${who})…`, "loading");
  showProgress(5, "Starting Piper…");

  try {
    const mod = await ensurePiper();
    if (typeof mod.setActiveSpeakerId === "function") mod.setActiveSpeakerId(speakerId);
    const blob = await mod.predict(
      { text: trimmed, voiceId, speakerId },
      piperProgressCallback
    );
    if (!state.speaking && !state.paused) return; // stopped during synth
    setStatus(`Speaking (Piper · ${voiceId}${who})…`, "speaking");
    showProgress(100, "Playing…");
    await playPiperBlob(blob, tune);
  } catch (err) {
    state.speaking = false;
    state.paused = false;
    updateTransport();
    hideProgress();
    const msg = err?.message || String(err);
    setStatus(`Piper error: ${msg}`, "error");
    els.piperProgress.hidden = false;
    els.piperProgress.textContent = msg;
  }
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
    const en =
      voices.find((v) => /^en(-|_)/i.test(v.lang) && v.localService) ||
      voices.find((v) => /^en(-|_)/i.test(v.lang)) ||
      voices[0];
    els.voice.value = en.voiceURI;
  }
}

function selectedBrowserVoice() {
  return state.voices.find((v) => v.voiceURI === els.voice.value) || null;
}

function stopBrowserSpeech() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
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
  try {
    speechSynthesis.resume();
  } catch (_) { /* ignore */ }

  const u = new SpeechSynthesisUtterance(slice);
  const voice = selectedBrowserVoice();
  if (voice) u.voice = voice;
  u.rate = Number(els.rate.value) || 1;
  u.pitch = Number(els.pitch.value) || 1;
  u.volume = Number(els.volume.value) || 1;

  state.charIndex = fromIndex;
  state.resumeText = text;
  state.utterance = u;
  state.speaking = true;
  state.paused = false;
  updateTransport();
  setStatus(`Speaking (browser / system)${voice ? ` · ${voice.name}` : ""}…`, "speaking");

  u.onboundary = (ev) => {
    if (typeof ev.charIndex === "number") state.charIndex = fromIndex + ev.charIndex;
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
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      state.paused = false;
      state.speaking = true;
      updateTransport();
      setStatus("Speaking (browser / system)…", "speaking");
      return;
    }
    speakBrowser(state.resumeText || els.text.value, state.charIndex || 0);
    return;
  }
  if (typeof speechSynthesis.pause === "function") {
    speechSynthesis.pause();
    setTimeout(() => {
      if (speechSynthesis.speaking && !speechSynthesis.paused) speechSynthesis.cancel();
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
  if (state.kokoroLoading) throw new Error("Kokoro is already loading — please wait.");

  state.kokoroLoading = true;
  els.kokoroProgress.hidden = false;
  els.kokoroProgress.textContent = "Loading Kokoro model (first time ~50–100 MB)…";
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

    els.kokoroProgress.textContent = "Kokoro ready (cached by the browser).";
    setStatus("Kokoro ready", "idle");
    return state.kokoro;
  } catch (err) {
    state.kokoro = null;
    const msg = err?.message || String(err);
    els.kokoroProgress.textContent = `Failed to load Kokoro: ${msg}`;
    setStatus(`Kokoro load failed — try Piper or Browser. ${msg}`, "error");
    throw err;
  } finally {
    state.kokoroLoading = false;
    els.loadKokoro.disabled = false;
  }
}

function stopNeuralAudio() {
  try {
    state.audioSource?.stop();
  } catch (_) {}
  state.audioSource = null;
  state.neural.buffer = null;
  state.neural.offset = 0;
}

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
  state.neural.pitch = 1;
  state.neural.volume = Number(els.volume.value) || 1;
  state.neural.offset = 0;
  startPitchedFromOffset(0);
}

function pauseNeural() {
  const ctx = getAudioContext();
  if (state.paused) {
    startPitchedFromOffset(state.neural.offset || 0);
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
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    const arrays = [];
    let sampleRate = 24000;
    for (let i = 0; i < chunks.length; i++) {
      if (!state.speaking && !state.paused) return;
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
  if (!/^https?:/i.test(abs)) throw new Error("Only http(s) URLs are supported.");

  const attempts = [];
  if (els.corsProxy.checked) {
    for (const make of CORS_PROXIES) attempts.push({ label: "CORS proxy", url: make(abs) });
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
    : "Browser CORS blocked this site. Enable the third-party CORS proxy toggle, or paste the text.";
  throw new Error(`${hint} (${lastErr?.message || lastErr})`);
}

/* ----------------------------- Orchestration ----------------------------- */

function stopAll() {
  stopBrowserSpeech();
  stopPiperAudio();
  stopNeuralAudio();
  state.speaking = false;
  state.paused = false;
  state.resumeText = "";
  state.charIndex = 0;
  hideProgress();
  updateTransport();
}

function syncEngineUI() {
  const engine = els.engine.value;
  state.engine = engine;
  els.piperVoiceBlock.hidden = engine !== "piper";
  els.kokoroVoiceBlock.hidden = engine !== "kokoro";
  els.browserVoiceBlock.hidden = engine !== "browser";

  if (engine === "piper") {
    els.engineHint.textContent =
      "Piper downloads a free ONNX voice on first use (cached via OPFS), then runs on-device. 100+ MIT voices.";
    els.tuneScope.textContent = els.piperSpeakerWrap.hidden
      ? "per Piper voice"
      : "per Piper voice · speaker";
  } else if (engine === "kokoro") {
    els.engineHint.textContent =
      "Kokoro downloads a free ~82M ONNX model on first use, then runs offline in this browser.";
    els.tuneScope.textContent = "global (Kokoro)";
  } else {
    els.engineHint.textContent =
      "Uses your OS / browser speechSynthesis voices — often robotic. Prefer Piper for natural speech.";
    els.tuneScope.textContent = "global (browser)";
  }

  applyTuneToSliders(getActiveTune());
  savePrefs();
}

async function onSpeak() {
  const text = els.text.value;
  if (els.engine.value === "piper") await speakPiper(text);
  else if (els.engine.value === "kokoro") await speakKokoro(text);
  else speakBrowser(text, 0);
}

function onPause() {
  if (els.engine.value === "piper") pausePiper();
  else if (els.engine.value === "kokoro") pauseNeural();
  else pauseBrowser();
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

  const onTuneInput = () => {
    els.rateValue.textContent = `${Number(els.rate.value).toFixed(2)}×`;
    els.pitchValue.textContent = Number(els.pitch.value).toFixed(2);
    els.volumeValue.textContent = Number(els.volume.value).toFixed(2);
    persistCurrentTune();
  };
  els.rate.addEventListener("input", onTuneInput);
  els.pitch.addEventListener("input", onTuneInput);
  els.volume.addEventListener("input", onTuneInput);

  els.voice.addEventListener("change", savePrefs);
  els.kokoroVoice.addEventListener("change", savePrefs);
  els.piperVoice.addEventListener("change", () => {
    syncPiperSpeakerUI();
    applyTuneToSliders(getActiveTune());
    savePrefs();
  });
  els.piperSpeaker.addEventListener("change", () => {
    applyTuneToSliders(getActiveTune());
    savePrefs();
  });
  els.engine.addEventListener("change", syncEngineUI);
  els.corsProxy.addEventListener("change", savePrefs);

  els.loadPiper.addEventListener("click", () => {
    const id = els.piperVoice.value || DEFAULT_PIPER_VOICE;
    ensurePiperVoiceDownloaded(id);
  });
  els.loadKokoro.addEventListener("click", () => {
    ensureKokoro().catch(() => {});
  });

  const mq = window.matchMedia("(min-width: 900px)");

  function setSettingsOpen(open) {
    els.settingsPanel.classList.toggle("is-open", open);
    if (open) {
      els.settingsPanel.removeAttribute("hidden");
    } else if (!mq.matches) {
      els.settingsPanel.setAttribute("hidden", "");
    } else {
      // Desktop sidebar stays visible
      els.settingsPanel.removeAttribute("hidden");
      els.settingsPanel.classList.add("is-open");
      open = true;
    }
    els.settingsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  els.settingsBtn.addEventListener("click", () => {
    const currentlyOpen = els.settingsPanel.classList.contains("is-open") &&
      !els.settingsPanel.hasAttribute("hidden");
    // On desktop the panel is always shown; still allow toggling is-open for aria,
    // but keep it visible. On narrow viewports, truly collapse/expand.
    if (mq.matches) {
      setSettingsOpen(true);
      els.settingsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    const next = !currentlyOpen;
    setSettingsOpen(next);
    if (next) {
      els.settingsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  const syncSettingsVisibility = () => {
    if (mq.matches) {
      setSettingsOpen(true);
    } else if (!els.settingsPanel.classList.contains("is-open")) {
      els.settingsPanel.setAttribute("hidden", "");
      els.settingsBtn.setAttribute("aria-expanded", "false");
    }
  };
  mq.addEventListener?.("change", syncSettingsVisibility);
  syncSettingsVisibility();
}

async function init() {
  // Bind UI first so gear / Speak work even if Piper module fails to load.
  loadPrefs();
  populateKokoroVoices();
  populateBrowserVoices();
  // Placeholder option until Piper catalog loads
  populatePiperVoices([
    {
      key: DEFAULT_PIPER_VOICE,
      name: "lessac",
      language: { code: "en_US", family: "en", region: "US", name_english: "English", country_english: "United States" },
      quality: "medium",
      num_speakers: 1,
      speaker_id_map: {},
      files: {},
      aliases: [],
    },
  ]);
  syncEngineUI();
  bind();
  updateTransport();
  setStatus("Idle — loading Piper…");

  if ("speechSynthesis" in window) {
    speechSynthesis.addEventListener("voiceschanged", populateBrowserVoices);
    setTimeout(populateBrowserVoices, 250);
  }

  try {
    const count = await loadPiperVoiceCatalog();
    if (count > 0) {
      setStatus(`Idle — Piper neural ready (${count} voices). Paste text or load a URL.`);
    }
  } catch (err) {
    console.error(err);
    setStatus(`Piper unavailable: ${err?.message || err}. Try Browser engine or reload.`, "error");
  }
}

init();
