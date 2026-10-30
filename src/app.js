import { HABITS, OWN_ICONS, OWN_PLANTS, PRESETS, habitsFor, ordered, subjects } from './subjects.js';
import { award, garden, moreArrived, plantWords } from './garden/model.js';
import { PLANTS, animateScene, animateVisitor, drawGarden, flower, plant, sway, visitor } from './garden/art.js';
import { emptyProgress, nextUp, unitsOf, finishPractice, logToday, track, unlogToday, writeJournal, finishSession, noteFeel, currentStreak, dueKeys, habitDays, light, migrate, needsRepair, offersPlacement, placeAt, showsIntro, soonestKeys, today } from './progress.js';
import { FIRST_SQUARE, NO_STREAK, QUIET_DAY, REST_DAY, dateOf, streakLine, dayName, restDays, sessionLine } from './habitview.js';
import { coach } from './cast/coach.js';
import { rosa } from './cast/rosa.js';
import { lumi } from './cast/lumi.js';
import { reducedMotion } from './cast/kit.js';
import { CALM_SOUNDS, feelsFor, INTRO_WORDS, LOG_WORDS, STREAK_LABEL, accuracyLabel, finished, headline, line, paceLabel, rightAnswer } from './cast/lines.js';
import { buzz, calmPref, chime, move, play, setPref, setSound, soundOn } from './feel.js';
import { chip, esc } from './html.js';
import { helpHtml } from './practice/kit.js';
import { TIMINGS, TIMING_WORDS, pathTimings, setTiming, spread, timed } from './practice/timings.js';

const STORE = 'drill.progress';
const REVIEW_SIZE = 8;
const app = document.getElementById('app');

let progress = load();
/** Every habit this learner has (built in, then their own; what the intro picked first), and one of them by id. */
const habits = () => ordered(habitsFor(progress), progress.picked);
const habitOf = (id) => habits().find((h) => h.id === id);

function load() {
  let raw = null;
  try { raw = localStorage.getItem(STORE); } catch { /* private mode */ }
  if (raw == null) return emptyProgress();
  let p = null;
  try { p = migrate(JSON.parse(raw)); } catch { /* not JSON */ }
  // Unreadable progress is set aside, not overwritten by the next save.
  if (!p) try { localStorage.setItem(`${STORE}.unreadable`, raw); } catch { /* nowhere to keep it */ }
  return p || emptyProgress();
}
let persistAsked = false;
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* private mode: progress lasts the visit */ }
  // Ask the browser, quietly and once a visit, not to evict progress (Safari clears it after a week away).
  if (persistAsked) return;
  persistAsked = true;
  try { navigator.storage?.persisted?.().then((kept) => kept || navigator.storage.persist()).catch(() => {}); } catch { /* unsupported */ }
}

// Every item by key, so a review can find what it is reviewing.
const items = new Map();
for (const s of subjects)
  for (const u of s.units)
    for (const l of u.lessons)
      for (const item of l.items) items.set(`${s.id}:${item.id}`, { subject: s, item, topic: u.title });

/**
 * A new screen replaces the page, so focus would fall back to the top of the document. This puts
 * it where the screen starts (its heading, for a screen reader to read out) or on the control
 * that brought the learner back.
 */
const focusOn = (sel) => {
  const el = app.querySelector(sel);
  if (el && !el.matches('button')) el.tabIndex = -1;
  el?.focus();
};

let stopHome = () => {};

// The habit whose path home shows. Remembered across visits when storage allows.
const HABIT_KEY = 'drill.habit';
let habitShown = (() => {
  let h = null;
  try { h = localStorage.getItem(HABIT_KEY); } catch { /* private mode */ }
  return habits().some((x) => x.id === h && !x.hidden) ? h : HABITS[0].id;
})();
function showHabit(id) {
  habitShown = id;
  try { localStorage.setItem(HABIT_KEY, id); } catch { /* lasts the visit */ }
}

const ROW = 112; // px from one node to the next; the drawn path assumes it
const SWAY = 70; // px a node sits off centre at most

/**
 * Home: every unit as a winding path of quest markers, joined by a drawn line. A finished lesson
 * shows a tick; the next one a gold "!" with Lumi beside it; locked ones a grey "!". Reviews due
 * and one Continue button sit at the bottom. Today's light colours the streak chip.
 */
