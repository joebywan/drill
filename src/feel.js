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
  right: [[660, 0, 0.12], [880, 0.09, 0.2]],
  run: [[660, 0, 0.1], [880, 0.08, 0.1], [1175, 0.16, 0.25]],
  wrong: [[330, 0, 0.16, 'triangle'], [262, 0.12, 0.24, 'triangle']],
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

const BUZZ = { right: 12, wrong: [20, 60, 20], done: [15, 50, 15, 50, 30], inhale: 8, exhale: [6, 80, 6] };
export const buzz = (name) => { try { navigator.vibrate?.(BUZZ[name]); } catch { /* no haptics */ } };

/** `el.animate`, skipped under reduced motion. */
export const move = (el, frames, opts) => (el && !reducedMotion() ? el.animate(frames, opts) : null);
