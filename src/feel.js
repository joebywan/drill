import { reducedMotion } from './cast/kit.js';

/**
 * Sound, haptics and motion. Each fails quietly: a lesson works silent, still and unbuzzed.
 */
// On/off preferences kept per device: 'sound' (the home bar's mute), Calm's 'bell' and 'rain'.
export const pref = (name, dflt) => { try { const v = localStorage.getItem(`drill.${name}`); return v ? v === 'on' : dflt; } catch { return dflt; } };
export const setPref = (name, on) => { try { localStorage.setItem(`drill.${name}`, on ? 'on' : 'off'); } catch { /* lasts the visit */ } };
export const soundOn = () => pref('sound', true);
export const setSound = (on) => setPref('sound', on);
/** Calm's bell and rain, each off until turned on, and never when muted or under reduced motion. */
export const calmPref = (name) => pref(name, false);
export const calmSound = (name) => soundOn() && !reducedMotion() && calmPref(name);

// Synthesised, so there are no audio files: [frequency Hz, start s, length s, wave].
const SOUNDS = {
  right: [[660, 0, 0.08], [990, 0.06, 0.16]], // a bright two-note pop
  run: [[660, 0, 0.1], [880, 0.08, 0.1], [1175, 0.16, 0.25]],
  wrong: [[330, 0, 0.14, 'triangle', 0.1], [277, 0.1, 0.2, 'triangle', 0.1]], // soft and low, never a buzzer
  unlock: [[784, 0, 0.1, 'triangle', 0.12], [1175, 0.07, 0.25, 'sine', 0.1]], // a path node opening up
  tap: [[1400, 0, 0.04, 'triangle']],
  done: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.4]],
  // Calm's breath cues: low, long and quiet (the fifth value is the peak volume).
  inhale: [[392, 0, 1.2, 'sine', 0.04]],
  exhale: [[294, 0, 1.6, 'sine', 0.04]],
  // A soft bell to open and close a Calm practice: a low tone and a faint overtone, ringing out.
  bell: [[528, 0, 4, 'sine', 0.05], [1330, 0, 2.5, 'sine', 0.012]],
};
let audio;

export function play(name) {
  if (!soundOn()) return;
  try {
    audio ??= new AudioContext();
    const t0 = audio.currentTime;
    for (const [freq, start, len, type = 'sine', peak = 0.15] of SOUNDS[name]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + start + (peak < 0.1 ? 0.3 : 0.01));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len);
      osc.connect(gain).connect(audio.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + len + 0.02);
    }
  } catch { /* no audio */ }
}

// The garden's sounds are files in assets/sounds, rendered by tools/sounds.js, loaded on first use.
// ponytail: wav, about 90 KB each; encode to opus/mp3 if the set grows past a handful.
export const CHIMES = ['plant', 'flower', 'butterfly', 'bee', 'birds'];
const chimes = {};

/** Plays a garden sound, if sound is on. Quietly nothing when it can't. */
export function chime(name) {
  if (!soundOn() || !CHIMES.includes(name)) return;
  try {
    const a = (chimes[name] ??= Object.assign(new Audio(new URL(`../assets/sounds/${name}.wav`, import.meta.url)), { volume: 0.5 }));
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch { /* no audio */ }
}

/**
 * Soft rain under a Calm practice, if turned on: looped brown noise, low-passed and quiet. It
 * holds while the page is hidden. Returns the function that fades it out.
 */
export function rain() {
  if (!calmSound('rain')) return () => {};
  try {
    audio ??= new AudioContext();
    const buf = audio.createBuffer(1, audio.sampleRate * 4, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0, last = 0; i < d.length; i++) d[i] = last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    const src = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    Object.assign(src, { buffer: buf, loop: true });
    filter.frequency.value = 1000;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, audio.currentTime + 2);
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start();
    const hidden = () => (document.hidden ? audio.suspend() : audio.resume());
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      gain.gain.setTargetAtTime(0.0001, audio.currentTime, 0.3);
      src.stop(audio.currentTime + 1.5);
    };
  } catch { return () => {}; }
}

