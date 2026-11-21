import { Chess } from 'chess.js';
import { Chessboard, COLOR, INPUT_EVENT_TYPE, POINTER_EVENTS } from 'cm-chessboard/src/Chessboard.js';
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers.js';
import { Arrows, ARROW_TYPE } from 'cm-chessboard/src/extensions/arrows/Arrows.js';
import { Accessibility } from 'cm-chessboard/src/extensions/accessibility/Accessibility.js';
import { PromotionDialog } from 'cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js';
import { startPuzzle, playerColor, tryMove, hint, needed } from './puzzle.js';
import { answer, explanation, grade, hop, kind, load, meets, solutions, starPath, starsPrompt, targets } from './items.js';
import { NAMES as PIECE } from './why.js';
import { move as animate, play } from '../feel.js';
import { reducedMotion } from '../cast/kit.js';
import { LINES } from '../cast/lines.js';
import { verdictHeight } from '../fit.js';

const ASSETS = new URL('../../node_modules/cm-chessboard/assets/', import.meta.url).href;
const REPLY_DELAY = 450;

/**
 * Mounts one item in `el`. `say(text, mood?)` sets what the coach says, and how she looks;
 * `done(correct, text, { hinted })` is called once, when the item is over: true or false for a marked
 * item (false if any mistake was made; true with `hinted` if it was solved after being shown the
 * hint), null for a teach card, with the explanation to show: the first of its wordings (items.js `explanation`) whose
 * verdict leaves the board room, measured on the page.
 * Returns a cleanup function.
 */
export function mount(el, item, ctx) {
  el.innerHTML = '<div class="board lesson"></div><div class="choices"></div>';
  const stop = fitBoard(el.firstChild, el.lastChild, item, ctx);
  const cleanup = MOUNTS[kind(item)](el.firstChild, el.lastChild, item, stop.ctx);
  stop.refit();
  return () => { stop(); cleanup(); };
}

const SQUARE_MIN = 40; // a square to tap stays thumb-sized
const FRAME = 8.7; // a board is its eight squares and a frame of about 0.7 of one
const ANSWERED = 150; // the smallest an answered board (or a teach card's) gets: nobody taps it, the final position still reads

/**
 * Of `wordings` (best first), the first whose verdict, under the longest headline the coach's `lines` could give,
 * leaves the board at least ANSWERED px above it, measured on the page as it is now; else the last. With no
 * verdict banner on the page, the first.
 */
export function worded(boardEl, wordings, lines = LINES) {
  scrollTo(0, 0);
  const top = boardEl.getBoundingClientRect().top;
  return wordings.find((w) => innerHeight - verdictHeight(w, lines) - top - 6 >= ANSWERED) ?? wordings.at(-1);
}

/**
 * Keeps the board on the screen. Asked, the coach's words and the whole board show together (the page has
 * nothing to scroll), the board giving up size down to SQUARE_MIN squares (to tap) to do it; answered (or a teach card),
 * the whole board sits above the verdict banner, and nobody needs to tap it then, so it may shrink further.
 * A board that already fits is left as it is; one that does not first compacts the coach and the gaps (`tall`, styles.css).
 * Returns `stop`, with `refit` and the `ctx` to mount with (its say and done refit afterwards).
 */
