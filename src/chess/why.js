import { Chess } from 'chess.js';
import { uci } from './puzzle.js';

/**
 * Why a real-game puzzle's line works, in one plain sentence worked out from the position by chess.js: never
 * stored, never guessed. `why(item)` tries its theme's rule (`item.theme`, the Lichess theme its lesson is from),
 * then, for a line that ends in checkmate, why the king has no way out; failing both it gives the theme's
 * general idea, `GENERAL`. A worked-out sentence comes with its `claim`: the facts it states and the board
 * they hold on (`at`, the number of moves played), which test/why.test.js checks against the rules on its own.
 */

export const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const PLURAL = { p: 'pawns', n: 'knights', b: 'bishops', r: 'rooks', q: 'queens', k: 'kings' };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const LINES = { r: ROOK, b: BISHOP, q: [...ROOK, ...BISHOP] };

/** Each theme's idea, for a puzzle whose facts can't be worked out. Taught words only (test/items.test.js). */
export const GENERAL = {
  fork: 'The idea: one piece attacks two at once.',
  mateIn1: 'The idea: a check the king has no way out of.',
  hangingPiece: 'The idea: take what nothing defends.',
  pin: "The idea: a pinned piece can't move without exposing what is behind it.",
  skewer: 'The idea: the piece in front has to move, and the one behind it is taken.',
  backRankMate: 'The idea: a king boxed in on his back rank by his own pieces.',
  mateIn2: 'The idea: each move leaves fewer replies, until one is checkmate.',
  discoveredAttack: 'The idea: a piece moves off a line and uncovers an attack behind it.',
  doubleCheck: 'The idea: two pieces check at once, so the king has to move.',
  trappedPiece: 'The idea: attack a piece that has no safe square.',
  deflection: 'The idea: pull a defender away from what it guards.',
  attraction: 'The idea: draw a piece onto a square where it can be hit.',
  promotion: 'The idea: the pawn reaches the last rank and becomes a stronger piece.',
  mateIn3: 'The idea: each move leaves fewer replies, until one is checkmate.',
};

const other = (c) => (c === 'w' ? 'b' : 'w');
const xy = (sq) => [sq.charCodeAt(0) - 97, Number(sq[1]) - 1];
const square = (x, y) => (x >= 0 && x < 8 && y >= 0 && y < 8 ? String.fromCharCode(97 + x) + (y + 1) : null);
const byValue = (a, b) => VALUE[b.type] - VALUE[a.type];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** The pieces met along a line from `from`, nearest first, as [square, piece]. */
export function ray(game, from, [dx, dy]) {
  const met = [];
  let [x, y] = xy(from);
  for (;;) {
    x += dx; y += dy;
    const sq = square(x, y);
    if (!sq) return met;
    const p = game.get(sq);
    if (p) met.push([sq, p]);
  }
}

/** A puzzle played through: the board before and after every move (`boards[i]` is before `moves[i]`), and the player's colour. */
export function played(item) {
  const game = new Chess(item.fen);
  const boards = [game.fen()];
  const moves = item.moves.map((m) => { const move = game.move(uci(m)); boards.push(game.fen()); return move; });
  return { boards, moves, us: moves[0].color === 'w' ? 'b' : 'w' };
}

const board = (fen) => new Chess(fen);
const theirs = (g, us) => g.board().flat().filter((p) => p && p.color !== us);
const kingOf = (g, color) => g.board().flat().find((p) => p?.type === 'k' && p.color === color).square;
const ours = (i, moves) => i % 2 === 1 && i < moves.length; // the player's moves are the odd ones
const the = (p, sq) => `the ${NAMES[p.type]} on ${sq}`;
const list = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
/** "rook and pawns": pieces by kind, most valuable first, plural where there are several; more than two kinds are "pieces". */
const kinds = (pieces) => {
  const count = {};
  for (const p of [...pieces].sort(byValue)) count[p.type] = (count[p.type] || 0) + 1;
  const named = Object.entries(count).map(([t, n]) => (n > 1 ? PLURAL[t] : NAMES[t]));
  return named.length > 2 ? 'pieces' : list(named);
};
/** Index of the player's move that later takes the piece on `sq` after move `after`, followed as it moves, or -1. */
function takes(moves, after, sq) {
  for (let j = after + 1; j < moves.length; j++) {
    if (!ours(j, moves) && moves[j].from === sq) sq = moves[j].to;
    else if (ours(j, moves) && moves[j].to === sq) return j;
  }
  return -1;
}

