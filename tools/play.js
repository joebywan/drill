/**
 * The generic half of a "play a whole course" phone scenario (see test/phone/coding-all.js for the
 * course half). `playCourse(helpers, options)` walks one unit of a Learn course's path with real
 * touches, as a learner would: normal motion, warm-ups, "Once more" and checkpoints included. It
 * knows nothing about what an item is: `options.answer(h, item)` taps the item in (h.tap counts taps)
 * and each session's numbers go to test-results/play-<course>/unit-<n>.json.
 *
 *   options.course   the subject's course data: { id, units: [{ title, lessons: [{ id, title }] }] }, checkpoints included
 *   options.unit     1-based unit to play (default 1); `only` limits it to some lesson ids
 *   options.answer   async (h, item) => void
 *   options.small    wm size to play at, e.g. '1080x1700', for a short phone
 *   options.parts    selectors of the parts of the course's screen that must not sit on each other (default: Coding's)
 *   options.wrongOk  a run that answers wrongly on purpose: a wrong answer is not a failed check
 *   options.tray     of those, the ones the verdict may cover: the answer tray (default: '.tiles')
 *
 * PLAY_JITTER=0.85 lands each tap at a random spot out to that share of the way to its target's edge (PLAY_SEED varies
 * the run; same seed, same taps), where a plain run taps dead centre. A tap another element takes is reported with its item
 * and gets a picture (`miss-<item>-<n>`).
 *
 * PLAY_SWIPE=1 also swipes each kind of scrolling box once, with a real finger (see `swipeBoxes`).
 *
 * Time is an estimate at a steady human pace, since the harness taps faster than a person: reading
 * (1.5 s + 0.2 s a word of what the coach says, 0.1 s a word of the explanation after), one second a
 * tap, and the real time animations took (Fennel walking). The progress each unit ends with is saved,
 * so the next unit starts with the cards (warm-ups) a learner would have.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('../test-results/', import.meta.url).pathname;
const words = (s) => (String(s ?? '').match(/\S+/g) || []).length;

const PARTS = ['.bubble', '.grid-world', '.vars', '.program', '.tiles']; // Coding's screen

/** What is wrong with the screen right now: clipped or overlapping text, things off the side or behind each other. Run in the page (`page.evaluate(scan, { parts, tray })`); test/e2e/large-text.spec.js uses it too. */
export const scan = ({ parts: all, tray }) => {
  const out = [];
  const app = document.getElementById('app');
  const shown = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0; };
  const label = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : ''} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}"`;
  for (const el of app.querySelectorAll('*')) {
    if (!shown(el) || el.closest('svg') && el.tagName !== 'svg' || el.closest('.visually-hidden')) continue; // hidden-for-eyes text is for screen readers
    const s = getComputedStyle(el);
    const clip = (axis, size, client) => s[axis] !== 'visible' && s[axis] !== 'auto' && s[axis] !== 'scroll' && client > 0 && size > client + 2;
    if (el.textContent.trim() && clip('overflowX', el.scrollWidth, el.clientWidth)) out.push(`text clipped sideways: ${label(el)}`);
    if (el.textContent.trim() && clip('overflowY', el.scrollHeight, el.clientHeight) && !/^\d/.test(s.webkitLineClamp ?? 'none')) out.push(`text clipped at the bottom: ${label(el)}`); // a clamp is meant (the verdict's headline)
    const r = el.getBoundingClientRect();
    if (!el.children.length && el.textContent.trim() && (r.right > innerWidth + 1 || r.left < -1)) out.push(`text off the side: ${label(el)}`);
  }
  // Things that must not sit on each other: the parts of the screen, and the buttons in them.
  const area = (r) => Math.max(0, r.width) * Math.max(0, r.height);
  const cut = (a, b) => area({ width: Math.min(a.right, b.right) - Math.max(a.left, b.left), height: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) });
  const parts = [...new Set(all.map((q) => app.querySelector(q)))].filter((e) => e && shown(e)); // one element can match two selectors
  for (const [i, a] of parts.entries()) for (const b of parts.slice(i + 1)) if (cut(a.getBoundingClientRect(), b.getBoundingClientRect()) > 16) out.push(`overlap: ${label(a)} and ${label(b)}`);
  const foot = app.querySelector('.foot.show');
  if (foot) for (const e of app.querySelectorAll(all.filter((q) => !tray.includes(q)).join(', '))) if (shown(e) && cut(foot.getBoundingClientRect(), e.getBoundingClientRect()) > 16) out.push(`verdict covers: ${label(e)}`);
  // A button scrolled out of its own box (a tray's rows past the last whole one) is out of sight, not under anything.
  const scrolledAway = (el) => {
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== app; p = p.parentElement) {
      if (!/auto|scroll|hidden/.test(getComputedStyle(p).overflowY)) continue;
      const q = p.getBoundingClientRect();
      if (r.top >= q.bottom - 1 || r.bottom <= q.top + 1) return true;
    }
    return false;
  };
  const buttons = [...app.querySelectorAll('.stage button')].filter((b) => shown(b) && getComputedStyle(b).visibility !== 'hidden' && !scrolledAway(b));
  for (const [i, a] of buttons.entries()) for (const b of buttons.slice(i + 1)) {
    if (a.contains(b) || b.contains(a)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    if (cut(ra, rb) > 0.25 * Math.min(area(ra), area(rb))) out.push(`buttons overlap: ${label(a)} and ${label(b)}`);
  }
  return [...new Set(out)];
};


