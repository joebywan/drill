// Renders the garden's sounds to assets/sounds/*.wav: `node tools/sounds.js`. Every sound is made
// here from scratch (plucked strings, bells, chirps, a buzz, a touch of room), so the files are ours
// to ship and the script is their source. Change a recipe, run it, listen, commit the wavs.
import { writeFileSync, mkdirSync } from 'node:fs';

const RATE = 24000;
const TAU = Math.PI * 2;
// A small seeded random, so the files come out byte-for-byte the same every run.
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const track = (secs) => new Float32Array(Math.ceil(secs * RATE));
const hz = (note) => 440 * 2 ** ((note - 69) / 12); // MIDI note number to frequency

/** A plucked string (Karplus-Strong): a burst of noise through a damped delay line. */
function pluck(out, at, freq, { gain = 0.5, decay = 0.996, bright = 0.5 } = {}) {
  const n = Math.round(RATE / freq);
  const line = Float32Array.from({ length: n }, () => rand() * 2 - 1);
  const start = Math.round(at * RATE);
  for (let i = 0; start + i < out.length; i++) {
    const j = i % n;
    const next = line[(j + 1) % n];
    const v = line[j];
    line[j] = decay * (bright * v + (1 - bright) * next);
    out[start + i] += gain * v;
  }
}

/** A struck tone: partials [ratio, level, decay s] over a fast attack, like a bell or a marimba bar. */
function strike(out, at, freq, partials, gain = 0.4) {
  const start = Math.round(at * RATE);
  for (let i = 0; start + i < out.length; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.003);
    let v = 0;
    for (const [ratio, level, decay] of partials) v += level * Math.sin(TAU * freq * ratio * t) * Math.exp(-t / decay);
    out[start + i] += gain * attack * v;
  }
}

/** A chirp: a sine whose pitch follows `f(p)` and whose loudness follows a bump, p from 0 to 1. */
function chirp(out, at, len, f, gain = 0.3) {
  const start = Math.round(at * RATE);
  const n = Math.round(len * RATE);
  let phase = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const p = i / n;
    phase += TAU * f(p) / RATE;
    out[start + i] += gain * Math.sin(Math.PI * p) ** 2 * Math.sin(phase);
  }
}

/** A bee: a soft sawtooth hum with a wavering pitch, low-passed, swelling in and fading away. */
function buzz(out, at, len, base, gain = 0.2) {
  const start = Math.round(at * RATE);
  const n = Math.round(len * RATE);
  let phase = 0, lp = 0, lp2 = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE, p = i / n;
    phase = (phase + (base * (1 + 0.03 * Math.sin(TAU * 5.5 * t) + 0.08 * Math.sin(TAU * 0.9 * t))) / RATE) % 1;
    const saw = 2 * phase - 1;
    lp += 0.12 * (saw - lp);
    lp2 += 0.12 * (lp - lp2);
    const env = Math.sin(Math.PI * p) ** 1.5 * (0.75 + 0.25 * Math.sin(TAU * 3 * t));
    out[start + i] += gain * env * lp2;
  }
}

/** A little room: a Schroeder reverb (four combs, two all-passes), mixed under the dry sound. */
function room(dry, wet = 0.25, size = 1) {
  const comb = (x, ms, fb) => {
    const d = Math.round((ms * size * RATE) / 1000), y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) y[i] = x[i] + (i >= d ? fb * y[i - d] : 0);
    return y;
  };
  const allpass = (x, ms, g) => {
    const d = Math.round((ms * RATE) / 1000), y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) y[i] = -g * x[i] + (i >= d ? x[i - d] + g * y[i - d] : 0);
    return y;
  };
  const combs = [[29.7, 0.8], [37.1, 0.78], [41.1, 0.76], [43.7, 0.74]].map(([ms, fb]) => comb(dry, ms, fb));
  let tail = dry.map((_, i) => combs.reduce((s, c) => s + c[i], 0) / 4);
  tail = allpass(allpass(tail, 5, 0.7), 1.7, 0.7);
  return dry.map((v, i) => v + wet * tail[i]);
}

/** Fades the last `secs` to silence, scales the peak to -3 dB and writes a 16-bit mono wav. */
function save(name, x, fade = 0.3) {
  const f = Math.round(fade * RATE);
  for (let i = 0; i < f; i++) x[x.length - 1 - i] *= i / f;
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const pcm = Int16Array.from(x, (v) => Math.round((v / peak) * 0.707 * 32767));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.byteLength, 4); head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(pcm.byteLength, 40);
  mkdirSync('assets/sounds', { recursive: true });
  writeFileSync(`assets/sounds/${name}.wav`, Buffer.concat([head, Buffer.from(pcm.buffer)]));
}

const MARIMBA = [[1, 1, 0.35], [3.93, 0.25, 0.06], [9.2, 0.06, 0.02]];
const GLASS = [[1, 1, 0.9], [2.76, 0.35, 0.4], [5.4, 0.15, 0.2]];

const SOUNDS = {
  // A habit added, a new plant on its way: two warm wooden notes, rising.
  plant() {
    const x = track(1.3);
    strike(x, 0, hz(67), MARIMBA);
    strike(x, 0.13, hz(74), MARIMBA);
    strike(x, 0.13, hz(79), MARIMBA, 0.15);
    return room(x, 0.2);
  },
  // A flower opened: a harp running up a pentatonic scale, ringing on.
  flower() {
    const x = track(2.4);
    [72, 74, 76, 79, 81, 84].forEach((n, i) => pluck(x, i * 0.075, hz(n), { gain: 0.45 - i * 0.03, decay: 0.997 }));
    pluck(x, 0.5, hz(88), { gain: 0.2, decay: 0.998 });
    return room(x, 0.3, 1.2);
  },
  // A butterfly: a quick, light shimmer of glass bells, up and back down, like wingbeats.
  butterfly() {
    const x = track(2);
    [84, 88, 91, 96, 91, 93].forEach((n, i) => strike(x, i * 0.09 + (i % 2) * 0.015, hz(n), GLASS, 0.22));
    return room(x, 0.35, 1.3);
  },
  // A bee: a soft hum drifting past, then one round note where it lands.
  bee() {
    const x = track(1.8);
    buzz(x, 0, 1.1, 196);
    buzz(x, 0.05, 1.0, 293, 0.06);
    strike(x, 0.95, hz(76), MARIMBA, 0.5);
    strike(x, 0.95, hz(83), GLASS, 0.12);
    return room(x, 0.2);
  },
  // Birds: a robin's little phrase and a blue tit's answer, quick up-sweeps and a trill.
  birds() {
    const x = track(1.8);
    chirp(x, 0, 0.09, (p) => 2600 + 1400 * p);
    chirp(x, 0.12, 0.07, (p) => 3400 - 600 * p);
    for (let i = 0; i < 5; i++) chirp(x, 0.26 + i * 0.045, 0.04, (p) => 3800 + 500 * Math.sin(Math.PI * p), 0.22);
    chirp(x, 0.7, 0.16, (p) => 4200 - 1800 * p, 0.25);
    chirp(x, 0.92, 0.08, (p) => 3000 + 1600 * p, 0.25);
    chirp(x, 1.02, 0.08, (p) => 3000 + 1600 * p, 0.25);
    return room(x, 0.25, 1.4);
  },
};

for (const [name, make] of Object.entries(SOUNDS)) save(name, make());
console.log(`wrote ${Object.keys(SOUNDS).map((n) => `assets/sounds/${n}.wav`).join(', ')}`);
