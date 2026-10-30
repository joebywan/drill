import { Chess } from 'chess.js';
import { MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers.js';
import { ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows.js';
import { PromotionDialog } from 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js';
import { board, cantMove, pop, withDots } from './exercise.js';
import { TIERS, dailyIndex, entry, mistake, sideName, teach } from './mate.js';
import { HIT_MS, RUN_MS, hunted, play as playCapture, start as startCapture } from './capture.js';
import { HINT, LEVELS, thinking } from './engine.js';
import { words } from './items.js';
import { uci } from './puzzle.js';
import { rosa } from '../cast/rosa.js';
import { GAME_WORDS } from '../cast/lines.js';
import { cue, play } from '../feel.js';
import { today } from '../progress.js';

/**
 * Chess's replayable modes. Each is a session of one entry for run() in app.js, which gives it the
 * coach, the bubble and the ✕. Their mount never calls done, so nothing is scored, scheduled or
 * logged: a game ends on its own banner, whose button is run()'s `.next`, which mounts it afresh.
 */
const ROSA = { draw: rosa, name: 'Rosa', start: 'think' };
const game = (id, label, mount) => ({ id, label, entry: { subject: { kind: 'game', habit: 'learn', coach: ROSA, mount }, topic: label, item: {} } });

const LAND = 120; // ms for a dropped piece to land before the board is redrawn from the rules
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];
const stored = (key, dflt) => { try { return JSON.parse(localStorage.getItem(key)) ?? dflt; } catch { return dflt; } };
const store = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* lasts the visit */ } };

/** The fixed banner: nothing on the page moves. Its button runs the mode again. */
function banner(tone, head, text, label) {
  const foot = document.querySelector('.foot');
  foot.className = `foot show ${tone}`;
  foot.querySelector('strong').textContent = head;
  foot.querySelector('p').textContent = text;
  const next = foot.querySelector('.next');
  next.textContent = label;
  next.setAttribute('aria-describedby', 'verdict');
  next.focus();
}

/** The session bar's lesson meter means nothing here. */
const noMeter = () => { const m = document.querySelector('.bar .meter'); if (m) m.hidden = true; };

const mark = (b, squares) => {
  b.removeMarkers(MARKER_TYPE.square);
  for (const sq of squares) b.addMarker(MARKER_TYPE.square, sq);
};

// The prover, off the main thread (prover-worker.js). The searches on a shipped position take
// up to about 200 ms on a desktop, longer on a phone after a wild move.
let worker;
const asked = new Map();
let asks = 0;
function ask(fn, ...args) {
  worker ??= Object.assign(new Worker(new URL('./prover-worker.js', import.meta.url), { type: 'module' }), {
    onmessage: ({ data: { id, result } }) => { asked.get(id)(result); asked.delete(id); },
  });
  return new Promise((resolve) => {
    asked.set(++asks, resolve);
    worker.postMessage({ id: asks, fn, args });
  });
}

const W = GAME_WORDS;
let positions;

/**
 * Mate: three tiers, today's board first and then fresh ones. The opponent's reply comes from the
 * prover. A move that gives the mate up is not refused: it plays out, Rosa says so at once, and Undo
 * takes it back. Hint nudges, then explains; the player still moves.
 */
