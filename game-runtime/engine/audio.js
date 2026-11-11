/**
 * audio.js — synthesized sound effects and a tiny procedural music loop (WebAudio, no files).
 *
 * Browsers only allow audio after a user gesture; the engine unlocks the audio
 * context automatically on the first click/tap/key press (e.g. the start
 * screen's Play button). Calls made before that are silently ignored, except
 * music.start(), which waits for the unlock. Press M to toggle mute.
 *
 * Built-in sounds: jump, coin, hit, explosion, shoot, powerup, click, lose, win, step.
 *
 * @example
 * import { sfx, music } from "./engine/index.js";
 * sfx.play("coin");
 * sfx.play("shoot", { volume: 0.5, pitch: 1.2 });
 * sfx.tone({ freq: 440, to: 880, duration: 0.2, type: "square" }); // custom blip
 * music.start({ style: "arp", tempo: 120 });   // or "drone"; music.stop()
 */

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuffer = null;
let muted = false;
let muteKeyInstalled = false;
const pendingUnlock = [];

function readStoredMute() {
  try {
    return localStorage.getItem("pf:muted") === "1";
  } catch {
    return false;
  }
}
muted = readStoredMute();

function ensureContext() {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.7;
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.25;
  sfxBus.connect(master);
  musicBus.connect(master);
  return ctx;
}

/** Create/resume the AudioContext. Call from a user gesture (done automatically on first input). */
export function unlockAudio() {
  const c = ensureContext();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  while (pendingUnlock.length) pendingUnlock.shift()();
}

/** True once audio can play. */
export const isAudioUnlocked = () => !!ctx && ctx.state === "running";

if (typeof window !== "undefined") {
  const onGesture = () => {
    unlockAudio();
    if (ctx && ctx.state !== "suspended") {
      for (const t of ["pointerdown", "keydown", "touchend"]) window.removeEventListener(t, onGesture, true);
    }
  };
  for (const t of ["pointerdown", "keydown", "touchend"]) window.addEventListener(t, onGesture, true);
}

function installMuteKey() {
  if (muteKeyInstalled || typeof window === "undefined") return;
  muteKeyInstalled = true;
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyM" && !e.repeat && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) setMuted(!muted);
  });
}

/** Mute or unmute everything (remembered across reloads). */
export function setMuted(value) {
  muted = !!value;
  try {
    localStorage.setItem("pf:muted", muted ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
  return muted;
}

export const isMuted = () => muted;

function ready() {
  installMuteKey();
  if (!ctx || ctx.state !== "running") return false;
  return true;
}

function noise() {
  if (noiseBuffer) return noiseBuffer;
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** Envelope-shaped oscillator. Times in seconds relative to now. */
function osc({ type = "square", freq = 440, to, start = 0, duration = 0.15, volume = 0.3, bus = sfxBus, attack = 0.005 }) {
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + duration);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + duration + 0.05);
}

function noiseBurst({ start = 0, duration = 0.3, volume = 0.4, filter = 2000, filterTo = 200, type = "lowpass" }) {
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noise();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(filter, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(filterTo, 20), t + duration);
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
  src.stop(t + duration + 0.05);
}

const SOUNDS = {
  jump: (v, p) => osc({ type: "square", freq: 280 * p, to: 620 * p, duration: 0.16, volume: 0.18 * v }),
  coin: (v, p) => {
    osc({ type: "square", freq: 988 * p, duration: 0.08, volume: 0.16 * v });
    osc({ type: "square", freq: 1319 * p, start: 0.07, duration: 0.22, volume: 0.16 * v });
  },
  hit: (v, p) => {
    noiseBurst({ duration: 0.12, volume: 0.35 * v, filter: 3000, filterTo: 400 });
    osc({ type: "sine", freq: 180 * p, to: 60, duration: 0.15, volume: 0.4 * v });
  },
  explosion: (v) => {
    noiseBurst({ duration: 0.8, volume: 0.6 * v, filter: 1800, filterTo: 60 });
    osc({ type: "sine", freq: 110, to: 30, duration: 0.6, volume: 0.5 * v });
  },
  shoot: (v, p) => osc({ type: "square", freq: 900 * p, to: 180 * p, duration: 0.12, volume: 0.14 * v }),
  powerup: (v, p) => [523, 659, 784, 1047].forEach((f, i) => osc({ type: "triangle", freq: f * p, start: i * 0.07, duration: 0.14, volume: 0.25 * v })),
  click: (v, p) => osc({ type: "sine", freq: 1200 * p, duration: 0.04, volume: 0.15 * v }),
  step: (v, p) => noiseBurst({ duration: 0.05, volume: 0.15 * v, filter: 900 * p, filterTo: 300 }),
  lose: (v, p) => [392, 330, 262, 196].forEach((f, i) => osc({ type: "triangle", freq: f * p, start: i * 0.16, duration: 0.3, volume: 0.25 * v })),
  win: (v, p) =>
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => osc({ type: "square", freq: f * p, start: i * 0.1, duration: i === 5 ? 0.45 : 0.12, volume: 0.13 * v })),
};

