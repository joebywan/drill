import { Chess } from 'chess.js';
import { Chessboard, COLOR, INPUT_EVENT_TYPE, POINTER_EVENTS } from 'cm-chessboard/src/Chessboard.js';
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers.js';
import { Arrows, ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows.js';
import { Accessibility } from 'cm-chessboard/src/extensions/accessibility/Accessibility.js';
import { startPuzzle, playerColor, tryMove, hint } from './puzzle.js';
import { answer, explanation, grade, hop, kind, meets, solutions, starPath, starsPrompt, targets } from './items.js';
import { move as animate, play } from '../feel.js';
import { reducedMotion } from '../cast/kit.js';

const ASSETS = new URL('../../node_modules/cm-chessboard/assets/', import.meta.url).href;
const REPLY_DELAY = 450;
const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

/**
 * Mounts one item in `el`. `say(text, mood?)` sets what the coach says, and how she looks;
 * `done(correct, text, { hinted })` is called once, when the item is over: true or false for a marked
 * item (false if any mistake was made; true with `hinted` if it was solved after being shown the
 * hint), null for a teach card, with the explanation to show.
 * Returns a cleanup function.
 */
export function mount(el, item, ctx) {
  el.innerHTML = '<div class="board"></div><div class="choices"></div>';
  return MOUNTS[kind(item)](el.firstChild, el.lastChild, item, ctx);
}

// A gold star, drawn by Markers like its own sprites: with cached sprites (cm-chessboard's
// default) a marker is `<use href="#slice">`, so the star only has to be in the document once.
// A star on an enemy piece sits small in the corner, above it, so the piece still shows.
const STAR = { class: 'marker-star', slice: 'markerStar' };
const STAR_ON = { class: 'marker-star', slice: 'markerStarOn', position: 'above' };
const starPoints = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 6 : 14;
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return `${(20 + r * Math.cos(a)).toFixed(2)},${(21 + r * Math.sin(a)).toFixed(2)}`;
}).join(' ');
function assets() {
  if (document.getElementById('drill-star')) return;
  document.body.insertAdjacentHTML('beforeend', `<svg id="drill-star" aria-hidden="true" style="position:absolute;width:0;height:0">
    <defs><g id="markerStar"><polygon points="${starPoints}" fill="#f7c02b" stroke="#b9800a" stroke-width="2" stroke-linejoin="round"/></g>
    <g id="markerStarOn"><use href="#markerStar" transform="translate(21 -2) scale(.5)"/></g></defs></svg>`);
  document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${ASSETS}extensions/arrows/arrows.css"><link rel="stylesheet" href="${ASSETS}extensions/promotion-dialog/promotion-dialog.css">`);
}

/** A star that bursts and fades where it was collected (or a piece taken). Under reduced motion it just goes. */
export function pop(b, square) {
  const { x, y } = b.view.squareToPoint(square);
  const ns = 'http://www.w3.org/2000/svg';
  const outer = document.createElementNS(ns, 'g');
  outer.setAttribute('transform', `translate(${x} ${y}) scale(${b.view.scalingX})`);
  const inner = outer.appendChild(document.createElementNS(ns, 'g'));
  inner.style.cssText = 'transform-box: fill-box; transform-origin: center';
  inner.appendChild(document.createElementNS(ns, 'use')).setAttribute('href', '#markerStar');
  b.view.markersTopLayer.appendChild(outer);
  const anim = animate(inner, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.9) rotate(30deg)', opacity: 0 }],
    { duration: 320, easing: 'ease-out' });
  if (anim) anim.onfinish = () => outer.remove(); else outer.remove();
}

/**
 * Legal-move dots: a picked-up piece shows where it can go. Returns the move-input handler
 * wrapper, which adds dots on pick-up and clears them on any drop, then calls `input`.
 */
export const withDots = (b, fenNow, input) => (event) => {
  if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
    b.removeMarkers(MARKER_TYPE.dot);
    const to = targets(fenNow(), event.squareFrom);
    for (const sq of to) b.addMarker(MARKER_TYPE.dot, sq);
    return true; // a piece with no moves still gets picked up, so the drop can say why
  }
  if (event.type !== INPUT_EVENT_TYPE.movingOverSquare) b.removeMarkers(MARKER_TYPE.dot);
  if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
    // Clicking another of your own pieces just picks that one up instead.
    const own = b.getPiece(event.squareTo)?.[0];
    if (own && own === b.getPiece(event.squareFrom)?.[0]) return false;
    return input(event);
  }
};

/** What Rosa says about a move the rules don't allow, for a piece of type `p`, `n`... */
export const cantMove = (type) => `The ${PIECE[type] || 'piece'} can't move like that. Try again.`;

export function board(el, fen, color = fen.split(' ')[1], more = []) {  // seen from `color`, else the side to move; `more`: extra extensions
  assets();
  return new Chessboard(el, {
    position: fen,
    orientation: color === 'w' ? COLOR.white : COLOR.black,
    assetsUrl: ASSETS,
    // The frame carries the a-h and 1-8 coordinates: beginners learn to read squares from it.
    // Drill's own pieces (tools/pieces.js) and colours (the "Board skin" block in styles.css).
    style: {
      cssClass: 'drill', borderType: 'frame', animationDuration: reducedMotion() ? 0 : 250,
      pieces: { file: new URL('../../assets/pieces/drill.svg', import.meta.url).href },
    },
    // Keyboard play: arrows walk the squares (each one is announced), Enter picks up and drops.
    // The board is also read out as a table and piece lists. The typed move form stays off: it
    // would be a focusable field nobody can see.
    extensions: [{ class: Markers, props: { autoMarkers: MARKER_TYPE.frame } }, { class: Arrows },
      { class: Accessibility, props: { language: 'en', keyboardMoveInput: true, movePieceForm: false } }, ...more],
  });
}