function home(arrived = null, newly = []) {
  stopHome();
  if (!habitOf(habitShown) || habitOf(habitShown).hidden) showHabit(HABITS[0].id);
  const shownHabit = habitOf(habitShown);
  // A self-reported habit has no path: one big button instead (logPanel).
  const logged = shownHabit.kind === 'log' && light(progress, new Date(), habitShown) === 'bright';
  const learning = habitShown === 'learn';
  const due = learning ? dueKeys(progress).filter((k) => items.has(k)) : [];
  // A repair needs a review even when nothing is due yet: then the soonest cards stand in.
  const repair = learning && needsRepair(progress);
  const reviewKeys = (due.length ? due : repair ? soonestKeys(progress).filter((k) => items.has(k)) : []).slice(0, REVIEW_SIZE);
  const units = subjects.filter((s) => s.habit === habitShown).flatMap((s) => unitsOf(progress, s));
  // A subject's optional placement question, offered by its path until answered or dismissed.
  const offer = subjects.find((s) => s.habit === habitShown && offersPlacement(progress, s));
  const brandNew = !progress.log.length && !Object.keys(progress.done).length;
  // After the intro, Lumi's welcome names the first thing picked.
  const firstPick = brandNew && habitOf(progress.picked?.[0]);
  // The next lesson; a finished path whose subject has `again` ("Reflect today") keeps one of its lessons one tap away.
  const again = subjects.find((s) => s.habit === habitShown)?.again;
  const { current, repeat } = nextUp(units, again);
  const minutes = `about ${Math.max(1, Math.round(reviewKeys.length * 0.4))} min`;
  const dueChip = !reviewKeys.length ? ''
    : repair ? `<button class="due" data-review>${esc(line('repair'))} · ${minutes}</button>`
    : `<button class="due" data-review>${due.length} to review · ${minutes}</button>`;
  const xAt = (i) => Math.round(Math.sin((i * Math.PI) / 3) * SWAY);

  const node = (n, i) => {
    const here = n === current;
    const mark = n.state === 'done' ? '✓' : '!';
    const status = n.state === 'done' ? ', done' : n.state === 'locked' ? ', locked' : here ? ', current' : '';
    return `<li style="--x:${xAt(i)}px">
      <button class="node ${n.state}${here ? ' here' : ''}" data-lesson="${n.id}" ${n.state === 'locked' ? 'disabled' : ''}${here ? ' aria-current="step"' : ''}
        aria-label="${esc(n.lesson.title)}${status}"><span aria-hidden="true">${mark}</span></button>
      ${here ? `<div class="guide ${xAt(i) > 0 ? 'left' : 'right'}"></div>` : ''}
      <span class="label" aria-hidden="true">${esc(n.lesson.title)}</span>
    </li>`;
  };

  // The line through every node centre; the stretch up to the last finished node is drawn in green.
  const trail = (nodes) => {
    const pts = nodes.map((_, i) => [xAt(i), i * ROW + 32]);
    const d = (to) => pts.slice(0, to).map(([x, y], i) => {
      if (!i) return `M${x} ${y}`;
      const [px, py] = pts[i - 1];
      return `C${px} ${py + ROW / 2} ${x} ${y - ROW / 2} ${x} ${y}`;
    }).join(' ');
    const walked = nodes.filter((n) => n.state === 'done').length + 1;
    const h = (nodes.length - 1) * ROW + 64;
    return `<svg class="trail" viewBox="-160 0 320 ${h}" width="320" height="${h}" aria-hidden="true">
      <path d="${d(pts.length)}" class="ahead"/>${walked > 1 ? `<path d="${d(Math.min(walked, pts.length))}" class="walked"/>` : ''}
    </svg>`;
  };

  const g = garden(progress);
  app.innerHTML = `
    <header class="bar">
      <h1>Drill</h1>
      <button class="sound" aria-pressed="${soundOn()}" aria-label="Sound">${soundOn() ? '🔊' : '🔇'}</button>
      <button class="menu" aria-label="Your progress">⋯</button>
    </header>
    <main class="home">
      <button class="garden-link" aria-label="Your garden: ${g.plants.length} plant${g.plants.length === 1 ? '' : 's'}">${drawGarden(g, 'strip', newly.map((r) => r.id))}</button>
      <nav class="paths" aria-label="Show the path for">
        ${habits().filter((h) => !h.hidden).map(habitTab).join('')}
        <button class="path-tab add-tab" data-add aria-label="Add a habit">${esc(LOG_WORDS.addTab)}</button>
      </nav>
      ${brandNew ? `<p class="said welcome">${esc(firstPick ? INTRO_WORDS.first.replace('{name}', firstPick.name) : line('welcome'))}</p>` : ''}
      ${progress.habits[habitShown]?.last ? `<button class="streak-line">${esc(streakLine(currentStreak(progress, new Date(), habitShown), true))}</button>`
        : TIMINGS[habitShown] ? `<button class="link timings-link">${esc(TIMING_WORDS.link)}</button>` : ''}
      ${offer ? `<p class="offer"><button data-place>${esc(offer.placement.offer)}</button><button class="dismiss" data-dismiss aria-label="Dismiss">×</button></p>` : ''}
      ${shownHabit.kind === 'log' ? logPanel(shownHabit, logged, newly) : ''}
      ${units.map((u) => `
        <section class="street">
          <h2>${esc(u.title)}</h2>
          <div class="trailhead">${trail(u.nodes)}<ol class="path">${u.nodes.map(node).join('')}</ol></div>
        </section>`).join('')}
    </main>
    <footer class="cta">
      ${dueChip}
      ${shownHabit.kind === 'log' ? (logged ? '' : `<button class="next" data-log>${esc(shownHabit.did)}</button>`)
        : current ? `<button class="next" data-lesson="${current.id}">Continue · ${esc(current.lesson.title)}</button>`
        : repeat ? `<button class="next" data-lesson="${repeat.id}">${esc(again.label)}</button>` : ''}
    </footer>`;

  const stopGarden = liven(app.querySelector('.garden-link'));
  // The current lesson is brought into view, centred, only when it is out of view (the fixed
  // footer covers the bottom 160px), so the garden at the top stays in sight when there's room.
  const showHere = () => {
    const r = app.querySelector('.here')?.getBoundingClientRect();
    if (r && (r.top < 0 || r.bottom > innerHeight - 160)) app.querySelector('.here').scrollIntoView({ block: 'center' });
  };
  const guide = app.querySelector('.guide');
  if (guide) {
    // Lumi rests once today is done, and is content otherwise: never sad, whatever the light.
    const late = new Date().getHours() >= 21;
    const lumiCoach = coach(guide, lumi);
    const guideLight = light(progress, new Date(), habitShown);
    const settle = () => lumiCoach.set(guideLight === 'bright' ? (late ? 'sleepy' : 'complete') : 'teach');
    const from = arrived && app.querySelector(`.node[data-lesson="${arrived}"]`);
    showHere();
    const walk = from && walkTo(guide, from, app.querySelector('.node.here'));
    if (walk) {
      lumiCoach.set('correct');
      walk.finished.then(settle, () => {});
    } else settle();
    stopHome = () => { walk?.cancel(); lumiCoach.stop(); stopGarden(); };
  } else {
    showHere();
    stopHome = stopGarden;
  }
  app.querySelector('.garden-link').addEventListener('click', () => gardenView());
  app.querySelector('.sound').addEventListener('click', () => { setSound(!soundOn()); home(); focusOn('.sound'); });
  app.querySelector('.menu').addEventListener('click', () => { stopHome(); keep(); });
  app.querySelector('.streak-line')?.addEventListener('click', () => habitView(habitShown));
  // Before a habit's first session there is no habit view yet, so its timings are offered here.
  app.querySelector('.timings-link')?.addEventListener('click', () => { stopHome(); timingsView(habitShown, () => { home(); focusOn('.timings-link'); }); });
  // The tabs are one row that scrolls inside itself: the selected one is brought into view.
  const tabs = app.querySelector('.paths');
  const shown = tabs.querySelector('[aria-pressed="true"]');
  tabs.scrollLeft = shown.offsetLeft - (tabs.clientWidth - shown.offsetWidth) / 2;
  // An edge fades only when there are more tabs that way.
  const edges = () => {
    tabs.classList.toggle('more-start', tabs.scrollLeft > 1);
    tabs.classList.toggle('more-end', tabs.scrollLeft < tabs.scrollWidth - tabs.clientWidth - 1);
  };
  edges();
  tabs.addEventListener('scroll', edges, { passive: true });
  for (const b of app.querySelectorAll('[data-path]')) {
    b.addEventListener('click', () => { showHabit(b.dataset.path); home(); focusOn(`[data-path="${b.dataset.path}"]`); });
  }
  app.querySelector('[data-add]').addEventListener('click', addHabit);
  app.querySelector('[data-log]')?.addEventListener('click', () => {
    progress = logToday(progress, habitShown, shownHabit.title);
    let got;
    ({ progress, newly: got } = award(progress));
    save();
    if (got.length) arrive(got); else play('tap');
    buzz('right');
    home(null, got);
    focusOn('.log-habit [role="status"]');
  });
  app.querySelector('[data-undo]')?.addEventListener('click', () => {
    progress = unlogToday(progress, habitShown);
    save();
    home();
    focusOn('[data-log]');
  });
  app.querySelector('[data-edit]')?.addEventListener('click', () => editHabit(shownHabit));
  app.querySelector('[data-place]')?.addEventListener('click', () => { stopHome(); survey(offer); });
  app.querySelector('[data-dismiss]')?.addEventListener('click', () => {
    progress = placeAt(progress, offer.id, null);
    save();
    home();
    focusOn('.cta .next');
  });
  app.querySelector('[data-review]')?.addEventListener('click', () =>
    run(null, reviewKeys.map((k) => ({ key: k, ...items.get(k) })), 'Review'));
  for (const btn of app.querySelectorAll('[data-lesson]')) {
    btn.addEventListener('click', () => {
      const n = units.flatMap((u) => u.nodes).find((x) => x.id === btn.dataset.lesson);
      run(n.id, n.lesson.items.map((item) => ({ key: `${n.subject.id}:${item.id}`, ...items.get(`${n.subject.id}:${item.id}`) })), n.lesson.title);
    });
  }
}

