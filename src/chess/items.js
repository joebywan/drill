import { Chess } from 'chess.js';
import { uci } from './puzzle.js';

/**
 * Lesson items. `type` says how one is played; a Lichess puzzle has none and is 'find'.
 *
 *   teach      { text, fen? }                         a card to read: not marked, not reviewed
 *   tap        { fen, rule, square?, answer?, prompt, explain }
 *                rule 'attacks' (default): every enemy piece the piece on `square` attacks
 *                rule 'moves': every square the piece on `square` can move to
 *                rule 'ends': the furthest square the piece can reach in each direction
 *                rule 'name': the one square named by `answer`, e.g. "e4"
 *   move       { fen, goal, targets?, to?, prompt, explain }   play a move that meets the goal:
 *                fork (attack every target), reach (land on `to`), capture (take on `to`),
 *                check, escape (get out of check), mate
 *   truefalse  { fen, claim?, move?, targets?, prompt, explain }
 *                claim 'check' / 'mate': "the side to move is in check / checkmated";
 *                otherwise "after `move`, the piece attacks every target"
 *   stars      { fen, stars, moves, prompt?, explain?, new?, demo?, intro? }
 *                move your piece(s) onto every star square within `moves` moves. The other side
 *                never moves, and the board needs no kings. `new` ('rook'...) tags a piece's first
 *                puzzle; `demo` (squares, e.g. ['a1','a8']) is a path the piece slides along first,
 *                while the coach says `intro`
 *   find       { fen, moves, prompt?, explain? }      a puzzle: play the line on the board
 *
 * Any item may set `side` ('w' or 'b') to choose which way the board faces; by default it
 * faces the side to move. Every answer is worked out from the position by chess.js, never stored, so a typo in the
 * course can't make a right answer wrong. `problem()` proves each item can be answered.
 */
export const kind = (item) => item.type || 'find';

/** Squares of the enemy pieces that the piece on `square` attacks, sorted. */
export function attacked(fen, square) {
  const game = new Chess(fen);
  const { color } = game.get(square);
  return game.board().flat()
    .filter((p) => p && p.color !== color && game.attackers(p.square, color).includes(square))
    .map((p) => p.square).sort();
}

/** The enemy pieces attacked by whatever moved last, after `moves` are played from `fen`. */
function hitsAfter(fen, ...moves) {
  const game = new Chess(fen);
  let move;
  for (const m of moves) move = game.move(m);
  return attacked(game.fen(), move.to);
}

const hitsAll = (hits, targets) => targets.every((t) => hits.includes(t));

/** Whether `move` (anything chess.js accepts) is legal here and meets a move item's goal. */
export function meets(item, move) {
  const game = new Chess(item.fen);
  let played;
  try { played = game.move(move); } catch { return { legal: false, correct: false }; }
  const correct = {
    fork: () => hitsAll(attacked(game.fen(), played.to), item.targets),
    reach: () => played.to === item.to,
    capture: () => played.to === item.to && !!played.captured,
    check: () => game.inCheck(),
    escape: () => true, // any legal move out of check does it; illegal ones never get here
    mate: () => game.isCheckmate(),
  }[item.goal]();
  return { legal: true, correct, played, fen: game.fen() };
}

/** Every legal move that meets a move item's goal. */
export const solutions = (item) =>
  new Chess(item.fen).moves({ verbose: true }).filter((m) => meets(item, m).correct);

/** The right answer: a sorted square list (tap) or a boolean (truefalse). */
export function answer(item) {
  switch (kind(item)) {
    case 'tap': {
      const rule = item.rule || 'attacks';
      if (rule === 'name') return [item.answer];
      if (rule === 'moves' || rule === 'ends') {
        const to = [...new Set(new Chess(item.fen).moves({ square: item.square, verbose: true }).map((m) => m.to))];
        return (rule === 'ends' ? furthest(item.square, to) : to).sort();
      }
      return attacked(item.fen, item.square);
    }
    case 'truefalse': {
      if (item.claim === 'check') return new Chess(item.fen).inCheck();
      if (item.claim === 'mate') return new Chess(item.fen).isCheckmate();
      return hitsAll(hitsAfter(item.fen, item.move), item.targets);
    }
  }
}

/**
 * Of the squares a piece can reach from `from`, the furthest along each straight or diagonal
 * line. A knight's jumps are each their own direction, so they all stay.
 */
