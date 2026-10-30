import { fennel, demo } from '../cast/fennel.js';
import { flower } from '../garden/art.js';
import { esc } from '../html.js';
import { move, play } from '../feel.js';
import { reached } from './program.js';

/**
 * The grid Fennel walks and the walking, for any item with a level (`parse` in program.js): Coding's
 * blocks and the code courses' chips both run here. `gridHtml(g)` draws it, and `walkerOn(world, g,
 * showValues)` gives { walk(result), backToStart(), cellAt([x, y]), stop() } for a `run()` result.
 */
const STEP_MS = 380;
const ROCK = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.2 8.6 Q.6 5.2 3 3.6 Q4.4 1.6 6.6 2.6 Q9 3.4 8.9 6.4 Q9.2 8.6 7.4 8.8 Z" fill="var(--rock)"/><path d="M3.2 4.4 Q4.6 3 6.4 3.6" fill="none" stroke="var(--rock-shine)" stroke-width=".7" stroke-linecap="round"/></svg>';

/** The grid in words, for a screen reader. */
function describe(g) {
  const at = ([x, y]) => `column ${x + 1}, row ${y + 1}`;
  const rocks = g.rows.flatMap((r, y) => r.map((c, x) => (c === '#' ? at([x, y]) : null))).filter(Boolean);
  return `A grid ${g.w} wide and ${g.h} high. Fennel at ${at(g.start)}${g.flowers.length ? `, ${g.flowers.length > 1 ? 'flowers' : 'the flower'} at ${g.flowers.map(at).join('; ')}` : ''}`
    + `${g.shape ? `, the shape to draw on ${g.shape.map(at).join('; ')}` : ''}`
    + `${rocks.length ? `, rocks at ${rocks.join('; ')}` : ''}.`;
}

export const gridHtml = (g) => `<div class="grid-world" style="--w:${g.w};--h:${g.h}" role="img" aria-label="${esc(describe(g))}">
      ${g.rows.flatMap((row, y) => row.map((c, x) => `<span class="cell${c === 'o' || (c === 'S' && g.shape) ? ' target' : ''}" data-x="${x}" data-y="${y}">${c === '#' ? ROCK : c === '*' ? flower('learn') : ''}</span>`)).join('')}
      <div class="walker" aria-hidden="true">${fennel('think')}</div>
    </div>`;

export function walkerOn(world, g, showValues = () => {}) {
  const walker = world.querySelector('.walker');
  const cellAt = ([x, y]) => world.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
  /** What standing on a square does: a value updates, a drawing grows, one of several flowers is picked. */
  const arrive = (result, i) => {
    showValues(result.values[i]);
    const cell = cellAt(result.path[i]);
    if (g.shape) cell.classList.add('trail');
    if (g.flowers.length > 1) cell.classList.add('picked');
  };
  let gone = false;
  const anims = [];
  const place = ([x, y]) => `translate(${x * 100}%, ${y * 100}%)`;
  walker.style.transform = place(g.start);

  let walkId = 0;
  /** Fennel walks `path` square by square, trotting, then reacts to how it ended. */
  const walk = async (result) => {
    const id = ++walkId;
    const off = () => gone || id !== walkId;
    const steps = result.path.length - 1;
    const trot = demo(walker.firstElementChild, 'walk', Math.max(steps, 1) * STEP_MS / 1000, Math.max(steps, 1));
    if (trot) anims.push(...trot);
    arrive(result, 0);
    for (let i = 1; i <= steps && !off(); i++) {
      const a = move(walker, [{ transform: place(result.path[i - 1]) }, { transform: place(result.path[i]) }], { duration: STEP_MS, easing: 'ease-in-out' });
      walker.style.transform = place(result.path[i]);
      if (a) { anims.push(a); await a.finished.catch(() => {}); if (off()) return; play('tap'); }
      arrive(result, i); // on landing: a count made before this step has been showing since it set off
    }
    if (off()) return;
    walker.innerHTML = fennel(reached(result) ? 'correct' : 'wrong');
    if (result.end === 'bump') {
      const [x, y] = result.path.at(-1), [bx, by] = result.bumped;
      const nudge = `translate(${(x + (bx - x) * 0.25) * 100}%, ${(y + (by - y) * 0.25) * 100}%)`;
      const a = move(walker, [{ transform: place([x, y]) }, { transform: nudge }, { transform: place([x, y]) }], { duration: 300 });
      if (a) { anims.push(a); await a.finished.catch(() => {}); }
    }
  };
  /** Stops a run part-way and stands Fennel back at the start. */
  const backToStart = () => {
    walkId++;
    anims.splice(0).forEach((a) => a.cancel());
    walker.style.transform = place(g.start);
    walker.innerHTML = fennel('think');
    for (const c of world.querySelectorAll('.trail, .picked')) c.classList.remove('trail', 'picked');
    showValues();
  };
  return { walk, backToStart, cellAt, stop: () => { gone = true; anims.forEach((a) => a.cancel()); } };
}
