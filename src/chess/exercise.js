import { Chess } from 'chess.js';
import { Chessboard, COLOR, INPUT_EVENT_TYPE, POINTER_EVENTS } from 'cm-chessboard/src/Chessboard.js';
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers.js';
import { startPuzzle, playerColor, tryMove, hint } from './puzzle.js';
import { answer, explanation, grade, kind, meets, solutions } from './items.js';
import { play } from '../feel.js';

const ASSETS = new URL('../../node_modules/cm-chessboard/assets/', import.meta.url).href;
const REPLY_DELAY = 450;
const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/**
 * Mounts one item in `el`. `say(text, mood?)` sets what the coach says, and how she looks;
 * `done(correct, text)` is called once, when the item is over: true or false for a marked item
 * (false if any mistake was made), null for a teach card, with the explanation to show.
 * Returns a cleanup function.
 */
export function mount(el, item, ctx) {
  el.innerHTML = '<div class="board"></div><div class="choices"></div>';
  return MOUNTS[kind(item)](el.firstChild, el.lastChild, item, ctx);
}

function board(el, fen, color = fen.split(' ')[1]) {  // seen from `color`, else the side to move
  return new Chessboard(el, {
    position: fen,
    orientation: color === 'w' ? COLOR.white : COLOR.black,
    assetsUrl: ASSETS,
    // The frame carries the a-h and 1-8 coordinates: beginners learn to read squares from it.
    style: { cssClass: 'default', borderType: 'frame', animationDuration: 250 },
    extensions: [{ class: Markers, props: { autoMarkers: MARKER_TYPE.frame } }],
  });
}

/**
 * Choice buttons as [label, value]. The first tap is final: it is marked right or wrong, the
 * right one is shown either way, and `then(correct)` runs.
 */
function buttons(el, item, options, then) {
  el.innerHTML = options.map(([label]) => `<button class="choice">${label}</button>`).join('');
  [...el.children].forEach((b, i) => b.addEventListener('click', () => {
    for (const other of el.children) other.disabled = true;
    const correct = grade(item, options[i][1]);
    b.classList.add(correct ? 'right' : 'wrong');
    el.children[options.findIndex(([, v]) => grade(item, v))].classList.add('right');
    then(correct);
  }));
}

/** Plays `san` on the board and marks the squares it moved between. */
function playMove(b, fen, san) {
  const game = new Chess(fen);
  const move = game.move(san);
  b.setPosition(game.fen(), true);
  b.addMarker(MARKER_TYPE.square, move.from);
  b.addMarker(MARKER_TYPE.square, move.to);
  return move;
}

const feedback = (item) =>
  (kind(item) === 'truefalse' ? `It's ${answer(item) ? 'true' : 'false'}. ` : '') + explanation(item);

