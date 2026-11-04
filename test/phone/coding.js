// Coding's first lesson with real touches: the course row on Learning, tap-to-build tiles in the
// thumb zone, Fennel walking the grid, a predict tap on a grid square, then the end screen.
import { readFileSync } from 'node:fs';
import { answer, parse, solve } from '../../src/coding/program.js';

const first = JSON.parse(readFileSync(new URL('../../src/data/coding.json', import.meta.url))).units[0].lessons[0];

export default async ({ page, seed, touch, btn, shot, check }) => {
  await seed();
  await touch(page.locator('[data-course="coding"]')); await shot('home');
  await touch(btn(`Continue · ${first.title}`));
  for (const [i, item] of first.items.entries()) {
    await shot(`item${i}-${item.type}`);
    if (item.type === 'build') {
      for (const t of solve(item)) await touch(page.locator('.tiles').getByRole('button', { name: `Step ${t}`, exact: true }));
    }
    if (item.type === 'predict') {
      const [x, y] = answer(item);
      await touch(btn(`Column ${x + 1}, row ${y + 1}`));
    }
    await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
    if (item.type !== 'teach') {
      await shot(`item${i}-done`);
      check(`${item.id}: right first time`, await page.locator('.foot.right').count() === 1);
      const moved = await page.locator('.walker').evaluate((el) => el.style.transform);
      const [x, y] = parse(item.level).start;
      check(`${item.id}: Fennel walked off the start`, moved !== `translate(${x * 100}%, ${y * 100}%)`, moved);
    }
    await touch(btn('Continue', { exact: true }));
  }
  await shot('summary');
  check('Fennel is on the end screen', await page.locator('.summary svg.cast-fennel').count() === 1);
  await touch(btn('Continue', { exact: true })); await shot('home-after');

  // The tallest programs and maps as they mount, and a compact value to change answering a finger
  // that lands just above it: a pin with no pointer events marks the spot the real tap goes to.
  const items = JSON.parse(readFileSync(new URL('../../src/data/coding.json', import.meta.url))).units.flatMap((u) => u.lessons.flatMap((l) => l.items));
  for (const id of ['var-3-grow', 'bug-3-draw', 'draw-3-comb', 'bug-3-list']) {
    await page.evaluate(async (item) => {
      const { mount } = await import('/src/coding/exercise.js');
      const app = document.getElementById('app');
      app.innerHTML = '<header class="bar" style="height:44px"></header><main class="play"><div class="coach"><button class="who"></button><p class="bubble"></p></div><div class="stage"></div></main>';
      window.stopItem?.();
      window.stopItem = mount(app.querySelector('.stage'), item, { say(t) { app.querySelector('.bubble').textContent = t; }, done() {} });
    }, items.find((i) => i.id === id));
    await shot(id);
  }
  const b = await page.getByRole('button', { name: 'Change: Step up' }).boundingBox();
  await page.evaluate(([x, y]) => document.body.insertAdjacentHTML('beforeend', `<i id="pin" style="position:fixed;left:${x}px;top:${y}px;width:1px;height:1px;pointer-events:none"></i>`), [b.x + b.width / 2, b.y - 5]);
  await touch(page.locator('#pin'));
  await shot('changed-from-above');
  check(`a tap 5px above a ${Math.round(b.height)}px value picks it to change`, await page.locator('.program .block.hole').count() === 1);
};
