import { builder } from '../builder.js';
import { boxTo, fitter, scrollBox, topOf, wholeRows } from '../fit.js';
import { flourish, play } from '../feel.js';
import { esc } from '../html.js';
import { parse as parseLevel } from '../coding/program.js';
import { gridHtml, walkerOn } from '../coding/grid.js';
import { mount as mountQuiz } from '../quiz/exercise.js';
import { grade, layout, limitOf, optionsOf, pretty, runIt, startOf, trayOf, walkOf, wayOf, withOut } from './items.js';

const DEMO_WAIT_MS = 900;

/** The tallest height up to `limit` that shows whole lines of the code in `pre`. */
function wholeLines(pre, limit) {
  const css = getComputedStyle(pre);
  const line = parseFloat(css.lineHeight), pad = parseFloat(css.paddingTop) + parseFloat(css.borderTopWidth);
  return Math.floor((limit - 2 * pad) / line) * line + 2 * pad;
}

/** Reads a chip aloud sensibly: code characters a screen reader would drop are said in words. */
const SPOKEN = { '(': 'open bracket', ')': 'close bracket', '{': 'open brace', '}': 'close brace', '[': 'open square', ']': 'close square', ';': 'semicolon', ',': 'comma', '=': 'equals', '=>': 'arrow', ':': 'colon' };
export const chipName = (word) => SPOKEN[word] ?? word;

/** Teach and predict cards are the quiz's own teach and pick, set as code. */
function asQuiz(item) {
  const show = [item.given && pretty(item.given), pretty(item.code)].filter(Boolean).join('\n');
  if (item.asks === 'check') return { ...quizPick(item, show.split('\n').map((l, i) => `${i + 1}  ${l}`).join('\n')), prompt: item.prompt };
  if (item.type === 'teach') {
    const printed = item.code ? runIt(item, item.code).output : [];
    return { id: item.id, type: 'teach', show, text: withOut(item, item.text), read: printed.length ? `Prints: ${printed.join(' / ')}` : undefined };
  }
  return quizPick(item, show);
}
function quizPick(item, show) {
  const { answer, options } = optionsOf(item);
  return { id: item.id, type: 'pick', show, options, answer, prompt: item.prompt ?? 'What does this print?', explain: withOut(item, item.explain) };
}

/**
 * What the goal is, above the answer: nothing to say for a walk, the grid says it. A print goal has a line under it
 * for what a run printed, lined up with it so the two compare at a glance.
 */
function goalHtml(item) {
  if (item.goal === 'print') {
    return `<div class="code-goal"><span>It should print</span><code>${esc(runIt(item, wayOf(item)).output.join('\n'))}</code>`
      + '<span>It printed</span><pre class="code-out" aria-label="What it printed" aria-live="polite"></pre></div>';
  }
  if (item.goal === 'returns') {
    const [args, want] = item.cases[0];
    return `<div class="code-goal"><span>For example</span><code>${esc(item.name)}(${esc(args.map((a) => JSON.stringify(a)).join(', '))}) gives ${esc(JSON.stringify(want))}</code></div>`;
  }
  return '';
}

/**
 * Mounts one code item (the subject contract: see src/subjects.js). A build or gap item is the bubble,
 * then anything already written or the grid, the answer as lines of code, and the tray and Run in the
 * thumb zone. Everything long scrolls inside its own space, so nothing moves on feedback: what it printed
 * has a reserved line, and the verdict is the runner's banner over the tray.
 */
