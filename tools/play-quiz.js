/**
 * Taps in one src/quiz/ item (pick, build, pairs, line), the part Maths and Japanese share: both play
 * as quiz items, so each course's `*-all` scenario only works out the item's answer (Maths with `toQuiz`)
 * and hands it here. `h` is what tools/play.js passes `options.answer`: { page, tap, swipe, ... }.
 */
import { tick } from '../src/quiz/items.js';

const exact = (t) => new RegExp(`^${String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/** The tile or option reading `text`, still tappable; `side` picks a column of a pairs item. */
const choice = (page, text, side) => page.locator(`.quiz .choices .choice:not(:disabled)${side == null ? '' : `[data-side="${side}"]`}`).filter({ hasText: exact(text) });

export async function answerQuiz({ page, tap, swipe }, item) {
  switch (item.type) {
    case 'teach': return;
    case 'pick': return tap(choice(page, item.answer));
    case 'build': for (const t of item.answer) await tap(choice(page, t)); return;
    case 'pairs': for (const [l, r] of item.pairs) { await tap(choice(page, l, 0)); await tap(choice(page, r, 1)); } return;
    case 'line': {
      const k = Array.from({ length: item.ticks + 1 }, (_, j) => j).find((j) => Math.abs(tick(item, j) - item.answer) < 1e-9);
      const track = page.locator('.numline .track');
      const { width } = await track.boundingBox();
      return swipe(track, 2 * ((width * k) / item.ticks - width / 2)); // a drag that ends on the answer
    }
    default: throw new Error(`no way to answer a ${item.type} item`);
  }
}

/**
 * Answers an item and, the first time each `key` comes up, takes a screenshot before and after
 * (the verdict up), so the pictures and the odd cards can be looked at. `key` is null for no shot.
 */
export async function answerShown(h, item, key, seen, answer = answerQuiz) {
  const shoot = key && !seen.has(key);
  if (shoot) { seen.add(key); await h.shot(`${item.id}-${key}-asked`); }
  await answer(h, item);
  if (shoot && item.type !== 'teach') {
    await h.page.locator('.foot.show').waitFor();
    await new Promise((r) => setTimeout(r, 900)); // let the verdict's pop settle
    await h.shot(`${item.id}-${key}-answered`);
  }
}