function furthest(from, squares) {
  const xy = (sq) => [sq.charCodeAt(0) - 97, Number(sq[1]) - 1];
  const [fx, fy] = xy(from);
  const best = new Map(); // direction -> [distance, square]
  for (const sq of squares) {
    const [dx, dy] = xy(sq).map((v, i) => v - [fx, fy][i]);
    const line = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
    const dir = line ? `${Math.sign(dx)},${Math.sign(dy)}` : sq;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    if (!best.has(dir) || best.get(dir)[0] < dist) best.set(dir, [dist, sq]);
  }
  return [...best.values()].map(([, sq]) => sq);
}

export const grade = (item, response) =>
  kind(item) === 'tap' ? [...response].sort().join() === answer(item).join() : response === answer(item);

const PIECES = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' };

/** A move in plain words, for people who don't read notation: "Nxf7+" is "Knight takes on f7, check". */
export function words(san) {
  const end = san.endsWith('#') ? ', checkmate' : san.endsWith('+') ? ', check' : '';
  if (san.startsWith('O-O')) return (san.startsWith('O-O-O') ? 'Castles queenside' : 'Castles kingside') + end;
  const [, piece, takes, to, promo] = san.match(/^([KQRBN])?[a-h]?[1-8]?(x?)([a-h][1-8])(?:=([QRBN]))?/);
  const becomes = promo ? `, becomes a ${PIECES[promo].toLowerCase()}` : '';
  return `${PIECES[piece] || 'Pawn'} ${takes ? 'takes on' : 'to'} ${to}${becomes}${end}`;
}

/** The line a find item is solved by, in SAN, setup move left out. */
export function line(item) {
  const game = new Chess(item.fen);
  game.move(uci(item.moves[0]));
  return item.moves.slice(1).map((m) => game.move(uci(m)).san);
}

/** A stars board: any pieces, kings optional. Legality is still all chess.js. */
export const load = (fen) => new Chess(fen, { skipValidation: true });
export const handBack = (fen, turn) => { const f = fen.split(' '); f[1] = turn; f[3] = '-'; return f.join(' '); };

/**
 * One move in a stars item: null if the rules don't allow it. The other side never replies,
 * so the turn comes straight back to the player.
 */
export function hop(fen, move) {
  const game = load(fen);
  let played;
  try { played = game.move(move); } catch { return null; }
  return { played, fen: handBack(game.fen(), fen.split(' ')[1]) };
}

/** Squares the piece on `square` can move to, as chess.js sees it (stars boards included). */
export const targets = (fen, square) => [...new Set(load(fen).moves({ square, verbose: true }).map((m) => m.to))];

/** Prompt for a stars item that doesn't write its own. */
export const starsPrompt = (item) => item.prompt ||
  `Collect ${item.stars.length === 1 ? 'the star' : `all ${item.stars.length} stars`} in ${item.moves} move${item.moves === 1 ? '' : 's'}.`;

/**
 * A shortest way to collect every star within the budget, as chess.js moves, or null.
 * Breadth-first over (position, stars left); positions seen before are skipped.
 */
export function starPath(item) {
  const turn = item.fen.split(' ')[1];
  let frontier = [{ fen: item.fen, left: [...item.stars], path: [] }];
  const seen = new Set();
  for (let depth = 0; depth < item.moves; depth++) {
    const next = [];
    for (const s of frontier) {
      const game = load(s.fen);
      for (const m of game.moves({ verbose: true })) {
        if (m.promotion && m.promotion !== 'q') continue; // one way that works is all this finds, and a queen goes furthest
        game.move(m);
        const fen = handBack(game.fen(), turn);
        game.undo();
        const left = s.left.filter((sq) => sq !== m.to);
        const path = [...s.path, m];
        if (!left.length) return path;
        const key = fen.split(' ')[0] + left.join();
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ fen, left, path });
      }
    }
    frontier = next;
  }
  return null;
}

/** What is said after an answer. Every marked item has one; a puzzle falls back to its line. */
export const explanation = (item) => item.explain ||
  (kind(item) === 'stars' ? `One way: ${starPath(item).map((m) => words(m.san)).join(', then ')}.`
    : `The line: ${line(item).map(words).join('. ')}.`);