function fitBoard(boardEl, choices, item, ctx) {
  const bubble = boardEl.closest('.play')?.querySelector('.bubble');
  const said = sayings(item);
  let answered = false;
  /** The coach's words keep the room of the tallest line this item can say, so a shorter one never moves the board up. */
  const hold = () => {
    if (!bubble) return;
    const copy = bubble.cloneNode(false);
    copy.removeAttribute('id');
    copy.removeAttribute('aria-live');
    copy.style.cssText = `position:absolute;visibility:hidden;min-height:0;width:${bubble.offsetWidth}px`;
    bubble.after(copy);
    const most = Math.max(...said.map((t) => { copy.textContent = t; return copy.offsetHeight; }));
    copy.remove();
    bubble.style.minHeight = `${most}px`;
  };
  const refit = () => {
    if (!boardEl.isConnected) return;
    scrollTo(0, 0); // measured from the top of the page, where a board that fits stays
    boardEl.style.width = '';
    hold();
    const natural = boardEl.getBoundingClientRect().width;
    const foot = document.querySelector('.foot.show');
    const tapped = ['tap', 'move', 'stars', 'find'].includes(kind(item)); // a true/false board is only looked at
    const tray = choices.isConnected && choices.children.length ? choices.offsetHeight : 0;
    const low = innerHeight - (foot ? foot.offsetHeight : tray);
    const roomNow = () => low - boardEl.getBoundingClientRect().top - 6;
    // Too tall for the screen: first the coach and the gaps give way (the shared `.tall` rules in styles.css), then the board.
    // Decided while asked: once answered the board only gets smaller, its top where it was.
    if (roomNow() < natural && !answered && !boardEl.classList.contains('tall')) { boardEl.classList.add('tall'); hold(); }
    const room = roomNow();
    const least = foot || !tapped ? ANSWERED : SQUARE_MIN * FRAME;
    const side = Math.floor(Math.min(natural, Math.max(room, least)));
    if (side < natural) { boardEl.style.width = `${side}px`; boardEl.style.marginInline = 'auto'; }
    // Still under the verdict (a 206px page, Chrome at 200% zoom): the page gets room to scroll the board clear of it.
    const play = boardEl.closest('.play');
    if (play) play.style.paddingBottom = foot && boardEl.getBoundingClientRect().bottom > low ? `${innerHeight - low + 8}px` : '';
  };
  const stop = () => { removeEventListener('resize', refit); if (bubble) bubble.style.minHeight = ''; };
  addEventListener('resize', refit);
  stop.refit = refit;
  stop.ctx = {
    ...ctx,
    say: (...a) => { ctx.say(...a); refit(); },
    // Over, the bubble stops asking for more or counting ("Keep going", "Found 2 of 3"); the banner has the explanation.
    // A true/false claim stays: it is what the explanation is about. Then the words give way to the board, not the other way.
    done: (right, text, kept) => {
      if (right !== null && kind(item) !== 'truefalse') ctx.say(right && !kept?.hinted ? OVER[0] : OVER[1]);
      if (right !== null) answered = true;
      ctx.done(right, Array.isArray(text) ? worded(boardEl, text, ctx.coach?.lines) : text, kept);
      refit();
    },
  };
  return stop;
}

const OVER = ["That's it.", "Here's how it goes."];
const KING_CHECK = 'That leaves your king in check. Try again.';
const starsLeft = (stars, moves) => `${stars} star${stars === 1 ? '' : 's'} to go, ${moves} move${moves === 1 ? '' : 's'} left.`;
/** A stars item's first words: a new piece's introduction stays with the prompt until the first move. */
const starsFirst = (item) => (item.intro ? `${item.intro} ${starsPrompt(item)}` : starsPrompt(item));

/**
 * Every line the coach can say during `item`, from asked to Continue (each MOUNTS entry's say calls), so her words
 * keep the room of the tallest: a shorter line never gives height back and moves the board.
 */
