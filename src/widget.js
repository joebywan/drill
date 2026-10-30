import { currentStreak, light } from './progress.js';
import { WIDGET_LINES } from './cast/lines.js';
import { lumi } from './cast/lumi.js';

/**
 * The Android wrapper's side of Drill, pure apart from the bridge glue at the end. The home-screen
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
/** The streak flame, tinted by today's light: lit, warm, or a low glow. */
const FLAME = { bright: '#F0772A', soft: '#E3A857', ember: '#9C6B4E' };

/** (light, hour) → what the widget shows. `lines` is a pool; Kotlin picks one per look. */
export function look(lit, hour) {
  const b = band(hour);
  const [bg, ink] = SKY[b];
  const pose = lit === 'bright' ? 'complete' : b === 'night' ? 'sleepy' : 'teach';
  return { bg, ink, flame: FLAME[lit], pose, lines: WIDGET_LINES[lit === 'bright' ? 'done' : b] };
}

const LIGHTS = ['ember', 'soft', 'bright'];

/** The widget's flame follows the learner's best habit: the brightest light, then the longest streak. */
function best(progress, at) {
  const ids = Object.keys(progress.habits);
  return ids.map((id) => ({ light: light(progress, at, id), streak: currentStreak(progress, at, id) }))
    .sort((a, b) => LIGHTS.indexOf(b.light) - LIGHTS.indexOf(a.light) || b.streak - a.streak)[0]
    ?? { light: 'ember', streak: 0 };
}

/**
 * What the app passes over the bridge after every save: the latest day anything was done (the
 * reminder stays quiet when it is today), the reminder's line pool, and the widget's looks from
 * now through the next `days` days' boundaries, each with the time it starts.
 */
export function summary(progress, now = new Date(), days = 3) {
  const times = [now];
  for (let d = 0; d <= days; d++)
    for (const [h] of BANDS) {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h);
      if (t > now && +t !== +times.at(-1)) times.push(t);
    }
  const last = Object.values(progress.habits).map((s) => s.last).filter(Boolean).sort().at(-1) ?? null;
  return {
    doneOn: last,
    remindAt: REMIND_AT,
    remind: WIDGET_LINES.remind,
    looks: times.map((t) => {
      const b = best(progress, t);
      return { at: +t, ...b, ...look(b.light, t.getHours()) };
    }),
  };
}

// ponytail: a fixed hour; learning the learner's own hour is TODO.md's "Fitting the person".
export const REMIND_AT = 18;

/** The bridge the Android wrapper adds to the page. In a browser it is absent and nothing here runs. */
export const bridge = () => globalThis.DrillBridge;

export const tellAndroid = (progress) => bridge()?.summary(JSON.stringify(summary(progress)));

/** Lumi's widget poses, drawn from the same SVG as in the app and handed over as PNGs. */
export async function sendArt() {
  const b = bridge();
  if (!b) return;
  for (const pose of ['teach', 'sleepy', 'complete']) {
    const img = new Image();
    img.src = `data:image/svg+xml,${encodeURIComponent(lumi(pose).replace('<svg ', '<svg width="200" height="240" '))}`;
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: 200, height: 240 });
    canvas.getContext('2d').drawImage(img, 0, 0);
    b.art(pose, canvas.toDataURL('image/png').split(',')[1]);
  }
}