/** One piece attacking two or more (pawns aside) at once, one of which the line then takes. */
function fork({ boards, moves, us }) {
  for (let i = 1; ours(i, moves); i += 2) {
    const g = board(boards[i + 1]);
    const to = moves[i].to;
    const hit = theirs(g, us).filter((p) => p.type !== 'p' && g.attackers(p.square, us).includes(to)).sort(byValue).slice(0, 3);
    if (hit.length < 2 || !hit.some((p) => p.type !== 'k' && takes(moves, i, p.square) > 0)) continue;
    const named = hit.filter((p) => p.type !== 'k').map((p) => the(p, p.square));
    const what = hit[0].type === 'k' ? `checked the king and attacked ${list(named)}` : `attacked ${list(named)}`;
    return { kind: 'fork', at: i + 1, from: to, targets: hit.map((p) => p.square), text: `The ${NAMES[g.get(to).type]} on ${to} ${what} at once.`,
      short: `The ${NAMES[g.get(to).type]} on ${to} forked ${list(hit.map((p) => `the ${NAMES[p.type]}`))}.` };
  }
}

/** A capture of a piece nothing defended. The most valuable, if there are several. */
function hanging({ boards, moves, us }) {
  let best;
  for (let i = 1; ours(i, moves); i += 2) {
    const m = moves[i];
    if (!m.captured || m.flags.includes('e') || board(boards[i]).attackers(m.to, other(us)).length) continue;
    if (!best || VALUE[m.captured] > VALUE[best.m.captured]) best = { i, m };
  }
  if (!best) return;
  const { i, m } = best;
  return { kind: 'free', at: i, square: m.to, text: `Nothing defended ${the({ type: m.captured }, m.to)}, so it was free to take.`, short: `${cap(the({ type: m.captured }, m.to))} was free.` };
}

/** Every pin of theirs by one of ours on board `g`: [pinner, pinned, behind] squares, a pin to the king first. */
function pins(g, us) {
  const found = [];
  for (const p of g.board().flat()) {
    if (!p || p.color !== us || !LINES[p.type]) continue;
    for (const d of LINES[p.type]) {
      const [a, b] = ray(g, p.square, d);
      if (a && b && a[1].color !== us && b[1].color !== us && a[1].type !== 'k' && VALUE[b[1].type] > VALUE[a[1].type]) found.push([p.square, a[0], b[0], b[1]]);
    }
  }
  return found.sort((x, y) => VALUE[y[3].type] - VALUE[x[3].type]);
}

/**
 * A pin that matters, after one of the player's moves: the line's last move made it, or the pinned piece can't take the piece
 * that just moved though it could with the pinning piece gone, or the line takes the pinned piece later.
 */
function pin({ boards, moves, us }) {
  for (let i = 1; ours(i, moves); i += 2) {
    const g = board(boards[i + 1]);
    const to = moves[i].to;
    for (const [pinner, pinned, behind] of pins(g, us)) {
      const takesOn = (game) => game.moves({ square: pinned, verbose: true }).some((m) => m.to === to);
      const free = board(boards[i + 1]);
      free.remove(pinner);
      const stuck = !takesOn(g) && takesOn(free); // the pin, and only the pin, stops it
      if (!stuck && !(pinner === to && i === moves.length - 1) && takes(moves, i, pinned) < 0) continue;
      const end = stuck ? `, so it couldn't take on ${to}` : '';
      return { kind: 'pin', at: i + 1, pinner, pinned, behind, stuck: stuck ? to : null,
        text: `The ${NAMES[g.get(pinner).type]} on ${pinner} pinned ${the(g.get(pinned), pinned)} to the ${NAMES[g.get(behind).type]}${end}.`,
        short: `The ${NAMES[g.get(pinner).type]} on ${pinner} pinned ${the(g.get(pinned), pinned)}.` };
    }
  }
}

/** The player's piece attacks a big piece with a smaller one behind it; the big one moves and the one behind is taken. */
function skewer({ boards, moves, us }) {
  for (let i = 1; ours(i, moves); i += 2) {
    const g = board(boards[i + 1]);
    const to = moves[i].to;
    for (const d of LINES[g.get(to).type] || []) {
      const [a, b] = ray(g, to, d);
      if (!a || !b || a[1].color === us || b[1].color === us || b[1].type === 'k' || VALUE[a[1].type] <= VALUE[b[1].type]) continue;
      if (moves[i + 1]?.from !== a[0]) continue; // the piece in front has to be the one that moves
      const taken = takes(moves, i + 1, b[0]);
      if (taken < 0) continue;
      const front = a[1].type === 'k' ? 'checked the king; once he moved,' : `attacked ${the(a[1], a[0])}; once it moved,`;
      return { kind: 'skewer', at: i + 1, from: to, front: a[0], back: b[0], taken,
        text: `The ${NAMES[g.get(to).type]} on ${to} ${front} ${the(b[1], b[0])} behind ${a[1].type === 'k' ? 'him' : 'it'} was taken.`,
        short: `The ${NAMES[g.get(to).type]} on ${to} skewered the ${NAMES[a[1].type]} and ${the(b[1], b[0])}.` };
    }
  }
}

