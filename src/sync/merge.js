import { LEARN, migrate, nextStreak } from '../progress.js';

/**
 * Two copies of one learner's progress (this device's and the one synced from another), merged
 * into one. Pure. Nothing either side did is dropped:
 *   - cards: per card, the latest review wins
 *   - log: a union (a session both sides have counts once; two identical sessions on one side stay two)
 *   - done, garden.earned (the earliest date), journal (per day and line), tracked, start, timings: unions,
 *     this device winning where both set the same thing
 *   - look (the friends card's name and animal): the latest pick, by its `at`
 *   - each habit's streak is replayed from the merged log with the same rules as a live session,
 *     never lower than either side's when both end on the same day (the log keeps a year; a streak
 *     can be older), and `days` counts the dates only the other side had on top of the larger count
 * merge(a, a) is a; merge(a, merge(a, b)) is merge(a, b), so syncing again changes nothing.
 * Returns null when either side isn't progress.
 */
export function merge(local, remote) {
  const a = migrate(local);
  const b = ownIds(a, migrate(remote));
  if (!a || !b) return null;
  const log = mergeLog(a.log, b.log);
  const habits = {};
  for (const h of new Set([...Object.keys(a.habits), ...Object.keys(b.habits)])) habits[h] = mergeStreak(h, a, b, log);
  return {
    ...b,
    ...a,
    version: Math.max(a.version, b.version),
    habits,
    log,
    done: { ...b.done, ...a.done },
    cards: mergeCards(a.cards, b.cards),
    journal: mergeJournal(a.journal, b.journal),
    garden: { ...b.garden, ...a.garden, earned: earliest(a.garden.earned, b.garden.earned) },
    tracked: mergeTracked(a.tracked, b.tracked),
    timings: Object.fromEntries([...new Set([...Object.keys(b.timings), ...Object.keys(a.timings)])]
      .map((h) => [h, { ...b.timings[h], ...a.timings[h] }])),
    ...((a.start || b.start) && { start: { ...b.start, ...a.start } }),
    ...((a.met || b.met) && { met: { ...b.met, ...a.met } }),
    ...((a.picked || b.picked) && { picked: a.picked ?? b.picked }),
    ...((a.look || b.look) && { look: latestLook(a.look, b.look) }),
  };
}

