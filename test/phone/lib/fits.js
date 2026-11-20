// Shared by the large-text scenarios (test/phone/app.js, zoom.js): what doesn't fit a screen, a tour of the screens with
// the most text, and finding Android's own views.
import { ago } from './seed.js';

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

/** `fits(tag, name)`: a picture named `<tag>-<name>`, and a check that the screen fits (`misfits`). */
export const fitter = ({ page, run, shot }, check) => async (tag, name) => {
  await run(400); await shot(`${tag.replaceAll(' ', '-')}-${name}`);
  console.log(`  layout ${tag} ${name}: ${await page.evaluate(stack)}`);
  const m = await page.evaluate(misfits);
  check(`${tag}: ${name} fits`, !m.length, m.slice(0, 4).join('; '));
};

/**
 * The screens with the most text, each checked by `fitter`: home on every tab and with a course being raised, the first
 * two items of each Learn course, a Calm and a Move routine to their end screens, the field guide and a species, Settings,
 * the wardrobe and the "+ Habit" sheet. `h` is a page's helpers (tools/phone.js), `tag` names the look ("text 1.3").
 */
export async function textTour(h, check, tag) {
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
  };
  await home();
  for (const tab of await page.locator('.path-tab[data-path]').evaluateAll((t) => t.map((x) => x.dataset.path))) {
    await touch(page.locator(`.path-tab[data-path="${tab}"]`)); await fits(tag, `home-${tab}`);
  }
  // A course being raised: its picture ends the streak row, at this text size too.
  await home({ done: { 'chess:board-0': true } }); await touch(btn(/^Learning(,|$)/)); await touch(pressed('Chess'));
  await page.evaluate(() => scrollTo(0, 0)); await fits(tag, 'home-raising');
  check(`${tag}: the streak row ends with what Chess is raising`, await page.locator('.streak-row > .raising:last-child svg').isVisible());
  for (const course of ['Chess', 'Maths', 'Japanese', 'Coding', 'JavaScript']) {
    await home(); await touch(btn(/^Learning(,|$)/)); await touch(pressed(course));
    await touch(btn(/^Continue · /)); await fits(tag, `lesson-${course.toLowerCase()}`);
    await touch(pressed('Continue')); await fits(tag, `lesson-${course.toLowerCase()}-next`);
  }
  await routine('Calm', 'calm');
  await routine('Move', 'move');
  await home(); await touch(btn(/^Your garden/)); await touch(page.locator('.guide-link')); await fits(tag, 'field-guide');
  await touch(page.locator('.guide-tile')); await fits(tag, 'species');
  await home(); await touch(btn('Settings')); await fits(tag, 'settings');
  await touch(btn("Lumi's wardrobe")); await fits(tag, 'wardrobe');
  await home(); await touch(page.locator('[data-add]')); await fits(tag, 'add-habit');
}
