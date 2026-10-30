import course from '../data/reflect.json' with { type: 'json' };
import { REFLECT_LINES, line } from '../cast/lines.js';
import { teach } from '../practice/kit.js';
import { esc } from '../html.js';

const lumi = (kind) => line(kind, Math.random(), REFLECT_LINES);

/**
 * Mounts one Reflect item in `el`: the teach card, or the three prompts. Self-paced like Calm's
 * grounding, so no clock and no Pause. Any prompt can be skipped. `done(null, summary, entry)`
 * hands back what was written ({ good?, learned?, tomorrow? }) for the journal. The text is the
 * learner's own: it is never linted, scored or sent anywhere. Returns a cleanup function.
 */
export function mount(el, item, ctx) {
  return item.type === 'teach' ? teach(el, item, ctx) : write(el, ctx);
}

function write(el, { say, done, reached }) {
  const { prompts } = course;
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
      if (text) entry[p.key] = text;
      onward();
    });
    el.querySelector('.reflect-skip').addEventListener('click', onward);
  };
  const onward = () => {
    if (++at < prompts.length) return show();
    const n = Object.keys(entry).length;
    done(null, n ? `${n} line${n === 1 ? '' : 's'}` : '', entry);
  };
  show();
  return () => {};
}

/** The habit view's hook: a day's own three lines, or nothing. Read only here and by the file export. */
export function dayDetail(progress, date) {
  const kept = progress.journal?.[date];
  const rows = course.prompts.filter((p) => kept?.[p.key]).map((p) =>
    `<li><span>${esc(p.label)}</span> ${esc(kept[p.key])}</li>`);
  return rows.length ? `<ul class="journal" aria-label="Your lines">${rows.join('')}</ul>` : '';
}
