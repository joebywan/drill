/**
 * Every practice routine (Calm, Move, Eyes…) is a plain timeline: a list of phases, each
 * `{ seconds, ... }`. Pure, so timings are tested with fake time; `timeline()` plays one with a
 * pausable clock. A habit builds its own phases (see src/calm/routines.js) and plays them here.
 */

export const total = (phases) => phases.reduce((s, p) => s + p.seconds, 0);

/**
 * Where a timeline stands `ms` in: the phase index, ms into it and ms left of it. Past the end,
 * `done` is true and `index` is phases.length.
 */
export function phaseAt(phases, ms) {
  let start = 0;
  for (let index = 0; index < phases.length; index++) {
    const end = start + phases[index].seconds * 1000;
    if (ms < end) return { index, into: ms - start, left: end - ms, done: false };
    start = end;
  }
  return { index: phases.length, into: 0, left: 0, done: true };
}

/**
 * Plays `phases`: `onPhase(phase, index)` at each start, `onTick(secondsLeftInPhase)` each whole
 * second, `onEnd()` once at the end. Wakes only on second and phase boundaries. `pause` holds the
 * clock; `resume` carries on from the same moment.
 */
export function timeline(phases, { onPhase = () => {}, onTick = () => {}, onEnd = () => {} }) {
  let elapsed = 0;
  let since = Date.now();
  let timer = null;
  let shown = -1;
  let stopped = false;
  const tick = () => {
    const at = phaseAt(phases, elapsed + Date.now() - since);
    if (at.done) { stopped = true; return onEnd(); }
    if (at.index !== shown) { shown = at.index; onPhase(phases[at.index], at.index); }
    onTick(Math.ceil(at.left / 1000));
    timer = setTimeout(tick, at.left % 1000 || 1000);
  };
  tick();
  return {
    pause() {
      if (stopped || timer === null) return;
      clearTimeout(timer);
      timer = null;
      elapsed += Date.now() - since;
    },
    resume() {
      if (stopped || timer !== null) return;
      since = Date.now();
      tick();
    },
    stop() { stopped = true; clearTimeout(timer); },
    get paused() { return !stopped && timer === null; },
  };
}
