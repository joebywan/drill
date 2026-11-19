import course from '../data/reflect.json' with { type: 'json' };
import { REFLECT_LINES, REFLECT_WORDS, line } from '../cast/lines.js';
import { teach } from '../practice/kit.js';
import { esc } from '../html.js';
import { today } from '../progress.js';
import { dateOf } from '../habitview.js';

const lumi = (kind) => line(kind, Math.random(), REFLECT_LINES);

/**
 * Mounts one Reflect item in `el`: the teach card, or the three prompts. Self-paced like Calm's
 * grounding, so no clock and no Pause. Any prompt can be skipped. `done(null, summary, entry)`
 * hands back what was written ({ good?, learned?, tomorrow?, asked? }) for the journal. The text is the
 * learner's own: it is never linted, scored or sent anywhere. Returns a cleanup function.
 */
export function mount(el, item, ctx) {
  return item.type === 'teach' ? teach(el, item, ctx) : write(el, ctx);
}

/** The middle prompt, from the pool and chosen by the date: the same all day, a different one tomorrow. Its line is kept under `learned`. */
export const middleFor = (date) => ({ ...course.middle[Math.floor(Date.parse(date) / 864e5) % course.middle.length], key: 'learned' });
/** A day's three prompts: always "One good thing" first and "One thing for tomorrow" last. */
export const promptsFor = (date) => [course.prompts[0], middleFor(date), course.prompts[1]];
/** The middle prompt a day's entry says it asked (an entry from before the pool asked "learned"). */
const askedOf = (day) => course.middle.find((m) => m.id === day?.asked) ?? course.middle[0];

function write(el, { say, done, reached }) {
  const prompts = promptsFor(today());
  const entry = {};
  let at = 0;
  const show = () => {
    const p = prompts[at];
    reached?.(at, prompts.length);
    el.innerHTML = `<form class="reflect">
        <p class="topic">${at + 1} of ${prompts.length}</p>
        <h2><label for="reflect-line">${esc(p.prompt)}</label></h2>
        <textarea id="reflect-line" rows="1" autofocus autocomplete="off" autocapitalize="sentences" enterkeyhint="${at + 1 < prompts.length ? 'next' : 'done'}"
          placeholder="${esc(p.example)}"></textarea>
        ${at ? '' : `<p class="reflect-tip">${esc(course.tip)}</p>`}
        <div class="choices">
          <button type="button" class="choice reflect-skip">Skip</button>
          <button class="next reflect-on">${at + 1 < prompts.length ? 'Next' : 'Finish'}</button>
        </div>
      </form>`;
    say(lumi('write'), 'teach');
    const input = el.querySelector('textarea');
    if (at) input.focus();
    // The box grows with what's written (CSS field-sizing, or this where that's missing), up to
    // its max-height; Enter still moves on, as the keyboard's Next/Done says.
    if (!CSS.supports('field-sizing', 'content')) {
      input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight + 4}px`; });
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); input.form.requestSubmit(); }
    });
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (text) { entry[p.key] = text; if (p.id) entry.asked = p.id; }
      onward();
    });
    el.querySelector('.reflect-skip').addEventListener('click', onward);
  };
  const onward = () => {
    if (++at < prompts.length) return show();
    const n = Object.keys(entry).length - ('asked' in entry);
    done(null, n ? `${n} line${n === 1 ? '' : 's'}` : '', entry);
  };
  show();
  return () => {};
}

const KEYS = ['good', 'learned', 'tomorrow'];
const written = (day) => KEYS.filter((k) => typeof day?.[k] === 'string' && day[k].trim());
/** The label of a stored line: the middle one says what was asked that day. */
const labelled = (k, day) => (k === 'learned' ? askedOf(day) : course.prompts.find((p) => p.key === k));

/** The habit view's hook: a day's own three lines, or nothing. Read only here and by the file export. */
export function dayDetail(progress, date) {
  const kept = progress.journal?.[date];
  const rows = written(kept).map((k) => `<li><span>${esc(labelled(k, kept).label)}</span> ${esc(kept[k])}</li>`);
  return rows.length ? `<ul class="journal" aria-label="Your lines">${rows.join('')}</ul>` : '';
}

/**
 * Home's look back: one of the learner's own lines from seven days ago, or failing that from the
 * newest earlier day that has any, with its day and what was asked. Nothing if there is none.
 * Tapping it opens the habit view (the button's listener is app.js's).
 */
export function lookBack(progress, now = new Date()) {
  const kept = progress.journal ?? {};
  const week = today(dateOf(today(now), -7));
  const date = written(kept[week]).length ? week : Object.keys(kept).filter((d) => d < week && written(kept[d]).length).sort().pop();
  if (!date) return '';
  const k = written(kept[date])[0];
  const when = dateOf(date).toLocaleDateString('en', { weekday: 'long', ...(date === week ? {} : { day: 'numeric', month: 'short' }) });
  return `<button class="link look-back">${esc(REFLECT_WORDS.lookBack(date === week, when, labelled(k, kept[date]).back))} <q>${esc(kept[date][k])}</q></button>`;
}

/** The end screen's one quiet link, once three of the last seven days (today included) have lines. */
export function readBack(progress, now = new Date()) {
  const days = [...Array(7).keys()].filter((i) => written(progress.journal?.[today(dateOf(today(now), -i))]).length);
  return days.length >= 3 ? `<button class="link read-back">${esc(REFLECT_WORDS.readBack)}</button>` : '';
}
