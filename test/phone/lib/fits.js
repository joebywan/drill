// Shared by the large-text scenarios (test/phone/app.js, zoom.js): what doesn't fit a screen, a tour of the screens with
// the most text, and finding Android's own views.
import { ago } from './seed.js';
import { subjects } from '../../../src/subjects.js';
import { scan } from '../../../tools/play.js';

/**
 * Run in the page (`page.evaluate(misfits)`): what doesn't fit the screen as it is. Nothing wider than the page or cut
 * off, no path label running into the next node, no node's mark out of its node, and every control reachable above
 * the fixed bars when scrolled to the end. Leaves the page scrolled to the top.
 */
export function misfits() {
  const out = [];
  const what = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? `.${e.className.trim().split(/\s+/).join('.')}` : ''} "${e.textContent.trim().slice(0, 28)}"`;
  const scrolls = (e) => { for (let p = e.parentElement; p; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowX)) return true; return false; };
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page ${document.documentElement.scrollWidth - innerWidth}px too wide`);
  for (const e of document.querySelectorAll('#app :is(button, a, .label, h1, h2, h3, p, li)')) {
    const r = e.getBoundingClientRect();
    if (!r.width || scrolls(e) || e.closest('.visually-hidden')) continue; // hidden-for-eyes text is for screen readers
    if (r.right > innerWidth + 1 || r.left < -1) out.push(`off the side: ${what(e)}`);
    const cs = getComputedStyle(e);
    // A box that scrolls is reachable: only one that hides its overflow cuts text off.
    if ((/hidden|clip/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1) || (/hidden|clip/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1)) out.push(`cut off: ${what(e)}`);
  }
  const rows = [...document.querySelectorAll('.path li')];
  rows.forEach((li, i) => {
    const label = li.querySelector('.label')?.getBoundingClientRect(), next = rows[i + 1]?.querySelector('.node')?.getBoundingClientRect();
    if (label && next && label.bottom > next.top + 1) out.push(`label into the next node: ${what(li.querySelector('.label'))}`);
    const node = li.querySelector('.node'), mark = node?.querySelector('span')?.getBoundingClientRect(), box = node?.getBoundingClientRect();
    if (mark && (mark.bottom > box.bottom + 1 || mark.top < box.top - 1)) out.push(`mark out of its node: ${what(node)}`);
  });
  scrollTo(0, document.documentElement.scrollHeight);
  const bars = [...document.querySelectorAll('#app *')].filter((e) => {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    return cs.position === 'fixed' && cs.visibility !== 'hidden' && r.height && r.top > innerHeight / 2 && r.top < innerHeight;
  });
  const top = Math.min(innerHeight, ...bars.map((b) => b.getBoundingClientRect().top));
  for (const e of document.querySelectorAll('#app :is(button, a)')) {
    const r = e.getBoundingClientRect();
    if (r.height && !bars.some((b) => b.contains(e)) && getComputedStyle(e).visibility !== 'hidden' && r.bottom > top + 1) out.push(`under a fixed bar at the end: ${what(e)}`);
  }
  scrollTo(0, 0);
  return out;
}

/**
 * Run in the page (`page.evaluate(stack)`): what stands above the fixed bar, top to bottom, in CSS px of an
 * `innerHeight` page: the bar's top, the screen's rows (home's, nested in its rail and pane, by name) and home's first node.
 */
export function stack() {
  const cs = (e) => getComputedStyle(e);
  const bar = [...document.querySelectorAll('#app *')].filter((e) => cs(e).position === 'fixed' && cs(e).visibility !== 'hidden' && e.getBoundingClientRect().top > innerHeight / 2 && e.getBoundingClientRect().top < innerHeight)
    .reduce((m, e) => Math.min(m, e.getBoundingClientRect().top), innerHeight);
  const root = document.querySelector('#app main') ?? document.querySelector('#app');
  const rows = (root.matches('.home') ? [...root.querySelectorAll(':scope .garden-link, :scope .tabs-row, :scope .courses:not(.games), :scope .said, :scope .streak-row, :scope .street > h2')] : [...root.children])
    .filter((e) => e.getBoundingClientRect().height).map((e) => `${e.className.toString().split(' ')[0] || e.tagName.toLowerCase()} ${Math.round(e.getBoundingClientRect().top)}-${Math.round(e.getBoundingClientRect().bottom)}`);
  const node = document.querySelector('.path .node');
  return `height ${innerHeight}, bar from ${Math.round(bar)}; ${rows.join(', ')}${node ? `; first node ${Math.round(node.getBoundingClientRect().top)}-${Math.round(node.getBoundingClientRect().bottom)}` : ''}`;
}

