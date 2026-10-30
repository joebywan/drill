import { ARROW, answer, fill, holes, kind, parse, run, solve, tileKind } from './program.js';
import { fennel, demo } from '../cast/fennel.js';
import { flower } from '../garden/art.js';
import { dragTile } from '../drag.js';
import { flourish, move, play } from '../feel.js';
import { esc } from '../html.js';

const STEP_MS = 380;
const ROCK = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.2 8.6 Q.6 5.2 3 3.6 Q4.4 1.6 6.6 2.6 Q9 3.4 8.9 6.4 Q9.2 8.6 7.4 8.8 Z" fill="var(--rock)"/><path d="M3.2 4.4 Q4.6 3 6.4 3.6" fill="none" stroke="var(--rock-shine)" stroke-width=".7" stroke-linecap="round"/></svg>';

/**
 * Mounts one Coding item in `el` (the subject contract: see src/subjects.js). The grid sits on
 * top with Fennel standing on it, the program under it, and the tiles in the thumb zone where
 * Continue will appear. A build item runs the moment its last hole is filled: no Check button.
 */
export function mount(el, item, { say, done }) {
  const g = parse(item.level || ['S']);
  el.innerHTML = `<div class="grid-world" style="--w:${g.w};--h:${g.h}" role="img" aria-label="${esc(describe(g))}">
      ${g.rows.flatMap((row, y) => row.map((c, x) => `<span class="cell" data-x="${x}" data-y="${y}">${c === '#' ? ROCK : c === '*' ? flower('learn') : ''}</span>`)).join('')}
      <div class="walker" aria-hidden="true">${fennel('think')}</div>
    </div>
    <div class="program" aria-label="Program"></div>
    <div class="choices tiles"></div>`;
  const world = el.querySelector('.grid-world');
  const walker = world.querySelector('.walker');
  const programEl = el.querySelector('.program');
  const tilesEl = el.querySelector('.tiles');
  let gone = false;
  const anims = [];
  const place = ([x, y]) => `translate(${x * 100}%, ${y * 100}%)`;
  walker.style.transform = place(g.start);

  /** Fennel walks `path` square by square, trotting, then reacts to how it ended. */
  const walk = async (result) => {
    const steps = result.path.length - 1;
    const trot = demo(walker.firstElementChild, 'walk', Math.max(steps, 1) * STEP_MS / 1000, Math.max(steps, 1));
    if (trot) anims.push(...trot);
    for (let i = 1; i <= steps && !gone; i++) {
      const a = move(walker, [{ transform: place(result.path[i - 1]) }, { transform: place(result.path[i]) }], { duration: STEP_MS, easing: 'ease-in-out' });
      walker.style.transform = place(result.path[i]);
      if (a) { anims.push(a); await a.finished.catch(() => {}); play('tap'); }
    }
    if (gone) return;
    walker.innerHTML = fennel(result.end === 'flower' ? 'correct' : 'wrong');
    if (result.end === 'bump') {
      const [x, y] = result.path.at(-1), [bx, by] = result.bumped;
      const nudge = `translate(${(x + (bx - x) * 0.25) * 100}%, ${(y + (by - y) * 0.25) * 100}%)`;
      const a = move(walker, [{ transform: place([x, y]) }, { transform: nudge }, { transform: place([x, y]) }], { duration: 300 });
      if (a) { anims.push(a); await a.finished.catch(() => {}); }
    }
  };

  const cleanup = () => { gone = true; anims.forEach((a) => a.cancel()); };

  if (kind(item) === 'teach') {
    if (!item.level) world.remove();
    programEl.remove();
    say(item.text, 'teach');
    done(null);
    return cleanup;
  }

  if (kind(item) === 'predict') {
    programEl.innerHTML = blocks(item.program, []);
    tilesEl.remove();
    const want = answer(item);
    const cells = [...world.querySelectorAll('.cell')];
    for (const c of cells) {
      const b = document.createElement('button');
      b.className = 'cell-pick';
      b.setAttribute('aria-label', `Column ${+c.dataset.x + 1}, row ${+c.dataset.y + 1}`);
      c.append(b);
      b.addEventListener('click', async () => {
        for (const o of world.querySelectorAll('.cell-pick')) o.disabled = true;
        const right = +c.dataset.x === want[0] && +c.dataset.y === want[1];
        c.classList.add(right ? 'right' : 'wrong');
        await walk(run(item.level, item.program));
        if (gone) return;
        world.querySelector(`.cell[data-x="${want[0]}"][data-y="${want[1]}"]`).classList.add('right');
        flourish(c, right ? 'pop' : 'shake'); // the runner cues the sound and buzz
        done(right, item.explain);
      });
    }
    cells[0].querySelector('button').autofocus = true;
    say(item.prompt, 'think');
    return cleanup;
  }

  // build: tap a tile into the first hole it fits, or drag it into any; tap a filled hole to empty it.
  const kinds = holes(item.program);
  const picks = Array(kinds.length).fill(null);
  const firstFor = (t) => kinds.findIndex((k, n) => k === tileKind(t) && picks[n] === null);
  tilesEl.innerHTML = item.tiles.map((t, i) => `<button class="choice tile" data-tile="${i}" aria-label="${esc(tileName(t))}">${esc(tileFace(t))}</button>`).join('');
  const paint = (shown = picks, locked = false) => {
    programEl.innerHTML = blocks(item.program, shown, locked);
    for (const b of tilesEl.children) b.disabled = locked || firstFor(item.tiles[b.dataset.tile]) < 0;
    for (const b of programEl.querySelectorAll('button[data-hole]')) {
      b.addEventListener('click', () => { picks[b.dataset.hole] = null; play('tap'); paint(); });
    }
  };
  const put = async (n, tile, b) => {
    picks[n] = tile;
    play('tap');
    flourish(b, 'pop');
    if (picks.includes(null)) { paint(); return; }
    paint(picks, true);
    const result = run(item.level, fill(item.program, picks));
    say(result.end === 'flower' ? 'Here I go!' : 'Here I go...', 'think');
    await walk(result);
    if (gone) return;
    const right = result.end === 'flower';
    if (!right) {
      programEl.innerHTML = blocks(item.program, solve(item), true);
      programEl.classList.add('shown');
    }
    if (!right) say('Here is one way that works.', 'wrong');
    flourish(programEl, right ? 'pop' : 'shake'); // the runner cues the sound and buzz
    done(right, item.explain);
  };
  const stops = [...tilesEl.children].map((b) => {
    const tile = item.tiles[b.dataset.tile];
    b.addEventListener('click', () => put(firstFor(tile), tile, b));
    return dragTile(b, {
      targets: () => [...programEl.querySelectorAll('[data-hole]')].filter((h) => kinds[h.dataset.hole] === tileKind(tile)),
      drop: (h) => put(+h.dataset.hole, tile, b),
    });
  });
  paint();
  say(item.prompt, 'think');
  return () => { stops.forEach((stop) => stop()); cleanup(); };
}

