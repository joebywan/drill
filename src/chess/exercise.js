import { Chessboard, COLOR, INPUT_EVENT_TYPE } from 'cm-chessboard/src/Chessboard.js';
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers.js';
import { startPuzzle, playerColor, tryMove, hint } from './puzzle.js';

const ASSETS = new URL('../../node_modules/cm-chessboard/assets/', import.meta.url).href;
const REPLY_DELAY = 450;

/**
 * Mounts one puzzle in `el`. `say(text)` sets the caption under the board; `done(correct)` is
 * called once, when the puzzle is solved — `correct` is false if a mistake was made on the way.
 * Two mistakes and the answer's squares are marked; the player still has to play it.
 * Returns a cleanup function.
 */
export function mount(el, puzzle, { say, done }) {
  const state = startPuzzle(puzzle);
  const color = playerColor(state);
  const side = color === 'w' ? 'White' : 'Black';
  let mistakes = 0;
  let timer;

  const board = new Chessboard(el, {
    position: puzzle.fen,
    orientation: color === 'w' ? COLOR.white : COLOR.black,
    assetsUrl: ASSETS,
    style: { cssClass: 'default', borderType: 'none', animationDuration: 250 },
    extensions: [{ class: Markers, props: { autoMarkers: MARKER_TYPE.frame } }],
  });

  const show = () => {
    board.setPosition(state.game.fen(), true);
    board.removeMarkers(MARKER_TYPE.square);
    for (const sq of state.lastMove) board.addMarker(MARKER_TYPE.square, sq);
  };

  const input = (event) => {
    if (event.type === INPUT_EVENT_TYPE.moveInputStarted) return true;
    if (event.type !== INPUT_EVENT_TYPE.validateMoveInput) return;
    const result = tryMove(state, event.squareFrom, event.squareTo);
    if (result === 'wrong') {
      mistakes++;
      if (mistakes >= 2) {
        board.removeMarkers(MARKER_TYPE.circlePrimary);
        for (const sq of hint(state)) board.addMarker(MARKER_TYPE.circlePrimary, sq);
        say(`Not that. The marked piece moves — ${side} to play.`);
      } else {
        say(`Not that one. ${side} to play.`);
      }
      return false;
    }
    board.removeMarkers(MARKER_TYPE.circlePrimary);
    board.disableMoveInput();
    // The opponent's reply (or the solved position) is redrawn from the game, which also
    // corrects castling, en passant and promotion the board's own animation leaves half-done.
    timer = setTimeout(() => {
      show();
      if (result === 'solved') {
        say(mistakes ? 'Solved, with help.' : 'Solved!');
        done(mistakes === 0);
      } else {
        say(`Good. Keep going — ${side} to play.`);
        board.enableMoveInput(input, board.getOrientation());
      }
    }, REPLY_DELAY);
    return true;
  };

  say(`${side} to play.`);
  timer = setTimeout(() => {
    show();
    board.enableMoveInput(input, board.getOrientation());
  }, REPLY_DELAY);

  return () => { clearTimeout(timer); board.destroy(); };
}