/** The player moves a piece off a line, and one of the player's behind it now checks, or attacks a piece the line then takes. */
function discovered({ boards, moves, us }) {
  for (let i = 1; ours(i, moves); i += 2) {
    const m = moves[i];
    const before = board(boards[i]), g = board(boards[i + 1]);
    const found = [];
    for (const p of g.board().flat()) {
      if (!p || p.color !== us || p.square === m.to || !LINES[p.type]) continue;
      for (const d of LINES[p.type]) {
        const [t] = ray(g, p.square, d);
        if (t && t[1].color !== us && t[1].type !== 'p' && ray(before, p.square, d)[0]?.[0] === m.from
          && (t[1].type === 'k' || takes(moves, i, t[0]) > 0)) found.push([p, t]);
      }
    }
    const [hit] = found.sort((x, y) => VALUE[y[1][1].type] - VALUE[x[1][1].type]);
    if (!hit) continue;
    const [p, [tsq, t]] = hit;
    const does = t.type === 'k' ? `a check from ${the(p, p.square)}` : `${the(p, p.square)}, which then attacked ${the(t, tsq)}`;
    return { kind: 'discovered', at: i + 1, mover: m.from, behind: p.square, target: tsq, text: `Moving the ${NAMES[m.piece]} uncovered ${does}.`, short: `Moving the ${NAMES[m.piece]} uncovered ${the(p, p.square)}.` };
  }
}

/** Two of the player's pieces check at once. */
function double({ boards, moves, us }) {
  for (let i = 1; ours(i, moves); i += 2) {
    const g = board(boards[i + 1]);
    const checkers = g.attackers(kingOf(g, other(us)), us).sort((a, b) => (b === moves[i].to) - (a === moves[i].to)); // the piece that moved first
    if (checkers.length < 2) continue;
    const [a, b] = checkers.map((sq) => the(g.get(sq), sq));
    const end = g.isCheckmate() ? 'and the king had no square: checkmate' : 'so the king had to move';
    return { kind: 'double', at: i + 1, checkers, mate: g.isCheckmate(), text: `${cap(a)} and ${b} checked at once, ${end}.`, short: g.isCheckmate() ? 'A double check, and no square: checkmate.' : 'A double check: the king had to move.' };
  }
}

/** After the player's move, a piece of theirs is attacked and every move it has lands on an attacked square; later it is taken. */
function trapped({ boards, moves, us }) {
  for (let i = 1; ours(i, moves); i += 2) {
    const g = board(boards[i + 1]);
    for (const p of theirs(g, us).filter((x) => x.type !== 'k' && x.type !== 'p').sort(byValue)) {
      if (!g.attackers(p.square, us).length) continue;
      const stuck = g.moves({ square: p.square, verbose: true }).every((m) => {
        g.move(m);
        const hit = g.attackers(m.to, us).length > 0;
        g.undo();
        return hit;
      });
      if (!stuck) continue;
      const taken = takes(moves, i, p.square);
      if (taken < 0) continue;
      return { kind: 'trapped', at: i + 1, square: p.square, taken, text: `${cap(the(p, p.square))} was attacked and had no safe square to run to.`, short: `${cap(the(p, p.square))} had no safe square.` };
    }
  }
}

/** The player's check or capture pulls a defender off a square, and the player's next move lands there. */
function deflection({ boards, moves, us }) {
  for (let i = 1; ours(i + 2, moves); i += 2) {
    const g = board(boards[i + 1]);
    const reply = moves[i + 1], target = moves[i + 2].to;
    const forcing = g.inCheck() ? 'check' : moves[i].captured ? 'capture' : null;
    if (!forcing || target === reply.to || !g.attackers(target, other(us)).includes(reply.from)) continue;
    if (board(boards[i + 2]).attackers(target, other(us)).includes(reply.to)) continue;
    return { kind: 'deflection', at: i + 1, defender: reply.from, guarded: target, forcing, text: `Your ${forcing} pulled ${the(g.get(reply.from), reply.from)} away from guarding ${target}.`, short: `Your ${forcing} pulled the ${NAMES[g.get(reply.from).type]} off ${target}.` };
  }
}