/**
 * A habit's tab on home: its icon, name and, once it has had a session, its streak, coloured by
 * today's light. Pressed when its path is the one shown.
 */
function habitTab(h) {
  const n = currentStreak(progress, new Date(), h.id);
  const started = !!progress.habits[h.id]?.last;
  return `<button class="path-tab" data-path="${esc(h.id)}" aria-pressed="${h.id === habitShown}"
    aria-label="${esc(h.name)}${started ? `, ${n}-day streak` : ''}">${esc(h.icon)} ${esc(h.name)}${started ? ` <b class="streak-${light(progress, new Date(), h.id)}">${n}</b>` : ''}</button>`;
}

/**
 * A habit's view: its streak, the last seven days (each day's sessions, today first) and a month
 * of filled squares. The week ends today rather than on a Sunday, so it is always seven real days
 * and never a row of days still to come. Days without a session are plain.
 */
function habitView(id, back = () => { home(); focusOn('.streak-line'); }) {
  stopHome();
  const h = habitOf(id);
  const now = new Date();
  const n = currentStreak(progress, now, id);
  const rest = restDays(progress.habits[id]);
  const detail = subjects.find((s) => s.habit === id)?.dayDetail || (() => '');
  const month = habitDays(progress, id, 28, now);
  const week = month.slice(-7);
  const active = month.slice(-14).filter((d) => d.sessions.length).length;
  const cell = ({ date, sessions }) => `<li class="${sessions.length ? 'on' : rest.has(date) ? 'rest' : ''}">
    <span>${dateOf(date).toLocaleDateString('en', { weekday: 'narrow' })}</span><b>${dateOf(date).getDate()}</b></li>`;
  const day = ({ date, sessions }) => `<section class="day"><h3>${dayName(date, now)}</h3>${sessions.length
    ? `<ul>${sessions.map((e) => `<li>${esc(sessionLine(e))}</li>`).join('')}</ul>${detail(progress, date)}`
    : `<p class="quiet">${rest.has(date) ? REST_DAY : QUIET_DAY}</p>`}</section>`;
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="habit">
      <h1><span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}</h1>
      <p class="said">${n ? `${n}-day streak` : NO_STREAK}</p>
      ${TIMINGS[id] ? `<button class="link timings-link">${esc(TIMING_WORDS.link)}</button>` : ''}
      <h2>This week</h2>
      <ol class="week" aria-hidden="true">${week.map(cell).join('')}</ol>
      ${[...week].reverse().map(day).join('')}
      <h2>Keeping it up</h2>
      <p>${active ? `${active} of the last 14 days` : FIRST_SQUARE}</p>
      <div class="month" role="img" aria-label="Days with a session, last four weeks">${month.map((d) => `<i${d.sessions.length ? ' class="on"' : ''}></i>`).join('')}</div>
    </main>`;
  focusOn('h1');
  app.querySelector('.back').addEventListener('click', back);
  app.querySelector('.timings-link')?.addEventListener('click', () => timingsView(id, () => { habitView(id, back); focusOn('.timings-link'); }));
}

/**
 * A practice habit's own timings (practice/timings.js): a − and + stepper per value with the
 * default beside it, and "Back to defaults". Each tap saves; nothing to confirm.
 */
function timingsView(id, back) {
  const h = habitOf(id);
  const all = TIMINGS[id];
  const own = () => progress.timings?.[id] ?? {};
  const fmt = (v, r) => `${v}${r.unit ? ` ${r.unit}` : ''}`;
  // A growing value starts from what the next session's lesson uses.
  const units = subjects.filter((s) => s.habit === id).flatMap((s) => unitsOf(progress, s));
  const subject = subjects.find((s) => s.habit === id);
  const { current, repeat } = nextUp(units, subject?.again);
  const nodes = units.flatMap((u) => u.nodes);
  const usual = pathTimings(id, nodes.map((n) => n.lesson), nodes.indexOf(current ?? repeat), subject?.varied);
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="habit timings">
      <h1>${esc(TIMING_WORDS.link)}</h1>
      <p class="said"><span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}. ${esc(TIMING_WORDS.intro)}</p>
      <ul class="steppers">${Object.entries(all).map(([k, r]) => `<li data-k="${k}">
        <span id="t-${k}">${esc(r.label)}</span>
        <div class="stepper">
          <button class="step" data-d="-1" aria-label="Less" aria-describedby="t-${k}">−</button>
          <output aria-live="polite"></output>
          <button class="step" data-d="1" aria-label="More" aria-describedby="t-${k}">+</button>
        </div></li>`).join('')}</ul>
      <button class="choice timings-reset">${esc(TIMING_WORDS.reset)}</button>
    </main>`;
  const paint = () => {
    for (const li of app.querySelectorAll('.steppers li')) {
      const r = all[li.dataset.k];
      const set = timed(id, { [li.dataset.k]: undefined }, own())[li.dataset.k];
      const v = set ?? r.def ?? usual[li.dataset.k];
      // A value that differs per step reads "As written (15–25 s)" until it is set.
      const steps = r.varies && subject?.varied?.[li.dataset.k];
      const written = steps && `${spread(steps).join('–')}${r.unit ? ` ${r.unit}` : ''}`;
      const note = r.def != null ? `default ${r.def}` : written ? `default ${TIMING_WORDS.written.toLowerCase()}, ${written}`
        : set != null ? `default ${TIMING_WORDS.path}` : TIMING_WORDS.path;
      li.querySelector('output').innerHTML = written && set == null ? `<b>${esc(TIMING_WORDS.written)}</b> <small>(${esc(written)})</small>`
        : `<b>${esc(fmt(v, r))}</b> <small>(${esc(note)})</small>`;
      li.querySelector('[data-d="-1"]').disabled = v <= r.min;
      li.querySelector('[data-d="1"]').disabled = v >= r.max;
      li.classList.toggle('own', set != null);
    }
    app.querySelector('.timings-reset').disabled = !Object.keys(own()).length;
  };
  const keep = (mine) => { progress = { ...progress, timings: { ...progress.timings, [id]: mine } }; save(); paint(); };
  for (const b of app.querySelectorAll('.step')) b.addEventListener('click', () => {
    const k = b.closest('li').dataset.k;
    const r = all[k];
    const v = timed(id, { [k]: r.def ?? usual[k] }, own())[k];
    keep(setTiming(own(), id, k, Math.min(r.max, Math.max(r.min, v + Number(b.dataset.d) * (r.step ?? 1))), usual[k]));
  });
  app.querySelector('.timings-reset').addEventListener('click', () => { keep({}); focusOn('h1'); });
  app.querySelector('.back').addEventListener('click', back);
  paint();
  focusOn('h1');
}

