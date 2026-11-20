// The phone's own keyboard (adb input text) over every place a learner types: Reflect's three lines, "+ Habit" then
// "Make your own", Focus's "your own words" and a habit's "when". Each time, with the keyboard really up (dumpsys
// input_method), the field and the button that follows must be inside what the learner can see (the visual viewport,
// which the keyboard shrinks) and not under a fixed bar; the text typed is what is kept; and once the keyboard goes the
// page is whole again.
import { emptyProgress, finishPractice, today } from '../../src/progress.js';
import { daysAgo } from './lib/seed.js';

export default async ({ page, seed, touch, btn, type, shot, check, adb, run }) => {
  const keyboard = () => /mInputShown=true/.test(adb('shell', 'dumpsys', 'input_method'));
  /** Whether `loc` is wholly in what can be seen, and the element at its middle is it (or in it): nothing fixed over it. */
  const seen = (loc) => loc.first().evaluate((el) => {
    const v = visualViewport, r = el.getBoundingClientRect();
    const t = document.elementFromPoint(r.x + r.width / 2, Math.min(Math.max(r.y + r.height / 2, 0), innerHeight - 1));
    return { inView: r.top >= v.offsetTop - 1 && r.bottom <= v.offsetTop + v.height + 1, free: !!t && (el === t || el.contains(t) || t.contains(el)), y: Math.round(r.y), bottom: Math.round(r.bottom), seeTo: Math.round(v.offsetTop + v.height) };
  });
  const above = async (name, ...locs) => {
    check(`${name}: the keyboard is up`, keyboard());
    for (const [i, l] of locs.entries()) {
      let s = await seen(l);
      // The button after a long form may sit below the keyboard: the finding is noted, and it must be a scroll away.
      if (i && !s.inView) { console.log(`  NOTE ${name}: the button after it starts below the keyboard (${JSON.stringify(s)}); scrolling to it`); await l.first().scrollIntoViewIfNeeded(); await page.waitForTimeout(500); s = await seen(l); }
      check(`${name}: ${i ? 'the button after it' : 'the field'} is above the keyboard and uncovered`, s.inView && s.free, JSON.stringify(s)); }
  };
  const whole = async (name) => {
    await page.waitForTimeout(800);
    const v = await page.evaluate(() => ({ h: innerHeight, vh: Math.round(visualViewport.height), off: Math.round(visualViewport.offsetTop), x: document.documentElement.scrollWidth - innerWidth }));
    check(`${name}: the keyboard is gone and the page is whole again`, !keyboard() && v.vh >= v.h - 1 && v.off === 0 && v.x <= 0, JSON.stringify(v));
  };
  const kept = (fn) => page.evaluate(fn, today(new Date()));

  // Reflect.
  let p = emptyProgress(); p.journal = {};
  for (const n of [3, 2]) { p = finishPractice(p, 'reflect', null, daysAgo(n), { title: 'Reflect', mins: 1 }); p.journal[today(daysAgo(n))] = { good: 'A line' }; }
  await seed(p);
  await touch(btn(/^Reflect(,|$)/)); await touch(btn('Continue · Three small lines')); await touch(btn('Start'));
  const box = page.getByRole('textbox');
  const lines = ['Coffee with a friend', 'Soup on the stove', 'Go for a walk'];
  for (const [i, text] of lines.entries()) {
    await touch(box); await page.waitForTimeout(1200); await type(text);
    await above(`Reflect line ${i + 1}`, box, btn(/Next|Finish|Done/)); await shot(`reflect-${i + 1}`);
    await touch(btn(/Next|Finish|Done/));
  }
  const j = await kept((d) => JSON.parse(localStorage.getItem('wingbeat.progress')).journal?.[d] ?? null);
  const wrote = JSON.stringify(j ?? {});
  check('Reflect: all three lines are what was typed', lines.every((l) => wrote.includes(l)), wrote);
  await whole('Reflect');

  // + Habit, Make your own: the name.
  await seed();
  await touch(btn('Add a habit')); await touch(btn('Make your own'));
  const name = page.getByRole('textbox', { name: 'Name' });
  await touch(name); await page.waitForTimeout(1200); await type('Stretch more');
  await above('Make your own', name, btn('Add habit')); await shot('own-name');
  await touch(page.getByRole('heading', { name: 'Make your own' }));
  await whole('Make your own');
  await touch(btn('Add habit')); await touch(btn('Skip'));
  check('Make your own: the habit has the name typed', (await page.locator('.path-tab').allTextContents()).some((t) => t.includes('Stretch more')));

  // A habit's "when", in your own words.
  await touch(btn('Add a habit')); await touch(btn(/Music/));
  const own = page.getByRole('textbox', { name: 'Or in your own words' });
  await touch(own); await page.waitForTimeout(1200); await type('After the dishes');
  await above('When', own, btn('Save')); await shot('when');
  await touch(page.getByRole('heading', { name: 'When will you do it?' }));
  await whole('When');
  await touch(btn('Save'));
  check('When: kept as typed', (await page.locator('.log-habit .when').textContent()) === 'After the dishes');

  // Focus: your own words.
  await seed();
  await touch(btn(/^Focus(,|$)/)); await touch(btn('Continue · Ten minutes, one thing')); await touch(btn('Start')); await touch(btn('Reading'));
  await run(600_000); await page.waitForTimeout(1000); await touch(btn('Focused')); await touch(btn(/^Continue/));
  await touch(btn('Continue · Fifteen minutes'));
  const words = page.getByRole('textbox');
  await touch(words); await page.waitForTimeout(1200); await type('Tax forms');
  await above('Focus', words, btn(/^Start/)); await shot('focus');
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); // the heading has scrolled out of sight above the field: the keyboard's own way down
  await whole('Focus');
  await touch(btn(/^Start/)); await run(60_000); await touch(btn("I'm done")); await page.waitForTimeout(800);
  const f = await kept((d) => JSON.stringify(JSON.parse(localStorage.getItem('wingbeat.progress')).journal?.[d] ?? null));
  check('Focus: the words are kept as typed', f.includes('Tax forms'), f);
};