/** The friends card's name and animal: the latest pick wins; a tie is settled the same way on every device. */
function latestLook(a, b) {
  if (!a || !b) return a ?? b;
  const at = (l) => Date.parse(l.at) || 0;
  if (at(a) !== at(b)) return at(a) > at(b) ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

const reviewed = (c) => Date.parse(c.last_review) || 0;

function mergeCards(a, b) {
  const cards = { ...b };
  for (const [k, c] of Object.entries(a)) {
    const o = b[k];
    if (!o || reviewed(c) > reviewed(o) || (reviewed(c) === reviewed(o) && (c.reps ?? 0) >= (o.reps ?? 0))) cards[k] = c;
  }
  return cards;
}

// A session is the same session on both sides if it matches in everything but what can be added
// to it later (the "how do you feel?" answer) or is device bookkeeping (`was`, for today's undo).
const sameness = ({ feel, was, ...e }) => JSON.stringify(Object.keys(e).sort().map((k) => [k, e[k]]));

function mergeLog(a, b) {
  const seen = new Map(); // sameness → how many times this side has it
  for (const e of a) seen.set(sameness(e), (seen.get(sameness(e)) || 0) + 1);
  const theirs = [];
  const taken = new Map();
  for (const e of b) {
    const k = sameness(e);
    taken.set(k, (taken.get(k) || 0) + 1);
    if (taken.get(k) > (seen.get(k) || 0)) theirs.push(e);
    else if (e.feel !== undefined) { // the other side answered "how do you feel?" for a session both have
      const at = a.findIndex((x) => sameness(x) === k && x.feel === undefined);
      if (at >= 0) a = a.map((x, i) => (i === at ? { ...x, feel: e.feel } : x));
    }
  }
  // Stable: this device's order within a day, the other side's sessions after them.
  return [...a, ...theirs].map((e, i) => [e, i]).sort(([x, i], [y, j]) => x.date.localeCompare(y.date) || i - j).map(([e]) => e);
}

function mergeStreak(habit, a, b, log) {
  const sides = [a, b].map((p) => p.habits[habit]).filter(Boolean);
  const days = new Map(); // date → whether a session that day repairs a gap (any practice; for Learning, a review)
  for (const e of log) if (e.habit === habit) days.set(e.date, days.get(e.date) || habit !== LEARN || e.title === 'Review');
  const dates = [...days].sort(([x], [y]) => x.localeCompare(y));
  // Replay the merged log as the sessions would have played out on one device: from nothing, and
  // on from each side's own streak (which may be older than the log, kept a year). Latest wins,
  // then the longest; every candidate is a streak the learner really has.
  const replay = (from) => dates.filter(([d]) => !from.last || d > from.last).reduce((s, [d, review]) => nextStreak(s, d, review), from);
  const best = [{ count: 0, last: null, forgiven: [] }, ...sides].map(replay)
    .reduce((x, y) => ((y.last ?? '') > (x.last ?? '') || (y.last === x.last && y.count > x.count) ? y : x));
  // `days`: dates only the other side has, on top of the larger count (the log forgets, `days` never does).
  const base = sides.reduce((x, y) => ((y.days || 0) > (x.days || 0) ? y : x));
  const baseDates = new Set([a, b].find((p) => p.habits[habit] === base).log.filter((e) => e.habit === habit).map((e) => e.date));
  return { ...best, days: (base.days || 0) + dates.filter(([d]) => !baseDates.has(d)).length };
}

function mergeJournal(a, b) {
  const journal = { ...b };
  for (const [date, day] of Object.entries(a)) {
    const other = b[date] || {};
    journal[date] = { ...other, ...day };
    for (const [k, text] of Object.entries(day)) {
      const o = other[k];
      if (typeof o === 'string' && typeof text === 'string' && !text.includes(o)) journal[date][k] = o.includes(text) ? o : `${text}\n${o}`;
    }
  }
  return journal;
}

function earliest(a, b) {
  const earned = { ...b };
  for (const [k, d] of Object.entries(a)) if (!earned[k] || d < earned[k]) earned[k] = d;
  return earned;
}

/**
 * Habits of the learner's own are numbered per device, so 'own-1' made on each of two devices
 * before they were linked can be two different habits, and one habit can have two ids. The other
 * side's are matched to ours by name and icon, or, when the id is taken by a different habit
 * here, given the next free id; their streak, log, timings and garden gifts move along.
 */
function ownIds(a, b) {
  if (!a || !b) return b;
  const same = (x, y) => x.name === y.name && x.icon === y.icon;
  const own = (t) => t.id.startsWith('own-');
  const used = new Set([...a.tracked, ...b.tracked].map((t) => t.id));
  const next = () => { let n = 1; while (used.has(`own-${n}`)) n++; used.add(`own-${n}`); return `own-${n}`; };
  const moved = new Map();
  for (const t of b.tracked.filter(own)) {
    const match = a.tracked.find((x) => own(x) && same(x, t))?.id;
    if (match) { if (match !== t.id) moved.set(t.id, match); } else if (a.tracked.some((x) => x.id === t.id)) moved.set(t.id, next());
  }
  if (!moved.size) return b;
  const to = (id) => moved.get(id) ?? id;
  const rekey = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [to(k), v]));
  return {
    ...b,
    tracked: b.tracked.map((t) => ({ ...t, id: to(t.id) })),
    habits: rekey(b.habits),
    timings: rekey(b.timings),
    log: b.log.map((e) => (moved.has(e.habit) ? { ...e, habit: to(e.habit) } : e)),
    garden: { ...b.garden, earned: Object.fromEntries(Object.entries(b.garden.earned).map(([k, d]) => [k.replace(/(?<=:)own-\d+$/, to), d])) },
  };
}

function mergeTracked(a, b) {
  const byId = new Map(b.map((t) => [t.id, t]));
  const out = a.map((t) => ({ ...byId.get(t.id), ...t }));
  for (const t of b) if (!a.some((x) => x.id === t.id)) out.push(t);
  return out;
}
