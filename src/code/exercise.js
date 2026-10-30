import { builder } from '../builder.js';
import { flourish, play } from '../feel.js';
import { esc } from '../html.js';
import { parse as parseLevel } from '../coding/program.js';
import { gridHtml, walkerOn } from '../coding/grid.js';
import { mount as mountQuiz } from '../quiz/exercise.js';
import { grade, layout, limitOf, optionsOf, pretty, runIt, startOf, trayOf, walkOf, wayOf, withOut } from './items.js';

const DEMO_WAIT_MS = 900;

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

/** What the goal is, above the answer: nothing to say for a walk, the grid says it. */
function goalHtml(item) {
  if (item.goal === 'print') return `<p class="code-goal"><span>It should print</span><code>${esc(runIt(item, wayOf(item)).output.join('\n'))}</code></p>`;
  if (item.goal === 'returns') {
    const [args, want] = item.cases[0];
    return `<p class="code-goal"><span>For example</span><code>${esc(item.name)}(${esc(args.map((a) => JSON.stringify(a)).join(', '))}) gives ${esc(JSON.stringify(want))}</code></p>`;
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
  if (!item.level && (item.type === 'teach' || item.type === 'predict')) return mountQuiz(el, asQuiz(item), { ...ctx, look: 'code-look' });
  const g = item.level ? parseLevel(item.level) : null;
  const printing = item.goal === 'print';
  el.innerHTML = `<div class="code-item">
    ${g ? gridHtml(g) : ''}${item.type !== 'teach' ? goalHtml(item) : ''}
    ${item.given ? `<pre class="code code-given" tabindex="0" aria-label="Code already written">${esc(pretty(item.given))}</pre>` : ''}
    <div class="program code-program" aria-label="Your code"></div>
    ${printing ? '<pre class="code-out" aria-label="What it printed" aria-live="polite"></pre>' : ''}
    <div class="choices tiles tray code-tray"><div class="chips"></div><button class="next run" disabled>Run</button></div>
  </div>`;
  const programEl = el.querySelector('.program');
  const foot = el.querySelector('.tiles');
  const outEl = el.querySelector('.code-out');
  const walker = g ? walkerOn(el.querySelector('.grid-world'), g) : null;
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
  const words = trayOf(item);
  const board = builder(programEl, foot.querySelector('.chips'), {
    chips: words.map((w) => ({ face: w, name: chipName(w), chipClass: 'code-chip', placedClass: 'block token' })),
    limit: limitOf(item),
    start: item.type === 'gap' ? startOf(item) : undefined,
    breaks: layout,
    answerClass: 'code-answer',
    noun: 'word',
    onTap: () => play('tap'),
    onChange: (api) => { runEl.disabled = item.type === 'gap' ? api.open() > 0 : api.used() === 0; },
  });
  // A long answer scrolls inside the space between what's above it and the tray, so neither moves.
  const fit = () => {
    const floor = (outEl ?? foot).getBoundingClientRect().top;
    programEl.style.maxHeight = `${Math.max(48, floor - programEl.getBoundingClientRect().top - 8)}px`;
  };
  if (outEl) outEl.style.bottom = `${foot.offsetHeight + 4}px`;
  fit();
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
  });
  say(item.prompt, 'think');
  return cleanup;
}

