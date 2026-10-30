import { ARROW, answer, changed, fill, fixBug, holes, jsFace, kind, parse, punch, run, solve, tileKind, tileName, toJS } from './program.js';
import { fennel, demo } from '../cast/fennel.js';
import { flower } from '../garden/art.js';
import { dragTile } from '../drag.js';
import { flourish, move, play } from '../feel.js';
import { esc } from '../html.js';

const STEP_MS = 380;
const DEMO_WAIT_MS = 900; // long enough to see the grid before a teach card's program plays
const ROCK = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.2 8.6 Q.6 5.2 3 3.6 Q4.4 1.6 6.6 2.6 Q9 3.4 8.9 6.4 Q9.2 8.6 7.4 8.8 Z" fill="var(--rock)"/><path d="M3.2 4.4 Q4.6 3 6.4 3.6" fill="none" stroke="var(--rock-shine)" stroke-width=".7" stroke-linecap="round"/></svg>';

/** The bubble's line for a failed run: a loop that never ends is said out loud, or it just looks stuck. */
const afterFail = (result) => (result.end === 'endless' ? 'That loop never ends, so I stopped it. Here is one way that works.' : 'Here is one way that works.');

/**
 * Mounts one Coding item in `el` (the subject contract: see src/subjects.js). The grid sits on
 * top with Fennel standing on it, the program under it, and the tiles in the thumb zone where
 * Continue will appear. A build item runs the moment its last hole is filled: no Check button.
 * A bug item plays its failing run, then the same tile flow fills the block the learner taps.
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

  let walkId = 0;
  /** Fennel walks `path` square by square, trotting, then reacts to how it ended. */
  const walk = async (result) => {
    const id = ++walkId;
    const off = () => gone || id !== walkId;
    const steps = result.path.length - 1;
    const trot = demo(walker.firstElementChild, 'walk', Math.max(steps, 1) * STEP_MS / 1000, Math.max(steps, 1));
    if (trot) anims.push(...trot);
    for (let i = 1; i <= steps && !off(); i++) {
      const a = move(walker, [{ transform: place(result.path[i - 1]) }, { transform: place(result.path[i]) }], { duration: STEP_MS, easing: 'ease-in-out' });
      walker.style.transform = place(result.path[i]);
      if (a) { anims.push(a); await a.finished.catch(() => {}); play('tap'); }
    }
    if (off()) return;
    walker.innerHTML = fennel(result.end === 'flower' ? 'correct' : 'wrong');
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
  };
  const show = (program, picks = [], locked = true, tappable = null) => (item.view === 'js' ? '' : blocks(program, picks, locked, tappable))
    + (item.view ? code(program, picks, locked) : '');

  const cleanup = () => { gone = true; anims.forEach((a) => a.cancel()); };

  if (kind(item) === 'teach') {
    if (!item.level) world.remove();
    if (item.program) {
      programEl.innerHTML = show(item.program);
      const wait = setTimeout(() => walk(run(item.level, item.program)), DEMO_WAIT_MS);
      say(item.text, 'teach');
      done(null);
      return () => { clearTimeout(wait); cleanup(); };
    }
    programEl.remove();
    say(item.text, 'teach');
    done(null);
    return cleanup;
  }

  if (kind(item) === 'predict') {
    programEl.innerHTML = show(item.program);
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
  // bug: the same, once the block to change has been tapped. Until then there is no hole to fill.
  const isBug = kind(item) === 'bug';
  const offered = isBug ? new Set(item.tiles.map(tileKind)) : null;
  let program = item.program;
  let kinds = holes(program);
  let picks = Array(kinds.length).fill(null);
  const firstFor = (t) => kinds.findIndex((k, n) => k === tileKind(t) && picks[n] === null);
  const face = (t) => (item.view ? jsFace(t) : tileFace(t));
  tilesEl.innerHTML = item.tiles.map((t, i) => `<button class="choice tile${item.view ? ' code-tile' : t.call || tileKind(t) === 'look' ? ' word' : ''}" data-tile="${i}" aria-label="${esc(tileName(t))}">${esc(face(t))}</button>`).join('');
  let watch = null;
  const paint = (shown = picks, locked = false) => {
    programEl.innerHTML = show(program, shown, locked, locked ? null : offered);
    for (const b of tilesEl.children) b.disabled = locked || firstFor(item.tiles[b.dataset.tile]) < 0;
    for (const b of programEl.querySelectorAll('button[data-hole]')) {
      b.addEventListener('click', () => { picks[b.dataset.hole] = null; play('tap'); paint(); });
    }
    for (const b of programEl.querySelectorAll('button[data-part]')) {
      b.addEventListener('click', () => {
        clearTimeout(watch);
        backToStart();
        program = punch(item.program, +b.dataset.part);
        kinds = holes(program);
        picks = [null];
        play('tap');
        paint();
      });
    }
  };
  const put = async (n, tile, b) => {
    picks[n] = tile;
    play('tap');
    flourish(b, 'pop');
    if (picks.includes(null)) { paint(); return; }
    paint(picks, true);
    const result = run(item.level, fill(program, picks));
    say(result.end === 'flower' ? 'Here I go!' : 'Here I go...', 'think');
    await walk(result);
    if (gone) return;
    const right = result.end === 'flower';
    if (!right) {
      const fix = isBug ? fixBug(item) : null;
      programEl.innerHTML = isBug ? show(punch(item.program, fix.part), [fix.tile]) : show(item.program, solve(item));
      programEl.classList.add('shown');
      say(afterFail(result), 'wrong');
    }
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
  if (isBug) watch = setTimeout(() => walk(run(item.level, item.program)), DEMO_WAIT_MS);
  return () => { clearTimeout(watch); stops.forEach((stop) => stop()); cleanup(); };
}

const tileFace = (t) => (typeof t === 'number' ? `${t}×`
  : t.call ?? (t === 'flower' ? 'flower' : t.startsWith('rock-') ? `rock ${ARROW[t.slice(5)]}` : ARROW[t]));
const slotFace = (t) => (typeof t === 'number' ? String(t) : tileFace(t));
const slotClass = (kind, t) => (kind === 'step' ? `go${t?.call ? ' call' : ''}` : kind);

/** One hole: a gap to fill, or its pick (a button that empties it). `faceOf` is how the pick reads. */
function holeHtml(n, kind, pick, picks, locked, faceOf) {
  if (pick == null) return `<span role="img" class="block hole${n === picks.indexOf(null) && !locked ? ' fill-next' : ''}"${locked ? '' : ` data-hole="${n}"`} aria-label="Empty ${kind}"></span>`;
  return locked ? `<span role="img" class="block ${slotClass(kind, pick)} filled" aria-label="${esc(tileName(pick))}">${esc(faceOf(pick))}</span>`
    : `<button class="block ${slotClass(kind, pick)} filled" data-hole="${n}" aria-label="${esc(tileName(pick))}, tap to take out">${esc(faceOf(pick))}</button>`;
}

/**
 * The program as nested blocks. Holes show their pick or a gap to fill. With `tappable` (a set of
 * slot kinds), a filled slot of those kinds is a button that picks it as the block to change.
 */
function blocks(program, picks, locked = true, tappable = null) {
  let hole = 0;
  let part = 0;
  const slot = (kind, v) => {
    const n = part++;
    if (v === null) { const h = hole++; return holeHtml(h, kind, picks[h], picks, locked, slotFace); }
    if (tappable?.has(kind)) return `<button class="block ${slotClass(kind, v)}" data-part="${n}" aria-label="Change: ${esc(tileName(v))}">${esc(slotFace(v))}</button>`;
    return kind === 'step' ? `<span role="img" class="block ${slotClass(kind, v)}" aria-label="${esc(tileName(v))}">${esc(slotFace(v))}</span>` : `<b>${esc(slotFace(v))}</b>`;
  };
  const inner = (list) => `<div class="inner">${walk(list)}</div>`;
  const walk = (list) => list.map((b) => {
    if (b === null || typeof b === 'string' || 'call' in b) return slot('step', b);
    if ('repeat' in b) return `<div class="block loop"><span class="head">repeat ${slot('count', b.repeat)} times</span>${inner(b.do)}</div>`;
    if ('until' in b) return `<div class="block loop"><span class="head">repeat until ${slot('look', b.until)}</span>${inner(b.do)}</div>`;
    if ('define' in b) return `<div class="block loop def"><span class="head">new block <b>${esc(b.define)}</b></span>${inner(b.do)}</div>`;
    return `<div class="block if"><span class="head">if ${slot('look', b.if)}</span>${inner(b.then)}`
      + `<span class="head">else</span>${inner(b.else)}</div>`;
  }).join('');
  return walk(program);
}

/** The program as read-only JavaScript from `toJS`, with its holes as the same gaps the blocks use. */
function code(program, picks, locked = true) {
  const kinds = holes(program);
  const html = toJS(program).split('___').map(esc).reduce((all, text, i) => `${all}${holeHtml(i - 1, kinds[i - 1], picks[i - 1], picks, locked, jsFace)}${text}`);
  return `<pre class="code" aria-label="The program as JavaScript">${html}</pre>`;
}

/** The grid in words, for a screen reader. */
function describe(g) {
  const at = ([x, y]) => `column ${x + 1}, row ${y + 1}`;
  const rocks = g.rows.flatMap((r, y) => r.map((c, x) => (c === '#' ? at([x, y]) : null))).filter(Boolean);
  return `A grid ${g.w} wide and ${g.h} high. Fennel at ${at(g.start)}${g.flower ? `, the flower at ${at(g.flower)}` : ''}`
    + `${rocks.length ? `, rocks at ${rocks.join('; ')}` : ''}.`;
}
