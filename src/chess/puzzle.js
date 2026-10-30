import { Chess } from 'chess.js';

/**
 * A Lichess puzzle in play. `moves[0]` is the opponent's move that sets the puzzle up; the
 * player then answers every even-indexed reply after it, and the opponent's replies are played
 * for them.
 */
export function startPuzzle(puzzle) {
  const game = new Chess(puzzle.fen);
  const setup = game.move(uci(puzzle.moves[0]));
  return { puzzle, game, ply: 1, lastMove: [setup.from, setup.to] };
}

/** The colour the player solves for: whoever is to move after the setup move. */
export const playerColor = (state) => state.game.turn();

/**
 * Plays the player's move. Returns 'wrong' (board untouched), 'piece' (the right promotion but
 * not the piece the line needs, board untouched: see `needed`), 'next' (correct, opponent
 * replied, more to find) or 'solved'.
 *
 * Correct means the stored move, or any legal move that checkmates — Lichess accepts every
 * mate, so a validator decides success rather than a comparison with one stored answer.
 * `chosen` is the piece a pawn promotes to; left out, the stored one (or a queen).
 */
export function tryMove(state, from, to, chosen) {
  const expected = state.puzzle.moves[state.ply];
  const promotion = chosen ?? (expected.slice(2, 4) === to ? expected[4] : 'q');
  const probe = new Chess(state.game.fen());
  let move;
  try { move = probe.move({ from, to, promotion }); } catch { return 'wrong'; }
  if (!probe.isCheckmate()) {
    if (from + to !== expected.slice(0, 4)) return 'wrong';
    if (move.promotion && move.promotion !== expected[4]) return 'piece';
  }

  state.game.move(move);
  state.lastMove = [from, to];
  state.ply++;
  if (state.ply >= state.puzzle.moves.length || state.game.isCheckmate()) return 'solved';
  const reply = state.game.move(uci(state.puzzle.moves[state.ply]));
  state.lastMove = [reply.from, reply.to];
  state.ply++;
  return 'next';
}

/** The piece the line's promotion needs now: 'q', 'r', 'b' or 'n'. */
export const needed = (state) => state.puzzle.moves[state.ply][4];

/** The move the player should make now, as [from, to]. Used to show the answer. */
export const hint = (state) => {
  const m = state.puzzle.moves[state.ply];
  return [m.slice(0, 2), m.slice(2, 4)];
};

export const uci = (m) => ({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
