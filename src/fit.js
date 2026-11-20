/**
 * How tall the runner's verdict banner will be with `words` in it (null: a teach card's, Continue alone) under the
 * longest verdict the coach's `lines` could give, by measuring a hidden copy, so a tall program can be fitted above
 * it before it comes. 0 with no banner on the page.
 */
export function verdictHeight(words, lines = {}) {
  const foot = document.querySelector('.foot');
  if (!foot) return 0;
  const copy = foot.cloneNode(true);
  copy.className = `foot show${words === null ? ' plain' : ''}`;
  copy.style.visibility = 'hidden';
  copy.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
  copy.querySelector('strong').textContent = ['correct', 'run3', 'run5', 'wrong'].flatMap((k) => lines[k] ?? []).reduce((a, b) => (b.length > a.length ? b : a), 'x');
  copy.querySelector('p').textContent = words ?? '';
  foot.after(copy);
  const height = copy.offsetHeight;
  copy.remove();
  return height;
}

/**
 * Fits a quiz card above whatever will cover the bottom of the screen: the answer tray while asked, the verdict
 * once answered (the same rule as Coding's `fit()`: fit first, never let the page scroll under a fixed bar). A card
 * that fits is left alone. Otherwise, in turn: the card gives up its spare room (`tight`), the coach shrinks
 * (`tall`), slots and the sentence above them shrink (`tighter`), pictures shrink, and last the card scrolls in its own box. A build's slots are measured full, as they
 * will be once answered.
 */
export function fitCard(quiz, item, coach) {
  const card = quiz.querySelector('.card');
  if (!card) return; // a pairs item without a picture has none
  const tray = quiz.querySelector('.choices');
  const slots = [...card.querySelectorAll('.slot')];
  const was = slots.map((s) => s.textContent);
  slots.forEach((s, i) => { s.textContent = item.answer[i]; });
  const limit = () => Math.min(tray?.children.length ? tray.getBoundingClientRect().top + scrollY : innerHeight,
    innerHeight - verdictHeight(item.type === 'teach' ? null : item.explain, coach?.lines));
  const over = () => card.getBoundingClientRect().bottom + scrollY - limit() + 8;
  if (over() > 0) {
    for (const c of ['tight', 'tall', 'tighter']) { quiz.classList.add(c); if (over() <= 0) break; }
    const pics = [...card.querySelectorAll('.pic')];
    if (over() > 0 && pics.length) {
      const high = pics.reduce((n, p) => n + p.getBoundingClientRect().height, 0);
      const k = Math.max(0.45, (high - over()) / high);
      for (const p of pics) p.style.maxWidth = `${Math.floor(p.getBoundingClientRect().width * k)}px`;
    }
    if (over() > 0) { card.style.maxHeight = `${Math.floor(card.getBoundingClientRect().height - over())}px`; card.style.overflowY = 'auto'; }
  }
  slots.forEach((s, i) => { s.textContent = was[i]; });
}
