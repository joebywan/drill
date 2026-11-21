// Coding's drawing and variable lessons seen moving: while Fennel runs a program, a burst of real screenshots (as fast as
// the emulator takes them) and, beside it, a trace of the page on every real frame (where Fennel is, how many squares are
// drawn, what the values read). Normal motion, no page.clock jumps during a run. For draw-0, draw-3, var-0 and var-3.
//   MOVING_LESSONS=draw-0,var-3 npm run phone -- moving       (default: all four)
// Pictures and the traces go to MOVING_NOTES (default test-results/phone/moving/). Checks: Fennel never jumps more than a
// square between frames, a value changes only while he stands on a square (not between them), the drawing only grows,
// and the step cue is heard (the audio stream started) while a program runs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { playCourse } from '../../tools/play.js';
import { answerCoding, course } from './coding-all.js';
import { sleep } from './lib/device.js';

const LESSONS = (process.env.MOVING_LESSONS ?? 'draw-0,draw-3,var-0,var-3').split(',');

/** Starts a per-frame trace of the grid in the page. */
const trace = (page) => page.evaluate(() => {
  window.__tr = []; window.__trStop = false;
  const world = document.querySelector('.grid-world');
  const walker = world?.querySelector('.walker');
  if (!walker) return;
  const frame = window.__frame ?? requestAnimationFrame;
  const first = world.querySelector('.cell')?.getBoundingClientRect().width || 1;
  let last = '';
  (function loop() {
    const w = walker.getBoundingClientRect(), g = world.getBoundingClientRect();
    const s = {
      t: Math.round(performance.now()), x: +((w.x - g.x) / first).toFixed(2), y: +((w.y - g.y) / first).toFixed(2),
      trail: world.querySelectorAll('.trail').length, picked: world.querySelectorAll('.picked').length,
      vars: [...document.querySelectorAll('.vars .var')].map((v) => v.textContent.trim().replace(/\s+/g, '=')).join(' '),
      face: walker.firstElementChild?.getAttribute('class') ?? '',
    };
    const k = JSON.stringify([s.x, s.y, s.trail, s.picked, s.vars, s.face]);
    if (k !== last) { window.__tr.push(s); last = k; }
    if (!window.__trStop) frame(loop);
  })();
});

/** Reads a trace: what moved, what was drawn, and what the values did, against where Fennel stood. */
function analyse(tr) {
  const out = { samples: tr.length, jumps: [], offSquare: [], shrank: 0, flashes: [], visits: [], valueLog: [] };
  const atRest = (s) => Math.abs(s.x - Math.round(s.x)) < 0.08 && Math.abs(s.y - Math.round(s.y)) < 0.08;
  let run0 = null;
  tr.forEach((s, i) => {
    const p = tr[i - 1];
    if (!p) return;
    if (run0 === null && (s.x !== p.x || s.y !== p.y)) run0 = s.t;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d > 1.15) out.jumps.push(`${d.toFixed(2)} squares at +${s.t - (run0 ?? s.t)} ms`);
    if (s.vars !== p.vars && run0 !== null) {
      out.valueLog.push(`+${s.t - run0} ms at (${s.x},${s.y}) ${atRest(s) ? 'on a square' : 'BETWEEN squares'}: ${p.vars || '-'} -> ${s.vars}`);
      if (!atRest(s)) out.offSquare.push(`${p.vars} -> ${s.vars} at (${s.x},${s.y})`);
      if (/\?/.test(s.vars) && !/\?/.test(p.vars)) out.flashes.push(`values went to ? at +${s.t - run0} ms`);
    }
    if (s.trail < p.trail || s.picked < p.picked) out.shrank++;
    if (atRest(s) && s.vars === p.vars && (s.x !== p.x || s.y !== p.y)) out.visits.push(`(${s.x},${s.y})@+${s.t - (run0 ?? s.t)}`);
  });
  out.run = run0;
  out.endTrail = tr.at(-1)?.trail;
  return out;
}

export default async (h) => {
  const { page, device, check, playing } = h;
  const notes = process.env.MOVING_NOTES ?? new URL('../../test-results/phone/moving/', import.meta.url).pathname;
  mkdirSync(notes, { recursive: true });
  const report = {};
  let heard = 0, sampled = 0;

  // Each item that runs a program is watched from the first tap to the verdict.
  const watched = async (item, doIt) => {
    await trace(page);
    const shots = [], t0 = Date.now();
    let stop = false, started = null;
    const burst = (async () => {
      while (!stop && shots.length < 40) {
        const moving = await page.evaluate(() => { const t = window.__tr; return t.length > 1 && t.some((s) => s.x !== t[0].x || s.y !== t[0].y); }).catch(() => false);
        if (!moving) { await sleep(40); continue; }
        started ??= Date.now();
        const at = Date.now() - started;
        const buf = await device.screenshot();
        const now = await page.evaluate(() => window.__tr.at(-1)).catch(() => null);
        writeFileSync(`${notes}/${item.id}-${String(shots.length).padStart(2, '0')}.png`, buf);
        shots.push({ at, now });
        if (shots.length % 4 === 1) { sampled++; if (playing().started) heard++; } // slow: some frames only
        if (await page.locator('.foot.show').count().catch(() => 0)) break;
      }
    })();
    await doIt();
    await page.locator('.foot.show').waitFor({ timeout: 20000 }).catch(() => {});
    await sleep(600);
    stop = true; await burst;
    const tr = await page.evaluate(() => { window.__trStop = true; return window.__tr; });
    return { tr, shots, took: Date.now() - t0 };
  };

  for (const id of LESSONS) {
    const unit = course.units.findIndex((u) => u.lessons.some((l) => l.id === id)) + 1;
    if (!unit) throw new Error(`no lesson ${id}`);
    report[id] = [];
    await playCourse(h, {
      course, unit, only: [id], small: process.env.MOVING_SMALL,
      answer: async (h2, item) => {
        const runs = item.type !== 'teach' || item.program;
        if (!runs || !item.level) return answerCoding(h2, item);
        const { tr, shots } = await watched(item, () => answerCoding(h2, item));
        const a = analyse(tr);
        if (!a.run) return;
        report[id].push({ item: item.id, type: item.type, ...a, frames: shots.length, span: shots.at(-1)?.at });
        console.log(`  ${item.id} (${item.type}): ${shots.length} frames over ${shots.at(-1)?.at ?? 0} ms; visits ${a.visits.length}; trail ends at ${a.endTrail}; jumps ${a.jumps.length}; values between squares ${a.offSquare.length}; drawing shrank ${a.shrank}`);
        for (const v of a.valueLog.slice(0, 12)) console.log(`      ${v}`);
        check(`${item.id}: Fennel never jumps more than a square between frames`, !a.jumps.length, a.jumps.slice(0, 2).join('; '));
        check(`${item.id}: values change only while he stands on a square`, !a.offSquare.length, a.offSquare.slice(0, 2).join('; '));
        check(`${item.id}: the drawing only grows during a run`, !a.shrank);
        check(`${item.id}: values never flash to ?`, !a.flashes.length, a.flashes.join('; '));
      },
    });
  }
  writeFileSync(`${notes}/trace.json`, JSON.stringify(report, null, 1));
  check('the step cue is a started audio stream while programs run (sampled during the walks)', heard > 0, `${heard} of ${sampled} samples`);
};
