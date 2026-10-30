/**
 * A tap-only builder: a tray of chips and an ordered answer with a cursor. It knows nothing about
 * what the chips mean, so a block program, a line of JavaScript words or a Japanese sentence all
 * use it the same way. Tap a chip to place it at the cursor. A chip with `arms` holds other chips
 * (a loop has one arm, an if has two): placing one moves the cursor inside. Tap inside a list to
 * move the cursor to its end. Tap a placed chip to take it out, and the cursor stays in the gap it
 * left, which is also how to insert in the middle.
 *
 * Or the answer starts part written (`start`): fixed text with holes in it. A tapped chip fills the first
 * hole, and tapping a filled hole empties it, with no cursor to move. What the chips and the text say is
 * still none of its business.
 *
 * builder(answerEl, trayEl, options) mounts it and returns { tree(), used(), words(), lock() }.
 * Options:
 *   chips    [{ face, name, chipClass?, placedClass?, arms?: ['', 'else'], uses? }]: `face` is the
 *            text on it, `name` what a screen reader hears, `arms` the label over each list it holds
 *            and `uses` how many times it may be placed (any number if left out)
 *   limit    how many chips may be placed in all (none if left out)
 *   meter    (used, limit) => text for the line over the tray (no line if left out)
 *   start    the tree to begin with: nodes { text } (fixed, not a chip) and { hole: true }
 *   breaks   (words) => [indent | undefined per word]: top-level words given a number start a new line
 *            indented that much, so the answer can read as lines of code or verse
 *   answerClass  extra class on the answer; noun  what the spoken "goes here" calls a chip ('block')
 *   onChange (api) => {}: after every change, and once on mount
 *   onTap    () => {}: after every tap that changed something, for a sound
 * A tree is a list of nodes: { chip: index, arms?: [tree, ...] }, a filled hole adding `filled: true`. The state functions below are
 * pure enough to test without a page.
 */
export const newState = (start = []) => ({ tree: start.map((n) => ({ ...n })), cursor: { path: [], at: 0 } });

/** Whether the answer is fixed text with holes, rather than a list to grow. */
const holey = (state) => state.tree.some((n) => n.hole || n.filled);

/** The list a path leads to. A path is [node, arm, node, arm, ...], from the top. */
export function listAt(tree, path) {
  let list = tree;
  for (let i = 0; i < path.length; i += 2) list = list[path[i]].arms[path[i + 1]];
  return list;
}

/** Every chip placed anywhere in the tree, inner ones included. */
export const placed = (tree) => tree.flatMap((n) => (n.chip === undefined ? [] : [n.chip, ...(n.arms ?? []).flatMap(placed)]));

/** Every word of the answer in reading order: chips' faces and fixed text; an empty hole is `gap`. */
export const wordsOf = (tree, chips, gap = '') => tree.flatMap((n) => (n.hole ? [gap] : n.text !== undefined ? [n.text] : [chips[n.chip].face, ...(n.arms ?? []).flatMap((a) => wordsOf(a, chips, gap))]));

/** How many more times `chip` may be placed in `state`: the chip's own uses, then the limit. */
export function canPlace(state, chips, chip, limit = Infinity) {
  if (holey(state)) return state.tree.some((n) => n.hole);
  const all = placed(state.tree);
  return all.length < limit && all.filter((c) => c === chip).length < (chips[chip].uses ?? Infinity);
}

/** Puts `chip` at the cursor. A chip with arms takes the cursor into its first. */
export function place(state, chips, chip) {
  if (holey(state)) {
    state.tree[state.tree.findIndex((n) => n.hole)] = { chip, filled: true };
    return;
  }
  const { path, at } = state.cursor;
  const arms = chips[chip].arms;
  listAt(state.tree, path).splice(at, 0, arms ? { chip, arms: arms.map(() => []) } : { chip });
  state.cursor = arms ? { path: [...path, at, 0], at: 0 } : { path, at: at + 1 };
}

/** Takes out the node at `at` in the list at `path`, with what it holds. The cursor goes to the gap. */
export function takeOut(state, path, at) {
  if (listAt(state.tree, path)[at].filled) {
    listAt(state.tree, path)[at] = { hole: true };
    return;
  }
  listAt(state.tree, path).splice(at, 1);
  state.cursor = { path, at };
}

