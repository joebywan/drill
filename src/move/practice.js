import course from '../data/move.json' with { type: 'json' };
import { MOVE_LINES, line } from '../cast/lines.js';
import { phases, summary } from './routines.js';
import { coached, teach } from '../practice/kit.js';
import { buzz, play } from '../feel.js';

const say = (kind) => line(kind, Math.random(), MOVE_LINES);

/**
 * Mounts one Move item: a teach card, or a routine of timed exercises with rests between,
 * which Clover demonstrates; a rest shows how the next move goes. Ends with what was done ("5 moves · 8 squats").
 */
export function mount(el, item, ctx) {
  if (item.type === 'teach') return teach(el, item, ctx);
  const all = phases(item.set, course.moves, ctx.timings).map((p) => (p.kind === 'rest'
    ? { ...p, name: 'Rest', line: say('rest'), mood: 'rest' } : { ...p, line: say('go') }));
  return coached(el, all, ctx, {
    label: 'Exercises', tone: 'move', summary: summary(item.set, course.moves, ctx.timings), paused: say('paused'), room: say('room'),
    sound: (p) => { play(p.kind === 'rest' ? 'exhale' : 'inhale'); buzz('inhale'); },
  });
}