/**
 * PLAY_SWIPE=1: the first time a box that scrolls in itself (`.scrolls`, src/fit.js) shows on a screen, swipe it with a
 * real finger and report what is wrong: the page moved, its edge marks (`more-above`, `more-below`) are wrong at the top,
 * the bottom or part way, it did not come to rest, Continue/Run was swiped off the screen, or a swipe that began on a
 * button pressed it. Gives the lines to report, with a picture taken at the far end.
 */
async function swipeBoxes({ page, swipe, shot }, id, seen) {
  const found = await page.evaluate(() => [...document.querySelectorAll('#app .scrolls')].filter((b) => b.scrollHeight > b.clientHeight + 2).map((b, i) => { b.dataset.sw = i; return `${b.tagName.toLowerCase()}.${b.className.replace(/\b(scrolls|more-\w+)\b/g, '').trim().split(/\s+/)[0]}`; }));
  const out = [];
  for (const [i, name] of found.entries()) {
    if (seen.has(name)) continue;
    seen.add(name);
    const box = page.locator(`[data-sw="${i}"]`);
    const state = () => box.evaluate((b) => ({ top: Math.round(b.scrollTop), max: b.scrollHeight - b.clientHeight, above: b.classList.contains('more-above'), below: b.classList.contains('more-below'), page: Math.round(scrollY), foot: [...document.querySelectorAll('#app .foot.show button, #app .stage > button, #app .tiles > button')].filter((x) => getComputedStyle(x).visibility !== 'hidden').filter((x) => /^(Run|Continue|Check)/.test(x.textContent.trim())).every((x) => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) }));
    const edges = (s, where) => { const w = (s.top > 1) !== s.above ? `more-above is ${s.above} at ${s.top}px` : (s.max - s.top > 1) !== s.below ? `more-below is ${s.below} with ${s.max - s.top}px to go` : ''; return w && `${id}: ${name} ${where}: ${w}`; };
    const at = async (where) => { await page.waitForTimeout(500); const s = await state(); const later = (await page.waitForTimeout(1200), await state()); if (later.top !== s.top) out.push(`${id}: ${name} ${where}: still moving (${s.top} then ${later.top})`); const e = edges(later, where); if (e) out.push(e); return later; };
    const start = await at('before');
    const b = await box.boundingBox();
    const pressed = () => page.evaluate(() => document.querySelector('#app .program, #app .code-program, #app .code-answer')?.textContent ?? '');
    const text0 = await pressed();
    // Up first (the content moves up) with a swipe that starts on a button, if the box has one, else mid-box.
    const onButton = box.locator('button:not([disabled])').first();
    const grab = (await onButton.count()) && (await onButton.boundingBox());
    const reach = Math.min(b.height * 0.8, 220);
    await swipe(grab ? onButton : box, 0, -reach);
    let s = await at('after one swipe up');
    if (s.page !== start.page) out.push(`${id}: ${name}: the page moved ${s.page - start.page}px when the box was swiped`);
    if (s.top === start.top && start.max > 2) out.push(`${id}: ${name}: swiped up, did not scroll`);
    if (grab && (await pressed()) !== text0) out.push(`${id}: ${name}: a swipe that began on a button pressed it`);
    for (let k = 0; k < 6 && s.max - s.top > 1; k++) { await swipe(box, 0, -reach); s = await at('on the way down'); }
    if (s.max - s.top > 1) out.push(`${id}: ${name}: swiped to the end, ${s.max - s.top}px still to go`);
    if (!s.foot) out.push(`${id}: ${name}: Run or Continue is off the screen after the box was swiped`);
    if (s.page !== start.page) out.push(`${id}: ${name}: the page moved ${s.page - start.page}px at the end of the box`);
    await shot(`box-${id}-end`).catch(() => {});
    for (let k = 0; k < 6 && s.top > 1; k++) { await swipe(box, 0, reach); s = await at('on the way up'); }
    if (s.top > 1) out.push(`${id}: ${name}: swiped back, ${s.top}px short of the top`);
  }
  return out;
}