function sayings(item) {
  const k = kind(item);
  const cant = Object.keys(PIECE).map(cantMove);
  if (k === 'teach') return [item.text];
  if (k === 'truefalse') return [item.prompt];
  if (k === 'tap') {
    const n = answer(item).length, found = n > 1 ? ` Found ${n - 1} of ${n}.` : '';
    return [item.prompt + found, `It can go further that way.${found}`, ...OVER];
  }
  if (k === 'move') return [item.prompt, KING_CHECK, ...cant, ...OVER];
  if (k === 'stars') {
    const s = item.stars.length, m = item.moves;
    return [starsFirst(item), ...[[s - 1, m - 1], [1, 1], [s - 1, 1], [1, m - 1]].filter(([a, b]) => a > 0 && b > 0).map(([a, b]) => starsLeft(a, b)),
      'Every star collected.', "Out of moves. Here's one way.", ...cant, ...OVER];
  }
  const side = playerColor(startPuzzle(item)) === 'w' ? 'White' : 'Black'; // find
  return [item.prompt || `${side} to play. Find the best move.`, ...cant, rightPiece('knight', 'bishop'),
    `Not that. The marked piece moves — ${side} to play.`, `Not that one. ${side} to play.`, `Good. Keep going — ${side} to play.`, ...OVER];
}
const rightPiece = (needs, played) => `Right move, another piece. This position needs a ${needs}, not a ${played}.`;

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
  if (document.getElementById('wingbeat-star')) return;
  document.body.insertAdjacentHTML('beforeend', `<svg id="wingbeat-star" aria-hidden="true" style="position:absolute;width:0;height:0">
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

/**
 * The one promotion picker, for every board: a pawn move onto the last row asks which piece, then
 * `play(piece)`; any other move goes straight to `play()`. Call it from a move-input handler and
 * return what it returns. If the picker is dismissed, or `play` turns the piece down by returning
 * false, the board goes back to `fen` and `reopen()` lets the player move again. Input is off while
 * it asks, so after a piece is played `play` must turn it back on if the game goes on.
 */
export function withPromotion(b, fen, from, to, play, reopen) {
  const pawn = load(fen).moves({ square: from, verbose: true }).find((m) => m.to === to && m.promotion);
  if (!pawn) return play();
  b.disableMoveInput();
  b.showPromotionDialog(to, pawn.color, ({ piece }) => {
    if (piece && play(piece[1]) !== false) return;
    b.setPosition(fen);
    reopen();
  });
  return true;
}

/**
 * cm-chessboard ignores a press while a played move is still sliding into place: its move input
 * stays 'moveDone' until movePiece() resolves, so a quick tap as the piece lands was lost. Hold
 * that press (and its release, if it comes first) and replay it the moment the input is idle again.
 */
function keepFastTaps(b) {
  const input = b.view.visualMoveInput;
  const down = input.onPointerDown.bind(input);
  const set = input.setMoveInputState.bind(input);
  const held = [];
  let touched = false; // after a touch, a mouse press is the browser's copy of it: leave that one dropped
  const press = (tap) => {
    if (input.moveInputState === 'moveDone') return held.push(tap); // the replay played a move: wait again
    down(tap.down);
    if (tap.up) input.pointerUpListener?.(tap.up);
  };
  input.onPointerDown = (e) => {
    if (e.type === 'touchstart') touched = true;
    if (input.moveInputState !== 'moveDone' || (touched && e.type !== 'touchstart')) return down(e);
    if (e.cancelable) e.preventDefault();
    const tap = { down: e, up: null };
    held.push(tap);
    addEventListener(e.type === 'touchstart' ? 'touchend' : 'mouseup', (u) => { tap.up = u; }, { once: true });
  };
  input.setMoveInputState = (state, params) => {
    set(state, params);
    if (state === 'reset') held.splice(0).forEach(press);
  };
  const destroy = b.destroy.bind(b);
  b.destroy = () => { held.length = 0; destroy(); }; // its teardown resets the input: replay nothing then
  return b;
}

export function board(el, fen, color = fen.split(' ')[1]) {  // seen from `color`, else the side to move
  assets();
  return keepFastTaps(new Chessboard(el, {
    position: fen,
    orientation: color === 'w' ? COLOR.white : COLOR.black,
    assetsUrl: ASSETS,
    // The frame carries the a-h and 1-8 coordinates: beginners learn to read squares from it.
    // Wingbeat's own pieces (tools/pieces.js) and colours (the "Board skin" block in styles.css).
    style: {
      cssClass: 'wingbeat', borderType: 'frame', animationDuration: reducedMotion() ? 0 : 250,
      pieces: { file: new URL('../../assets/pieces/wingbeat.svg', import.meta.url).href },
    },
    // Keyboard play: arrows walk the squares (each one is announced), Enter picks up and drops.
    // The board is also read out as a table and piece lists. The typed move form stays off: it
    // would be a focusable field nobody can see.
    extensions: [{ class: Markers, props: { autoMarkers: MARKER_TYPE.frame } }, { class: Arrows },
      { class: Accessibility, props: { language: 'en', keyboardMoveInput: true, movePieceForm: false } }, { class: PromotionDialog }],
  }));
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
  explanation(item).map((w) => (kind(item) === 'truefalse' ? `It's ${answer(item) ? 'true' : 'false'}. ` : '') + w);

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
    const open = () => b.enableMoveInput(input, b.getOrientation());
    const input = withDots(b, () => item.fen, ({ squareFrom: from, squareTo: to }) => withPromotion(b, item.fen, from, to, (promotion) => {
      const result = meets(item, { from, to, promotion });
      if (!result.legal) {
        say(game.inCheck()
          ? KING_CHECK
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
    }, open));
    say(item.prompt, 'think');
    open();
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

    const open = () => b.enableMoveInput(input, b.getOrientation());
    const input = withDots(b, () => fen, ({ squareFrom: from, squareTo: to }) => withPromotion(b, fen, from, to, (promotion) => {
      const result = hop(fen, { from, to, promotion });
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
        say(starsLeft(left.size, budget), 'think');
        if (promotion) open();
      }
      return true;
    }, open));

    (async () => {
      if (item.demo) { // the piece shows how it moves first, then goes back
        say(starsFirst(item), 'teach');
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
      say(starsFirst(item), 'think');
      open();
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
      return withPromotion(b, state.game.fen(), event.squareFrom, event.squareTo, (promotion) => attempt(event.squareFrom, event.squareTo, promotion), open);
    };
    const open = () => b.enableMoveInput(input, b.getOrientation());
    const attempt = (from, to, promotion) => {
      if (!state.game.moves({ square: from, verbose: true }).some((m) => m.to === to)) { // not a move at all: explained, never counted as a miss
        say(cantMove(state.game.get(from)?.type), 'think');
        return false;
      }
      const result = tryMove(state, from, to, promotion);
      if (result === 'piece') {
        say(rightPiece(PIECE[needed(state)], PIECE[promotion]), 'think');
        return false;
      }
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
          open();
        }
      }, REPLY_DELAY);
      return true;
    };

    say(item.prompt || `${side} to play. Find the best move.`, 'think');
    timer = setTimeout(() => {
      show();
      open();
    }, REPLY_DELAY);

    return () => { clearTimeout(timer); b.destroy(); };
  },
};
