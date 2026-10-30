import { ARROW, answer, armsOf, fill, fixBug, fromTree, holes, isBuilt, isStep, jsFace, kind, listKind, names, parse, punch, reached, runItem, solve, tileKind, tileName, toJS, writeLook } from './program.js';
import { builder } from '../builder.js';
import { gridHtml, walkerOn } from './grid.js';
import { dragTile } from '../drag.js';
import { flourish, play } from '../feel.js';
import { esc } from '../html.js';

const DEMO_WAIT_MS = 900; // long enough to see the grid before a teach card's program plays

/** The bubble's line for a failed run: a loop that never ends is said out loud, or it just looks stuck. */
const afterFail = (result) => (result.end === 'endless' ? 'That loop never ends, so I stopped it. Here is one way that works.'
  : result.end === 'spare' ? 'I got there with steps to spare. Here is one way that works.' : 'Here is one way that works.');

/**
 * Mounts one Coding item in `el` (the subject contract: see src/subjects.js). The grid sits on
 * top with Fennel standing on it, the program under it, and the tiles in the thumb zone where
 * Continue will appear. A build item runs the moment its last hole is filled: no Check button.
 * A bug item plays its failing run, then the same tile flow fills the block the learner taps.
 * Unscramble, palette and free items are laid out with src/builder.js and run on Run, the one Check.
 */