/**
 * The garden's plants sway, its visitors move (new ones fly in) and its sky and grass live, each on the Web Animations API, so the svg is
 * drawn once. Paused while it is off screen or the tab is hidden; nothing moves under reduced
 * motion. Returns the stop.
 */
function liven(el) {
  const anims = [...el.querySelectorAll('svg.plant')].map(sway)
    .concat([...el.querySelectorAll('svg.visitor')].flatMap((v) => animateVisitor(v, v.dataset.kind, 'new' in v.dataset) || []))
    .concat(animateScene(el))
    .filter(Boolean);
  if (!anims.length) return () => {};
  let seen = true;
  const sync = () => anims.forEach((a) => (seen && !document.hidden ? a.play() : a.pause()));
  const watch = new IntersectionObserver(([e]) => { seen = e.isIntersecting; sync(); });
  watch.observe(el);
  document.addEventListener('visibilitychange', sync);
  return () => { watch.disconnect(); document.removeEventListener('visibilitychange', sync); anims.forEach((a) => a.cancel()); };
}

const shortDate = (date) => dateOf(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** One thing that arrived, drawn small beside its line: "A butterfly arrived · 12 Oct". */
const arrival = ({ gift, text, on }, habit) =>
  `<span class="arrival">${gift === 'flower' ? flower(habit) : visitor(gift)}<span>${esc(text)}${on ? ` · ${shortDate(on)}` : ''}</span></span>`;

/** What arrived in the garden is heard: the first thing's own sound, after `wait` ms. */
const arrive = (newly, wait = 0) => { if (newly.length) setTimeout(() => chime(newly[0].gift), wait); };

/** What a session brought to the garden, quietly: three lines at most, then "and N more". */
const arrivals = (newly) => (!newly.length ? '' : `<ul class="arrivals">
  ${newly.slice(0, 3).map((r) => `<li>${arrival(r, r.habit)}</li>`).join('')}
  ${newly.length > 3 ? `<li>${esc(moreArrived(newly.length - 3))}</li>` : ''}</ul>`);

/**
 * The whole garden, tall, with a card per plant under it: its stage, days practised, a gentle
 * hint of the next stage and what has arrived. A plant or its card opens its habit view, whose
 * Back comes here. `from` is the plant to put focus back on.
 */
function gardenView(from = null) {
  stopHome();
  const g = garden(progress);
  const card = (p) => {
    const h = habitOf(p.habit);
    const words = plantWords(p);
    const kind = p.plant || PLANTS[p.habit];
    return `<li><button class="plant-card" data-plant="${esc(p.habit)}">
      <span class="kicker">${esc(h.icon)} ${esc(h.name)}</span>
      <b>${esc(kind[0].toUpperCase() + kind.slice(1))} · ${esc(p.name)}</b>
      ${words.days ? `<span>${esc(words.days)}</span>` : ''}
      ${words.next ? `<span class="hint">${esc(words.next)}</span>` : ''}
      ${[...p.flowers, ...p.visitors].sort((a, b) => a.on.localeCompare(b.on)).map((a) => arrival(a, p.habit)).join('')}
    </button></li>`;
  };
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="garden-page">
      <h1>Your garden</h1>
      <div class="garden-view">${drawGarden(g, 'tall')}</div>
      <ul class="plant-cards">${g.plants.map(card).join('')}</ul>
    </main>`;
  stopHome = liven(app.querySelector('.garden-view'));
  focusOn(from ? `[data-plant="${from}"]` : 'h1');
  const open = (id) => habitView(id, () => gardenView(id));
  app.querySelector('.back').addEventListener('click', () => { home(); focusOn('.garden-link'); });
  app.querySelector('.garden-view').addEventListener('click', (e) => {
    const p = e.target.closest('svg.plant');
    if (p) open(p.dataset.habit);
  });
  for (const b of app.querySelectorAll('[data-plant]')) b.addEventListener('click', () => open(b.dataset.plant));
}

/**
 * A self-reported habit's part of home, in place of a path. Before today's tap: a short hint, and
 * the big button sits in the footer. After it: a calm "done", today's streak, anything that arrived
 * in the garden (the end screens' own lines) and a small Undo for the rest of the day.
 */
function logPanel(h, logged, newly) {
  const n = currentStreak(progress, new Date(), h.id);
  return `<section class="log-habit">
    <h2><span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}</h2>
    ${logged ? `<p class="said" role="status">${esc(LOG_WORDS.done)}</p>
      <div class="chips">${chip('log', `${h.name.toUpperCase()} STREAK`, `${h.icon} ${n}`)}</div>
      ${arrivals(newly)}
      <button class="link" data-undo>${esc(LOG_WORDS.undo)}</button>`
    : `<p class="said">${esc(LOG_WORDS.hint)}</p>`}
    <button class="link" data-edit>${esc(LOG_WORDS.edit)}</button>
  </section>`;
}

/** Back to home showing `id`'s tab, with focus on it. */
const homeOn = (id) => { showHabit(id); home(); focusOn(`[data-path="${id}"]`); };

/**
 * The "+ Habit" sheet: the presets not yet on the tabs, any hidden habit to bring back (its days
 * kept), and "Make your own". One tap starts tracking.
 */
function addHabit() {
  stopHome();
  const shown = new Set(habits().filter((h) => !h.hidden).map((h) => h.id));
  const offer = [...PRESETS.filter((p) => !shown.has(p.id)), ...habits().filter((h) => h.own && h.hidden)];
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="survey add-habit">
      <h1>Add a habit</h1>
      <p class="said">${esc(LOG_WORDS.add)}</p>
      ${offer.map((h) => `<button class="choice" data-track="${esc(h.id)}"><span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}</button>`).join('')}
      <button class="choice" data-own>${esc(LOG_WORDS.own)}</button>
    </main>`;
  focusOn('h1');
  app.querySelector('.back').addEventListener('click', () => { home(); focusOn('[data-add]'); });
  for (const b of app.querySelectorAll('[data-track]')) {
    b.addEventListener('click', () => {
      progress = track(progress, { id: b.dataset.track, hidden: false });
      save();
      chime('plant');
      homeOn(b.dataset.track);
    });
  }
  app.querySelector('[data-own]').addEventListener('click', () => editHabit(null));
}