/** Moves the cursor to the end of the list at `path`. */
export function moveTo(state, path) {
  state.cursor = { path, at: listAt(state.tree, path).length };
}

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function builder(answerEl, trayEl, { chips, limit, meter, onChange, onTap, start, breaks, answerClass = '', noun = 'block' }) {
  const state = newState(start);
  const gaps = holey(state);
  let locked = false;
  const renderList = (nodes, path, extra = '') => {
    const here = same(state.cursor.path, path);
    const key = path.join();
    const lines = !path.length && breaks ? breaks(wordsOf(state.tree, chips, '___')) : [];
    const lineAt = (i) => (lines[i] === undefined ? '' : `<i class="line-break" aria-hidden="true"></i><i class="line-indent" aria-hidden="true" style="--indent:${lines[i]}"></i>`);
    const items = nodes.map((n, i) => lineAt(i) + (!gaps && here && state.cursor.at === i ? '<span class="caret" aria-hidden="true"></span>' : '') + renderNode(n, path, i));
    const atEnd = here && state.cursor.at === nodes.length;
    const slot = gaps ? '' : `<button class="block slot${atEnd ? ' here' : ''}" data-list="${key}" aria-label="${atEnd ? `The next ${noun} goes here` : `Put the next ${noun} here`}"></button>`;
    return `<div class="${extra}" data-list="${key}">${items.join('')}${slot}</div>`;
  };
  const renderNode = (n, path, i) => {
    if (n.text !== undefined) return `<span class="fixed-word">${attr(n.text)}</span>`;
    if (n.hole) return `<span role="img" class="block hole" aria-label="A gap to fill"></span>`;
    const c = chips[n.chip];
    const key = `${path.join()}|${i}`;
    const take = `aria-label="${attr(c.name)}, tap to take out" data-take="${key}"`;
    if (!n.arms) return `<button class="${attr(c.placedClass ?? '')}" ${take}>${attr(c.face)}</button>`;
    return `<div class="${attr(c.placedClass ?? '')}"><button class="head take" ${take}>${attr(c.face)}</button>${
      n.arms.map((arm, a) => (c.arms[a] ? `<span class="head">${attr(c.arms[a])}</span>` : '') + renderList(arm, [...path, i, a], 'inner')).join('')}</div>`;
  };
  trayEl.innerHTML = `${meter ? '<p class="meter-line"></p>' : ''}${chips.map((c, i) => `<button class="choice tile ${attr(c.chipClass ?? '')}" data-chip="${i}" aria-label="${attr(c.name)}">${attr(c.face)}</button>`).join('')}`;
  const line = trayEl.querySelector('.meter-line');
  const api = {
    tree: () => state.tree,
    used: () => placed(state.tree).length,
    words: () => wordsOf(state.tree, chips),
    /** Holes still empty: a part-written answer is ready when there are none. */
    open: () => state.tree.filter((n) => n.hole).length,
    lock: () => { locked = true; paint(); },
  };
  const paint = () => {
    answerEl.innerHTML = renderList(state.tree, [], `answer ${answerClass}`.trim());
    for (const b of answerEl.querySelectorAll('button')) b.disabled = locked;
    for (const b of trayEl.querySelectorAll('[data-chip]')) b.disabled = locked || !canPlace(state, chips, +b.dataset.chip, limit);
    if (line) line.textContent = meter(api.used(), limit);
    answerEl.querySelector('.here')?.scrollIntoView?.({ block: 'nearest' });
    onChange?.(api);
  };
  const changed = () => { onTap?.(); paint(); };
  const pathOf = (key) => (key === '' ? [] : key.split(',').map(Number));
  const onAnswer = (e) => {
    if (locked) return;
    const take = e.target.closest('[data-take]');
    if (take) {
      const [path, at] = take.dataset.take.split('|');
      takeOut(state, pathOf(path), +at);
      return changed();
    }
    const list = e.target.closest('[data-list]');
    if (list) { moveTo(state, pathOf(list.dataset.list)); changed(); }
  };
  const onTray = (e) => {
    const b = e.target.closest('[data-chip]');
    if (!b || b.disabled) return;
    place(state, chips, +b.dataset.chip);
    changed();
  };
  answerEl.addEventListener('click', onAnswer);
  trayEl.addEventListener('click', onTray);
  paint();
  return api;
}
