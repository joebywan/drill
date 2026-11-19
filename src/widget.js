import { LEARN, currentStreak, light } from './progress.js';
import { WIDGET_LINES } from './cast/lines.js';
import { lumi } from './cast/lumi.js';
import { BOX, butterflyToday, habitColour } from './cast/butterfly.js';
import { INK } from './cast/kit.js';

/**
 * The Android wrapper's side of Wingbeat, pure apart from the bridge glue at the end. The home-screen
 * widget and the daily note are drawn by Kotlin, but every choice is made here: `look()` picks the widget's look, and
 * `summary()` hands over a schedule of looks for the next few days, so the widget can change at
 * midnight (when `light()` turns soft or ember) without the app running. Kotlin only renders.
 */

/** The hours where the widget's look can change, and the band each one opens. */
export const BANDS = [[0, 'night'], [5, 'morning'], [12, 'day'], [18, 'evening'], [22, 'night']];
const band = (hour) => BANDS.filter(([h]) => h <= hour).at(-1)[1];

/** Background and text by time of day: a pale sky by day, a deep one at night. */
const SKY = {
  morning: ['#FFF3DF', '#3A2A12'],
  day: ['#FFFFFF', '#1F2631'],
  evening: ['#FCE3D2', '#3A2016'],
  night: ['#1F2631', '#E8ECF2'],
};
/** Your butterfly by today's light: flying once today is done, basking until then, resting after a missed day. Never sad. */
export const STATES = { bright: 'flying', soft: 'basking', ember: 'resting' };

/**
 * (light, hour, whose words) → what the widget shows: `butterfly` is its state and `art` the drawing
 * Kotlin shows (sendArt; at night with a pale body). `lines` is a pool; Kotlin picks one per look.
 */
export function look(lit, hour, words = 'learn') {
  const b = band(hour);
  const [bg, ink] = SKY[b];
  const pose = lit === 'bright' ? 'complete' : b === 'night' ? 'sleepy' : 'teach';
  const butterfly = STATES[lit];
  return { bg, ink, butterfly, art: `butterfly-${butterfly}${b === 'night' ? '-night' : ''}`, pose, lines: WIDGET_LINES[words][lit === 'bright' ? 'done' : b] };
}

/**
 * Whose words the widget and the note speak: 'learn' for someone whose sessions are mostly lessons,
 * 'habits' for someone who mostly keeps habits. Before any session, what the intro picked first.
 */
export function leaning(progress) {
  const log = progress.log || [];
  if (!log.length) return (progress.picked?.[0] ?? LEARN) === LEARN ? 'learn' : 'habits';
  return 2 * log.filter((e) => e.habit === LEARN).length >= log.length ? 'learn' : 'habits';
}

const LIGHTS = ['ember', 'soft', 'bright'];

/** The widget and your butterfly follow the learner's best habit: the brightest light, then the longest streak. */
function best(progress, at) {
  const ids = Object.keys(progress.habits);
  return ids.map((id) => ({ light: light(progress, at, id), streak: currentStreak(progress, at, id) }))
    .sort((a, b) => LIGHTS.indexOf(b.light) - LIGHTS.indexOf(a.light) || b.streak - a.streak)[0]
    ?? { light: 'ember', streak: 0 };
}

/** Your butterfly today (src/cast/butterfly.js butterflyToday), from the best habit's light. Before any session, basking. */
export const wingState = (progress, at = new Date()) => STATES[best(progress, at).light];

/** The colours on your butterfly's wings, panel by panel; a habit of the learner's own by its place among them. */
export function wingColours(progress) {
  const own = (progress.tracked || []).map((t) => t.id).filter((id) => id.startsWith('own-'));
  return (progress.wings || []).map((id) => habitColour(id, Math.max(0, own.indexOf(id))));
}

/**
 * What the app passes over the bridge after every save: the latest day anything was done (the
 * reminder stays quiet when it is today), the reminder's line pool, and the widget's looks from
 * now through the next `days` days' boundaries, each with the time it starts.
 */
export function summary(progress, now = new Date(), days = 3, brain = globalThis.wingbeat) {
  const times = [now];
  for (let d = 0; d <= days; d++)
    for (const [h] of BANDS) {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h);
      if (t > now && +t !== +times.at(-1)) times.push(t);
    }
  const words = leaning(progress);
  const last = Object.values(progress.habits).map((s) => s.last).filter(Boolean).sort().at(-1) ?? null;
  return {
    doneOn: last,
    // The reminder brain (window.wingbeat, when it is there) picks the hour and whether to speak at
    // all; without it, a fixed hour and yes. A snapshot: it is re-read on every save and app open.
    remindAt: brain?.reminderHour?.() ?? REMIND_AT,
    wanted: brain?.shouldRemind?.() ?? true,
    remind: WIDGET_LINES[words].remind,
    looks: times.map((t) => {
      const b = best(progress, t);
      return { at: +t, ...b, ...look(b.light, t.getHours(), words) };
    }),
  };
}

/** The note's hour when the reminder brain has no hour of its own (or isn't there). */
export const REMIND_AT = 18;

/** The bridge the Android wrapper adds to the page. In a browser it is absent and nothing here runs. */
export const bridge = () => globalThis.WingbeatBridge;

/**
 * The bars follow the page: `rgb` is the body's background ('rgb(24, 20, 15)'), so Wind down's night
 * palette or the phone's dark mode reach `<meta name="theme-color">` (Chrome) and the wrapper's
 * system bars, with dark icons on a light page.
 */
export function tellBars(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) document.head.append(meta = Object.assign(document.createElement('meta'), { name: 'theme-color' }));
  meta.content = hex;
  bridge()?.bars?.(hex, 0.299 * r + 0.587 * g + 0.114 * b > 140);
}

export const tellAndroid = (progress) => bridge()?.summary(JSON.stringify(summary(progress)));

/**
 * What became of each note ('opened' or 'cleared'), queued by the wrapper and handed to the
 * reminder brain. Left in the queue while there is no brain to hear it.
 */
export function passNotes() {
  const hear = globalThis.wingbeat?.noteReminder;
  if (!hear || !bridge()?.notes) return;
  for (const note of JSON.parse(bridge().notes())) hear(note);
}

/** An SVG as base64 PNG, `width` x `height`. */
async function png(svg, width, height) {
  const img = new Image();
  img.src = `data:image/svg+xml,${encodeURIComponent(svg.replace('<svg ', `<svg width="${width}" height="${height}" `))}`;
  await img.decode();
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/png').split(',')[1];
}

/** The pale body and antennae your butterfly has on the widget's night sky. */
const NIGHT_BODY = '#E6DFD2';
let sent = null; // the wings last drawn for the widget: they change at most once a day

/**
 * The widget's art, drawn from the same SVG as in the app and handed over as PNGs: Lumi's poses once,
 * and your butterfly's three states (`look().art`) in your own wing colours, again whenever they change.
 */
export async function sendArt(progress) {
  const b = bridge();
  if (!b) return;
  const wings = JSON.stringify(progress.wings || []);
  if (wings === sent) return;
  const first = sent === null;
  sent = wings;
  if (first) for (const pose of ['teach', 'sleepy', 'complete']) b.art(pose, await png(lumi(pose), 200, 240));
  for (const state of Object.values(STATES))
    for (const night of [false, true])
      b.art(`butterfly-${state}${night ? '-night' : ''}`, await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BOX}">${butterflyToday(state, wingColours(progress), night ? NIGHT_BODY : INK)}</svg>`, 240, 200));
}
