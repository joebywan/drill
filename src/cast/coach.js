import { blink } from './kit.js';
import { move } from '../feel.js';

const IDLE_NOD = 8000;

/**
 * A character standing in `el` who reacts. `set(mood)` redraws with a small pop; `hop` and
 * `sway` are the right and wrong reactions; while thinking, a slow nod comes after 8 s idle.
 * Motion is skipped under reduced motion; the blink stays. Call `stop` when done with it.
 */
export function coach(el, draw) {
  let mood;
  let idle;
  let stopBlink = () => {};
  const svg = () => el.firstElementChild;

  const nod = () => {
    const head = el.querySelector('[data-part="head"]');
    if (head) Object.assign(head.style, { transformBox: 'fill-box', transformOrigin: '50% 100%' });
    move(head, [{ transform: 'rotate(0)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(0)' }], { duration: 900, easing: 'ease-in-out' });
  };

  const set = (next) => {
    clearTimeout(idle);
    if (next !== mood) {
      mood = next;
      stopBlink();
      el.innerHTML = draw(next);
      stopBlink = blink(svg());
      move(svg(), [{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'ease-out' });
    }
    if (next === 'think') idle = setTimeout(nod, IDLE_NOD);
  };

  // A dip, a hop and a squash on landing.
  const hop = () => move(svg(), [
    { transform: 'translateY(0) scale(1, 1)' },
    { transform: 'translateY(2px) scale(1.04, .94)', offset: 0.15 },
    { transform: 'translateY(-10px) scale(.97, 1.04)', offset: 0.5 },
    { transform: 'translateY(1px) scale(1.03, .96)', offset: 0.85 },
    { transform: 'translateY(0) scale(1, 1)' },
  ], { duration: 440, easing: 'ease-out' });

  const sway = () => move(svg(), [
    { transform: 'rotate(0)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(0)' },
  ], { duration: 500, easing: 'ease-in-out' });

  return { set, hop, sway, stop: () => { clearTimeout(idle); stopBlink(); } };
}
