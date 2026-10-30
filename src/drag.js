const START_PX = 8; // less than this is a tap with a shaky thumb
const REACH_PX = 56; // a finger hides what it's aiming at, so the nearest target within reach wins

/**
 * Makes a tile button draggable onto a target; tapping it still works through its own click
 * listener. `targets()` lists the elements it may land on right now, `drop(el)` is called with the
 * one it landed on. Returns a function that ends any drag in progress, for when the item unmounts.
 */
export function dragTile(tile, { targets, drop }) {
  tile.style.touchAction = 'none'; // the finger drags the tile, not the page
  let from = null, ghost = null, target = null, dragged = false;
  const aim = (el) => {
    if (el === target) return;
    target?.classList.remove('drop-target');
    target = el;
    target?.classList.add('drop-target');
  };
  const stop = () => { from = null; ghost?.remove(); ghost = null; aim(null); };
  tile.addEventListener('pointerdown', (e) => {
    dragged = false;
    from = [e.clientX, e.clientY];
    tile.setPointerCapture?.(e.pointerId);
  });
  tile.addEventListener('pointermove', (e) => {
    if (!from) return;
    if (!ghost) {
      if (Math.hypot(e.clientX - from[0], e.clientY - from[1]) < START_PX) return;
      dragged = true;
      const r = tile.getBoundingClientRect();
      ghost = tile.cloneNode(true);
      ghost.classList.add('tile-ghost');
      ghost.style.width = `${r.width}px`;
      ghost.style.height = `${r.height}px`;
      document.body.append(ghost);
    }
    ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    aim(nearest(targets(), e.clientX, e.clientY));
  });
  tile.addEventListener('pointerup', () => {
    const landed = target;
    stop();
    if (landed) drop(landed);
  });
  tile.addEventListener('pointercancel', stop);
  // The click that ends a drag isn't a tap.
  tile.addEventListener('click', (e) => { if (dragged) { dragged = false; e.stopImmediatePropagation(); } }, true);
  return stop;
}

function nearest(els, x, y) {
  let best = null, bestAt = REACH_PX;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const at = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (at < bestAt) { best = el; bestAt = at; }
  }
  return best;
}