const tileFace = (t) => (typeof t === 'number' ? `${t}×` : ARROW[t]);
const tileName = (t) => (typeof t === 'number' ? `${t} times` : `Step ${t}`);

/** The program as nested blocks. Holes show their pick (a button that empties it) or a gap to fill. */
function blocks(program, picks, locked = true) {
  let i = 0;
  const hole = (k) => {
    const n = i++;
    const v = picks[n];
    if (v == null) return `<span role="img" class="block hole${n === picks.indexOf(null) && !locked ? ' fill-next' : ''}"${locked ? '' : ` data-hole="${n}"`} aria-label="Empty ${k === 'count' ? 'count' : 'step'}"></span>`;
    const face = k === 'count' ? String(v) : ARROW[v];
    return locked ? `<span role="img" class="block ${k === 'step' ? 'go' : k} filled" aria-label="${esc(tileName(v))}">${esc(face)}</span>`
      : `<button class="block ${k === 'step' ? 'go' : k} filled" data-hole="${n}" aria-label="${esc(tileName(v))}, tap to take out">${esc(face)}</button>`;
  };
  const walk = (list) => list.map((b) => {
    if (b === null) return hole('step');
    if (typeof b === 'string') return `<span role="img" class="block go" aria-label="${esc(tileName(b))}">${ARROW[b]}</span>`;
    if ('repeat' in b) {
      const count = b.repeat === null ? hole('count') : `<b>${b.repeat}</b>`;
      return `<div class="block loop"><span class="head">repeat ${count} times</span><div class="inner">${walk(b.do)}</div></div>`;
    }
    const way = b.if.replace('rock-', '');
    return `<div class="block if"><span class="head">if rock ${ARROW[way]}</span><div class="inner">${walk(b.then)}</div>`
      + `<span class="head">else</span><div class="inner">${walk(b.else)}</div></div>`;
  }).join('');
  return walk(program);
}

/** The grid in words, for a screen reader. */
function describe(g) {
  const at = ([x, y]) => `column ${x + 1}, row ${y + 1}`;
  const rocks = g.rows.flatMap((r, y) => r.map((c, x) => (c === '#' ? at([x, y]) : null))).filter(Boolean);
  return `A grid ${g.w} wide and ${g.h} high. Fennel at ${at(g.start)}${g.flower ? `, the flower at ${at(g.flower)}` : ''}`
    + `${rocks.length ? `, rocks at ${rocks.join('; ')}` : ''}.`;
}