function mountMate(el, item, { say }) {
  noMeter();
  el.innerHTML = `<div class="game-tabs" role="group" aria-label="How many moves">${TIERS.map((n) =>
    `<button class="course" data-tier="${n}">${W.mate.tier(n)}</button>`).join('')}</div>
    <div class="board"></div>
    <div class="choices game-actions"><button class="choice" data-hint>${W.mate.hint}</button><button class="choice" data-undo>${W.mate.undo}</button><button class="choice" data-fresh>${W.mate.fresh}</button></div>
    <p class="game-note" aria-live="polite"></p>`;
  const boardEl = el.querySelector('.board');
  const note = el.querySelector('.game-note');
  const [hintBtn, undoBtn] = ['[data-hint]', '[data-undo]'].map((s) => el.querySelector(s));
  let b, gone = false, round = 0; // `round` goes up on anything that makes an answer from the prover stale
  let tier = stored('drill.mate.tier', 2);
  const again = item.again; // the banner's "Another board": a fresh one, not today's
  item.again = false;
  let daily, stack, still, dead, hintStep;

  const fen = () => stack.at(-1).fen;
  const shown = () => {
    b.setPosition(fen(), true);
    const m = stack.at(-1).last;
    mark(b, m && m !== '-' ? [m.slice(0, 2), m.slice(2, 4)] : []);
  };
  const ready = () => {
    undoBtn.disabled = stack.length < 2 && !dead;
    hintBtn.textContent = W.mate.hint;
    hintBtn.disabled = false;
    hintStep = 0;
    b.removeMarkers(MARKER_TYPE.framePrimary);
    b.removeMarkers(MARKER_TYPE.circlePrimary);
    note.textContent = '';
  };
  const prove = async () => {
    const mine = round;
    const res = await ask('forcedMate', fen(), tier - (stack.length - 1));
    if (mine === round) still = res;
    return mine === round;
  };

  const input = () => withDots(b, fen, ({ squareFrom: from, squareTo: to }) => {
    const probe = new Chess(fen());
    const piece = probe.get(from);
    const promoting = piece?.type === 'p' && (to[1] === '8' || to[1] === '1');
    const legal = probe.moves({ square: from, verbose: true }).some((m) => m.to === to);
    if (!legal) { say(cantMove(piece?.type), 'think'); return false; }
    if (promoting) {
      b.disableMoveInput();
      b.showPromotionDialog(to, piece.color, ({ piece: chosen }) => {
        if (chosen) commit(from + to + chosen[1]);
        else { b.setPosition(fen()); open(); }
      });
      return true;
    }
    commit(from + to);
    return true;
  });
  const open = () => { b.disableMoveInput(); b.enableMoveInput(input(), b.getOrientation()); };

  async function commit(m) {
    const mine = ++round;
    const before = fen();
    const g = new Chess(before);
    g.move(uci(m));
    b.disableMoveInput();
    play('tap');
    ready();
    mark(b, [m.slice(0, 2), m.slice(2, 4)]);
    undoBtn.disabled = true;
    hintBtn.disabled = true;
    await delay(LAND);
    if (mine !== round) return;
    b.setPosition(g.fen(), true); // squares like castling and promotion, redrawn from the rules
    const left = tier - stack.length;
    if (g.isCheckmate()) return solved(stack.length);
    if (!left || g.isStalemate()) {
      stack.push({ fen: g.fen(), last: m });
      dead = mistake(before, m, left);
      return slip();
    }
    const [reply] = await Promise.all([ask('defence', g.fen(), left), delay(350)]);
    if (mine !== round) return;
    const r = g.move(uci(reply));
    stack.push({ fen: g.fen(), last: reply });
    shown();
    mark(b, [r.from, r.to]);
    if (!(await prove())) return;
    if (!still) {
      dead = mistake(before, m, left);
      return slip();
    }
    say(W.mate.onward(still.inMoves), 'think');
    ready();
    open();
  }
  const slip = () => { say(dead, 'struggling'); undoBtn.disabled = false; hintBtn.disabled = true; };

  function solved(n) {
    if (daily) {
      const seen = stored('drill.mate.daily', {});
      store('drill.mate.daily', { date: today(), tiers: [...(seen.date === today() ? seen.tiers : []), tier] });
    }
    item.again = true;
    cue('done');
    say(W.mate.solved(n), 'complete');
    banner('right', pickOf(W.mate.solvedHead), W.mate.solved(n), W.mate.again);
  }

  function begin(n, fresh = false) {
    round++;
    tier = n;
    store('drill.mate.tier', n);
    for (const t of el.querySelectorAll('[data-tier]')) t.setAttribute('aria-pressed', Number(t.dataset.tier) === n);
    const seen = stored('drill.mate.daily', {});
    daily = !fresh && !(seen.date === today() && seen.tiers.includes(n));
    const list = positions[n];
    const first = entry(list[daily ? dailyIndex(today(), n, list.length) : Math.floor(Math.random() * list.length)]);
    stack = [first];
    dead = null;
    still = undefined;
    b?.destroy();
    b = board(boardEl, first.fen, first.fen.split(' ')[1], [{ class: PromotionDialog }]);
    shown();
    ready();
    say((daily ? W.mate.today : W.mate.another)(sideName(first.fen), n), 'think');
    open();
    prove();
  }

  hintBtn.addEventListener('click', async () => {
    if (still === undefined) say(W.mate.busy, 'think');
    while (still === undefined) { await delay(50); if (gone) return; }
    if (!still) return;
    const step = teach(fen(), still);
    if (hintStep === 0) {
      say(step.nudge, 'teach');
      b.addMarker(MARKER_TYPE.framePrimary, step.from);
      hintBtn.textContent = W.mate.explain;
      hintStep = 1;
    } else {
      note.textContent = step.explain;
      b.addMarker(MARKER_TYPE.circlePrimary, step.from);
      b.addMarker(MARKER_TYPE.circlePrimary, step.to);
      hintBtn.disabled = true;
    }
  });
  undoBtn.addEventListener('click', () => {
    round++;
    if (stack.length > 1) stack.pop();
    dead = null;
    still = undefined;
    shown();
    ready();
    say(W.mate.back(tier - (stack.length - 1)), 'think');
    open();
    prove();
  });
  el.querySelector('[data-fresh]').addEventListener('click', () => begin(tier, true));
  for (const t of el.querySelectorAll('[data-tier]')) t.addEventListener('click', () => begin(Number(t.dataset.tier)));

  (async () => {
    positions ??= (await import('../data/mate.json', { with: { type: 'json' } })).default;
    if (!gone) begin(tier, again);
  })();
  return () => { gone = true; round++; b?.destroy(); };
}