/** The square the keyboard cursor is on, from the Accessibility extension. */
const cursorSquare = (b) => b.getExtension(Accessibility).components.find((c) => c.getCurrentSquare)?.getCurrentSquare();

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
    let over = false;
    const pick = ({ square }) => {
      if (over || !square || square === item.square || found.has(square)) return;
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
      over = true;
      b.disableSquareSelect(POINTER_EVENTS.pointerdown);
      done(right, feedback(item));
    };
    b.enableSquareSelect(POINTER_EVENTS.pointerdown, pick);
    // The keyboard taps the square under the cursor: move input is off here, so the extension ignores Enter.
    b.view.svg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') pick({ square: cursorSquare(b) });
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
    const input = withDots(b, () => item.fen, (event) => {
      const { squareFrom: from, squareTo: to } = event;
      const result = meets(item, { from, to, promotion: 'q' });
      if (!result.legal) {
        say(game.inCheck()
          ? 'That leaves your king in check. Try again.'
          : cantMove(game.get(from)?.type), 'think');
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
    });
    say(item.prompt, 'think');
    b.enableMoveInput(input, b.getOrientation());
    return () => { clearTimeout(timer); b.destroy(); };
  },

  /**
   * Collect the stars: move your piece onto every star within the move budget. Illegal moves
   * are explained and cost nothing; the other side never moves. Out of moves and the board
   * resets with arrows along a way that works. A piece's first puzzle can slide it along a
   * demo path first, before the player gets the board.
   */
  stars(boardEl, choices, item, { say, done }) {
    choices.remove();
    const b = board(boardEl, item.fen, item.side);
    const prompt = starsPrompt(item);
    const left = new Set(item.stars);
    let fen = item.fen;
    let budget = item.moves;
    let timer;
    let gone = false;
    const wait = (ms) => new Promise((r) => { timer = setTimeout(r, ms); });
    const unstar = (sq) => { b.removeMarkers(STAR, sq); b.removeMarkers(STAR_ON, sq); };
    const drawStars = () => {
      unstar();
      for (const sq of left) b.addMarker(b.getPiece(sq) ? STAR_ON : STAR, sq);
    };
    drawStars();
    if (item.new) {
      boardEl.style.position = 'relative';
      boardEl.insertAdjacentHTML('beforeend', `<span style="position:absolute;top:0;left:50%;transform:translate(-50%,-50%);z-index:2;
        padding:2px 10px;border-radius:999px;background:var(--accent);color:var(--accent-text);font-size:.75rem;font-weight:800;
        letter-spacing:.08em;white-space:nowrap;pointer-events:none">NEW PIECE · ${item.new.toUpperCase()}</span>`);
    }

    const input = withDots(b, () => fen, ({ squareFrom: from, squareTo: to }) => {
      const result = hop(fen, { from, to, promotion: 'q' });
      if (!result) {
        say(cantMove(b.getPiece(from)?.[1]), 'think');
        return false;
      }
      fen = result.fen;
      budget--;
      if (left.delete(to)) { unstar(to); pop(b, to); play('tap'); }
      if (result.played.promotion) timer = setTimeout(() => b.setPosition(fen), REPLY_DELAY);
      if (!left.size) {
        b.disableMoveInput();
        say(`Every star collected.`);
        done(true, explanation(item));
      } else if (!budget) {
        b.disableMoveInput();
        say(`Out of moves. Here's one way.`, 'think');
        timer = setTimeout(() => {
          b.setPosition(item.fen, true);
          left.clear();
          for (const sq of item.stars) left.add(sq);
          drawStars();
          for (const m of starPath(item)) b.addArrow(ARROW_TYPE.default, m.from, m.to);
        }, REPLY_DELAY);
        done(false, explanation(item));
      } else {
        say(`${left.size} star${left.size === 1 ? '' : 's'} to go, ${budget} move${budget === 1 ? '' : 's'} left.`, 'think');
      }
      return true;
    });

    (async () => {
      if (item.demo) { // the piece shows how it moves first, then goes back
        say(item.intro || prompt, 'teach');
        await wait(600);
        for (let i = 1; i < item.demo.length && !gone; i++) {
          b.addArrow(ARROW_TYPE.default, item.demo[i - 1], item.demo[i]);
          await b.movePiece(item.demo[i - 1], item.demo[i], !reducedMotion());
          await wait(500);
        }
        if (gone) return;
        b.removeArrows();
        await b.setPosition(item.fen, !reducedMotion());
        await wait(300);
        if (gone) return;
      }
      say(prompt, 'think');
      b.enableMoveInput(input, b.getOrientation());
    })().catch(() => {}); // the board was taken down mid-demo
    return () => { gone = true; clearTimeout(timer); b.destroy(); };
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
          // Solved after the hint: right, and it says so (see `done` in app.js).
          if (mistakes >= 2) done(true, explanation(item), { hinted: true });
          else done(mistakes === 0, explanation(item));
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