/** The player's piece is taken on a square, and the player's next move hits the piece that took it. */
function attraction({ boards, moves, us }) {
  for (let i = 1; ours(i + 2, moves); i += 2) {
    const m = moves[i], reply = moves[i + 1];
    if (reply.to !== m.to || !reply.captured) continue;
    const g = board(boards[i + 3]);
    if (!g.attackers(m.to, us).length) continue;
    const king = reply.piece === 'k';
    const into = g.isCheckmate() ? 'checkmate' : king ? 'check' : 'your attack';
    return { kind: 'attraction', at: i + 1, square: m.to, mate: g.isCheckmate(), text: `Taking your ${NAMES[m.promotion || m.piece]} drew the ${NAMES[reply.piece]} to ${m.to}, into ${into}.`, short: `Taking drew the ${NAMES[reply.piece]} to ${m.to}.` };
  }
}

/** The player's pawn reaches the last rank. */
function promotion({ moves }) {
  for (let i = 1; ours(i, moves); i += 2) {
    const m = moves[i];
    if (m.promotion) return { kind: 'promotion', at: i + 1, square: m.to, piece: m.promotion, text: `Reaching the last rank, the pawn became a ${NAMES[m.promotion]}.`, short: `The pawn became a ${NAMES[m.promotion]}.` };
  }
}

/**
 * Why a checkmate is one: every square beside the king is held by his own pieces
 * or guarded by the player's (seen with the king lifted off, so a square behind him on the checking line counts).
 * On the back rank too when the king is on his home row and checked along it.
 */
function mate({ boards, moves, us }, backRank) {
  const g = board(boards[moves.length]);
  if (!g.isCheckmate()) return;
  const k = kingOf(g, other(us));
  const checkers = g.attackers(k, us);
  const [kx, ky] = xy(k);
  const around = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => (dx || dy ? square(kx + dx, ky + dy) : null))).filter(Boolean);
  const own = around.filter((sq) => g.get(sq)?.color === other(us));
  const lifted = board(boards[moves.length]);
  lifted.remove(k);
  const guards = [...new Set(around.filter((sq) => !own.includes(sq)).flatMap((sq) => lifted.attackers(sq, us)))];
  const home = other(us) === 'w' ? 0 : 7;
  const onRow = ky === home && checkers.every((sq) => xy(sq)[1] === home);
  // The line has just said which move mates, so the sentence is about the squares: short enough for the verdict on a phone.
  const one = own.length === 1 ? 's' : '';
  const blocked = `his own ${kinds(own.map((sq) => g.get(sq)))} ${guards.length ? `block${one} the king in` : `fill${one} every square around the king`}`;
  const guarded = `your ${kinds(guards.map((sq) => g.get(sq)))} ${guards.length > 1 ? 'guard' : 'guards'} ${own.length ? 'the rest' : 'every square around the king'}`;
  const parts = [own.length && blocked, guards.length && guarded].filter(Boolean);
  const row = backRank && onRow ? 'On his back rank, ' : '';
  const text = cap(`${row}${list(parts)}.`);
  // For a long line, the same facts in fewer words.
  const short = row && own.length ? `His own ${kinds(own.map((sq) => g.get(sq)))} boxed him in on his back rank.`
    : cap(`${list([own.length && `his own ${kinds(own.map((sq) => g.get(sq)))}`, guards.length && `your ${kinds(guards.map((sq) => g.get(sq)))}`].filter(Boolean))} leave the king no square.`);
  return { kind: 'mate', at: moves.length, king: k, checkers, own, guards, backRank: backRank && onRow, text, short };
}

const RULES = {
  fork, hangingPiece: hanging, pin, skewer, discoveredAttack: discovered, doubleCheck: double,
  trappedPiece: trapped, deflection, attraction, promotion,
  backRankMate: (p) => mate(p, true),
};

/**
 * The sentence for a puzzle: { text, short?, claim } with a worked-out claim (`short`, the same facts in fewer words),
 * { text } with the theme's general idea, or null with no theme and no mate.
 */
export function why(item) {
  const p = played(item);
  const claim = RULES[item.theme]?.(p) || mate(p, false);
  if (claim) return { text: claim.text, short: claim.short, claim };
  return GENERAL[item.theme] ? { text: GENERAL[item.theme] } : null;
}
