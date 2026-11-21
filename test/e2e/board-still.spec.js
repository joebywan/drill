import { test, expect } from './fixtures.js';
import { subjects } from '../../src/subjects.js';
import { answer, hop, kind, meets, solutions, starPath, targets, load } from '../../src/chess/items.js';
import { startPuzzle, tryMove } from '../../src/chess/puzzle.js';

// "Feedback must not move the board": from the moment a chess item is asked until Continue, the board's top stays
// where it was, through a right answer, a wrong one, every move of a stars item and every word the coach says.

const chess = subjects.find((s) => s.id === 'chess');
const lessons = chess.units.flatMap((u) => u.lessons).filter((l) => !l.mix);
// Every item but the real-game puzzles, and the first puzzle of every sixth lesson that has them (they all say the same lines).
const puzzles = lessons.filter((l) => l.items.some((i) => kind(i) === 'find')).filter((_, n) => n % 6 === 0).map((l) => l.items.find((i) => kind(i) === 'find'));
const items = [...lessons.flatMap((l) => l.items).filter((i) => !['teach', 'find'].includes(kind(i))), ...puzzles];

const squares = 'abcdefgh'.split('').flatMap((f) => '12345678'.split('').map((r) => f + r));
const own = (fen) => squares.filter((sq) => load(fen).get(sq)?.color === fen.split(' ')[1]);

/** A puzzle's line as the player plays it, from the stored moves. */
function line(item) {
  const state = startPuzzle(item);
  const out = [];
  for (;;) {
    const m = item.moves[state.ply];
    out.push({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    if (tryMove(state, m.slice(0, 2), m.slice(2, 4), m[4]) !== 'next') return out;
  }
}

/** A move from `fen` the rules don't allow: a piece of the side to move onto an empty square it can't reach. */
function illegal(fen) {
  for (const from of own(fen)) {
    if (!targets(fen, from).length) continue;
    const to = squares.find((sq) => !load(fen).get(sq) && !targets(fen, from).includes(sq));
    if (to) return { from, to };
  }
  return null;
}

/** The taps that answer `item` right, or wrong (null when it has no wrong way to play), as a list of steps. */
function plays(item, right) {
  const k = kind(item);
  if (k === 'truefalse') return [{ button: (right ? answer(item) : !answer(item)) ? 'True' : 'False' }];
  if (k === 'tap') {
    if (right) return answer(item).map((sq) => ({ tap: sq }));
    const miss = squares.find((sq) => sq !== item.square && !answer(item).includes(sq));
    return [{ tap: miss }];
  }
  if (k === 'move') {
    if (right) { const m = solutions(item)[0]; return [{ from: m.from, to: m.to, promotion: m.promotion }]; }
    const wrong = load(item.fen).moves({ verbose: true }).find((m) => !m.promotion && !meets(item, m).correct);
    const bad = illegal(item.fen);
    return wrong ? [...(bad ? [bad] : []), { from: wrong.from, to: wrong.to }] : null;
  }
  if (k === 'stars') {
    if (right) return starPath(item);
    // A move the rules don't allow, then moves onto no star until the budget runs out.
    const steps = [];
    const bad = illegal(item.fen);
    if (bad) steps.push(bad);
    let fen = item.fen;
    for (let n = 0; n < item.moves; n++) {
      const m = own(fen).flatMap((from) => targets(fen, from).map((to) => ({ from, to }))).find((x) => !item.stars.includes(x.to) && hop(fen, { ...x, promotion: 'q' }) && !(load(fen).get(x.from).type === 'p' && /[18]$/.test(x.to)));
      if (!m) return null;
      steps.push(m);
      fen = hop(fen, m).fen;
    }
    return steps;
  }
  // find: two moves that aren't the line, then the line.
  if (right) return line(item);
  const state = startPuzzle(item);
  const fen = state.game.fen();
  const wrong = load(fen).moves({ verbose: true }).filter((m) => !m.promotion && tryMove(startPuzzle(item), m.from, m.to) === 'wrong').slice(0, 2);
  return [...wrong, ...line(item)];
}

for (const [width, height] of [[412, 786], [360, 640], [412, 533]]) {
  test(`a chess board never moves from asked to Continue, right or wrong, at ${width}x${height}`, async ({ page }) => {
    test.setTimeout(600000);
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const bad = [];
    for (const item of items) {
      for (const right of [true, false]) {
        const steps = plays(item, right);
        if (!steps) continue;
        await page.evaluate(async (item) => {
          const { mount } = await import('/src/chess/exercise.js');
          window.stopItem?.();
          const app = document.getElementById('app');
          app.innerHTML = `<header class="bar"><button class="close" aria-label="Quit lesson">✕</button><div class="meter"><div class="fill"></div></div></header>
            <main class="play"><p class="topic">Topic</p><div class="coach"><button class="who" aria-label="Rosa"></button><p class="bubble" id="said"></p></div><div class="stage"></div></main>
            <footer class="foot"><div class="verdict"><strong>Not quite.</strong><p></p></div><button class="next">Continue</button></footer>`;
          const foot = app.querySelector('.foot');
          window.stopItem = mount(app.querySelector('.stage'), item, {
            say: (t) => { app.querySelector('.bubble').textContent = t; },
            done: (r, text) => { foot.className = `foot show ${r ? 'right' : 'wrong'}`; foot.querySelector('p').textContent = text; },
          });
        }, item);
        // Asked: a piece's demo plays first, a puzzle's setup move comes a moment after.
        await page.waitForTimeout(item.demo ? 600 + 500 * item.demo.length + 600 : kind(item) === 'find' ? 700 : 100);
        const top = () => page.locator('div.board').evaluate((b) => b.getBoundingClientRect().top + scrollY); // on the page: a click Playwright scrolls to is not the board moving
        const asked = await top();
        const where = [];
        for (const step of steps) {
          if (step.button) await page.locator('.choices button', { hasText: step.button }).click();
          else if (step.tap) await page.locator(`.board rect[data-square="${step.tap}"]`).click();
          else {
            await page.locator(`.board rect[data-square="${step.from}"]`).click();
            await page.locator(`.board rect[data-square="${step.to}"]`).click();
            if (step.promotion) await page.locator('.promotion-dialog-button-group').first().click();
          }
          await page.waitForTimeout(kind(item) === 'find' || kind(item) === 'move' ? 600 : 60); // a reply comes after REPLY_DELAY
          where.push(await top());
        }
        await expect(page.locator('.foot.show'), `${item.id} ${right ? 'right' : 'wrong'} ends`).toBeAttached();
        where.push(await top());
        const moved = where.filter((t) => Math.abs(t - asked) > 0.5);
        if (moved.length) bad.push(`${item.id} (${right ? 'right' : 'wrong'}): asked at ${asked}, then ${where.map(Math.round).join(', ')}`);
      }
    }
    await page.evaluate(() => window.stopItem?.());
    expect(bad).toEqual([]);
  });
}