const clockText = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Scramble (capture.js). The clock starts on the first move and rests while the page is hidden. */
function mountCapture(el, item, { say }) {
  noMeter();
  const best = stored('drill.capture.best', 0);
  el.innerHTML = `<div class="hud"><span class="hud-clock" role="timer">${clockText(RUN_MS)}</span><b class="hud-score">0</b><span class="hud-best">${W.capture.best(best)}</span></div><div class="board"></div>`;
  const [clockEl, scoreEl] = ['.hud-clock', '.hud-score'].map((s) => el.querySelector(s));
  let state = startCapture();
  let left = RUN_MS, ticking, last, timer;
  const b = board(el.querySelector('.board'), state.fen, 'w');
  const frame = () => { b.removeMarkers(MARKER_TYPE.frameDanger); b.addMarker(MARKER_TYPE.frameDanger, hunted(state.fen)); };
  frame();
  say(W.capture.ready, 'think');

  const tick = () => {
    const now = Date.now();
    if (!document.hidden) left -= now - last;
    last = now;
    clockEl.textContent = clockText(left);
    if (left <= 0) finish();
  };
  const finish = () => {
    clearInterval(ticking);
    b.disableMoveInput();
    const { score } = state;
    if (score > best) store('drill.capture.best', score);
    cue('done');
    say(W.capture.time, 'complete');
    banner(score > best ? 'right' : '', W.capture.score(score),
      score > best ? (best ? W.capture.newBest(best) : W.capture.first) : W.capture.oldBest(best), W.capture.again);
  };

  b.enableMoveInput(withDots(b, () => state.fen, ({ squareFrom: from, squareTo: to }) => {
    const result = playCapture(state, { from, to });
    if (!result) { say(cantMove(b.getPiece(from)?.[1]), 'think'); return false; }
    if (!ticking) { last = Date.now(); ticking = setInterval(tick, 200); }
    state = result.state;
    scoreEl.textContent = state.score;
    if (result.took) {
      pop(b, to);
      play(state.chain >= 2 ? 'right' : 'tap');
      say(state.chain >= 2 ? W.capture.chain(state.chain) : pickOf(W.capture.taken), 'correct');
    }
    if (result.hit) {
      left -= HIT_MS;
      clockEl.textContent = clockText(left);
      cue('wrong');
      say(W.capture.hit, 'struggling');
    } else if (!result.took) say(W.capture.quiet, 'think');
    clearTimeout(timer);
    timer = setTimeout(() => { // once the piece has landed: arrivals and any hit, from the rules
      b.setPosition(state.fen, true);
      frame();
      if (result.hit) b.addArrow(ARROW_TYPE.danger, result.hit.from, result.hit.to);
      else b.removeArrows();
    }, LAND);
    return true;
  }), 'w');

  return () => { clearInterval(ticking); clearTimeout(timer); b.destroy(); };
}