/** The first of Android's own views in `xml` (a `uiautomator dump`) whose text or description matches `re`: its centre and text. */
export function uiNode(xml, re) {
  for (const [tag] of xml.matchAll(/<node [^>]*>/g)) {
    const [t, d] = [/ text="([^"]*)"/, / content-desc="([^"]*)"/].map((r) => tag.match(r)?.[1] ?? '');
    if (!re.test(t) && !re.test(d)) continue;
    const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
    return { at: [(b[0] + b[2]) >> 1, (b[1] + b[3]) >> 1], text: t || d };
  }
  return null;
}

// A lesson's screen, by kind of item: its parts (tools/play.js `scan`), and of those the tray at the bottom.
export const QUIZ = { parts: ['.bubble', '.card', '.choices'], tray: ['.choices'] };
export const CODING = { parts: ['.bubble', '.grid-world', '.vars', '.program', '.tiles'], tray: ['.tiles'] };
export const CODE = { parts: ['.bubble', '.code-given', '.program', '.card', '.tiles', '.choices'], tray: ['.tiles', '.choices'] };
export const CHESS = { parts: ['.bubble', '.board', '.choices'], tray: ['.choices'] };

/** Run in the page: a part that scrolls in its own box is in view only with a line (32px) of it above whatever is fixed at the bottom. */
export function inView({ parts, tray }) {
  const bars = [...document.querySelectorAll('.foot.show, #app .tiles, #app .choices')].filter((e) => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().height);
  const low = Math.min(innerHeight, ...bars.map((b) => b.getBoundingClientRect().top));
  return parts.filter((q) => !tray.includes(q)).map((q) => document.querySelector(`#app ${q}`)).filter((e) => e?.classList.contains('scrolls'))
    .map((e) => [e, Math.min(e.getBoundingClientRect().bottom, low) - Math.max(e.getBoundingClientRect().top, 0)])
    .filter(([, h]) => h < 32).map(([e, h]) => `only ${Math.round(h)}px of ${e.className.split(' ')[0]} in view`);
}

/**
 * Run in the page once answered: what breaks the verdict's own rule. At most half the screen, Continue whole on it,
 * and the explanation's last line reached by scrolling the verdict's box (left scrolled there). The headline at most
 * two lines once the words have to scroll, and with larger text no bigger than the explanation.
 */
export function verdictRule() {
  const out = [];
  const foot = document.querySelector('.foot.show'), box = foot.querySelector('.verdict'), p = box.querySelector('p'), head = box.querySelector('strong');
  const f = foot.getBoundingClientRect(), next = foot.querySelector('.next').getBoundingClientRect();
  if (f.height > innerHeight / 2 + 1) out.push(`${Math.round(f.height)}px tall, over half of ${innerHeight}`);
  if (next.top < 0 || next.bottom > innerHeight + 1) out.push('Continue is off the screen');
  box.scrollTop = box.scrollHeight;
  const b = box.getBoundingClientRect(), end = p.getBoundingClientRect();
  if (end.bottom > b.bottom + 1 || end.bottom > next.top + 1) out.push(`the explanation's end is ${Math.round(end.bottom - Math.min(b.bottom, next.top))}px out of reach`);
  const size = (e) => parseFloat(getComputedStyle(e).fontSize);
  if (box.scrollHeight > box.clientHeight + 1 && head.getBoundingClientRect().height > 2 * 1.4 * size(head) + 1) out.push('the headline is over two lines while the words scroll');
  if (getComputedStyle(document.documentElement).getPropertyValue('--text-scale') && size(head) > size(p) + 0.5) out.push(`the headline (${size(head)}px) is bigger than the explanation (${size(p)}px)`);
  return out;
}

/**
 * Run in the page: each part of the screen (`parts`, not the tray) that the verdict or a fixed tray covers, scrolled clear
 * of it by the page, as a thumb would: whole above it, or one that scrolls in its own box with a line (32px) of it showing.
 */