const MOUNTS = {
  teach(boardEl, choices, item, { say, done }) {
    const b = item.fen && board(boardEl, item.fen, item.side);
    if (!b) boardEl.remove();
    say(item.text, 'teach');
    done(null);
    return () => b?.destroy();
  },

  /**
   * Tap squares, judged on every tap: a right one lights up green at once, and the item is won
   * the moment the last one is found. A wrong tap ends it and shows the rest. No Check button.
   */
  tap(boardEl, choices, item, { say, done }) {
    choices.remove();
    const b = board(boardEl, item.fen, item.side);
    const want = answer(item);
    const found = new Set();
    if (item.square) b.addMarker(MARKER_TYPE.square, item.square);
    // For 'ends', a nearer square on a right line is a nudge, not a miss.
    const along = item.rule === 'ends' ? answer({ ...item, rule: 'moves' }) : [];
    const progress = () => (want.length > 1 ? ` Found ${found.size} of ${want.length}.` : '');
    b.enableSquareSelect(POINTER_EVENTS.pointerdown, ({ square }) => {
      if (!square || square === item.square || found.has(square)) return;
      const right = want.includes(square);
      if (!right && along.includes(square)) { say(`It can go further that way.${progress()}`, 'think'); return; }
      if (right) {
        found.add(square);
        b.addMarker(MARKER_TYPE.framePrimary, square);
        if (found.size < want.length) { play('tap'); say(item.prompt + progress()); return; }
      } else {
        b.addMarker(MARKER_TYPE.circleDanger, square);
        for (const sq of want) if (!found.has(sq)) b.addMarker(MARKER_TYPE.circlePrimary, sq);
      }
      b.disableSquareSelect(POINTER_EVENTS.pointerdown);
      done(right, feedback(item));
    });
    say(item.prompt, 'think');
    return () => b.destroy();
  },

  /**
   * Play a move that meets the goal. A move the rules don't allow is explained and costs
   * nothing; the first legal move is the answer. A wrong one is taken back and a right one shown.
   */
  move(boardEl, choices, item, { say, done }) {
    choices.remove();
    const b = board(boardEl, item.fen, item.side);
    const game = new Chess(item.fen);
    let timer;
    const input = (event) => {
      if (event.type === INPUT_EVENT_TYPE.moveInputStarted) return true;
      if (event.type !== INPUT_EVENT_TYPE.validateMoveInput) return;
      const { squareFrom: from, squareTo: to } = event;
      const result = meets(item, { from, to, promotion: 'q' });
      if (!result.legal) {
        say(game.inCheck()
          ? 'Your king is in check, so the move has to get it out of check. Try again.'
          : `The ${PIECE[game.get(from)?.type] || 'piece'} can't move like that. Try again.`, 'think');
        return false;
      }
      b.disableMoveInput();
      say(item.prompt);
      timer = setTimeout(() => {
        if (result.correct) {
          b.setPosition(result.fen, true);
          b.addMarker(MARKER_TYPE.square, from);
          b.addMarker(MARKER_TYPE.square, to);
          for (const sq of item.targets || []) b.addMarker(MARKER_TYPE.framePrimary, sq);
        } else {
          const right = solutions(item)[0];
          b.setPosition(item.fen, true);
          b.addMarker(MARKER_TYPE.circlePrimary, right.from);
          b.addMarker(MARKER_TYPE.circlePrimary, right.to);
        }
      }, REPLY_DELAY);
      done(result.correct, explanation(item));
      return true;
    };
    say(item.prompt, 'think');
    b.enableMoveInput(input, b.getOrientation());
    return () => { clearTimeout(timer); b.destroy(); };
  },

  truefalse(boardEl, choices, item, { say, done }) {
    const b = board(boardEl, item.fen, item.side);
    buttons(choices, item, [['True', true], ['False', false]], (correct) => {
      if (item.move) playMove(b, item.fen, item.move);
      for (const sq of item.targets || []) b.addMarker(MARKER_TYPE.framePrimary, sq);
      done(correct, feedback(item));
    });
    say(item.prompt, 'think');
    return () => b.destroy();
  },

  /** A puzzle: two mistakes and the answer's squares are marked; the player still plays it. */
  find(boardEl, choices, item, { say, done }) {
    choices.remove();
    const state = startPuzzle(item);
    const color = playerColor(state);
    const side = color === 'w' ? 'White' : 'Black';
    let mistakes = 0;
    let timer;
    const b = board(boardEl, item.fen, color);

    const show = () => {
      b.setPosition(state.game.fen(), true);
      b.removeMarkers(MARKER_TYPE.square);
      for (const sq of state.lastMove) b.addMarker(MARKER_TYPE.square, sq);
    };

    const input = (event) => {
      if (event.type === INPUT_EVENT_TYPE.moveInputStarted) return true;
      if (event.type !== INPUT_EVENT_TYPE.validateMoveInput) return;
      const result = tryMove(state, event.squareFrom, event.squareTo);
      if (result === 'wrong') {
        mistakes++;
        if (mistakes >= 2) {
          b.removeMarkers(MARKER_TYPE.circlePrimary);
          for (const sq of hint(state)) b.addMarker(MARKER_TYPE.circlePrimary, sq);
          say(`Not that. The marked piece moves — ${side} to play.`, 'struggling');
        } else {
          say(`Not that one. ${side} to play.`, 'wrong');
        }
        return false;
      }
      b.removeMarkers(MARKER_TYPE.circlePrimary);
      b.disableMoveInput();
      // The opponent's reply (or the solved position) is redrawn from the game, which also
      // corrects castling, en passant and promotion the board's own animation leaves half-done.
      timer = setTimeout(() => {
        show();
        if (result === 'solved') {
          done(mistakes === 0, explanation(item));
        } else {
          say(`Good. Keep going — ${side} to play.`, 'think');
          b.enableMoveInput(input, b.getOrientation());
        }
      }, REPLY_DELAY);
      return true;
    };

    say(item.prompt || `${side} to play. Find the best move.`, 'think');
    timer = setTimeout(() => {
      show();
      b.enableMoveInput(input, b.getOrientation());
    }, REPLY_DELAY);

    return () => { clearTimeout(timer); b.destroy(); };
  },
};
