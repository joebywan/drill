import { esc } from './html.js';
import { BOX, lifeArt, open, side } from './cast/butterfly.js';
import { LIFE_WORDS } from './garden/model.js';

/**
 * The field guide: every species (guide() in garden/model.js) as a grid, and a page for each.
 * Emerged ones are in full colour, one being raised shows its stage and what comes next, and one not
 * started a pale silhouette and what would raise it. Only an emerged one's page has its lines and
 * source; a source is an ordinary link, which the Android wrapper hands to the phone's browser.
 *
 *   fieldGuide(entries, { app, back, focusOn, date, id })   `id` opens that species' page first,
 *       whose back then returns to `back` (home); a page opened from the grid goes back to the grid.
 */
const svg = (body, cls = '') => `<svg class="guide-art${cls}" viewBox="${BOX}" aria-hidden="true">${body}</svg>`;
const art = ({ species, creature: c }) => (!c ? svg(open(species.art), ' silhouette') : svg(lifeArt(species, c.stage, c.growth)));
// What a tile and a page say under the name.
const about = ({ creature: c, by }, date) => (!c ? LIFE_WORDS.by(by)
  : c.k === 3 ? [LIFE_WORDS.by(by), c.on && date(c.on)].filter(Boolean).join(' · ')
  : LIFE_WORDS.next(c.next) || c.stage);

export function fieldGuide(entries, { app, back, focusOn, date, id = null }) {
  const grid = (from = null) => {
    app.innerHTML = `
      <header class="bar"><button class="back" aria-label="Back">←</button></header>
      <main class="field-guide">
        <h1>${esc(LIFE_WORDS.title)}</h1>
        <ul class="guide-grid">${entries.map((e) => `<li><button class="guide-tile${e.creature ? '' : ' waiting'}" data-species="${esc(e.species.id)}">
          ${art(e)}<b>${esc(e.species.name)}</b><span>${esc(about(e, date))}</span></button></li>`).join('')}</ul>
      </main>`;
    app.querySelector('.back').addEventListener('click', back);
    for (const b of app.querySelectorAll('[data-species]')) b.addEventListener('click', () => page(b.dataset.species, () => grid(b.dataset.species)));
    focusOn(from ? `[data-species="${from}"]` : 'h1');
  };
  const page = (sid, up) => {
    const e = entries.find((x) => x.species.id === sid) || entries[0];
    const { species, creature: c } = e;
    const flown = c?.k === 3;
    const sources = [...new Map(species.lines.map((l) => [l.source.url, l.source])).values()];
    app.innerHTML = `
      <header class="bar"><button class="back" aria-label="Back">←</button></header>
      <main class="field-guide guide-page">
        <div class="guide-arts">${flown ? svg(open(species.art)) + svg(side(species.art)) : art(e)}</div>
        <h1>${esc(species.name)}</h1>
        <p class="latin">${esc(species.latin)}</p>
        ${c && !flown ? `<p>${esc(LIFE_WORDS.raising(c))}</p>` : ''}
        <p class="said">${esc(about(e, date))}</p>
        ${flown ? `${species.lines.map((l) => `<p>${esc(l.text)}</p>`).join('')}
          <p class="source">${esc(LIFE_WORDS.source)} ${sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a>`).join(', ')}</p>` : ''}
      </main>`;
    app.querySelector('.back').addEventListener('click', up);
    focusOn('h1');
  };
  if (id) page(id, back); else grid();
}