/** Why an item can't be shipped, or null. chess.js checks every position and move. */
export function problem(item) {
  try {
    switch (kind(item)) {
      case 'teach': return item.text ? null : 'no text';
      case 'tap': {
        if (item.rule === 'name') return /^[a-h][1-8]$/.test(item.answer) ? null : 'not a square';
        const game = new Chess(item.fen);
        if (['moves', 'ends'].includes(item.rule) && game.get(item.square)?.color !== game.turn()) return 'the piece is not the side to move';
        return answer(item).length ? null : 'nothing to tap';
      }
      case 'move': return solutions(item).length ? null : 'no legal move meets the goal';
      case 'truefalse': answer(item); return item.claim || item.targets.length ? null : 'no targets';
      case 'stars': {
        const game = load(item.fen);
        if (!Number.isInteger(item.moves) || item.moves < 1) return 'no move budget';
        if (!item.stars?.length) return 'no stars';
        for (const sq of item.stars) {
          if (!/^[a-h][1-8]$/.test(sq)) return `${sq} is not a square`;
          if (game.get(sq)?.color === game.turn()) return `your own piece is on the star ${sq}`;
        }
        if (item.demo) {
          let fen = item.fen;
          for (let i = 1; i < item.demo.length; i++) {
            fen = hop(fen, { from: item.demo[i - 1], to: item.demo[i], promotion: 'q' })?.fen;
            if (!fen) return `the demo can't go ${item.demo[i - 1]}-${item.demo[i]}`;
          }
        }
        return starPath(item) ? null : `the stars can't all be collected in ${item.moves} moves`;
      }
      case 'find':
        line(item);
        if (item.targets && !hitsAll(hitsAfter(item.fen, ...item.moves.slice(0, 2).map(uci)), item.targets)) return 'the move misses a target';
        return null;
    }
    return 'unknown type';
  } catch (e) {
    return e.message;
  }
}

const flipFile = (f) => String.fromCharCode(201 - f.charCodeAt(0)); // a <-> h
const flipSquare = (sq) => flipFile(sq[0]) + sq[1];

/** A chess text mirrored: its squares, its files, and which way a step goes. */
const flipText = (text) => text?.replace(/\b([a-h])([1-8])\b/g, (_, f, r) => flipFile(f) + r)
  .replace(/\b([a-h])-(file|pawn)\b/g, (_, f, w) => `${flipFile(f)}-${w}`)
  .replace(/\b(right(?! next)|left)\b/gi, (w) => ({ right: 'left', left: 'right', Right: 'Left', Left: 'Right' })[w]);

const flipBoard = (board) => board.split('/').map((rank) =>
  [...rank.replace(/\d/g, (n) => '.'.repeat(n))].reverse().join('').replace(/\.+/g, (m) => m.length)).join('/');
const flipUci = (m) => flipSquare(m.slice(0, 2)) + flipSquare(m.slice(2, 4)) + m.slice(4);

// Text a mirror would make untrue: castling and which wing or colour of square something is on.
const ONE_SIDED = /kingside|queenside|castl|(light|dark|white|black)[- ]squared?/i;

/** Whether a puzzle's line castles anywhere: the one thing that doesn't survive a mirror. */
const castles = (item) => {
  const game = new Chess(item.fen);
  return item.moves.some((m) => game.move(uci(m)).san.startsWith('O-O'));
};

/** A move item or real-game puzzle mirrored left to right, or null where a mirror wouldn't be safe. */
function mirror(item) {
  const [board, turn, rights, ep, ...rest] = item.fen.split(' ');
  if (ONE_SIDED.test(`${item.prompt} ${item.explain}`)) return null;
  if (kind(item) === 'move' ? rights !== '-' : castles(item)) return null;
  const copy = {
    ...item,
    fen: [flipBoard(board), turn, '-', ep === '-' ? '-' : flipSquare(ep), ...rest].join(' '),
    prompt: flipText(item.prompt),
    explain: flipText(item.explain),
  };
  if (item.to) copy.to = flipSquare(item.to);
  if (item.targets) copy.targets = item.targets.map(flipSquare);
  if (kind(item) === 'find') copy.moves = item.moves.map(flipUci);
  return problem(copy) ? null : copy;
}

/**
 * The Chess subject's `vary` (repeat.js): a stars puzzle mirrored left to right, its piece no longer
 * introduced; a move item or real-game puzzle mirrored where that's safe. Null for anything else.
 */
export function vary(item) {
  const type = kind(item);
  if (type === 'move' || type === 'find') {
    try { return mirror(item); } catch { return null; }
  }
  if (type !== 'stars') return null;
  const [board, turn, , , ...rest] = item.fen.split(' ');
  const { new: _new, demo: _demo, intro: _intro, ...plain } = item;
  return { ...plain, fen: [flipBoard(board), turn, '-', '-', ...rest].join(' '), stars: item.stars.map(flipSquare), prompt: flipText(item.prompt), explain: flipText(item.explain) };
}

/** A real-game puzzle is mirrored for a checkpoint or review, but it's never echoed: too close to the original. */
export const echoable = (item) => kind(item) !== 'find';