/**
 * Make a habit of the learner's own (`h` null), or change one: its name, icon and plant, for their
 * own; and for any self-reported habit, hiding it. The name is theirs: kept as typed (trimmed),
 * never judged, and always escaped.
 */
function editHabit(h) {
  stopHome();
  const own = !h || h.own;
  const picks = (name, values, chosen, show) => `<fieldset class="pick pick-${name}"><legend>${esc(LOG_WORDS[name])}</legend>
    ${values.map((v, i) => `<label><input type="radio" name="${name}" value="${esc(v)}"${(chosen ? v === chosen : !i) ? ' checked' : ''}>${show(v)}</label>`).join('')}</fieldset>`;
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="survey own-habit">
      <h1>${esc(h ? LOG_WORDS.editTitle : LOG_WORDS.ownTitle)}</h1>
      ${h ? `<p class="said"><span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}</p>` : ''}
      ${own ? `<form>
        <label class="field">${esc(LOG_WORDS.name)}<input name="name" maxlength="30" required pattern=".*\\S.*" autocomplete="off" value="${esc(h?.name || '')}"></label>
        ${picks('icon', OWN_ICONS, h?.icon, (v) => `<span>${esc(v)}</span>`)}
        ${picks('plant', OWN_PLANTS, h?.plant, (v) => `<span>${plant(v, 4)}<span>${esc(v[0].toUpperCase() + v.slice(1))}</span></span>`)}
        <button class="next">${esc(h ? LOG_WORDS.save : LOG_WORDS.create)}</button>
      </form>` : ''}
      ${h ? `<button class="choice" data-hide>${esc(LOG_WORDS.hide)}</button><p class="said">${esc(LOG_WORDS.hideNote)}</p>` : ''}
    </main>`;
  focusOn(own ? '[name="name"]' : 'h1');
  app.querySelector('.back').addEventListener('click', () => (h ? homeOn(h.id) : addHabit()));
  app.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    progress = track(progress, { id: h?.id, name: data.get('name'), icon: data.get('icon'), plant: data.get('plant') });
    save();
    if (!h) chime('plant');
    homeOn(h?.id || progress.tracked.at(-1).id);
  });
  app.querySelector('[data-hide]')?.addEventListener('click', () => {
    progress = track(progress, { id: h.id, hidden: true });
    save();
    showHabit(HABITS[0].id);
    home();
    focusOn('[data-add]');
  });
}

/**
 * Lumi hops along the path from the lesson just finished to the next one, and that lesson's tick
 * pops in: the learner sees themselves move forward. Skipped under reduced motion (null).
 */
function walkTo(guide, fromNode, toNode) {
  const a = fromNode.getBoundingClientRect();
  const b = toNode.getBoundingClientRect();
  const dx = a.left - b.left;
  const dy = a.top - b.top;
  move(fromNode, [{ transform: 'scale(.6)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
  const HOPS = 3;
  const frames = [];
  for (let i = 0; i <= HOPS * 2; i++) {
    const k = i / (HOPS * 2);
    const lift = i % 2 ? -14 : 0; // up on the odd frames: a hop between each landing
    frames.push({ transform: `translate(${dx * (1 - k)}px, ${dy * (1 - k) + lift}px)` });
  }
  return move(guide, frames, { duration: 1300, delay: 350, easing: 'ease-in-out', fill: 'backwards' });
}

/**
 * Plays a session: a lesson (lessonId set) or a review (null). An item missed the first time
 * comes back once at the end; only the first try counts toward review scheduling.
 */
function run(lessonId, queue, title) {
  stopHome();
  // A practice routine (Calm) has no right or wrong: no meter heat, no runs, no review cards.
  const practice = queue[0]?.subject.kind === 'practice';
  const who = queue[0].subject.coach; // the session's coach and their lines
  const did = []; // what each practice item did, for its end screen ("3 breaths")
  let journal = null; // what a Reflect item wrote, for the journal (never the log)
  const results = [];
  let at = 0;
  let streak = 0; // right answers in a row, this session
  let cleanup = () => {};
  const started = Date.now();
  app.innerHTML = `
    <header class="bar">
      <button class="close" aria-label="${practice ? 'Stop' : 'Quit lesson'}">✕</button>
      <div ${practice ? 'hidden ' : ''}class="meter" data-heat="0" role="progressbar" aria-label="Lesson progress" aria-valuemin="0"><div class="fill"><i class="shine"></i></div><span class="flare" aria-hidden="true"></span></div>
    </header>
    <main class="play">
      <p class="topic"></p>
      <div class="coach${who.demonstrates ? ' demonstrates' : ''}">
        <button class="who" aria-label="${esc(who.name)}"></button>
        <p class="bubble" id="said" aria-live="polite"></p>
      </div>
      <div class="stage"></div>
    </main>
    <footer class="foot">
      <div class="verdict" id="verdict"><strong></strong><p></p></div>
      <button class="next">Continue</button>
    </footer>`;
  const $ = (sel) => app.querySelector(sel);
  const [topic, bubble, stage, foot, next] = ['.topic', '.bubble', '.stage', '.foot', '.next'].map($);
  const sessionCoach = coach($('.who'), who.draw);
  let said = '';
  const quit = () => { cleanup(); sessionCoach.stop(); };
  $('.close').addEventListener('click', () => { quit(); home(); focusOn('.cta .next'); });

  // Tapping Rosa: a hop and a line, then back to the question.
  let aside;
  $('.who').addEventListener('click', () => {
    play('tap');
    sessionCoach.hop();
    bubble.textContent = line('tapped', Math.random(), who.lines);
    clearTimeout(aside);
    aside = setTimeout(() => { bubble.textContent = said; }, 2500);
  });

  // The bar warms with the run: green, then gold at three in a row, then an orange glow at five.
  const meterEl = $('.meter');
  const meter = () => {
    meterEl.style.setProperty('--at', `${(100 * at) / queue.length}%`);
    meterEl.dataset.heat = streak >= 5 ? 2 : streak >= 3 ? 1 : 0;
    meterEl.setAttribute('aria-valuemax', queue.length);
    meterEl.setAttribute('aria-valuenow', at);
  };
  const shine = () => move($('.shine'), [{ transform: 'translateX(-100%)' }, { transform: 'translateX(350%)' }], { duration: 650, easing: 'ease-out' });
  // The flare is hidden (visibility, not just opacity) except while it plays. Easing goes per
  // keyframe: an overall ease-out stretched the fade into a faint pill that lingered onto the next item.
  const flareEl = $('.flare');
  const flare = (text) => {
    flareEl.textContent = text;
    move(flareEl, [
      { visibility: 'visible', opacity: 0, transform: 'translate(-50%, 6px) scale(.6)', easing: 'ease-out' },
      { visibility: 'visible', opacity: 1, transform: 'translate(-50%, 0) scale(1.1)', offset: 0.15 },
      { visibility: 'visible', opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.85, easing: 'ease-in' },
      { visibility: 'visible', opacity: 0, transform: 'translate(-50%, -4px) scale(1)' },
    ], { duration: 1400 });
  };
  const step = () => {
    cleanup();
    flareEl.getAnimations().forEach((a) => a.finish()); // a flare belongs to its answer, never the next item
    meter();
    foot.className = 'foot';
    if (at === queue.length) { sessionCoach.stop(); return practice ? finishRoutine() : finish(); }
    const entry = queue[at];
    topic.textContent = entry.topic;
    sessionCoach.set(who.start);
    cleanup = entry.subject.mount(stage, entry.item, {
      say: (text, mood) => {
        said = bubble.textContent = text;
        if (mood) sessionCoach.set(mood);
      },
      coachEl: $('.who'),
      coach: who,
      help: who.help,
      timings: progress.timings?.[entry.subject.habit],
      done: (correct, text = '', kept = null) => {
        // A practice item goes straight on: its own buttons were the Continue.
        if (practice) { if (text) did.push(text); if (kept) journal = kept; at++; return step(); }
        if (correct !== null && !entry.retry) results.push({ key: entry.key, correct });
        if (correct === false && !entry.retry) queue.push({ ...entry, retry: true });
        at++;
        let kind = 'plain';
        if (correct === true) {
          streak++;
          kind = rightAnswer(streak);
          if (kind !== 'correct') flare(`${streak} in a row`);
          sessionCoach.set('correct');
          sessionCoach.hop();
          play(kind === 'correct' ? 'right' : 'run');
          buzz('right');
        } else if (correct === false) {
          streak = 0;
          kind = 'wrong';
          sessionCoach.set('wrong');
          sessionCoach.sway();
          play('wrong');
          buzz('wrong');
        }
        meter();
        shine();
        foot.className = `foot show ${correct === null ? 'plain' : correct ? 'right' : 'wrong'}`;
        foot.querySelector('strong').textContent = kind === 'plain' ? '' : line(kind);
        foot.querySelector('p').textContent = text;
        // Focus moves to Continue, which reads out the verdict (a teach card: Rosa's line). The
        // banner is fixed over the bottom, so nothing on the page moves.
        next.setAttribute('aria-describedby', correct === null ? 'said' : 'verdict');
        next.focus();
      },
    });
    // A question starts on its board (or its answers), not back at the top of the page.
    if (!foot.classList.contains('show')) stage.querySelector('[autofocus], svg[tabindex], .choice, .practice-go')?.focus();
  };
  next.addEventListener('click', step);

  /**
   * The end of any practice routine (Calm, Move…): settled, not a party. What was done, the habit's streak, and
   * "How do you feel?" as one optional tap that is kept on the log and never judged.
   */
  const finishRoutine = () => {
    const { subject, topic: technique } = queue[0];
    const firstTime = lessonId && !progress.done[lessonId];
    const mins = Math.max(1, Math.round((Date.now() - started) / 60000));
    progress = writeJournal(finishPractice(progress, subject.habit, lessonId, new Date(), { title: technique, mins }), journal);
    let newly;
    ({ progress, newly } = award(progress));
    save();
    const h = habitOf(subject.habit);
    const n = currentStreak(progress, new Date(), h.id);
    app.innerHTML = `
      <main class="summary practice-end">
        <div class="hero"></div>
        <p class="kicker">${esc(technique)}</p>
        <h1>${esc(line('done', Math.random(), who.lines))}</h1>
        <p class="said">${esc([...did, `${mins} min`].join(' · '))}</p>
        <div class="chips">
          ${chip(h.id, `${h.name.toUpperCase()} STREAK`, `${h.icon} ${n}`)}
        </div>
        ${arrivals(newly)}
        <section class="feel" aria-labelledby="feel-q">
          <h2 id="feel-q">How do you feel?</h2>
          <div class="feels">${feelsFor(who.feel).map(([value, label]) => `<button class="choice" data-feel="${value}">${esc(label)}</button>`).join('')}</div>
          <p class="said" role="status"></p>
        </section>
      </main>
      <footer class="cta"><button class="next">Continue</button></footer>`;
    const endCoach = coach(app.querySelector('.hero'), who.draw);
    endCoach.set('done');
    arrive(newly, 400);
    focusOn('h1');
    for (const b of app.querySelectorAll('[data-feel]')) {
      b.addEventListener('click', () => {
        const feel = b.dataset.feel;
        progress = noteFeel(progress, h.id, feel);
        save();
        play('tap');
        const section = app.querySelector('.feel');
        section.querySelector('.feels').remove();
        section.querySelector('[role="status"]').textContent = line(feel, Math.random(), who.lines);
        if (feel === 'no different' && who.help) section.insertAdjacentHTML('beforeend', helpHtml(who.help));
        focusOn('.cta .next');
      });
    }
    app.querySelector('.next').addEventListener('click', () => {
      endCoach.stop();
      home(firstTime ? lessonId : null);
      focusOn('.cta .next');
    });
  };

  const perfectRun = () => results.length > 0 && results.every((r) => r.correct);
  const finish = () => {
    const relit = needsRepair(progress);
    const firstTime = lessonId && !progress.done[lessonId];
    const seconds = Math.round((Date.now() - started) / 1000);
    progress = finishSession(progress, lessonId, results, new Date(), { title: title || 'Review', mins: Math.max(1, Math.round(seconds / 60)) });
    let newly;
    ({ progress, newly } = award(progress));
    save();
    const right = results.filter((r) => r.correct).length;
    const perfect = perfectRun();
    const missed = results.some((r) => !r.correct);
    // Speed is only praised when it wasn't bought with mistakes.
    const pace = missed ? 'STEADY' : paceLabel(seconds / queue.length);
    const kind = finished({
      review: !lessonId, perfect, relit: relit && !needsRepair(progress),
      fast: pace !== 'STEADY', missed,
    });
    const percent = results.length ? Math.round((100 * right) / results.length) : null;
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    app.innerHTML = `
      <main class="summary">
        <div class="duo">
          <div class="hero rosa"></div>
          <i class="spark" aria-hidden="true">✦</i>
          <div class="hero lumi"></div>
          <p class="cheer">${esc(line('lumi'))}</p>
        </div>
        <p class="kicker">${esc(lessonId ? title : 'Review done')}</p>
        <h1>${esc(headline(kind))}</h1>
        <p class="said">${esc(line(kind))}</p>
        <div class="chips">
          ${percent === null ? '' : chip('acc', accuracyLabel(percent), `${percent}%`)}
          ${chip('time', pace, clock)}
          ${chip('fire', STREAK_LABEL, `🔥 ${currentStreak(progress)}`)}
        </div>
        <p class="learned">${Object.keys(progress.cards).length} learned so far · ${right} of ${results.length} ${lessonId ? 'right first try' : 'recalled'}</p>
        ${arrivals(newly)}
      </main>
      <footer class="cta"><button class="next">Continue</button></footer>`;
    const [rosaEl, lumiEl] = app.querySelectorAll('.duo .hero');
    const cast = [coach(rosaEl, rosa), coach(lumiEl, lumi)];
    let left = false;
    for (const c of cast) c.set('correct');
    // The high five: both lean in and hop, a spark where the hands meet, then a proud bounce.
    const meet = (el, dx) => move(el, [
      { transform: 'translate(0, 0)' },
      { transform: `translate(${dx}px, -10px)`, offset: 0.45 },
      { transform: `translate(${dx}px, 0)`, offset: 0.6 },
      { transform: 'translate(0, 0)' },
    ], { duration: 900, delay: 200, easing: 'ease-in-out' });
    const leanIn = meet(rosaEl, 22);
    meet(lumiEl, -22);
    move(app.querySelector('.spark'), [
      { opacity: 0, transform: 'scale(.3) rotate(0)' },
      { opacity: 1, transform: 'scale(1.4) rotate(45deg)', offset: 0.4 },
      { opacity: 0, transform: 'scale(1.8) rotate(90deg)' },
    ], { duration: 500, delay: 560, easing: 'ease-out' });
    move(app.querySelector('.cheer'), [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, delay: 560, easing: 'ease-out', fill: 'backwards' });
    app.querySelectorAll('.chip').forEach((el, i) =>
      move(el, [{ opacity: 0, transform: 'translateY(12px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 700 + i * 140, easing: 'ease-out', fill: 'backwards' }));
    const settle = () => {
      if (left) return;
      for (const c of cast) c.set('complete');
      cast[0].hop();
      setTimeout(() => !left && cast[1].hop(), 140);
    };
    if (leanIn) leanIn.finished.then(settle, () => {}); else settle();
    focusOn('h1');
    play('done');
    arrive(newly, 900);
    buzz('done');
    const stopParty = perfect ? confetti() : () => {};
    app.querySelector('.summary').addEventListener('click', stopParty);
    app.querySelector('.next').addEventListener('click', () => {
      left = true;
      stopParty();
      for (const c of cast) c.stop();
      home(firstTime ? lessonId : null);
      focusOn('.cta .next');
    });
  };

  step();
}

/**
 * Confetti for a lesson right first time all through. About 2.6 s, skipped by a tap (the returned
 * function) and by reduced motion.
 */
function confetti() {
  if (reducedMotion()) return () => {};
  const layer = document.createElement('div');
  layer.className = 'confetti';
  const colours = ['#F5A524', '#4caf73', '#6E82A8', '#F28C8C', '#FFD978'];
  for (let i = 0; i < 40; i++) {
    const bit = document.createElement('i');
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colours[i % colours.length];
    layer.append(bit);
    bit.animate([
      { transform: 'translateY(0) rotate(0)' },
      { transform: `translateY(${window.innerHeight + 40}px) rotate(${360 + Math.random() * 360}deg)` },
    ], { duration: 1800 + Math.random() * 800, delay: Math.random() * 300, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'forwards' });
  }
  document.body.append(layer);
  const timer = setTimeout(() => layer.remove(), 2600);
  return () => { clearTimeout(timer); layer.remove(); };
}

/** A subject's optional placement question (`subject.placement`), offered on home by its path. */
function survey(subject) {
  const { question, options } = subject.placement;
  app.innerHTML = `
    <main class="survey">
      <div class="hero"></div>
      <h1>${esc(question)}</h1>
      <p class="said">Pick the closest. It only sets where you start: every earlier lesson stays open.</p>
      ${options.map(([label], i) => `<button class="choice" data-i="${i}">${esc(label)}</button>`).join('')}
      <button class="link" data-back>Back</button>
    </main>`;
  const guide = coach(app.querySelector('.hero'), lumi);
  guide.set('teach');
  focusOn('h1');
  for (const b of app.querySelectorAll('[data-i]')) {
    b.addEventListener('click', () => { guide.stop(); suggest(subject, options[b.dataset.i][1]); });
  }
  app.querySelector('[data-back]').addEventListener('click', () => { guide.stop(); home(); focusOn('[data-place]'); });
}

function suggest(subject, unit) {
  const first = subject.units[0].title;
  if (unit === first) return place(subject, first);
  app.innerHTML = `
    <main class="survey">
      <div class="hero"></div>
      <h1>Start at ${esc(unit)}?</h1>
      <p class="said">That's where Lumi suggests you begin. The lessons before it stay open, if you want a refresher.</p>
      <button class="next" data-start>Start at ${esc(unit)}</button>
      <button class="choice" data-first>Start from the beginning</button>
    </main>`;
  const guide = coach(app.querySelector('.hero'), lumi);
  guide.set('correct');
  guide.hop();
  focusOn('h1');
  app.querySelector('[data-start]').addEventListener('click', () => { guide.stop(); place(subject, unit); });
  app.querySelector('[data-first]').addEventListener('click', () => { guide.stop(); place(subject, first); });
}

function place(subject, unit) {
  progress = placeAt(progress, subject.id, unit);
  save();
  home();
  focusOn('.cta .next');
}

/** Save progress to a file, or load one back: for a new device, or a browser that cleared it. */
function keep(note = '') {
  app.innerHTML = `
    <main class="survey">
      <h1>Your progress</h1>
      <p class="said">Keep a copy in a file, or load one from another device.</p>
      <button class="choice" data-save>Save to a file</button>
      <button class="choice" data-load>Load from a file</button>
      <input type="file" accept=".json,application/json" hidden>
      <p class="said" role="status">${esc(note)}</p>
      <button class="choice" data-change>${esc(INTRO_WORDS.change)}</button>
      <h2>Calm sounds</h2>
      ${CALM_SOUNDS.map(([name, label]) => `<button class="choice" data-pref="${name}" aria-pressed="${calmPref(name)}">${esc(label)}</button>`).join('')}
      <button class="choice" data-back>Back</button>
    </main>`;
  for (const b of app.querySelectorAll('[data-pref]')) {
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      setPref(b.dataset.pref, on);
      b.setAttribute('aria-pressed', on);
      if (on && b.dataset.pref === 'bell') play('bell');
    });
  }
  const status = app.querySelector('[role="status"]');
  const input = app.querySelector('input');
  focusOn('h1');
  app.querySelector('[data-back]').addEventListener('click', () => { home(); focusOn('.menu'); });
  app.querySelector('[data-change]').addEventListener('click', () => want(true));
  app.querySelector('[data-save]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(progress)], { type: 'application/json' }));
    a.download = `drill-progress-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    status.textContent = 'Saved.';
  });
  app.querySelector('[data-load]').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    let p = null;
    try { p = migrate(JSON.parse(await input.files[0].text())); } catch { /* not JSON */ }
    input.value = ''; // the same file can be picked again
    if (p) confirmLoad(p);
    else status.textContent = "That file isn't Drill progress, so nothing changed.";
  });
}