export function mount(el, item, { say, done }) {
  const g = parse(item.level || ['S']);
  el.innerHTML = `${gridHtml(g)}
    ${(item.program || item.way) && names(item.program ?? item.way, item.tiles, item.chips).length ? '<p class="vars" aria-label="Values"></p>' : ''}
    <div class="program" aria-label="Program"></div>
    <div class="choices tiles"></div>`;
  const world = el.querySelector('.grid-world');
  const programEl = el.querySelector('.program');
  const tilesEl = el.querySelector('.tiles');
  const varsEl = el.querySelector('.vars');
  const showValues = (now = {}) => {
    if (varsEl) varsEl.innerHTML = names(item.program ?? item.way, item.tiles, item.chips).map((n) => `<span class="var"><i>${esc(n)}</i> <b>${esc(String(now[n] ?? '?'))}</b></span>`).join('');
  };
  showValues();
  const { walk, backToStart, cellAt, stop } = walkerOn(world, g, showValues);
  const show = (program, picks = [], locked = true, tappable = null) => (item.view === 'js' ? '' : blocks(program, picks, locked, tappable))
    + (item.view ? code(program, picks, locked) : '');

  let gone = false;
  const cleanup = () => { gone = true; stop(); };

  if (kind(item) === 'teach') {
    if (!item.level) world.remove();
    if (item.program) {
      programEl.innerHTML = show(item.program);
      const wait = setTimeout(() => walk(runItem(item)), DEMO_WAIT_MS);
      say(item.text, 'teach');
      done(null);
      return () => { clearTimeout(wait); cleanup(); };
    }
    programEl.remove();
    say(item.text, 'teach');
    done(null);
    return cleanup;
  }

  /** Runs a finished program: Fennel walks it, a miss shows `oneWay()`, then the item is done. */
  const perform = async (program, oneWay) => {
    const result = runItem(item, program);
    say(reached(result) ? 'Here I go!' : 'Here I go...', 'think');
    await walk(result);
    if (gone) return;
    const right = reached(result);
    if (!right) {
      programEl.innerHTML = oneWay();
      programEl.classList.add('shown');
      say(afterFail(result), 'wrong');
    }
    flourish(programEl, right ? 'pop' : 'shake'); // the runner cues the sound and buzz
    done(right, item.explain);
  };

  if (isBuilt(item)) {
    tilesEl.classList.add('tray');
    const whole = item.type === 'unscramble';
    const runEl = document.createElement('button');
    runEl.className = 'next run';
    runEl.textContent = 'Run';
    runEl.disabled = true;
    const board = builder(programEl, tilesEl, {
      chips: item.chips.map((c) => ({
        face: tileFace(c), name: tileName(c), arms: holders(c),
        chipClass: typeof c === 'object' ? 'word' : '', placedClass: placedClass(c), uses: whole ? 1 : undefined,
      })),
      limit: item.limit,
      meter: item.limit ? (used, limit) => `${used} of ${limit} blocks` : null,
      onTap: () => play('tap'),
      onChange: (api) => { runEl.disabled = whole ? api.used() < item.chips.length : api.used() === 0; },
    });
    tilesEl.append(runEl);
    // A long answer scrolls inside the space between the map and the tray, so neither moves.
    programEl.style.maxHeight = `${tilesEl.getBoundingClientRect().top - programEl.getBoundingClientRect().top - 8}px`;
    runEl.addEventListener('click', async () => {
      runEl.disabled = true;
      board.lock();
      await perform(fromTree(board.tree(), item.chips), () => blocks(item.way, []));
      if (!gone) tilesEl.style.visibility = 'hidden'; // Continue takes the thumb zone
    });
    say(item.prompt, 'think');
    return cleanup;
  }

  if (kind(item) === 'predict') {
    programEl.innerHTML = show(item.program);
    tilesEl.remove();
    world.classList.add('picking');
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
        await walk(runItem(item));
        if (gone) return;
        cellAt(want).classList.add('right');
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
  tilesEl.innerHTML = item.tiles.map((t, i) => `<button class="choice tile${item.view ? ' code-tile' : typeof t === 'object' || tileKind(t) === 'look' || (tileKind(t) === 'count' && typeof t === 'string') ? ' word' : ''}" data-tile="${i}" aria-label="${esc(tileName(t))}">${esc(face(t))}</button>`).join('');
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
    await perform(fill(program, picks), () => {
      const fix = isBug ? fixBug(item) : null;
      return isBug ? show(punch(item.program, fix.part), [fix.tile]) : show(item.program, solve(item));
    });
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
  if (isBug) watch = setTimeout(() => walk(runItem(item)), DEMO_WAIT_MS);
  return () => { clearTimeout(watch); stops.forEach((stop) => stop()); cleanup(); };
}

const lookFace = (l) => (l === 'flower' ? 'flower' : `rock ${ARROW[l.slice(5)]}`);
const FACE_LOOK = { look: lookFace, op: String, n: String, not: 'not ', and: ' and ', or: ' or ' };
const tileFace = (t) => {
  if (typeof t === 'number') return String(t);
  if (typeof t === 'object') {
    if (t.define) return `new ${t.define}${t.params ? `(${t.params.join(', ')})` : ''}`;
    if ('repeat' in t) return `repeat ${t.repeat}`;
    if ('until' in t) return `until ${writeLook(t.until, FACE_LOOK)}`;
    if ('if' in t) return `if ${writeLook(t.if, FACE_LOOK)}`;
    if (t.each) return `each ${t.each}: ${t.in.map(tileFace).join(' ')}`;
    if (t.set) return `${t.set} = ${t.to}`;
    if (t.call) return `${t.call}${t.args ? `(${t.args.join(', ')})` : ''}`;
    if (t.go) return `go ${t.go}`;
    if (t.change) return `${t.change} ${t.by < 0 ? '-' : '+'} ${Math.abs(t.by)}`;
    return writeLook(t, FACE_LOOK);
  }
  const k = tileKind(t);
  return k === 'look' ? lookFace(t) : k === 'step' ? ARROW[t] : t;
};
/** A block as a chip's arm labels, and how it looks once placed. */
const holders = (c) => (typeof c === 'object' && armsOf(c).length ? armsOf(c).map((k) => (k === 'else' ? 'else' : '')) : undefined);
const placedClass = (c) => (typeof c !== 'object' ? 'block go' : 'if' in c ? 'block if' : armsOf(c).length ? `block loop${c.define ? ' def' : ''}` : c.call || c.go ? 'block go call' : 'block stmt');
const slotClass = (kind, t) => (kind === 'step' ? `go${typeof t === 'object' && t ? ' call' : ''}` : kind);

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
    if (v === null) { const h = hole++; return holeHtml(h, kind, picks[h], picks, locked, tileFace); }
    if (tappable?.has(kind)) return `<button class="block ${slotClass(kind, v)}" data-part="${n}" aria-label="Change: ${esc(tileName(v))}">${esc(tileFace(v))}</button>`;
    return kind === 'step' ? `<span role="img" class="block ${slotClass(kind, v)}" aria-label="${esc(tileName(v))}">${esc(tileFace(v))}</span>` : `<b>${esc(tileFace(v))}</b>`;
  };
  const look = (c) => writeLook(c, { look: (l) => slot('look', l), op: (o) => slot('op', o), n: (v) => slot('count', v), not: 'not ', and: ' and ', or: ' or ' });
  const inner = (list) => `<div class="inner">${walk(list)}</div>`;
  const walk = (list) => list.map((b) => {
    if (isStep(b)) return slot('step', b);
    if ('call' in b) return `<div class="block stmt"><span class="head">${esc(b.call)}(${b.args.map((a) => slot('count', a)).join(', ')})</span></div>`;
    if ('set' in b) return `<div class="block stmt"><span class="head">set ${esc(b.set)} to ${slot('count', b.to)}</span></div>`;
    if ('change' in b) return `<div class="block stmt"><span class="head">change ${esc(b.change)} by ${slot('count', b.by)}</span></div>`;
    if ('each' in b) return `<div class="block loop"><span class="head">for each ${esc(b.each)} in <span class="list">${b.in.map((v) => slot(listKind(b), v)).join('')}</span></span>${inner(b.do)}</div>`;
    if ('repeat' in b) return `<div class="block loop"><span class="head"><i>repeat</i> ${slot('count', b.repeat)} <i>times</i></span>${inner(b.do)}</div>`;
    if ('until' in b) return `<div class="block loop"><span class="head">repeat until ${look(b.until)}</span>${inner(b.do)}</div>`;
    if ('define' in b) return `<div class="block loop def"><span class="head">new block <b>${esc(b.define)}${b.params ? `(${b.params.map(esc).join(', ')})` : ''}</b></span>${inner(b.do)}</div>`;
    return `<div class="block if"><span class="head">if ${look(b.if)}</span>${inner(b.then)}`
      + (b.else.length ? `<span class="head">else</span>${inner(b.else)}` : '') + '</div>';
  }).join('');
  return walk(program);
}

/** The program as read-only JavaScript from `toJS`, with its holes as the same gaps the blocks use. */
function code(program, picks, locked = true) {
  const kinds = holes(program);
  const html = toJS(program).split('___').map(esc).reduce((all, text, i) => `${all}${holeHtml(i - 1, kinds[i - 1], picks[i - 1], picks, locked, jsFace)}${text}`);
  return `<pre class="code" aria-label="The program as JavaScript">${html}</pre>`;
}
