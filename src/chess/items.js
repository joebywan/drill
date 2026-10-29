import { Chess } from 'chess.js';
import { uci } from './puzzle.js';

/**
 * Lesson items. `type` says how one is played; a Lichess puzzle has none and is 'find'.
 *
 *   teach      { text, fen?, side? }                  a card to read: not marked, not reviewed
 *   tap        { fen, rule, square?, answer?, prompt, explain }
 *                rule 'attacks' (default): every enemy piece the piece on `square` attacks
 *                rule 'moves': every square the piece on `square` can move to
 *                rule 'name': the one square named by `answer`, e.g. "e4"
 *   move       { fen, goal, targets?, to?, prompt, explain }   play a move that meets the goal:
 *                fork (attack every target), reach (land on `to`), capture (take on `to`),
 *                check, escape (get out of check), mate
 *   truefalse  { fen, claim?, move?, targets?, prompt, explain }
 *                claim 'check' / 'mate': "the side to move is in check / checkmated";
 *                otherwise "after `move`, the piece attacks every target"
 *   find       { fen, moves, prompt?, explain? }      a puzzle: play the line on the board
 *
 * Every answer is worked out from the position by chess.js, never stored, so a typo in the
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
      if (rule === 'moves') return [...new Set(new Chess(item.fen).moves({ square: item.square, verbose: true }).map((m) => m.to))].sort();
      return attacked(item.fen, item.square);
    }
    case 'truefalse': {
      if (item.claim === 'check') return new Chess(item.fen).inCheck();
      if (item.claim === 'mate') return new Chess(item.fen).isCheckmate();
      return hitsAll(hitsAfter(item.fen, item.move), item.targets);
    }
  }
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

/** What is said after an answer. Every marked item has one; a puzzle falls back to its line. */
export const explanation = (item) => item.explain || `The line: ${line(item).map(words).join('. ')}.`;

/** Why an item can't be shipped, or null. chess.js checks every position and move. */
export function problem(item) {
  try {
    switch (kind(item)) {
      case 'teach': return item.text ? null : 'no text';
      case 'tap': {
        if (item.rule === 'name') return /^[a-h][1-8]$/.test(item.answer) ? null : 'not a square';
        const game = new Chess(item.fen);
        if (item.rule === 'moves' && game.get(item.square)?.color !== game.turn()) return 'the piece is not the side to move';
        return answer(item).length ? null : 'nothing to tap';
      }
      case 'move': return solutions(item).length ? null : 'no legal move meets the goal';
      case 'truefalse': answer(item); return item.claim || item.targets.length ? null : 'no targets';
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