const tally = (p) => {
  const n = Object.keys(p.done).length;
  return `${n} lesson${n === 1 ? '' : 's'} done, a ${currentStreak(p)}-day streak`;
};

function confirmLoad(p) {
  app.innerHTML = `
    <main class="survey">
      <h1>Use this file?</h1>
      <p class="said">The file has ${tally(p)}. It replaces what's here now: ${tally(progress)}.</p>
      <button class="next" data-use>Use this file</button>
      <button class="choice" data-keep>Keep what's here</button>
    </main>`;
  focusOn('h1');
  app.querySelector('[data-use]').addEventListener('click', () => { progress = p; save(); home(); focusOn('.cta .next'); });
  app.querySelector('[data-keep]').addEventListener('click', () => keep('Nothing changed.'));
}

/**
 * The first-visit intro, step 1: what Drill can do, one plain line each, with Lumi. Shown once
 * (`progress.picked` records it); Skip leaves the default home.
 */
function intro() {
  const row = (icon, text) => `<li><span aria-hidden="true">${esc(icon)}</span><span>${esc(text)}</span></li>`;
  app.innerHTML = `
    <main class="survey intro">
      <div class="hero"></div>
      <h1>${esc(INTRO_WORDS.title)}</h1>
      <ul class="does">
        ${HABITS.filter((h) => INTRO_WORDS.does[h.id]).map((h) => row(h.icon, INTRO_WORDS.does[h.id])).join('')}
        ${row('👆', INTRO_WORDS.does.track)}
        ${row('🌻', INTRO_WORDS.garden)}
        ${row('🔒', INTRO_WORDS.privacy)}
      </ul>
    </main>
    <footer class="cta">
      <button class="next" data-next>${esc(INTRO_WORDS.next)}</button>
      <button class="link" data-skip>${esc(INTRO_WORDS.skip)}</button>
    </footer>`;
  const guide = coach(app.querySelector('.hero'), lumi);
  guide.set('teach');
  focusOn('h1');
  app.querySelector('[data-next]').addEventListener('click', () => { guide.stop(); want(); });
  app.querySelector('[data-skip]').addEventListener('click', () => { guide.stop(); choose([]); });
}