const BUZZ = { unlock: 8, right: 12, run: 12, wrong: [20, 60, 20], done: [15, 50, 15, 50, 30], inhale: 8, exhale: [6, 80, 6] };
export const buzz = (name) => { try { navigator.vibrate?.(BUZZ[name]); } catch { /* no haptics */ } };

/** `el.animate`, skipped under reduced motion. */
export const move = (el, frames, opts) => (el && !reducedMotion() ? el.animate(frames, opts) : null);

/**
 * A lesson moment: its sound and buzz. The sound follows the Sound toggle only (`play`): reduced
 * motion is about motion, so it skips the animations, never the cues.
 */
export function cue(name) {
  play(name);
  buzz(name);
}

// Short feedback motions, all under 400 ms and never blocking input: an animation is decoration.
const MOTIONS = {
  pop: [[{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' }],
  shake: [[0, -6, 5, -3, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 320, easing: 'ease-in-out' }],
};
/** Plays one of MOTIONS on `el`, skipped under reduced motion. */
export const flourish = (el, name) => move(el, ...MOTIONS[name]);

/**
 * Petals and leaves drifting down over a finished lesson: the garden's confetti. About 2.6 s,
 * stopped early by the returned function, skipped under reduced motion. Never takes a tap.
 */
export function petals() {
  if (reducedMotion()) return () => {};
  const layer = document.createElement('div');
  layer.className = 'petals';
  layer.setAttribute('aria-hidden', 'true');
  const colours = ['#F7A8C4', '#FBD3E0', '#F28C8C', '#7BC47F', '#4caf73', '#FFD978'];
  for (let i = 0; i < 36; i++) {
    const bit = document.createElement('i');
    bit.className = i % 3 === 2 ? 'leaf' : 'petal';
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colours[i % colours.length];
    layer.append(bit);
    const drift = (Math.random() - 0.5) * 120;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 260);
    bit.animate([
      { transform: 'translate(0, 0) rotate(0)' },
      { transform: `translate(${drift / 2 + 20}px, ${innerHeight * 0.5}px) rotate(${spin / 2}deg)`, offset: 0.5 },
      { transform: `translate(${drift}px, ${innerHeight + 40}px) rotate(${spin}deg)` },
    ], { duration: 2000 + Math.random() * 600, delay: Math.random() * 400, easing: 'ease-in', fill: 'forwards' });
  }
  document.body.append(layer);
  const timer = setTimeout(() => layer.remove(), 3000);
  return () => { clearTimeout(timer); layer.remove(); };
}

/**
 * Speech, for a course in another language: the browser's own voice for `lang` ('ja-JP'), if it
 * has one. `voice(lang)` is null without one, or with Sound muted: then the screen shows the
 * written reading instead, and nothing waits on speech. Voices load late in Chrome, so asking
 * once here warms the list before the first lesson needs it.
 */
const synth = () => (typeof speechSynthesis === 'undefined' ? null : speechSynthesis);
try { synth()?.getVoices(); } catch { /* no speech */ }
export const voice = (lang) => {
  if (!soundOn()) return null;
  try {
    const voices = synth()?.getVoices() || [];
    const norm = (l) => l.replace('_', '-').toLowerCase();
    return voices.find((v) => norm(v.lang) === lang.toLowerCase()) || voices.find((v) => norm(v.lang).startsWith(lang.slice(0, 2).toLowerCase())) || null;
  } catch { return null; }
};
/** Says `text` in `lang`, slowly. False when there is no voice for it: show the reading instead. */
export function speak(text, lang) {
  const v = voice(lang);
  if (!v) return false;
  try {
    synth().cancel();
    synth().speak(Object.assign(new SpeechSynthesisUtterance(text), { voice: v, lang: v.lang, rate: 0.8 }));
    return true;
  } catch { return false; }
}