export function mount(el, item, ctx) {
  const { say, done } = ctx;
  if (!item.level && (item.type === 'teach' || item.type === 'predict')) return mountQuiz(el, asQuiz(item), { ...ctx, look: item.asks === 'check' ? 'code-look code-check' : 'code-look' });
  const g = item.level ? parseLevel(item.level) : null;
  el.innerHTML = `<div class="code-item">
    ${g ? gridHtml(g) : ''}${item.type !== 'teach' ? goalHtml(item) : ''}
    ${item.given ? `<pre class="code code-given" tabindex="0" aria-label="Code already written">${esc(pretty(item.given))}</pre>` : ''}
    <div class="program code-program" aria-label="Your code"></div>
    <div class="choices tiles tray code-tray"><div class="chips"></div><button class="next run" disabled>Run</button></div>
  </div>`;
  const programEl = el.querySelector('.program');
  const foot = el.querySelector('.tiles');
  const outEl = el.querySelector('.code-out');
  // As tall as what it should print, so a run moves nothing; something longer scrolls inside it.
  if (outEl) outEl.style.height = `${el.querySelector('.code-goal code').offsetHeight}px`;
  const world = el.querySelector('.grid-world');
  const walker = g ? walkerOn(world, g) : null;
  const givenEl = el.querySelector('.code-given');
  const { fit, settle } = fitter({ program: programEl, tray: foot, world, g, lines: ctx.coach?.lines });
  let gone = false;
  const cleanup = () => { gone = true; walker?.stop(); };

  if (item.type === 'teach') {
    const printed = runIt(item, item.code).output;
    programEl.innerHTML = `<pre class="code">${esc(pretty(item.code))}${printed.length ? `\n\nPrints: ${esc(printed.join(' / '))}` : ''}</pre>`;
    foot.remove();
    const wait = setTimeout(() => walker?.walk(walkOf(item, runIt(item, item.code).steps)), DEMO_WAIT_MS);
    say(withOut(item, item.text), 'teach');
    done(null);
    return () => { clearTimeout(wait); cleanup(); };
  }

  const runEl = foot.querySelector('.run');
  const chipsEl = foot.querySelector('.chips');
  /**
   * Room between what is above (the goal, the grid) and Run: the tray grows to show every chip while there is room,
   * else it ends on a whole row and scrolls; the code under test gets as many whole lines as fit; the answer the rest.
   * The code keeps at least four lines and the answer one, and grows past it in its box, the line being built in view.
   * Nothing is limited on a screen where everything fits.
   */
  const share = (known) => {
    const LINE = 36; // an answer's line of chips
    const want = { given: givenEl?.scrollHeight ?? 0, answer: known ? programEl.scrollHeight : LINE + 16, tray: chipsEl.scrollHeight };
    const fixed = (givenEl ? 6 : 0) + 8 + (foot.offsetHeight - chipsEl.offsetHeight) + 8; // margins, Run and the tray's padding
    const room = () => innerHeight - topOf(givenEl ?? programEl) - fixed;
    if (want.given + want.answer + want.tray <= room()) return;
    programEl.classList.add('tall'); // the coach gives room first
    if (want.given + want.answer + want.tray <= room()) return;
    const least = { given: Math.min(want.given, 4 * 18 + 16), answer: Math.min(want.answer, LINE + 16) };
    const tray = wholeRows(chipsEl, Math.min(want.tray, room() - least.given - least.answer + 2 /* rounding */));
    if (tray < want.tray) { chipsEl.style.maxHeight = `${Math.max(tray, 44)}px`; scrollBox(chipsEl); }
    if (givenEl) {
      const lines = Math.max(least.given, room() - chipsEl.offsetHeight - least.answer);
      if (lines < want.given) { givenEl.style.maxHeight = `${wholeLines(givenEl, lines)}px`; scrollBox(givenEl); }
    }
  };
  const words = trayOf(item);
  const board = builder(programEl, chipsEl, {
    chips: words.map((w) => ({ face: w, name: chipName(w), chipClass: 'code-chip', placedClass: 'block token' })),
    limit: limitOf(item),
    start: item.type === 'gap' ? startOf(item) : undefined,
    breaks: layout,
    answerClass: 'code-answer',
    noun: 'word',
    onTap: () => play('tap'),
    onChange: (api) => { runEl.disabled = item.type === 'gap' ? api.open() > 0 : api.used() === 0; },
  });
  say(item.prompt, 'think'); // first: the bubble's size is part of the room
  share(item.type === 'gap');
  if (item.type === 'gap') fit(withOut(item, item.explain));
  // Past the tray, an answer scrolls inside its own space, so neither moves: one laid out from nothing, or a gap filled longer.
  if (!programEl.style.maxHeight) boxTo(programEl, foot.getBoundingClientRect().top, true);
  runEl.addEventListener('click', async () => {
    runEl.disabled = true;
    board.lock();
    const source = board.words().join(' ');
    const result = grade(item, source);
    if (outEl) outEl.textContent = result.output.join('\n');
    say('Running it...', 'think');
    if (result.walk) await walker.walk(result.walk);
    if (gone) return;
    if (!result.right) {
      programEl.innerHTML = `<pre class="code shown" tabindex="0" aria-label="One way that works">${esc(pretty(wayOf(item)))}</pre>`;
      programEl.classList.add('shown');
      say('Here is one way that works.', 'wrong');
    } else say(result.why || 'It runs, and it does the job.', 'correct');
    flourish(programEl, result.right ? 'pop' : 'shake'); // the runner cues the sound and buzz
    const lesson = withOut(item, item.explain);
    done(result.right, result.right ? lesson : `${result.why} ${lesson}`.trim());
    foot.style.visibility = 'hidden'; // Continue takes the thumb zone
    // The verdict covers neither the answer's end nor what matters: a filled gap, the end of what was built, or the way's start.
    settle(result.right ? programEl.querySelector('.filled') ?? [...programEl.querySelectorAll('[data-take]')].at(-1) : null, true);
    if (!result.right) programEl.scrollTop = 0;
  });
  return cleanup;
}