/**
 * Step 2, and the ⋯ menu's "Change what you see" (`change`): Learn something and Build habits, each
 * opening its own list. Picks are kept in the order tapped; home shows them first (ordered()).
 */
function want(change = false) {
  const courses = subjects.filter((s) => s.kind === 'learn');
  const list = [...HABITS.filter((h) => !courses.some((s) => s.habit === h.id)), ...PRESETS];
  const branch = { learn: courses.map((s) => s.habit), habits: list.map((h) => h.id) };
  let picked = (progress.picked || []).filter((id) => branch.learn.includes(id) || branch.habits.includes(id));
  const on = (id) => picked.includes(id);
  const toggle = (attr, id, pressed, label) => `<button class="choice" ${attr}="${esc(id)}" aria-pressed="${pressed}">${label}</button>`;
  const open = (b) => branch[b].some(on);
  app.innerHTML = `
    <main class="survey intro">
      <h1>${esc(INTRO_WORDS.want)}</h1>
      <p class="said">${esc(INTRO_WORDS.wantSaid)}</p>
      ${toggle('data-want', 'learn', open('learn'), esc(INTRO_WORDS.learn))}
      <section class="branch" data-branch="learn"${open('learn') ? '' : ' hidden'}>
        <h2>${esc(INTRO_WORDS.courses)}</h2>
        ${courses.map((s) => toggle('data-pick', s.habit, on(s.habit), esc(s.title))).join('')}
        ${INTRO_WORDS.soonCourses.map((n) => `<button class="choice" disabled>${esc(n)} <small>· ${esc(INTRO_WORDS.soon)}</small></button>`).join('')}
      </section>
      ${toggle('data-want', 'habits', open('habits'), esc(INTRO_WORDS.habits))}
      <section class="branch" data-branch="habits"${open('habits') ? '' : ' hidden'}>
        <h2>${esc(INTRO_WORDS.habitList)}</h2>
        ${list.map((h) => toggle('data-pick', h.id, on(h.id), `<span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}`)).join('')}
      </section>
    </main>
    <footer class="cta">
      <button class="next" data-done>${esc(INTRO_WORDS.done)}</button>
      <button class="link" data-skip>${esc(change ? INTRO_WORDS.back : INTRO_WORDS.skip)}</button>
    </footer>`;
  focusOn('h1');
  const press = (b, pressed) => b.setAttribute('aria-pressed', pressed);
  for (const b of app.querySelectorAll('[data-pick]')) {
    b.addEventListener('click', () => {
      picked = on(b.dataset.pick) ? picked.filter((id) => id !== b.dataset.pick) : [...picked, b.dataset.pick];
      press(b, on(b.dataset.pick));
    });
  }
  // Opening a branch shows its list; with one live course, Learn picks it straight away. Closing
  // one drops its picks.
  for (const b of app.querySelectorAll('[data-want]')) {
    b.addEventListener('click', () => {
      const id = b.dataset.want;
      const opening = b.getAttribute('aria-pressed') !== 'true';
      press(b, opening);
      app.querySelector(`[data-branch="${id}"]`).hidden = !opening;
      if (opening && id === 'learn' && branch.learn.length === 1 && !on(branch.learn[0])) picked = [...picked, branch.learn[0]];
      if (!opening) picked = picked.filter((x) => !branch[id].includes(x));
      for (const p of app.querySelectorAll(`[data-branch="${id}"] [data-pick]`)) press(p, on(p.dataset.pick));
    });
  }
  app.querySelector('[data-done]').addEventListener('click', () => choose(picked));
  app.querySelector('[data-skip]').addEventListener('click', () => (change ? (home(), focusOn('.menu')) : choose([])));
}

/**
 * Home after the intro: the picks come first and the first is shown; picked one-tap habits are
 * switched on the way + Habit does (track). [] is a skip: today's default home.
 */
function choose(picked) {
  for (const id of picked) if (PRESETS.some((p) => p.id === id)) progress = track(progress, { id, hidden: false });
  progress = { ...progress, picked };
  save();
  if (picked.length) showHabit(picked[0]);
  scrollTo(0, 0); // home starts at its top, not where the list was scrolled to
  home();
  focusOn(picked.length ? '.cta .next' : 'h1');
}

if (showsIntro(progress)) intro(); else home();
