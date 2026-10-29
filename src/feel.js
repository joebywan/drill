import { reducedMotion } from './cast/kit.js';

/**
 * Sound, haptics and motion. Each fails quietly: a lesson works silent, still and unbuzzed.
 */
const KEY = 'drill.sound';
export const soundOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setSound = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* lasts the visit */ } };

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

const BUZZ = { right: 12, wrong: [20, 60, 20], done: [15, 50, 15, 50, 30], inhale: 8, exhale: [6, 80, 6] };
export const buzz = (name) => { try { navigator.vibrate?.(BUZZ[name]); } catch { /* no haptics */ } };

/** `el.animate`, skipped under reduced motion. */
export const move = (el, frames, opts) => (el && !reducedMotion() ? el.animate(frames, opts) : null);