/** Sound effects. */
export const sfx = {
  /**
   * Play a built-in sound.
   * @param {"jump"|"coin"|"hit"|"explosion"|"shoot"|"powerup"|"click"|"lose"|"win"|"step"} name
   * @param {{volume?:number, pitch?:number}} [opts] pitch multiplies frequency (try 0.8..1.3 for variety)
   */
  play(name, { volume = 1, pitch = 1 } = {}) {
    if (!ready()) return;
    const fn = SOUNDS[name];
    if (fn) fn(volume, pitch);
  },
  /** Custom synthesized blip. type: "sine"|"square"|"sawtooth"|"triangle". */
  tone({ freq = 440, to, duration = 0.15, type = "square", volume = 0.2 } = {}) {
    if (!ready()) return;
    osc({ type, freq, to, duration, volume });
  },
  /** Register a custom sound: fn(audioContext, destinationNode, volume, pitch). */
  define(name, fn) {
    SOUNDS[name] = (v, p) => fn(ctx, sfxBus, v, p);
  },
  /** Effects volume 0..1. */
  setVolume(v) {
    ensureContext();
    if (sfxBus) sfxBus.gain.value = v;
  },
  mute: setMuted,
  toggleMute: () => setMuted(!muted),
  get muted() {
    return muted;
  },
};

// --- Music ---------------------------------------------------------------

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
let musicTimer = null;
let droneNodes = [];

/** Procedural background music. */
export const music = {
  playing: false,
  /**
   * Start looping music (waits for the audio unlock if needed).
   * @param {{style?:"arp"|"drone", tempo?:number, root?:number, volume?:number}} [opts] root = MIDI note (57 = A3)
   */
  start({ style = "arp", tempo = 110, root = 57, volume = 0.25 } = {}) {
    installMuteKey();
    music.stop();
    music.playing = true;
    const begin = () => {
      if (!music.playing || !ensureContext()) return;
      musicBus.gain.value = volume;
      if (style === "drone") startDrone(root);
      else startArp(tempo, root);
    };
    if (ctx && ctx.state === "running") begin();
    else pendingUnlock.push(begin);
  },
  stop() {
    music.playing = false;
    clearInterval(musicTimer);
    musicTimer = null;
    for (const n of droneNodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    droneNodes = [];
  },
  setVolume(v) {
    ensureContext();
    if (musicBus) musicBus.gain.value = v;
  },
};

function startArp(tempo, root) {
  // i - vi - IV - V progression, arpeggiated, with a soft bass note per bar
  const chords = [
    [0, 4, 7, 12],
    [-3, 0, 4, 9],
    [-7, -3, 0, 5],
    [-5, -1, 2, 7],
  ];
  const stepDur = 60 / tempo / 2; // eighth notes
  let step = 0;
  let next = ctx.currentTime + 0.1;
  const schedule = () => {
    if (!music.playing) return;
    while (next < ctx.currentTime + 0.2) {
      const bar = Math.floor(step / 8) % chords.length;
      const chord = chords[bar];
      const note = root + 12 + chord[[0, 1, 2, 3, 2, 1, 2, 3][step % 8]];
      const start = next - ctx.currentTime;
      osc({ type: "triangle", freq: midi(note), start, duration: stepDur * 0.9, volume: 0.22, bus: musicBus });
      if (step % 8 === 0) osc({ type: "sine", freq: midi(root - 12 + chord[0]), start, duration: stepDur * 7.5, volume: 0.35, bus: musicBus, attack: 0.05 });
      step++;
      next += stepDur;
    }
  };
  schedule();
  musicTimer = setInterval(schedule, 50);
}

function startDrone(root) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  filter.connect(musicBus);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  droneNodes.push(lfo);
  for (const [n, detune, type] of [[root - 12, -6, "sawtooth"], [root - 12, 7, "sawtooth"], [root - 5, 0, "triangle"], [root, 3, "sine"]]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = midi(n);
    o.detune.value = detune;
    g.gain.value = 0.12;
    o.connect(g).connect(filter);
    o.start();
    droneNodes.push(o);
  }
}