/** Play Rosa: a level, then a full game. You change colour each game. */
function mountRosa(el, item, { say }) {
  noMeter();
  el.innerHTML = `<div class="board"></div><div class="choices game-actions"></div><p class="game-note" aria-live="polite"></p>`;
  const [boardEl, actions] = [el.querySelector('.board'), el.querySelector('.choices')];
  const colour = item.colour ?? 'w';
  item.colour = colour === 'w' ? 'b' : 'w';
  const g = new Chess();
  const b = board(boardEl, g.fen(), colour);
  let level, thinker, timer, gone = false;

  const stopThinking = () => { thinker?.cancel(); thinker = null; };
  const refresh = (from, to) => {
    b.setPosition(g.fen(), true);
    b.removeArrows();
    mark(b, from ? [from, to] : []);
  };
  const end = () => {
    if (!g.isGameOver()) return false;
    const won = g.isCheckmate() && g.turn() !== colour;
    const words_ = !g.isCheckmate() ? W.rosa.drawn : won ? W.rosa.won : W.rosa.beaten;
    finish(words_, won ? 'right' : '', won ? 'correct' : 'complete');
    return true;
  };
  const finish = (words_, tone, mood) => {
    b.disableMoveInput();
    stopThinking();
    for (const x of actions.children) x.disabled = true;
    cue('done');
    const head = pickOf(words_.head);
    say(head, mood);
    banner(tone, head, words_.text, W.rosa.again);
  };

  const rosaMoves = async () => {
    b.disableMoveInput();
    say(W.rosa.thinking, 'think');
    const shownAt = Date.now();
    thinker = thinking(g, LEVELS[level]);
    const mine = thinker;
    const san = await mine.result;
    if (gone || thinker !== mine) return;
    await delay(Math.max(0, 400 - (Date.now() - shownAt))); // a reply that lands at once reads as no reply
    if (gone || thinker !== mine) return;
    thinker = null;
    const m = g.move(san);
    refresh(m.from, m.to);
    if (end()) return;
    say(g.inCheck() ? W.rosa.check : W.rosa.played(words(m.san).replace(/, check$/, '')), 'teach');
    open();
  };
  const input = withDots(b, () => g.fen(), ({ squareFrom: from, squareTo: to }) => {
    let m;
    const type = g.get(from)?.type;
    // ponytail: promotion is always a queen, as in the lessons; Mate has the picker where it can matter.
    try { m = g.move({ from, to, promotion: 'q' }); } catch { say(cantMove(type), 'think'); return false; }
    play('tap');
    stopThinking(); // a hint still working on the old position
    b.removeArrows();
    note.textContent = '';
    clearTimeout(timer);
    timer = setTimeout(() => {
      refresh(m.from, m.to);
      if (!end()) rosaMoves();
    }, LAND);
    b.disableMoveInput();
    return true;
  });
  const note = el.querySelector('.game-note');
  const open = () => { b.disableMoveInput(); b.enableMoveInput(input, colour === 'w' ? 'w' : 'b'); };

  function playing() {
    const helps = LEVELS[level].helps;
    actions.innerHTML = `${helps ? `<button class="choice" data-hint>${W.rosa.hint}</button><button class="choice" data-back>${W.rosa.takeBack}</button>` : ''}<button class="choice" data-resign>${W.rosa.resign}</button>`;
    actions.querySelector('[data-hint]')?.addEventListener('click', async () => {
      if (g.turn() !== colour || thinker) return;
      say(W.rosa.hinting, 'think');
      const mine = thinker = thinking(g, HINT);
      const san = await mine.result;
      if (gone || thinker !== mine) return;
      thinker = null;
      const m = new Chess(g.fen()).move(san);
      b.removeArrows();
      b.addArrow(ARROW_TYPE.default, m.from, m.to);
      say(W.rosa.hinted(words(m.san).replace(/, check(mate)?$/, '')), 'teach');
    });
    actions.querySelector('[data-back]')?.addEventListener('click', () => {
      if (!g.history().length) return;
      stopThinking();
      clearTimeout(timer);
      if (g.turn() === colour && g.history().length >= 2) g.undo(); // Rosa's reply goes too
      else if (g.turn() === colour) return; // she opened as White: nothing of yours to take back
      g.undo();
      refresh();
      say(W.rosa.yours, 'think');
      open();
    });
    const resign = actions.querySelector('[data-resign]');
    resign.addEventListener('click', () => {
      if (resign.textContent !== W.rosa.sure) { resign.textContent = W.rosa.sure; return; }
      clearTimeout(timer);
      finish(W.rosa.resigned, '', 'teach');
    });
    if (colour === 'w') { say(W.rosa.yours, 'think'); open(); } else rosaMoves();
  }

  actions.innerHTML = W.rosa.levels.map((name, i) => `<button class="choice" data-level="${i}">${name}</button>`).join('');
  actions.classList.add('game-levels');
  say(W.rosa.pick, 'teach');
  for (const x of actions.querySelectorAll('[data-level]')) x.addEventListener('click', () => {
    level = Number(x.dataset.level);
    actions.classList.remove('game-levels');
    playing();
  });

  return () => { gone = true; stopThinking(); clearTimeout(timer); b.destroy(); };
}

export const CHESS_GAMES = [
  game('mate', 'Mate', mountMate),
  game('capture', W.capture.title, mountCapture),
  game('rosa', W.rosa.title, mountRosa),
];