export function reachable({ parts, tray }) {
  const out = [];
  const bars = [...document.querySelectorAll('.foot.show, #app .tiles, #app .choices')].filter((e) => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().height);
  const top = Math.min(innerHeight, ...bars.map((b) => b.getBoundingClientRect().top));
  for (const sel of parts.filter((q) => !tray.includes(q))) {
    const el = document.querySelector(`#app ${sel}`);
    if (!el || !el.getBoundingClientRect().height) continue;
    scrollTo(0, 0);
    const r0 = el.getBoundingClientRect();
    if (r0.bottom <= top + 1) continue;
    scrollTo(0, Math.max(0, r0.bottom - top + 1));
    const r = el.getBoundingClientRect();
    const box = el.classList.contains('scrolls');
    if (box ? Math.min(r.bottom, top) - Math.max(r.top, 0) < 32 : r.top < -1 || r.bottom > top + 1) out.push(`${sel} can't be scrolled clear of the verdict (${Math.round(r.top)}..${Math.round(r.bottom)} over ${Math.round(top)}; the page is ${document.documentElement.scrollHeight}px)`);
  }
  scrollTo(0, 0);
  return out;
}

/** `fits(tag, name)`: a picture named `<tag>-<name>`, and a check that the screen fits (`misfits`). */
export const fitter = ({ page, run, shot }, check) => async (tag, name) => {
  await run(400); await shot(`${tag.replaceAll(' ', '-')}-${name}`);
  console.log(`  layout ${tag} ${name}: ${await page.evaluate(stack)}`);
  const m = await page.evaluate(misfits);
  check(`${tag}: ${name} fits`, !m.length, m.slice(0, 4).join('; '));
};

// A lesson of each kind played to its first question and answered by a tap, right or not: course, lesson, its screen.
const ANSWERED = [['Chess', 'chess', 'check-0', CHESS], ['Maths', 'maths', 'ten-0', QUIZ], ['Japanese', 'japanese', 'v1', QUIZ], ['Coding', 'coding', 'steps-0', CODING], ['JavaScript', 'javascript', 'jsv-1', CODE]];

/**
 * The screens with the most text, each checked by `fitter`: home on every tab and with a course being raised, the first
 * two items of each Learn course, a question of each kind answered (the item in view above the verdict, the verdict at
 * most half the screen and read to its end: `verdictRule`), a Calm and a Move routine to their end screens, the field
 * guide and a species, Settings, the wardrobe and the "+ Habit" sheet. `h` is a page's helpers (tools/phone.js), `tag`
 * names the look ("text 1.3"). With `reach`, a page past what the app promises (206px wide), what the verdict covers
 * only has to be reachable by scrolling (`reachable`).
 */