export async function playCourse(h, { course, unit = 1, only, answer, small, parts = PARTS, tray = ['.tiles'], wrongOk = false }) {
  const { page, adb, touch, btn, shot, seed, run, check } = h;
  const swipeSeen = new Set();
  const unitAt = course.units[unit - 1];
  if (!unitAt) throw new Error(`${course.id} has ${course.units.length} units, not ${unit}`);
  if (process.env.PLAY_JITTER) console.log(`  taps land up to ${process.env.PLAY_JITTER} of the way to the target's edge (seed ${process.env.PLAY_SEED || 1})`);
  const dir = `${OUT}play-${course.id}/`;
  mkdirSync(dir, { recursive: true });
  const saved = (() => { try { return JSON.parse(readFileSync(`${dir}progress.json`, 'utf8')); } catch { return null; } })();
  const key = (l) => `${course.id}:${l.id}`;
  const before = course.units.slice(0, unit - 1).flatMap((u) => u.lessons);
  const lessons = unitAt.lessons.filter((l) => !only || only.includes(l.id));
  const skipped = unitAt.lessons.slice(0, unitAt.lessons.indexOf(lessons[0]));
  // Unplayed lessons ahead of this one count as done, so the path asks for this unit's.
  const done = Object.fromEntries([...before, ...skipped].map((l) => [key(l), true]));
  const restored = unit > 1 && saved && before.every((l) => saved.done?.[key(l)]) ? saved : null;
  // A short phone first, so the taps are aimed where its smaller screen puts the page (`calibrate` blanks the page; seed loads it).
  if (small) { adb('shell', 'wm', 'size', small); await run(1500); await h.calibrate?.(); }
  // A course that follows another is played as by someone who chose "I know JavaScript: start here" (progress.js waits).
  const chosen = course.follows ? { start: { ...restored?.start, [course.id]: restored?.start?.[course.id] ?? course.units[0].title } } : {};
  await seed(restored ? { ...restored, done, ...chosen } : { done, ...chosen }); // only what is behind this unit counts as done, so a unit can be played again

  await page.evaluate(() => { window.WINGBEAT_PLAIN = false; }); // the app reads it as it goes: warm-ups, echoes and checkpoints on, as a learner has them
  const events = [];
  const onError = (e) => events.push(`page error: ${e.message}`);
  const onResponse = (r) => r.status() >= 400 && events.push(`failed request: ${r.status()} ${r.url()}`);
  const onFailed = (r) => events.push(`failed request: ${r.failure()?.errorText} ${r.url()}`);
  page.on('pageerror', onError); page.on('response', onResponse); page.on('requestfailed', onFailed);

  let taps = 0;
  let tapEnd = 0;
  let current = ''; // the item being answered, for what is reported
  const targets = new Map(); // small tap targets, one line per kind
  const trouble = []; // what could not be tapped
  /** A real tap that first checks the target can be hit: on screen, not covered, big enough. */
  const tap = async (loc) => {
    const at = loc.first();
    await at.waitFor({ timeout: 15000 });
    await at.scrollIntoViewIfNeeded();
    const hit = await at.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const name = (e) => `${e.tagName.toLowerCase()}.${String(e.className).split(/\s+/)[0]}`;
      // A real finger is not a point: another control's (invisible) target over any of this one's box can take the tap.
      let part = null;
      for (let i = 0; i < 10 && !part; i++) { // across the middle each way, edge to edge: the rounded corners are no one's
        const f = (i % 5) / 4, x = i < 5 ? r.x + 1 + f * (r.width - 2) : r.x + r.width / 2, y = i < 5 ? r.y + r.height / 2 : r.y + 1 + f * (r.height - 2);
        const o = document.elementFromPoint(x, y)?.closest('button, a, input, [role="button"]');
        if (o && o !== el && !o.contains(el) && !el.contains(o)) {
          const box = (q) => `${Math.round(q.top * 10) / 10}-${Math.round(q.bottom * 10) / 10}`;
          const clip = el.closest('.scrolls');
          part = `${name(o)} (at y ${Math.round(y * 10) / 10}: this ${box(r)}, that ${box(o.getBoundingClientRect())}${clip ? `, in ${name(clip)} ${box(clip.getBoundingClientRect())} scrolled ${Math.round(clip.scrollTop)}` : ''})`;
        }
      }
      return { ok: !!t && (el === t || el.contains(t) || t.contains(el)), w: r.width, h: r.height, name: name(el), covered: t && name(t), part };
    });
    const where = current ? `${current}: ` : '';
    if (!hit.ok) trouble.push(`${where}${hit.name} is covered by ${hit.covered}`);
    else if (hit.part) trouble.push(`${where}${hit.name} is partly covered by ${hit.part}`);
    const least = Math.round(Math.min(hit.w, hit.h));
    if (least < 40) { const was = targets.get(hit.name); targets.set(hit.name, { least: Math.min(least, was?.least ?? 99), n: (was?.n ?? 0) + 1 }); }
    taps++;
    // Where the finger really landed: a tap aimed here that a neighbour takes is the worst kind of covered.
    await at.evaluate((el) => {
      window.__landed = null;
      addEventListener('pointerdown', (e) => {
        const t = e.target instanceof Element ? e.target : null;
        window.__landed = !t || el.contains(t) || t.contains(el) ? 'ok' : `${t.tagName.toLowerCase()}.${String(t.className).split(/\s+/)[0]} "${(t.getAttribute('aria-label') || t.textContent).trim().slice(0, 30)}"`;
      }, { once: true, capture: true });
    });
    await touch(at);
    const landed = await page.evaluate(() => window.__landed).catch(() => 'ok'); // a tap that leaves the page is fine
    if (landed && landed !== 'ok') { trouble.push(`${where}${hit.name} was tapped, but ${landed} took it`); await shot(`miss-${current || 'x'}-${taps}`).catch(() => {}); }
    tapEnd = Date.now();
  };

  await touch(page.locator(`[data-course="${course.id}"]`));
  await page.evaluate(async () => { // every mounted item, so the answer is worked out from what is on screen (a repeat is a fresh version)
    const { subjects } = await import('/src/subjects.js');
    window.__n = 0;
    for (const s of subjects) if (s.mount && !s.__seen) { const m = s.mount; s.mount = (el, item, ctx) => { window.__item = JSON.parse(JSON.stringify(item)); window.__n++; return m(el, item, ctx); }; s.__seen = true; }
  });
  const height = await page.evaluate(() => innerHeight);
  console.log(`  unit ${unit} ${unitAt.title}: ${lessons.length} lessons, page ${await page.evaluate(() => innerWidth)}x${height}${restored ? ', continuing saved progress' : ''}`);

  const report = [];
  let shots = 0;
  const every = !!process.env.PLAY_SHOTS; // a picture of every item, asked and answered, to look through by eye
  for (const lesson of lessons) {
    const started = Date.now();
    const row = { lesson: lesson.id, title: lesson.title, items: 0, taps: 0, human: 0, kinds: {}, topics: {}, wrong: 0, odd: [], stuck: null, overflow: 0 };
    events.length = 0; trouble.length = 0; targets.clear(); taps = 0;
    const seenOdd = new Set();
    const look = async (item, when) => {
      if (when === 'answered') await new Promise((r) => setTimeout(r, 900)); // let the verdict's pop settle
      const [found, over] = await Promise.all([page.evaluate(scan, { parts, tray }), page.evaluate(() => document.documentElement.scrollWidth - innerWidth)]);
      row.overflow = Math.max(row.overflow, over);
      const news = found.filter((f) => !seenOdd.has(f)).map((f) => `${item.id} (${when}): ${f}`);
      found.forEach((f) => seenOdd.add(f));
      if (over > 0) news.push(`${item.id} (${when}): sideways overflow ${over}px`);
      row.odd.push(...news);
      if ((news.length || every) && shots++ < (every ? 400 : 40)) await shot(`${lesson.id}-${item.id}-${when}`);
    };
    try {
      await tap(btn(`Continue · ${lesson.title}`));
      let seen = 0;
      for (;;) {
        await page.waitForFunction((n) => window.__n > n || document.querySelector('.summary'), seen, { timeout: 15000 });
        if (await page.locator('.summary').count()) break;
        seen = await page.evaluate(() => window.__n);
        const [item, said, topic] = await page.evaluate(() => [window.__item, document.getElementById('said')?.textContent, document.querySelector('.topic')?.textContent]);
        const before = taps;
        current = item.id;
        row.items++;
        row.kinds[item.type] = (row.kinds[item.type] ?? 0) + 1;
        row.topics[topic] = (row.topics[topic] ?? 0) + 1;
        await look(item, 'asked');
        if (process.env.PLAY_SWIPE) row.odd.push(...await swipeBoxes(h, item.id, swipeSeen));
        tapEnd = Date.now();
        await answer({ ...h, tap, btn }, item);
        await page.locator('.foot.show').waitFor({ timeout: 30000 });
        const walk = Date.now() - tapEnd; // the real time Fennel's walk took after the last tap (the tap's own waits are over by then)
        const [right, verdict] = await page.evaluate(() => [document.querySelector('.foot.right') ? true : document.querySelector('.foot.wrong') ? false : null, document.querySelector('.foot p')?.textContent]);
        if (right === false) { row.wrong++; row.odd.push(`${item.id}: answered wrongly (${topic})`); if (shots++ < 40) await shot(`${lesson.id}-${item.id}-wrong`); }
        await look(item, 'answered');
        const demo = item.program && item.level && (item.type === 'teach' || item.type === 'bug') ? 0.9 + 0.38 * 8 : 0; // the demo run a learner watches
        row.human += 1.5 + 0.2 * words(said) + (taps - before) + walk / 1000 + 0.1 * words(verdict) + demo;
        await tap(btn('Continue', { exact: true }));
      }
      await shot(`${lesson.id}-summary`).catch(() => {});
      for (let i = 0; i < 4 && !(await page.locator('.home').count()); i++) await tap(btn('Continue', { exact: true })).catch(() => {});
    } catch (e) {
      row.stuck = e.message.split('\n')[0];
      await shot(`${lesson.id}-stuck`).catch(() => {});
    }
    row.taps = taps;
    row.human = Math.round(row.human);
    row.wall = Math.round((Date.now() - started) / 1000);
    row.untappable = [...new Set(trouble)];
    row.small = Object.fromEntries(targets);
    row.errors = [...new Set(events)];
    report.push(row);
    const flags = [row.stuck && `STUCK ${row.stuck}`, row.items > 20 && 'over 20 items', row.human > 360 && 'over 6 minutes', row.wrong && `${row.wrong} wrong`, row.odd.length && `${row.odd.length} odd`, row.untappable.length && 'untappable', row.errors.length && 'errors'].filter(Boolean);
    console.log(`  ${lesson.id.padEnd(22)} ${String(row.items).padStart(2)} items ${String(row.taps).padStart(3)} taps ~${Math.floor(row.human / 60)}:${String(row.human % 60).padStart(2, '0')}${flags.length ? `  <- ${flags.join(', ')}` : ''}`);
    if (row.stuck) break; // the path is not where the next lesson expects it
  }
  page.off('pageerror', onError); page.off('response', onResponse); page.off('requestfailed', onFailed);
  if (small) { adb('shell', 'wm', 'size', 'reset'); await run(1500); await h.calibrate?.(); }
  const progress = await page.evaluate(() => localStorage.getItem('wingbeat.progress'));
  if (!small && !only) writeFileSync(`${dir}progress.json`, progress);
  writeFileSync(`${dir}unit-${unit}${small ? '-small' : only ? '-some' : ''}.json`, JSON.stringify({ unit, title: unitAt.title, page: height, lessons: report }, null, 1));
  for (const r of report) {
    check(`${r.lesson}: played to the end`, !r.stuck, r.stuck ?? '');
    check(`${r.lesson}: no page errors or failed requests`, !r.errors.length, r.errors.join('; '));
    check(`${r.lesson}: nothing covered`, !r.untappable.length, r.untappable.join('; '));
    check(`${r.lesson}: every answer right`, wrongOk || !r.wrong);
    check(`${r.lesson}: nothing clipped, overlapping or sideways`, !r.odd.some((o) => !/answered wrongly/.test(o)), r.odd.filter((o) => !/answered wrongly/.test(o)).slice(0, 3).join('; '));
  }
  return report;
}