export async function textTour(h, check, tag, { reach = false } = {}) {
  const { page, touch, btn, run, seed } = h;
  const fits = fitter(h, check);
  const pressed = (name) => page.getByRole('button', { name, exact: true });
  const done = { learn: { count: 3, last: ago(0), forgiven: [] }, calm: { count: 2, last: ago(1), forgiven: [] }, move: { count: 1, last: ago(1), forgiven: [] } };
  const home = (patch = {}) => seed({ start: {}, picked: [], habits: done, wings: ['learn', 'learn', 'calm'], ...patch });
  /** Plays a timed routine (Calm, Move) from home's Continue to its end screen. */
  const routine = async (tab, name) => {
    await home(); await touch(btn(new RegExp(`^${tab}(,|$)`))); await touch(btn(/^Continue · /)); await fits(tag, `${name}-teach`);
    await touch(btn('Start')); await run(1500); await fits(tag, `${name}-running`);
    for (let i = 0; i < 12 && !(await page.locator('.summary').count()); i++) {
      await run(30000);
      const next = page.getByRole('button', { name: /^(Next|Done|I did it|Goodnight)/ });
      if (await next.count()) await touch(next);
    }
    await fits(tag, `${name}-end`);
    // With larger text the end screen gives way (finishRoutine in app.js) until the question it ends on is above Continue.
    const q = await page.evaluate(() => ({ large: !!getComputedStyle(document.documentElement).getPropertyValue('--text-scale'), end: Math.round(document.querySelector('#feel-q').getBoundingClientRect().bottom + scrollY), bar: Math.round(document.querySelector('.cta').getBoundingClientRect().top) }));
    if (q.large) check(`${tag}: ${name}-end: "How do you feel?" above Continue`, q.end <= q.bar, JSON.stringify(q));
  };
  await home();
  for (const tab of await page.locator('.path-tab[data-path]').evaluateAll((t) => t.map((x) => x.dataset.path))) {
    await touch(page.locator(`.path-tab[data-path="${tab}"]`)); await fits(tag, `home-${tab}`);
  }
  // With larger text home gives way (roomForHere in app.js): the next lesson and its coach above Continue, the page at its top.
  await touch(page.locator('.path-tab[data-path="learn"]')); await touch(pressed('Chess')); await run(400);
  const at = await page.evaluate(() => {
    const end = (s) => document.querySelector(s)?.getBoundingClientRect().bottom ?? 0;
    return { large: !!getComputedStyle(document.documentElement).getPropertyValue('--text-scale'), here: Math.round(Math.max(end('.node.here'), end('.guide'))), bar: Math.round(document.querySelector('.cta').getBoundingClientRect().top), y: Math.round(scrollY) };
  });
  if (at.large) check(`${tag}: home on Chess, the next lesson and its coach above Continue with the garden in sight`, at.y === 0 && at.here <= at.bar, JSON.stringify(at));
  // A course being raised: its picture ends the streak row, at this text size too.
  await home({ done: { 'chess:board-0': true } }); await touch(btn(/^Learning(,|$)/)); await touch(pressed('Chess'));
  await page.evaluate(() => scrollTo(0, 0)); await fits(tag, 'home-raising');
  check(`${tag}: the streak row ends with what Chess is raising`, await page.locator('.streak-row > .raising:last-child svg').isVisible());
  for (const course of ['Chess', 'Maths', 'Japanese', 'Coding', 'JavaScript']) {
    await home(); await touch(btn(/^Learning(,|$)/)); await touch(pressed(course));
    await touch(btn(/^Continue · /)); await fits(tag, `lesson-${course.toLowerCase()}`);
    await touch(pressed('Continue')); await fits(tag, `lesson-${course.toLowerCase()}-next`);
  }
  for (const [name, id, lessonId, parts] of ANSWERED) {
    const unit = subjects.find((s) => s.id === id).units.find((u) => u.lessons.some((l) => l.id === lessonId));
    const at = unit.lessons.findIndex((l) => l.id === lessonId);
    await home({ start: { [id]: unit.title }, done: Object.fromEntries(unit.lessons.slice(0, at).map((l) => [`${id}:${l.id}`, true])) });
    await touch(btn(/^Learning(,|$)/)); await touch(pressed(name));
    await touch(btn(`Continue · ${unit.lessons[at].title}`));
    for (let i = 0; i < 6 && await page.locator('.foot.show.plain').count(); i++) await touch(pressed('Continue')); // teach cards
    for (let i = 0; i < 10 && !(await page.locator('.foot.show').count()); i++) {
      const go = page.getByRole('button', { name: 'Run', exact: true });
      if (await go.count() && await go.isEnabled() && await page.locator('.program [data-take]').count()) await touch(go);
      else await touch(page.locator('.stage :is(.choices, .tiles) button:not(:disabled):not(.run)'));
      await run(1500); // Fennel's walk, the verdict sliding in
    }
    await run(1000); await h.shot(`${tag.replaceAll(' ', '-')}-answered-${id}`);
    const found = reach ? await page.evaluate(reachable, parts) : [...await page.evaluate(scan, parts), ...await page.evaluate(inView, parts)];
    found.push(...await page.evaluate(verdictRule));
    await h.shot(`${tag.replaceAll(' ', '-')}-answered-${id}-end`); // the verdict's box scrolled to its end
    check(`${tag}: ${name} answered: the question in view above a verdict of at most half the screen`, !found.length, found.slice(0, 4).join('; '));
  }
  await routine('Calm', 'calm');
  await routine('Move', 'move');
  await home(); await touch(btn(/^Your garden/)); await touch(page.locator('.guide-link')); await fits(tag, 'field-guide');
  await touch(page.locator('.guide-tile')); await fits(tag, 'species');
  await home(); await touch(btn('Settings')); await fits(tag, 'settings');
  await touch(btn("Lumi's wardrobe")); await fits(tag, 'wardrobe');
  await home(); await touch(page.locator('[data-add]')); await fits(tag, 'add-habit');
}
