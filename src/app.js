import { HABITS, OWN_ICONS, OWN_PLANTS, PRESETS, coursesFor, habitsFor, ordered, subjects } from './subjects.js';
import { GARDEN_WORDS, LIFE, LIFE_WORDS, SKIN_RULES, award, creatures, garden, flowersOpened, guide, listed, moreArrived, plantWords } from './garden/model.js';
import { lifeArt, lifeBox } from './cast/butterfly.js';
import { fieldGuide } from './guide.js';
import { PLANTS, animateLandmarks, animateScene, animateVisitor, drawGarden, flower, landmark, plant, sway, visitor } from './garden/art.js';
import { ASKS, shouldAsk } from './keep.js';
import { COMEBACK_WORDS, PAUSED_WORDS, activeComeback, answerComeback, noteReminder, preferred, reminderHour, remindersPaused, shorter, shouldRemind, startComeback, usualHours, usualLine } from './fitting.js';
import { WINGS, firstToday, emptyProgress, nextUp, unitsOf, finishPractice, leavePractice, logToday, setWhen, track, unlogToday, writeJournal, finishSession, meetsCoach, metCoach, noteFeel, currentStreak, dueKeys, habitDays, light, migrate, needsRepair, offersPlacement, placeAt, showsIntro, soonestKeys, today, waits } from './progress.js';
import { FIRST_SQUARE, NO_STREAK, QUIET_DAY, REST_DAY, dateOf, streakLine, showsStreak, dayName, restDays, sessionLine } from './habitview.js';
import { coach } from './cast/coach.js';
import { flap, lumi, lumiPerched } from './cast/lumi.js';
import { worn } from './cast/skins.js';
import { BOX, butterfly, butterflyToday } from './cast/butterfly.js';
import { CHECKPOINT, ECHOES, WARM_UPS, checkpoint, comeBack, dropEchoes, echoes, fresh, warmUps } from './repeat.js';
import { GOES, easier, flying, helpFor, misses, noteAnswer, struggling, warmedLast } from './adapt.js';
import { SIDEWAYS, giveRoom, giveWay, longestVerdict } from './fit.js';
import { CALM_SOUNDS, DARES_LABEL, SOUND_LABEL, QUIET_STREAK_LABEL, MOVE_ON, REMINDER_WORDS, KEEP_WORDS, SOUTH_LABEL, feelsFor, INTRO_WORDS, UPRIGHT, LOG_WORDS, CHOOSE_WORDS, SKIN_WORDS, WING_WORDS, STREAK_LABEL, accuracyLabel, finished, HEADLINES, LINES, line, paceLabel, rightAnswer, say, verdicts, VOICES } from './cast/lines.js';
import { buzz, calmPref, chime, cue, flourish, move, petals, play, pref, setPref, soundOn, voice } from './feel.js';
import { southern } from './garden/season.js';
import { lessonOf } from './garden/events.js';
import { moment } from './cast/voice.js';
import { chip, esc } from './html.js';
import { helpHtml } from './practice/kit.js';
import { TIMINGS, TIMING_WORDS, pathTimings, setTiming, spread, timed } from './practice/timings.js';
import { bridge, passNotes, sendArt, tellAndroid, tellBars, wingColours, wingState } from './widget.js';
import { profile as syncProfile, sync } from './sync/sync.js';
import { merge } from './sync/merge.js';
import { navigation } from './nav.js';
import { currentUnit, openPairLink, openSync, syncMenuHtml } from './sync/ui.js';

const STORE = 'wingbeat.progress';
const REVIEW_SIZE = 8;
const app = document.getElementById('app');

// A garden that already earned a landmark before landmarks existed gets it now, quietly. Everything
// else arrives after a session, where the end screen can say so.
let progress = award(load(), new Date(), (r) => r.habit === null).progress;
/** Every habit this learner has (built in, then their own; what the intro picked first), and one of them by id. */
const habits = () => ordered(habitsFor(progress), preferred(progress)); // picks first, then the ones finished most
const habitOf = (id) => habits().find((h) => h.id === id);
/** The first habit on the tabs: where home goes when the one it showed is hidden. */
const firstTab = () => habits().find((h) => !h.hidden)?.id ?? HABITS[0].id;
/** Lumi in what she wears (the wardrobe) with your butterfly on her head, or in the costume, its wings in your colours; a coach's drawing, Lumi dressed. */
const dressed = (mood, skin = worn(progress)) => lumi(mood, skin, wingColours(progress), wingColours(progress));
const drawOf = (c) => (c.draw === lumi ? dressed : c.draw);
/** Whose timings a habit plays by: its subject's `timings` (Wind down plays Calm's), or its own. */
const timingsOf = (id) => subjects.find((s) => s.habit === id)?.timings ?? id;

/** The widget's summary, with a quiet habit's streak count hidden unless the ⋯ switch shows it (decision 17). */
const tellWidget = () => tellAndroid(progress, (id) => showsStreak(id, pref('quiet-streaks', false)));

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
function save(synced = false) {
  try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* private mode: progress lasts the visit */ }
  tellWidget();
  sendArt(progress).catch(console.warn);
  if (!synced) syncSoon();
  // Ask the browser, quietly and once a visit, not to evict progress (Safari clears it after a week away).
  if (persistAsked) return;
  persistAsked = true;
  if (!ASKS) try { navigator.storage?.persisted?.().then((kept) => kept || navigator.storage.persist()).catch(() => {}); } catch { /* unsupported */ }
}

/** A browser that asks the person: bring its prompt up once ever, at home, never mid-lesson, and at most once a visit even with storage blocked. Recorded first, since a dismissed prompt may never answer. */
let keepAsked = false;
function askToKeep() {
  const know = () => ({ asks: ASKS, asked: keepAsked || pref('kept-asked', false), entries: progress.log.length });
  if (!shouldAsk(know())) return;
  keepAsked = true;
  try {
    navigator.storage.persisted().then((kept) => {
      if (!shouldAsk({ ...know(), asked: false, kept })) return;
      setPref('kept-asked', true);
      navigator.storage.persist().catch(() => {});
    }).catch(() => {});
  } catch { /* unsupported */ }
}

/**
 * Sync (src/sync/), only once turned on from ⋯: a moment after each save, and on opening, what
 * other devices did is merged in and the result uploaded. Offline it waits for the next save.
 * What came in while it ran is merged again, so a session finished meanwhile is kept.
 */
let syncTimer;
function syncSoon(wait = 2000) {
  if (!syncProfile()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const synced = await sync(progress, currentUnit(progress)).catch(() => null);
    if (synced) adopt(synced);
  }, wait);
}
/** Takes progress merged with another device's, and redraws home if that's where the learner is. */
function adopt(synced) {
  const next = merge(progress, synced) ?? progress;
  if (JSON.stringify(next) === JSON.stringify(progress)) return;
  progress = next;
  save(true);
  if (app.querySelector('.menu')) home();
}

// Every item by key, so a review can find what it is reviewing. Its topic is its unit's title, or a teach card's own `topic`
// (Chess's castling card, in the Attraction unit only because a puzzle there castles).
const items = new Map();
for (const s of subjects)
  for (const u of s.units)
    for (const l of u.lessons.filter((x) => !x.mix)) // a checkpoint only repeats its unit's items
      for (const item of l.items) items.set(`${s.id}:${item.id}`, { subject: s, item, topic: item.topic || u.title, lesson: l.id });

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
const HABIT_KEY = 'wingbeat.habit';
let habitShown = (() => {
  let h = null;
  try { h = localStorage.getItem(HABIT_KEY); } catch { /* private mode */ }
  return habits().some((x) => x.id === h && !x.hidden) ? h : firstTab();
})();
function showHabit(id) {
  habitShown = id;
  try { localStorage.setItem(HABIT_KEY, id); } catch { /* lasts the visit */ }
}

// The shown habit's coach greets home in its own voice (say() in lines.js). Kept per habit, light
// and day so a re-render doesn't change it; what was said lately and the day of the last dare
// are kept in storage, so lines don't repeat and a dare comes at most once a day.
const SAID = 'wingbeat.said';
const greeted = new Map();
function greeting(h) {
  // On Learning, the course shown speaks: Rosa, Kaede, Ada…
  const course = h.id === 'learn' ? courseShown.coach.name.toLowerCase() : undefined;
  const { coach: who, state, facts } = moment(progress, h, new Date(), course, showsStreak(h.id, pref('quiet-streaks', false)), course && courseShown.id);
  const dares = pref('dares', true);
  const key = `${h.id} ${course && courseShown.id} ${who} ${state.light} ${state.elsewhere} ${state.today} ${dares} ${facts.count}`;
  if (!greeted.has(key)) {
    let kept = {};
    try { kept = JSON.parse(localStorage.getItem(SAID)) || {}; } catch { /* private mode or unreadable */ }
    const recent = Array.isArray(kept.recent) ? kept.recent : [];
    const said = say(who, { ...state, dares, daredToday: kept.dared === state.today }, facts, Math.random, recent);
    try { localStorage.setItem(SAID, JSON.stringify({ recent: [...recent, said.line].slice(-6), dared: said.dare ? state.today : kept.dared })); } catch { /* lasts the visit */ }
    greeted.set(key, `<p class="said welcome greeting${said.dare ? ' dare' : ''}"><b>${esc(VOICES[who].name)}</b> ${esc(said.text)}</p>`);
  }
  return greeted.get(key);
}

// The courses (Learn subjects) share the Learning tab; it shows one course's path at a time,
// remembered like the habit shown.
const COURSE_KEY = 'wingbeat.course';
const courses = subjects.filter((s) => s.kind === 'learn');
let courseShown = (() => {
  let c = null;
  try { c = localStorage.getItem(COURSE_KEY); } catch { /* private mode */ }
  return courses.find((s) => s.id === c) || courses[0];
})();
function showCourse(id) {
  courseShown = courses.find((s) => s.id === id) || courses[0];
  try { localStorage.setItem(COURSE_KEY, courseShown.id); } catch { /* lasts the visit */ }
}
/** The courses in Learning's course row (what the intro picked, or all), and the course one builds on. */
const shownCourses = () => coursesFor(progress, courses);
const parentOf = (s) => (s.follows ? courses.find((c) => c.id === s.follows.course) : undefined);
/** Puts courses back in the row, each with the course it follows. */
function showCourses(ids) {
  for (const id of ids.flatMap((x) => [x, courses.find((c) => c.id === x)?.follows?.course]).filter(Boolean)) {
    if (progress.tracked.some((t) => t.id === id && t.hidden)) progress = track(progress, { id, hidden: false });
  }
}
/** `{name}`-style slots in our own words, filled. */
const fill = (text, slots) => text.replace(/\{(\w+)\}/g, (m, k) => slots[k] ?? m);

/**
 * How much larger than 16px the learner has asked for text: 1.3 in the Android app with the phone's text at 130%
 * (the WebView's text zoom follows it), 1.25 in a browser whose default font size is 20px (Chrome's "Font size: Large",
 * Firefox's Fonts setting; they change what 1rem is), more for small text under a minimum font size (a path's labels,
 * .8rem, at Firefox's or Chrome's "Minimum font size" of 20px: 1.56), 1 otherwise. A browser's zoom isn't text: it
 * enlarges px too and leaves this at 1. Set as --text-scale, so the room kept for text that px can't see (a path row,
 * the space under a fixed bar) grows with it; unset, the CSS falls back to 1.
 */
const TEXT = (() => {
  const k = [6.25, 0.8].map((rem) => { // 100px and a label's 12.8px, at 16px
    const probe = Object.assign(document.createElement('div'), { textContent: 'x' });
    probe.style.cssText = `position:absolute;visibility:hidden;font-size:${rem}rem;line-height:1`;
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h / (rem * 16);
  });
  return Math.max(1, Math.round(Math.max(...k) * 100) / 100);
})();
if (TEXT > 1) document.documentElement.style.setProperty('--text-scale', TEXT);
const ROW = 112 * TEXT; // px from one node to the next; the drawn path assumes it (and .path li's height)
const SWAY = 70; // px a node sits off centre at most

/**
 * Home: every unit as a winding path of quest markers, joined by a drawn line. A finished lesson
 * shows a tick; the next one a gold "!" with Lumi beside it; locked ones a grey "!". Reviews due
 * and one Continue button sit at the bottom. Today's light colours the streak chip.
 */
function home(arrived = null, newly = []) {
  stopHome();
  askToKeep();
  if (!habitOf(habitShown) || habitOf(habitShown).hidden) showHabit(firstTab());
  const fitted = startComeback(progress);
  if (fitted !== progress) { progress = fitted; save(); }
  const shownHabit = habitOf(habitShown);
  // A self-reported habit has no path: one big button instead (logPanel).
  const logged = shownHabit.kind === 'log' && light(progress, new Date(), habitShown) === 'bright';
  const learning = habitShown === 'learn';
  if (learning && !shownCourses().includes(courseShown)) showCourse(shownCourses()[0].id);
  // A course that follows another, before that much of it is done, offers the other first, and no path (decision 26).
  const parent = learning ? parentOf(courseShown) : undefined;
  const waiting = parent && waits(progress, courseShown, parent);
  const words = parent && { course: courseShown.title, parent: parent.title, units: courseShown.follows.units };
  // Learning shows one course at a time, and reviews that course's cards, so its coach runs them.
  const shownSubjects = learning ? [courseShown] : subjects.filter((s) => s.habit === habitShown);
  const ofCourse = (k) => items.get(k)?.subject === courseShown;
  const due = learning ? dueKeys(progress).filter(ofCourse) : [];
  // A repair needs a review even when nothing is due yet: then the soonest cards stand in.
  const repair = learning && needsRepair(progress);
  const reviewKeys = (due.length ? due : repair ? soonestKeys(progress).filter(ofCourse) : []).slice(0, REVIEW_SIZE);
  const units = waiting ? [] : shownSubjects.flatMap((s) => unitsOf(progress, s));
  // A subject's optional placement question, offered by its path until answered or dismissed.
  const offer = shownSubjects.find((s) => offersPlacement(progress, s));
  // Not brand new for a course the learner has just started here ("I know JavaScript"): its coach's own first meeting speaks.
  const brandNew = !progress.log.length && !Object.keys(progress.done).length && !(parent && typeof progress.start?.[courseShown.id] === 'string');
  // After the intro, Lumi's welcome names the first thing picked.
  // A course pick is kept as the Learning habit; the course it named is the one shown, so that names it.
  const first = progress.picked?.[0];
  const firstPick = brandNew && first && (first === courseShown.habit ? courseShown.title : habitOf(first)?.name);
  // The next lesson; a finished path whose subject has `again` ("Reflect today") keeps one of its lessons one tap away.
  const again = shownSubjects[0]?.again;
  const { current, repeat } = nextUp(units, again, progress.log);
  // A guided habit lets you pick another routine, and (not Reflect) count a day done away from the app.
  const guided = shownSubjects[0]?.kind === 'practice';
  const todays = progress.log.filter((e) => e.habit === habitShown && e.date === today(new Date()));
  const away = guided && habitShown !== 'reflect' && !todays.length;
  const finishedUnits = guided ? units.map((u) => ({ ...u, nodes: u.nodes.filter((n) => n.state === 'done') })).filter((u) => u.nodes.length) : [];
  const countedAway = guided && todays.some((e) => e.was !== undefined);
  // A practice often left at the same step offers a shorter one, for this session (fitting.js).
  const upNext = current ?? repeat;
  const short = upNext?.subject.kind === 'practice' && shorter(progress, habitShown, upNext.lesson, upNext.id, progress.timings?.[timingsOf(habitShown)]);
  const invite = activeComeback(progress);
  const minutes = `about ${Math.max(1, Math.round(reviewKeys.length * 0.4))} min`;
  const dueChip = !reviewKeys.length ? ''
    : repair ? `<button class="due" data-review>${esc(line('repair'))} · ${minutes}</button>`
    : `<button class="due" data-review>${due.length} to review · ${minutes}</button>`;
  // On a narrow page (320px, or a phone browser zoomed to 200%: 206px) the path sways less, so a label (half its
  // max-width, .path .label) stays on the page. ponytail: measured once per drawing; a rotation redraws on the next screen.
  const sway = Math.max(0, Math.min(SWAY, Math.min(320, app.clientWidth - 32) / 2 - 64 * TEXT));
  const xAt = (i) => Math.round(Math.sin((i * Math.PI) / 3) * sway);

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
  // Just after a lesson, its stretch to the next node is its own path (.fresh), which walkTo() fills.
  const trail = (nodes) => {
    const pts = nodes.map((_, i) => [xAt(i), i * ROW + 32 * TEXT]); // through each node's centre
    const d = (to, from = 0) => pts.slice(from, to).map(([x, y], k) => {
      const i = from + k;
      if (!k) return `M${x} ${y}`;
      const [px, py] = pts[i - 1];
      return `C${px} ${py + ROW / 2} ${x} ${y - ROW / 2} ${x} ${y}`;
    }).join(' ');
    const walked = Math.min(nodes.filter((n) => n.state === 'done').length + 1, pts.length);
    const a = nodes.findIndex((n) => n.id === arrived);
    const fresh = a >= 0 && nodes[a + 1] === current && walked === a + 2;
    const h = (nodes.length - 1) * ROW + 64 * TEXT;
    return `<svg class="trail" viewBox="-160 0 320 ${h}" width="100%" height="${h}" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <path d="${d(pts.length)}" class="ahead"/>${walked > 1 ? `<path d="${d(fresh ? a + 1 : walked)}" class="walked"/>` : ''}${fresh ? `<path d="${d(a + 2, a)}" class="walked fresh"/>` : ''}
    </svg>`;
  };

  const g = garden(progress, new Date(), south());
  const raised = creatures(progress).find((c) => c.id === (learning ? courseShown.id : habitShown));
  // Home has no title bar: the strip starts the page, and ⋯ is pinned at the right end of the tabs row.
  app.innerHTML = `
    <main class="home">
      <h1 class="visually-hidden">Wingbeat</h1>
      <div class="rail">
      <button class="garden-link" aria-label="Your garden: ${g.plants.length} plant${g.plants.length === 1 ? '' : 's'}">${drawGarden(g, 'strip', newly.map((r) => r.id))}${g.event ? `<span class="event-tag">${esc(g.event.name)}</span>` : ''}</button>
      <div class="tabs-row">
      <nav class="paths" aria-label="Show the path for">
        ${habits().filter((h) => !h.hidden).map(habitTab).join('')}
        <button class="path-tab add-tab" data-add aria-label="Add a habit">${esc(LOG_WORDS.addTab)}</button>
      </nav>
      <button class="menu" aria-label="Settings">⋯</button>
      </div>
      </div><div class="pane">
      ${learning && (shownCourses().length > 1 || shownCourses().length < courses.length) ? `<nav class="courses" aria-label="Course">${shownCourses().map((s) =>
        `<button class="course" data-course="${esc(s.id)}" aria-pressed="${s === courseShown}">${esc(s.title)}</button>`).join('')}${shownCourses().length < courses.length
        ? `<button class="course add-tab" data-add-course>${esc(INTRO_WORDS.addCourse)}</button>` : ''}</nav>` : ''}
      ${learning && courseShown.games ? `<nav class="courses games" aria-label="Games"><span>Games</span>${courseShown.games.map((g) => `<button class="course" data-game="${g.id}">${esc(g.label)}</button>`).join('')}</nav>` : ''}
      ${waiting ? `<p class="said welcome follows-line">${esc(fill(INTRO_WORDS.follows, words))}</p>`
        : brandNew ? `<p class="said welcome">${esc(firstPick ? INTRO_WORDS.first.replace('{name}', firstPick) : line('welcome'))}</p>` : invite ? ''
        : countedAway ? `<p class="said away-line" role="status" tabindex="-1">${esc(CHOOSE_WORDS.counted)} <button class="link" data-unaway>${esc(CHOOSE_WORDS.undo)}</button></p>` : greeting(shownHabit)}
      ${streakRow(progress.habits[habitShown]?.last ? `<button class="streak-line">${esc(streakLine(currentStreak(progress, new Date(), habitShown), true, showsStreak(habitShown, pref('quiet-streaks', false))))}</button>`
        : TIMINGS[timingsOf(habitShown)] ? `<button class="link timings-link">${esc(TIMING_WORDS.link)}</button>` : '',
        shownHabit.kind === 'log' ? '' : raising(raised, true))}
      ${invite ? comebackCard(invite) : ''}
      ${shownHabit.kind === 'log' ? logPanel(shownHabit, logged, newly, raising(raised)) : ''}
      ${shownSubjects[0]?.lookBack?.(progress, new Date()) ?? ''}
      ${units.map((u) => `
        <section class="street">
          <h2>${esc(u.title)}</h2>
          <div class="trailhead">${trail(u.nodes)}<ol class="path">${u.nodes.map(node).join('')}</ol></div>
        </section>`).join('')}
      </div>
    </main>
    <footer class="cta">
      ${dueChip}
      ${shownHabit.kind === 'log' ? (logged ? '' : `<button class="next" data-log>${esc(shownHabit.did)}</button>`)
        : waiting ? `<button class="next" data-parent>${esc(fill(Object.keys(progress.done).some((id) => id.startsWith(`${parent.id}:`)) ? INTRO_WORDS.carryOn : INTRO_WORDS.startParent, words))}</button>`
        : current ? `<button class="next" data-lesson="${current.id}">Continue · ${esc(current.lesson.title)}</button>`
        : repeat ? `<button class="next" data-lesson="${repeat.id}">${esc(again.lessons ? `${again.label} · ${repeat.lesson.title}` : again.label)}</button>` : ''}
      <div class="links">
        ${waiting ? `<button class="link" data-start-here>${esc(fill(INTRO_WORDS.startHere, words))}</button>` : ''}
        ${short ? `<button class="link short" data-short>${esc(short.words)}</button>` : ''}
        ${finishedUnits.length ? `<button class="link choose" data-choose>${esc(CHOOSE_WORDS.else)}</button>`
          : away ? `<button class="link choose" data-away>${esc(CHOOSE_WORDS.awayOnly)}</button>` : ''}
      </div>
      ${offer ? `<p class="offer"><button data-place>${esc(offer.placement.offer)}</button><button class="dismiss" data-dismiss aria-label="Dismiss">×</button></p>` : ''}
    </footer>`;

  const stopGarden = liven(app.querySelector('.garden-link'));
  // The current lesson is brought into view, centred, only when it is out of view (the fixed
  // footer covers the bottom 160px), so the garden at the top stays in sight when there's room.
  const showHere = () => {
    // With larger text the bar is measured: it grows with the text, and shrinks when its second row gives way.
    const target = app.querySelector('.here') ?? app.querySelector('.follows-line');
    if (TEXT > 1 && target) roomForHere(target);
    const r = app.querySelector('.here')?.getBoundingClientRect();
    const bar = TEXT > 1 ? app.querySelector('.cta').getBoundingClientRect().top : innerHeight - 160;
    if (r && (r.top < 0 || r.bottom > bar)) app.querySelector('.here').scrollIntoView({ block: 'center' });
  };
  const guide = app.querySelector('.guide');
  if (guide) {
    // The next session's own coach waits at the next step. They rest once today is done, and are
    // content otherwise: never sad, whatever the light.
    const late = new Date().getHours() >= 21;
    const pose = homePoses(current.subject.coach);
    const guideCoach = coach(guide, drawOf(current.subject.coach));
    const guideLight = light(progress, new Date(), habitShown);
    const settle = () => guideCoach.set(guideLight === 'bright' ? (late ? pose.rest : pose.done) : pose.ready);
    const from = arrived && app.querySelector(`.node[data-lesson="${arrived}"]`);
    showHere();
    const walk = from && walkTo(guide, from, app.querySelector('.node.here'));
    if (walk) {
      guideCoach.set(pose.cheer);
      walk.finished.then(settle, () => {});
    } else settle();
    stopHome = () => { walk?.cancel(); guideCoach.stop(); stopGarden(); };
  } else {
    showHere();
    stopHome = stopGarden;
  }
  app.querySelector('.garden-link').addEventListener('click', () => gardenView());
  app.querySelector('.raising')?.addEventListener('click', (e) => guideView(e.currentTarget.dataset.species, () => { home(); focusOn('.raising'); }));
  app.querySelector('.menu').addEventListener('click', () => { stopHome(); keep(); });
  app.querySelector('.streak-line')?.addEventListener('click', () => habitView(habitShown));
  app.querySelector('.yours-link')?.addEventListener('click', yoursView);
  app.querySelector('.look-back')?.addEventListener('click', () => habitView(habitShown));
  // Before a habit's first session there is no habit view yet, so its timings are offered here.
  app.querySelector('.timings-link')?.addEventListener('click', () => { stopHome(); timingsView(timingsOf(habitShown), () => { home(); focusOn('.timings-link'); }); });
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
  app.querySelector('[data-add]').addEventListener('click', () => addHabit());
  app.querySelector('[data-add-course]')?.addEventListener('click', () => addHabit(true));
  app.querySelector('[data-parent]')?.addEventListener('click', () => {
    showCourses([parent.id]);
    save();
    showCourse(parent.id);
    home();
    focusOn('.cta .next');
  });
  // Choosing to start here is a placement answer: the course's first unit (progress.start), so it is asked once.
  app.querySelector('[data-start-here]')?.addEventListener('click', () => {
    progress = placeAt(progress, courseShown.id, courseShown.units[0].title);
    save();
    home();
    focusOn('.cta .next');
  });
  for (const b of app.querySelectorAll('[data-course]')) {
    b.addEventListener('click', () => { showCourse(b.dataset.course); home(); focusOn(`[data-course="${b.dataset.course}"]`); });
  }
  for (const b of app.querySelectorAll('[data-game]')) {
    b.addEventListener('click', () => run(null, [courseShown.games.find((g) => g.id === b.dataset.game).entry]));
  }
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
  app.querySelector('[data-away]')?.addEventListener('click', () => awayToday(habitShown));
  app.querySelector('[data-choose]')?.addEventListener('click', () => chooseView(shownHabit, finishedUnits, away));
  app.querySelector('[data-unaway]')?.addEventListener('click', () => {
    progress = unlogToday(progress, habitShown);
    save();
    home();
    focusOn('.cta .next');
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
    run(null, reviewKeys.map((k) => ({ key: k, ...items.get(k), item: window.WINGBEAT_PLAIN ? items.get(k).item : fresh(items.get(k).subject, items.get(k).item) })), 'Review'));
  for (const btn of app.querySelectorAll('[data-lesson]')) {
    btn.addEventListener('click', () => lesson(units.flatMap((u) => u.nodes).find((x) => x.id === btn.dataset.lesson)));
  }
  app.querySelector('[data-short]')?.addEventListener('click', () => lesson(upNext, short.timings));
  app.querySelector('[data-comeback]')?.addEventListener('click', () => lesson(comebackLesson(invite)));
  app.querySelector('[data-comeback-dismiss]')?.addEventListener('click', () => {
    progress = { ...progress, comeback: { ...invite, dismissed: true } };
    save();
    home();
    focusOn('.cta .next');
  });
}

/**
 * With larger text, home gives way so the next lesson's node and its coach are in view above Continue with the page at
 * its top (decisions 22 to 24: the path is the point of the screen). In turn: the bar's second row ("Skip ahead",
 * "Something else") leaves the bar for the page, under the unit being walked; the coach's greeting goes (still read by
 * a screen reader); the streak line keeps its count and lets "See your week" go. Only as much as that takes, and none
 * of it if it can't be enough (a node further down the path is scrolled to instead). A follow-on course waiting for
 * its first (no path yet) does the same for its line: its bar's second row comes up under it.
 */
function roomForHere(here) {
  const cta = app.querySelector('.cta');
  const row = [...cta.querySelectorAll(':scope > .links, :scope > .offer')].filter((e) => e.children.length);
  const moved = Object.assign(document.createElement('div'), { className: 'from-bar' });
  const line = app.querySelector('.streak-line'), words = line?.textContent ?? '';
  giveRoom(() => Math.max(endOf(here), endOf(app.querySelector('.guide'))) - cta.getBoundingClientRect().top, [
    [() => { (here.closest('.street') ?? here).after(moved); moved.append(...row); }, () => { cta.append(...row); moved.remove(); }],
    hidden(app.querySelector('.pane > .said.welcome:not(.follows-line)')),
    [() => { if (words.includes(' · ')) { line.textContent = words.split(' · ')[0]; line.setAttribute('aria-label', words); } },
      () => { if (line) { line.textContent = words; line.removeAttribute('aria-label'); } }],
  ]);
}
/** A step for giveRoom(): `el` (if any) goes from sight, still read by a screen reader. */
const hidden = (el) => [() => el?.classList.add('visually-hidden'), () => el?.classList.remove('visually-hidden')];
/** Where `el` ends on the page (as if scrolled to the top); 0 if it isn't drawn. */
const endOf = (el) => (el?.getBoundingClientRect().height ? el.getBoundingClientRect().bottom + scrollY : 0);

/** Counts today for a guided habit done away from the app: the streak, the day and the wing as a session, nothing unlocked. */
function awayToday(habit) {
  progress = logToday(progress, habit, 'Away from the app');
  let got;
  ({ progress, newly: got } = award(progress));
  save();
  if (got.length) arrive(got); else play('tap');
  home(null, got);
  focusOn('.away-line');
}

/** "Something else": every routine finished, by unit, one tap to start, and (offered once a day) "I did it away from the app". */
function chooseView(h, finishedUnits, away) {
  stopHome();
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="survey add-habit">
      <h1>${esc(CHOOSE_WORDS.else)}</h1>
      ${finishedUnits.map((u) => `<h2>${esc(u.title)}</h2>
        ${u.nodes.map((n) => `<button class="choice" data-lesson="${n.id}">${esc(n.lesson.title)}</button>`).join('')}`).join('')}
      ${away ? `<button class="link away-row" data-away>${esc(CHOOSE_WORDS.away)}</button>` : ''}
    </main>`;
  focusOn('h1');
  app.querySelector('.back').addEventListener('click', () => { home(); focusOn('[data-choose]'); });
  app.querySelector('[data-away]')?.addEventListener('click', () => awayToday(h.id));
  for (const b of app.querySelectorAll('[data-lesson]')) {
    b.addEventListener('click', () => lesson(finishedUnits.flatMap((u) => u.nodes).find((n) => n.id === b.dataset.lesson)));
  }
}

/** Your butterfly drawn as it is today, or `state`; small on home, the end screens and the chip. */
const yours = (state = wingState(progress)) => `<svg viewBox="${BOX}" aria-hidden="true">${butterflyToday(state, wingColours(progress))}</svg>`;

/** Home's streak line (or what stands in its place) with your butterfly beside it, once there is anything to show. */
const streakRow = (line, after = '') => (!line && !progress.log.length ? '' : `<div class="streak-row">
  <button class="yours-link" aria-label="${esc(WING_WORDS.title)}, ${wingState(progress)}">${yours()}</button>${line}${after}</div>`);

/**
 * "Your butterfly", from home: the wings so far, the habits whose colours are on them, what its three
 * states mean and what comes next. No streak counts here.
 */
function yoursView() {
  stopHome();
  const wings = progress.wings || [];
  const colours = wingColours(progress);
  const legend = [...new Map(wings.map((id, i) => [id, colours[i]]))].map(([id, colour]) => {
    const h = habitOf(id);
    return `<li><i style="background:${colour}"></i><span aria-hidden="true">${esc(h?.icon ?? '')}</span> ${esc(h?.name ?? id)}</li>`;
  }).join('');
  const state = (s) => `<li>${yours(s)}<span>${esc(WING_WORDS[s])}</span></li>`;
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="yours-page">
      <h1>${esc(WING_WORDS.title)}</h1>
      <svg class="yours-wings" viewBox="${BOX}" aria-hidden="true">${butterfly(colours, wings.length >= WINGS)}</svg>
      <p class="said">${esc(wings.length ? WING_WORDS.panels.replace('{n}', wings.length).replace('{of}', WINGS) : WING_WORDS.none)}</p>
      ${legend ? `<h2>${esc(WING_WORDS.legend)}</h2><ul class="legend">${legend}</ul>` : ''}
      <h2>${esc(WING_WORDS.states)}</h2>
      <ul class="does states">${['flying', 'basking', 'resting'].map(state).join('')}</ul>
      <h2>${esc(WING_WORDS.next)}</h2>
      <p>${esc(wings.length >= WINGS ? WING_WORDS.done : WING_WORDS.more)}</p>
    </main>`;
  scrollTo(0, 0);
  focusOn('h1');
  app.querySelector('.back').addEventListener('click', () => { home(); focusOn('.yours-link'); });
}

/**
 * The wingbeat: on the first session of a day, the end screen shows your butterfly with the panel
 * that session coloured (`newPanel`; none once the wings are full) and one line. `lumiToo` draws Lumi
 * beside it, where she isn't on the screen already. `beat()` then pops the panel in, plays the flutter
 * and has Lumi flipper-flap; under reduced motion the panel is simply there.
 */
const wingbeat = (lumiToo, newPanel) => `<section class="wingbeat-moment">
    ${lumiToo ? `<div class="wing-lumi">${dressed('complete')}</div>` : ''}
    <svg viewBox="${BOX}" aria-hidden="true">${butterfly(wingColours(progress), progress.wings.length >= WINGS)}</svg>
    <p>${esc(line(newPanel ? 'wingbeat' : 'full', Math.random(), WING_WORDS))}</p></section>`;
function beat(section, newPanel, lumiEl, wait) {
  const panel = newPanel && section.querySelector(':scope > svg [data-new]');
  move(panel, [{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay: wait, easing: 'ease-out', fill: 'backwards' });
  setTimeout(() => {
    flourish(section.querySelector(':scope > svg'), 'pop');
    cue('flutter');
    flap(lumiEl());
  }, wait + 300);
}

/** Runs a path node's lesson; `timings` goes over the learner's own for this session only. */
const lesson = (n, timings) => !window.WINGBEAT_PLAIN && meetsCoach(progress, n.subject) ? meetCoach(n, () => lesson(n, timings)) :
  run(n.id, lessonQueue(n), n.lesson.title, timings);

/** A session's items: a lesson with its warm-ups and echoes (repeat.js), or a checkpoint's mix. */
function lessonQueue({ subject, lesson: l }) {
  const entry = (item, source = item) => ({ ...items.get(`${subject.id}:${source.id}`), key: `${subject.id}:${source.id}`, item });
  const own = l.items.map((item) => entry(item));
  if (subject.kind !== 'learn' || window.WINGBEAT_PLAIN) return own;
  if (l.mix) return checkpoint(subject, l.items, Math.random, CHECKPOINT, (item) => misses(progress.answers)[`${subject.id}:${item.id}`] ?? 0).map(({ item, source }) => entry(item, source));
  const keys = own.map((e) => e.key);
  const missed = misses(progress.answers);
  const weight = (item) => missed[`${subject.id}:${item.id}`] ?? 0;
  const inCourse = (k) => items.get(k)?.subject === subject;
  const warm = warmUps(progress.cards, inCourse, keys, WARM_UPS, missed, warmedLast(progress.answers, inCourse, WARM_UPS))
    .map((k) => ({ ...items.get(k), key: k, item: fresh(subject, items.get(k).item), topic: 'Warm up', warm: true }));
  return [...warm, ...own, ...echoes(subject, l.items, Math.random, flying(progress.answers, inCourse) ? 1 : ECHOES, weight).map(({ item, source }) => ({ ...entry(item, source), topic: 'Once more', echo: true }))];
}

/** A coach's moods on the path: a teacher answers kit.js's, a practice coach has its own. */
const homePoses = ({ start }) => (['guide', 'sleepy'].includes(start)
  ? { ready: start, done: 'done', rest: 'done', cheer: 'done' }
  : { ready: 'teach', done: 'complete', rest: 'sleepy', cheer: 'correct' });

/**
 * Meeting a course's coach, once, before its first lesson: who they are in their own voice and
 * what to expect. One tap and it's gone; `then` starts the lesson.
 */
function meetCoach({ subject }, then) {
  stopHome();
  const { draw, name, hello } = subject.coach;
  const row = (text) => `<li><span aria-hidden="true">✓</span><span>${esc(text)}</span></li>`;
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="survey intro meet">
      <div class="hero"></div>
      <h1>Meet ${esc(name)}</h1>
      <p class="said">${esc(hello.line)}</p>
      <h2>What to expect</h2>
      <ul class="does">${hello.expect.map(row).join('')}</ul>
    </main>
    <footer class="cta"><button class="next" data-go>${esc(hello.go)}</button></footer>`;
  scrollTo(0, 0); // it opens at its top, not where home was scrolled to
  const who = coach(app.querySelector('.hero'), draw === lumi ? dressed : draw);
  who.set('teach');
  who.hop();
  focusOn('h1');
  app.querySelector('.back').addEventListener('click', () => { who.stop(); home(); });
  app.querySelector('[data-go]').addEventListener('click', () => {
    who.stop();
    progress = metCoach(progress, subject.id);
    save();
    then();
  });
}

/** The comeback card on home (fitting.js): their favourite practice at their usual hour, a ladybird to come. */
const comebackCard = (c) => `<section class="comeback" aria-labelledby="comeback-text">
  ${visitor('ladybird')}
  <p class="kicker">${esc(COMEBACK_WORDS.kicker)}</p>
  <p id="comeback-text">${esc(COMEBACK_WORDS.text(c))}</p>
  <button class="choice" data-comeback>${esc(COMEBACK_WORDS.go(c))}</button>
  <button class="link" data-comeback-dismiss>${esc(COMEBACK_WORDS.dismiss)}</button>
</section>`;

/** The comeback's lesson: the first open one in its unit, else one done there, else the habit's next. */
function comebackLesson(c) {
  const units = subjects.filter((s) => s.habit === c.habit).flatMap((s) => unitsOf(progress, s));
  const unit = units.find((u) => u.title === c.title);
  return unit?.nodes.find((n) => n.state === 'open') ?? unit?.nodes.find((n) => n.state === 'done') ?? nextUp(units).current ?? units[0].nodes[0];
}

/**
 * A habit's tab on home: its icon, name and, once it has had a session, its streak, coloured by
 * today's light. Pressed when its path is the one shown.
 */
function habitTab(h) {
  const n = currentStreak(progress, new Date(), h.id);
  const started = !!progress.habits[h.id]?.last;
  const number = started && showsStreak(h.id, pref('quiet-streaks', false));
  const lit = light(progress, new Date(), h.id);
  const label = number ? `, ${n}-day streak` : started && lit === 'bright' ? ', done today' : '';
  return `<button class="path-tab" data-path="${esc(h.id)}" aria-pressed="${h.id === habitShown}"
    aria-label="${esc(h.name)}${label}">${esc(h.icon)} ${esc(h.name)}${started ? ` <b class="streak-${lit}"${number ? `>${n}` : ' aria-hidden="true">'}</b>` : ''}</button>`;
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
  const usual = usualLine(usualHours(progress, id));
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
      ${usual ? `<p class="usual">${esc(usual)}</p>` : ''}
      ${progress.when?.[id] ? `<p class="when">${esc(progress.when[id])}</p>` : ''}
      <button class="link when-link">${esc(progress.when?.[id] ? LOG_WORDS.whenChange : LOG_WORDS.whenSet)}</button>
      ${TIMINGS[timingsOf(id)] ? `<button class="link timings-link">${esc(TIMING_WORDS.link)}</button>` : ''}
      <h2>This week</h2>
      <ol class="week" aria-hidden="true">${week.map(cell).join('')}</ol>
      ${[...week].reverse().map(day).join('')}
      <h2>Keeping it up</h2>
      <p>${active ? `${active} of the last 14 days` : FIRST_SQUARE}</p>
      <div class="month" role="img" aria-label="Days with a session, last four weeks">${month.map((d) => `<i${d.sessions.length ? ' class="on"' : ''}></i>`).join('')}</div>
    </main>`;
  focusOn('h1');
  app.querySelector('.back').addEventListener('click', back);
  app.querySelector('.timings-link')?.addEventListener('click', () => timingsView(timingsOf(id), () => { habitView(id, back); focusOn('.timings-link'); }));
  app.querySelector('.when-link').addEventListener('click', () => whenView(id, () => { habitView(id, back); focusOn('.when-link'); }));
}

/**
 * "When will you do it?": an optional line tying habit `id` to the learner's day, picked from a few
 * or in their own words; then `next`. Skip, Back and a blank Save leave it as it was (a blank Save
 * clears one already set). Their words: escaped, never judged, kept on the device.
 */
function whenView(id, next) {
  stopHome();
  const h = habitOf(id);
  const set = progress.when?.[id] || '';
  const picks = LOG_WORDS.whenPicks;
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="survey when-ask">
      <h1>${esc(LOG_WORDS.whenAsk)}</h1>
      <p class="said"><span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}. ${esc(LOG_WORDS.whenSaid)}</p>
      <form>
        <div class="focus-presets">${picks.map((w) => `<button type="button" class="choice" data-when="${esc(w)}" aria-pressed="${w === set}">${esc(w)}</button>`).join('')}</div>
        <label class="field">${esc(LOG_WORDS.whenOwn)}<input name="when" maxlength="40" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" value="${esc(picks.includes(set) ? '' : set)}"></label>
        <button class="next">${esc(LOG_WORDS.save)}</button>
      </form>
      <button class="link" data-skip>${esc(set ? LOG_WORDS.whenClear : LOG_WORDS.whenSkip)}</button>
    </main>`;
  focusOn('h1');
  const keep = (text) => { progress = setWhen(progress, id, text); save(); next(); };
  for (const b of app.querySelectorAll('[data-when]')) b.addEventListener('click', () => keep(b.dataset.when));
  app.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const t = e.target.when.value; t.trim() || set ? keep(t) : next(); });
  app.querySelector('[data-skip]').addEventListener('click', () => (set ? keep('') : next()));
  app.querySelector('.back').addEventListener('click', next);
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
  const { current, repeat } = nextUp(units, subject?.again, progress.log);
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
    .concat(animateScene(el), animateLandmarks(el))
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

/** One thing that arrived, drawn small beside its line: "A butterfly arrived · 12 Oct". A visitor in its habit's species. */
const arrival = ({ gift, text, on, species: kind, skin }, habit) => {
  const species = habitsFor(progress).findIndex((h) => h.id === habit);
  const art = skin ? dressed('complete', skin) : LIFE.includes(gift) ? lifeSvg(kind, gift) : gift === 'flower' ? flower(habit) : gift === 'bee' ? visitor(gift, species) : landmark(gift);
  return `<span class="arrival">${art}<span>${esc(text)}${on ? ` · ${shortDate(on)}` : ''}</span></span>`;
};

/** A raised butterfly at its stage, drawn small by the kit (cropped close); the caterpillar at `growth`. */
const lifeSvg = (species, stage, growth = 0, box = '12 6 96 84') => `<svg class="creature" viewBox="${box}" aria-hidden="true">${lifeArt(species, stage, growth)}</svg>`;

/**
 * The creature the habit shown is raising, into the field guide: a one-tap habit's pill ("Walk is raising a Caper
 * White"), or on a path (`small`) just its picture, close up (`lifeBox`), at the end of the streak row, named by the same
 * words, until it emerges.
 */
const raising = (c, small = false) => (!c || small && c.k === 3 ? ''
  : small ? `<button class="raising" data-species="${esc(c.species.id)}" aria-label="${esc(LIFE_WORDS.raising(c))}">${lifeSvg(c.species, c.stage, c.growth, lifeBox(c.stage, c.growth))}</button>`
  : `<button class="raising" data-species="${esc(c.species.id)}">${lifeSvg(c.species, c.stage, c.growth)}<span>${esc(LIFE_WORDS.raising(c))}</span></button>`);

/** The field guide (src/guide.js), on `id`'s page when given; its back runs `back`. */
function guideView(id, back) {
  stopHome();
  stopHome = () => {};
  fieldGuide(guide(progress), { app, back, focusOn, date: shortDate, id });
}

/** What arrived in the garden is heard: the first thing's own sound, after `wait` ms. */
const arrive = (newly, wait = 0) => { if (newly.length) setTimeout(() => chime(newly[0].sound || newly[0].gift), wait); };

/** What a session brought, quietly: award()'s order, `max` lines (listed()), then "and N more in your garden". */
const arrivals = (newly, max) => {
  const { shown, more } = listed(newly, max);
  return !newly.length ? '' : `<ul class="arrivals">
  ${shown.map((r) => `<li>${arrival(r, r.habit)}</li>`).join('')}
  ${more ? `<li>${esc(moreArrived(more))}</li>` : ''}</ul>`;
};

/**
 * Lumi's wardrobe: Lumi in every skin. One tap wears one that has been given; one not given yet is
 * dimmed, with what gives it. "Just Lumi" is always there. No shop, no currency, nothing expires.
 */
function wardrobe(back) {
  stopHome();
  stopHome = () => {};
  const earned = progress.garden?.earned || {};
  const on = worn(progress);
  const card = (id, name, more = '') => `<li><button class="choice skin-card" data-skin="${id}" aria-pressed="${on === (id || null)}">${dressed('teach', id || null)}
    <span>${esc(name)}</span>${more}</button></li>`;
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="wardrobe">
      <h1>${esc(SKIN_WORDS.title)}</h1>
      <p class="said">${esc(SKIN_WORDS.said)}</p>
      <ul class="skins">
        ${card('', SKIN_WORDS.none)}
        ${SKIN_RULES.map(([id, , from]) => (earned[`skin:${id}`]
    ? card(id, SKIN_WORDS.names[id], `<small>${esc(from)} · ${esc(shortDate(earned[`skin:${id}`]))}</small>`)
    : `<li class="skin-card later">${dressed('teach', id)}<span>${esc(SKIN_WORDS.names[id])}</span><small>${esc(from)}</small></li>`)).join('')}
      </ul>
    </main>`;
  focusOn('h1');
  app.querySelector('.back').addEventListener('click', back);
  for (const b of app.querySelectorAll('[data-skin]')) b.addEventListener('click', () => {
    const { skin, ...rest } = progress;
    progress = b.dataset.skin ? { ...rest, skin: b.dataset.skin } : rest;
    save();
    play('tap');
    wardrobe(back);
    focusOn(`[data-skin="${b.dataset.skin}"]`);
  });
}

/** A seasonal event's card on the garden screen: what's on, its set, and what it leaves. Never when it ends. */
const eventCard = (e) => {
  const done = progress.done[lessonOf(e)];
  return `<section class="plant-card event-card"><span class="kicker">${esc(e.name)}</span>
    <p>${esc(e.about)}</p><p class="hint">${esc(done ? e.keep : e.offer)}</p>
    <button class="choice" data-event>${esc(done ? `${e.title} again` : e.title)}</button></section>`;
};

/** An event's set, played as an ordinary session of its subject's. Its items have no key: no review cards. */
const playEvent = (e) => {
  const subject = subjects.find((s) => s.id === e.subject);
  run(lessonOf(e), e.items.map((item) => ({ subject, topic: e.name, item })), e.title);
};

/**
 * The whole garden, tall, with a card per plant under it: its stage, days practised, a gentle
 * hint of the next stage and what has arrived. A plant or its card opens its habit view, whose
 * Back comes here. `from` is the plant to put focus back on.
 */
function gardenView(from = null) {
  stopHome();
  const g = garden(progress, new Date(), south());
  const card = (p) => {
    const h = habitOf(p.habit);
    const words = plantWords(p);
    const kind = p.plant || PLANTS[p.habit];
    return `<li><button class="plant-card" data-plant="${esc(p.habit)}">
      <span class="kicker">${esc(h.icon)} ${esc(h.name)}</span>
      <b>${esc(kind[0].toUpperCase() + kind.slice(1))} · ${esc(p.name)}</b>
      ${words.days ? `<span>${esc(words.days)}</span>` : ''}
      ${words.next ? `<span class="hint">${esc(words.next)}</span>` : ''}
      ${p.creatures.map((c) => `<span class="arrival">${lifeSvg(c.species, c.stage, c.growth)}<span>${esc(LIFE_WORDS.card(c))}${c.k === 3 && c.on ? ` ${shortDate(c.on)}` : ''}</span></span>`).join('')}
      ${[...(p.flowers.length > 3 ? [] : p.flowers), ...p.visitors].sort((a, b) => a.on.localeCompare(b.on)).map((a) => arrival(a, p.habit)).join('')}
      ${p.flowers.length > 3 ? `<span class="arrival">${flower(p.habit)}<span>${esc(flowersOpened(p.flowers.length))}</span></span>` : ''}
    </button></li>`;
  };
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button><button class="link guide-link">${esc(LIFE_WORDS.open)}</button><button class="link wardrobe-link">${esc(SKIN_WORDS.open)}</button></header>
    <main class="garden-page">
      <h1>Your garden</h1>
      <div class="garden-view">${drawGarden(g, 'tall')}</div>
      ${g.event ? eventCard(g.event) : ''}
      <ul class="plant-cards">${g.plants.map(card).join('')}
        ${g.landmarks.length ? `<li class="plant-card landmark-card"><span class="kicker">${esc(GARDEN_WORDS.kicker)}</span>
          ${g.landmarks.map((l) => arrival(l, null)).join('')}</li>` : ''}</ul>
    </main>`;
  stopHome = liven(app.querySelector('.garden-view'));
  app.querySelector('[data-event]')?.addEventListener('click', () => playEvent(g.event));
  app.querySelector('.guide-link').addEventListener('click', () => guideView(null, () => { gardenView(); focusOn('.guide-link'); }));
  app.querySelector('.wardrobe-link').addEventListener('click', () => wardrobe(() => { gardenView(); focusOn('.wardrobe-link'); }));
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
function logPanel(h, logged, newly, raised = '') {
  const n = currentStreak(progress, new Date(), h.id);
  return `<section class="log-habit">
    <h2><span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}</h2>
    ${progress.when?.[h.id] ? `<p class="when">${esc(progress.when[h.id])}</p>` : ''}
    ${raised}
    ${logged ? `<p class="said" role="status">${esc(LOG_WORDS.done)}</p>
      <div class="chips">${chip('log', `${h.name.toUpperCase()} STREAK`, `${h.icon} ${n}`)}</div>
      ${arrivals(newly)}
      <button class="link" data-undo>${esc(LOG_WORDS.undo)}</button>`
    : progress.log.some((e) => e.habit === h.id) ? '' : `<p class="said">${esc(LOG_WORDS.hint)}</p>`}
    <button class="link" data-edit>${esc(LOG_WORDS.edit)}</button>
  </section>`;
}

/** Back to home showing `id`'s tab, with focus on it. */
const homeOn = (id) => { showHabit(id); home(); focusOn(`[data-path="${id}"]`); };

/**
 * The "+ Habit" sheet: a built-in habit the intro left off, the presets not yet on the tabs, any hidden habit to
 * bring back (its days kept), and "Make your own". One tap starts tracking. With `course`, the course row's
 * "+ Course": the courses the intro left off, each with its line.
 */
function addHabit(course = false) {
  stopHome();
  const shown = new Set(habits().filter((h) => !h.hidden).map((h) => h.id));
  const offer = course ? courses.filter((s) => !shownCourses().includes(s))
    : [...HABITS.filter((h) => !shown.has(h.id)), ...PRESETS.filter((p) => !shown.has(p.id)), ...habits().filter((h) => h.own && h.hidden)];
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="survey add-habit${course ? ' add-course' : ''}">
      <h1>${esc(course ? INTRO_WORDS.addCourseTitle : 'Add a habit')}</h1>
      <p class="said">${esc(course ? INTRO_WORDS.addCourseSaid : LOG_WORDS.add)}</p>
      <div class="offers">${offer.map((h) => (course ? choice(`data-track="${esc(h.id)}"`, h, esc(h.title))
        : `<button class="choice" data-track="${esc(h.id)}"><span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}</button>`)).join('')}</div>
      ${course ? '' : `<button class="choice" data-own>${esc(LOG_WORDS.own)}</button>`}
    </main>`;
  focusOn('h1');
  app.querySelector('.back').addEventListener('click', () => { home(); focusOn(course ? '[data-add-course]' : '[data-add]'); });
  for (const b of app.querySelectorAll('[data-track]')) {
    b.addEventListener('click', () => {
      const id = b.dataset.track;
      if (course) {
        showCourses([id]);
        save();
        showCourse(id);
        return homeOn('learn');
      }
      progress = track(progress, { id, hidden: false });
      save();
      chime('plant');
      // A guided habit has its own path; only a one-tap habit is asked when it happens.
      if (progress.when?.[id] || HABITS.some((h) => h.id === id)) homeOn(id); else whenView(id, () => homeOn(id));
    });
  }
  app.querySelector('[data-own]')?.addEventListener('click', () => editHabit(null));
}

/**
 * What a course or habit is, in one plain line for someone who has never met it: INTRO_WORDS.about, with "After
 * JavaScript." on a course that follows another, and a one-tap habit's tap. `choice()` is a pick with that line
 * under its name, read out as the button's description so its name stays the name.
 */
const lineFor = (x) => (x.did ? fill(INTRO_WORDS.oneTap, { did: x.did })
  : [INTRO_WORDS.about[x.id], x.follows && fill(INTRO_WORDS.after, { parent: parentOf(x).title })].filter(Boolean).join(' '));
const choice = (attrs, x, label) => `<button class="choice${x.follows ? ' follows' : ''}" ${attrs} aria-describedby="about-${esc(x.id)}">${label}<small class="about" id="about-${esc(x.id)}" aria-hidden="true">${esc(lineFor(x))}</small></button>`;

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
    if (h) return homeOn(h.id);
    chime('plant');
    const id = progress.tracked.at(-1).id;
    whenView(id, () => homeOn(id));
  });
  app.querySelector('[data-hide]')?.addEventListener('click', () => {
    progress = track(progress, { id: h.id, hidden: true });
    save();
    showHabit(firstTab());
    home();
    focusOn('[data-add]');
  });
}

/**
 * Lumi hops along the path from the lesson just finished to the next one, and that lesson's tick
 * pops in: the learner sees themselves move forward. The green line fills ahead of Lumi (the
 * trail's .fresh stretch) and the next node pops open with a chime as Lumi lands. Skipped under
 * reduced motion (null): the line is simply drawn.
 */
function walkTo(guide, fromNode, toNode) {
  const fresh = app.querySelector('.trail .fresh');
  if (fresh) {
    const len = fresh.getTotalLength();
    fresh.style.strokeDasharray = len;
    move(fresh, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1300, delay: 350, easing: 'ease-in-out', fill: 'backwards' });
  }
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
  const walk = move(guide, frames, { duration: 1300, delay: 350, easing: 'ease-in-out', fill: 'backwards' });
  walk?.finished.then(() => { flourish(toNode, 'pop'); cue('unlock'); }, () => {});
  return walk;
}

/**
 * A phone on its side (fit.js SIDEWAYS): a lesson or routine asks to be turned upright (styles.css .upright). The line
 * is written as it turns and emptied as it comes back, so a screen reader hears it once per turn.
 */
function sideways() {
  const on = !!SIDEWAYS?.matches;
  document.documentElement.toggleAttribute('data-sideways', on);
  const line = app.querySelector('.upright');
  if (line) line.textContent = on ? UPRIGHT : '';
}

/**
 * Plays a session: a lesson (lessonId set) or a review (null). An item missed the first time
 * comes back once at the end; only the first try counts toward review scheduling.
 */
function run(lessonId, queue, title, extra = null) {
  stopHome();
  // A practice routine (Calm) has no right or wrong: no meter heat, no runs, no review cards.
  const practice = queue[0]?.subject.kind === 'practice';
  const who = queue[0].subject.coach; // the session's coach and their lines
  const did = []; // what each practice item did, for its end screen ("3 breaths")
  let journal = null; // what a Reflect item wrote, for the journal (never the log)
  let reached = { step: 0, of: null }; // how far a practice routine got, kept in `left` if it is closed part-way
  const results = [];
  let at = 0;
  let streak = 0; // right answers in a row, this session
  let cleanup = () => {};
  const started = Date.now();
  app.innerHTML = `
    <p class="upright" role="status"></p>
    <header class="bar">
      <button class="close" aria-label="${practice ? 'Stop' : 'Quit lesson'}">✕</button>
      <div ${practice ? 'hidden ' : ''}class="meter" data-heat="0" role="progressbar" aria-label="Lesson progress" aria-valuemin="0"><div class="fill"><i class="shine"></i></div><span class="flare" aria-hidden="true"></span></div>
    </header>
    <main class="play${queue[0].subject.night ? ' night' : ''}">
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
  sideways();
  const $ = (sel) => app.querySelector(sel);
  const [topic, bubble, stage, foot, next] = ['.topic', '.bubble', '.stage', '.foot', '.next'].map($);
  const sessionCoach = coach($('.who'), drawOf(who));
  let said = '';
  const quit = () => { cleanup(); sessionCoach.stop(); };
  $('.close').addEventListener('click', () => {
    quit();
    if (practice) { progress = leavePractice(progress, queue[0].subject.habit, lessonId, reached.step, reached.of, new Date(), { title: queue[0].topic }); save(); }
    home();
    focusOn('.cta .next');
  });

  // Tapping Rosa: a hop and a line (not one of the last few), then back to the question.
  let aside;
  let heard = [];
  $('.who').addEventListener('click', () => {
    play('tap');
    sessionCoach.hop();
    // Only an aside that fits the bubble as it stands, so nothing under it ever moves; none fits, she keeps what she was saying.
    const copy = bubble.cloneNode(false);
    copy.removeAttribute('id');
    copy.removeAttribute('aria-live');
    copy.style.cssText += `;position:absolute;visibility:hidden;width:${bubble.offsetWidth}px`;
    bubble.after(copy);
    const fits = (who.lines ?? LINES).tapped.filter((t) => { copy.textContent = t; return copy.offsetHeight <= bubble.offsetHeight; });
    copy.remove();
    if (!fits.length) return;
    heard = [...heard, line('tapped', Math.random(), { tapped: fits }, heard)].slice(-3); // not one of the last few, unless only those fit
    bubble.textContent = heard.at(-1);
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
    const shownAt = Date.now();
    scrollTo(0, 0); // every item starts at the top of the page: its question is there, and src/fit.js measures from it
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
      timings: extra ? { ...progress.timings?.[timingsOf(entry.subject.habit)], ...extra } : progress.timings?.[timingsOf(entry.subject.habit)],
      reached: (step, of) => { reached = { step, of }; },
      done: (answered, text = '', kept = null) => {
        // A practice item goes straight on: its own buttons were the Continue.
        if (practice) { if (text) did.push(text); if (kept) journal = kept; at++; return step(); }
        // Right after a hint is logged as that, but plays as a miss: it doesn't schedule or land.
        const hinted = !!kept?.hinted;
        const correct = hinted ? false : answered;
        // Only the first try schedules a card, and an echo is a second go at something just learned.
        if (correct !== null && !entry.retry && !entry.echo) results.push({ key: entry.key, correct });
        const plain = window.WINGBEAT_PLAIN;
        // A miss comes back at the end, fresh where it can be, until it lands or runs out of goes.
        const leftForReview = comeBack(queue, at, entry, correct,
          () => (plain ? entry.item : fresh(entry.subject, items.get(entry.key)?.item ?? entry.item)), plain ? 2 : GOES);
        if (correct !== null && entry.key) {
          progress = noteAnswer(progress, { key: entry.key, right: answered, ms: Date.now() - shownAt, hinted, warm: entry.warm && !entry.retry });
          save();
        }
        at++;
        if (correct === false && !plain) easeOff(entry);
        let kind = 'plain';
        if (correct === true) {
          streak++;
          kind = rightAnswer(streak);
          if (kind !== 'correct') flare(`${streak} in a row`);
          sessionCoach.set('correct');
          sessionCoach.hop();
          cue(kind === 'correct' ? 'right' : 'run');
        } else if (correct === false) {
          streak = 0;
          kind = 'wrong';
          sessionCoach.set('wrong');
          sessionCoach.sway();
          cue('wrong');
        }
        meter();
        shine();
        foot.className = `foot show ${correct === null ? 'plain' : correct ? 'right' : 'wrong'}`;
        // WINGBEAT_LONGEST (tests): the longest line of its kind, not one at random, so a check can't pass one run and fail the next.
        // A line that fits how the item was answered (doing() in lines.js): a listening item with no voice was shown, so read.
        const asked = entry.item.listen && !voice(entry.subject.lang ?? 'en') ? { ...entry.item, listen: false } : entry.item;
        foot.querySelector('strong').textContent = kind === 'plain' ? '' : window.WINGBEAT_LONGEST ? longestVerdict(who.lines, [kind])
          : line('pool', Math.random(), { pool: verdicts(who.lines || LINES, kind, asked) });
        foot.querySelector('p').textContent = leftForReview ? `${text} ${MOVE_ON}` : text;
        giveWay(foot); // at most half the screen
        // The answer tapped (or, on a board, the verdict) pops when right and gives a small shake when
        // not, unless the item already gave it its own (a quiz's cheer).
        const hit = correct === null ? null : stage.querySelector(correct ? '.choice.right' : '.choice.wrong') || foot.querySelector('strong');
        if (hit && !hit.getAnimations().length) flourish(hit, correct ? 'pop' : 'shake');
        // Focus moves to Continue, which reads out the verdict (a teach card: Rosa's line). The
        // banner is fixed over the bottom, so nothing on the page moves.
        next.setAttribute('aria-describedby', correct === null ? 'said' : 'verdict');
        next.focus();
      },
    });
    // A question starts on its board (or its answers), not back at the top of the page.
    if (!foot.classList.contains('show')) stage.querySelector('[autofocus], svg[tabindex], .choice, .numline, .practice-go')?.focus();
  };
  next.addEventListener('click', step);

  /**
   * The end of any practice routine (Calm, Move…): settled, not a party. What was done, the habit's streak, and
   * "How do you feel?" as one optional tap that is kept on the log and never judged.
   */
  const finishRoutine = () => {
    const { subject, topic: technique } = queue[0];
    const firstTime = lessonId && !progress.done[lessonId];
    const beats = firstToday(progress), panels = progress.wings.length;
    const mins = Math.max(1, Math.round((Date.now() - started) / 60000));
    progress = answerComeback(writeJournal(finishPractice(progress, subject.habit, lessonId, new Date(), { title: technique, mins }), journal), subject.habit);
    let newly;
    ({ progress, newly } = award(progress));
    save();
    const newPanel = progress.wings.length > panels;
    const h = habitOf(subject.habit);
    const n = currentStreak(progress, new Date(), h.id);
    app.innerHTML = `
      <main class="summary practice-end${subject.night ? ' night' : ''}">
        <div class="hero"></div>
        <p class="kicker">${esc(technique)}</p>
        <h1>${esc(window.WINGBEAT_LONGEST ? longestVerdict(who.lines, ['done']) : line('done', Math.random(), who.lines))}</h1>
        <p class="said">${esc([...did, `${mins} min`].join(' · '))}</p>
        <div class="chips">
          ${showsStreak(h.id, pref('quiet-streaks', false)) ? chip(h.id, `${h.name.toUpperCase()} STREAK`, `${h.icon} ${n}`) : ''}
        </div>
        ${beats ? wingbeat(true, newPanel) : ''}
        ${arrivals(newly, 2)}
        ${subject.readBack?.(progress, new Date()) ?? ''}
        <section class="feel" aria-labelledby="feel-q">
          <h2 id="feel-q">${esc(who.ask ?? 'How do you feel?')}</h2>
          <div class="feels">${feelsFor(who.feel).map(([value, label]) => `<button class="choice" data-feel="${value}">${esc(label)}</button>`).join('')}</div>
          <p class="said" role="status"></p>
        </section>
      </main>
      <footer class="cta"><button class="next">Continue</button></footer>`;
    const endCoach = coach(app.querySelector('.hero'), drawOf(who));
    endCoach.set('done');
    // With larger text the question it ends on is in view above Continue (decision 19: what matters first, and briefly).
    // In turn: the pictures give way, the coach first, then Lumi and your butterfly beside the wingbeat; the headline and the wingbeat's line
    // are no bigger than the rest; what arrived is one line and "N more"; then the line of what was done, the routine's name,
    // the streak chip.
    if (TEXT > 1) {
      const main = app.querySelector('.summary'), list = app.querySelector('.arrivals');
      const brief = list && Object.assign(document.createElement('div'), { innerHTML: arrivals(newly, 1) }).firstElementChild;
      giveRoom(() => endOf(app.querySelector('#feel-q')) - app.querySelector('.cta').getBoundingClientRect().top, [
        hidden(main.querySelector(':scope > .hero')),
        hidden(main.querySelector('.wing-lumi')),
        hidden(main.querySelector('.wingbeat-moment > svg')),
        [() => main.classList.add('brief'), () => main.classList.remove('brief')],
        [() => list?.replaceWith(brief), () => brief?.replaceWith(list)],
        hidden(main.querySelector(':scope > .said')),
        hidden(main.querySelector(':scope > .kicker')),
        hidden(main.querySelector(':scope > .chips')),
      ]);
    }
    if (beats) beat(app.querySelector('.wingbeat-moment'), newPanel, () => app.querySelector('.wing-lumi'), 600);
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
    app.querySelector('.read-back')?.addEventListener('click', () => { endCoach.stop(); habitView(h.id, () => home(firstTime ? lessonId : null)); });
    app.querySelector('.next').addEventListener('click', () => {
      endCoach.stop();
      home(firstTime ? lessonId : null);
      focusOn('.cta .next');
    });
  };

  // Twice wrong in a unit: once a session, explain it another way and step back to something smaller.
  const eased = new Set();
  const easeOff = ({ key, subject }) => {
    const known = items.get(key);
    if (!known || eased.has(known.topic)) return;
    if (!struggling(progress.answers, (k) => items.get(k)?.topic === known.topic && items.get(k).subject === subject)) return;
    eased.add(known.topic);
    const list = subject.units.find((u) => u.title === known.topic).lessons.filter((l) => !l.mix).flatMap((l) => l.items);
    const smaller = easier(list, known.item);
    const text = helpFor(subject.id, known.topic, known.lesson);
    dropEchoes(queue, at); // the step back and the repeats are plenty
    queue.splice(at, 0, ...[
      text && { subject, topic: 'One step back', item: { id: 'help', type: 'teach', text } },
      smaller && { subject, key: `${subject.id}:${smaller.id}`, topic: 'One step back', item: smaller, echo: true, once: true },
    ].filter(Boolean));
  };

  const perfectRun = () => results.length > 0 && results.every((r) => r.correct);
  const finish = () => {
    const relit = needsRepair(progress);
    const beats = firstToday(progress), panels = progress.wings.length;
    const firstTime = lessonId && !progress.done[lessonId];
    const seconds = Math.round((Date.now() - started) / 1000);
    progress = finishSession(progress, lessonId, results, new Date(), { title: title || 'Review', mins: Math.max(1, Math.round(seconds / 60)), course: queue[0].subject.id });
    let newly;
    ({ progress, newly } = award(progress));
    save();
    const newPanel = progress.wings.length > panels;
    const right = results.filter((r) => r.correct).length;
    const perfect = perfectRun();
    const misses = results.length - right;
    // Speed is only praised when it wasn't bought with mistakes.
    const pace = misses ? 'STEADY' : paceLabel(seconds / queue.length);
    const kind = finished({
      review: !lessonId, perfect, relit: relit && !needsRepair(progress),
      fast: pace !== 'STEADY', misses, right,
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
        <h1>${esc(line(kind, Math.random(), who.headlines || HEADLINES))}</h1>
        <p class="said">${esc(line(kind, Math.random(), who.lines))}</p>
        <div class="chips">
          ${percent === null ? '' : chip('acc', accuracyLabel(percent), `${percent}%`)}
          ${chip('time', pace, clock)}
          ${chip('fire', STREAK_LABEL, currentStreak(progress), yours('flying'))}
        </div>
        <p class="learned">${Object.keys(progress.cards).length} learned so far · ${right} of ${results.length} ${lessonId ? 'right first try' : 'recalled'}</p>
        ${beats ? wingbeat(false, newPanel) : ''}
        ${arrivals(newly)}
      </main>
      <footer class="cta"><button class="next">Continue</button></footer>`;
    const [rosaEl, lumiEl] = app.querySelectorAll('.duo .hero');
    const cast = [coach(rosaEl, who.draw), coach(lumiEl, dressed)];
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
    // The wingbeat, and Lumi's signature flipper-flap on a perfect lesson, once she has settled.
    if (beats) beat(app.querySelector('.wingbeat-moment'), newPanel, () => (left ? null : lumiEl), 1200);
    else if (perfect) setTimeout(() => !left && flap(lumiEl), 1500);
    focusOn('h1');
    cue('done');
    arrive(newly, 900);
    // Petals and leaves for every finished lesson, and for a review right all through.
    const stopParty = lessonId || perfect ? petals() : () => {};
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
  const guide = coach(app.querySelector('.hero'), dressed);
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
      <button class="link" data-back>Back</button>
    </main>`;
  const guide = coach(app.querySelector('.hero'), dressed);
  guide.set('correct');
  guide.hop();
  focusOn('h1');
  app.querySelector('[data-start]').addEventListener('click', () => { guide.stop(); place(subject, unit); });
  app.querySelector('[data-first]').addEventListener('click', () => { guide.stop(); place(subject, first); });
  app.querySelector('[data-back]').addEventListener('click', () => { guide.stop(); survey(subject); });
}

function place(subject, unit) {
  progress = placeAt(progress, subject.id, unit);
  save();
  home();
  focusOn('.cta .next');
}

/** The garden's hemisphere: the ⋯ screen's choice, else a guess from the timezone (Australia/* is south). */
const south = () => pref('south', southern(Intl.DateTimeFormat().resolvedOptions().timeZone));

/** Save progress to a file, or load one back: for a new device, or a browser that cleared it. */
function keep(note = '') {
  app.innerHTML = `
    <main class="survey">
      <h1>Settings</h1>
      <p class="said">Keep a copy in a file, or load one from another device.</p>
      <button class="choice" data-save>Save to a file</button>
      <button class="choice" data-load>Load from a file</button>
      <input type="file" accept=".json,application/json" hidden>
      ${ASKS ? `<p class="said" data-persist hidden>${esc(KEEP_WORDS.line)} <button class="link">${esc(KEEP_WORDS.ask)}</button></p>` : ''}
      <p class="said" role="status">${esc(note)}</p>
      <button class="choice" data-change>${esc(INTRO_WORDS.change)}</button>
      ${syncMenuHtml()}
      <h2>Sound</h2>
      <button class="choice" data-pref="sound" aria-pressed="${soundOn()}">${esc(SOUND_LABEL)}</button>
      <h2>Calm sounds</h2>
      ${CALM_SOUNDS.map(([name, label]) => `<button class="choice" data-pref="${name}" aria-pressed="${calmPref(name)}">${esc(label)}</button>`).join('')}
      <h2>Coaches and streaks</h2>
      <button class="choice" data-pref="dares" aria-pressed="${pref('dares', true)}">${esc(DARES_LABEL)}</button>
      <button class="choice" data-pref="quiet-streaks" aria-pressed="${pref('quiet-streaks', false)}">${esc(QUIET_STREAK_LABEL)}</button>
      <h2>Garden</h2>
      <button class="choice" data-pref="south" aria-pressed="${south()}">${esc(SOUTH_LABEL)}</button>
      <button class="choice" data-wardrobe>${esc(SKIN_WORDS.title)}</button>
      ${bridge() ? `<h2>${esc(REMINDER_WORDS.title)}</h2><button class="choice" data-remind aria-pressed="${bridge().remindersOn()}">${esc(REMINDER_WORDS.toggle)}</button>` : ''}
      ${remindersPaused(progress) ? `<p class="said paused">${esc(PAUSED_WORDS.line)} <button class="link" data-remind-on>${esc(PAUSED_WORDS.on)}</button></p>` : ''}
      <button class="choice" data-back>Back</button>
    </main>`;
  for (const b of app.querySelectorAll('[data-pref]')) {
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      setPref(b.dataset.pref, on);
      b.setAttribute('aria-pressed', on);
      if (on && b.dataset.pref === 'bell') play('bell');
      if (b.dataset.pref === 'quiet-streaks') tellWidget();
    });
  }
  // Android only: the once-a-day note is off until turned on here.
  app.querySelector('[data-remind]')?.addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    bridge().reminders(on);
    e.currentTarget.setAttribute('aria-pressed', on);
  });
  const status = app.querySelector('[role="status"]');
  const keepLine = app.querySelector('[data-persist]');
  if (keepLine) {
    navigator.storage?.persisted?.().then((kept) => { keepLine.hidden = kept !== false; }).catch(() => {});
    keepLine.querySelector('button').addEventListener('click', () => navigator.storage.persist().then((kept) => {
      if (kept) { keepLine.hidden = true; status.textContent = KEEP_WORDS.done; }
    }).catch(() => {}));
  }
  const input = app.querySelector('input');
  focusOn('h1');
  app.querySelector('[data-back]').addEventListener('click', () => { home(); focusOn('.menu'); });
  app.querySelector('[data-change]').addEventListener('click', () => want(true));
  app.querySelector('[data-wardrobe]').addEventListener('click', () => wardrobe(() => { keep(); focusOn('[data-wardrobe]'); }));
  app.querySelector('[data-remind-on]')?.addEventListener('click', () => { progress = noteReminder(progress, 'on'); save(); keep(PAUSED_WORDS.back); });
  const ctx = { app, progress: () => progress, adopt, back: () => keep(), focusOn };
  for (const b of app.querySelectorAll('[data-sync]')) b.addEventListener('click', () => openSync(b.dataset.sync, ctx));
  app.querySelector('[data-save]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(progress)], { type: 'application/json' }));
    a.download = `wingbeat-progress-${today()}.json`;
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
    else status.textContent = "That file isn't Wingbeat progress, so nothing changed.";
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
 * The first-visit intro, step 1: what Wingbeat can do, one plain line each, with Lumi. Shown once
 * (`progress.picked` records it); Skip leaves the default home.
 */
function intro() {
  const row = (icon, text, art = esc(icon)) => `<li><span aria-hidden="true">${art}</span><span>${esc(text)}</span></li>`;
  app.innerHTML = `
    <main class="survey intro">
      <div class="hero perched"></div>
      <h1>${esc(INTRO_WORDS.title)}</h1>
      <p class="tagline">${esc(INTRO_WORDS.tagline)}</p>
      <ul class="does">
        ${HABITS.filter((h) => INTRO_WORDS.does[h.id]).map((h) => row(h.icon, INTRO_WORDS.does[h.id])).join('')}
        ${row('👆', INTRO_WORDS.does.track)}
        ${row('', INTRO_WORDS.butterfly, yours('basking'))}
        ${row('🔒', INTRO_WORDS.privacy)}
      </ul>
    </main>
    <footer class="cta">
      <button class="next" data-next>${esc(INTRO_WORDS.next)}</button>
      <button class="link" data-skip>${esc(INTRO_WORDS.skip)}</button>
    </footer>`;
  const guide = coach(app.querySelector('.hero'), (mood) => (worn(progress) ? dressed(mood) : lumiPerched(mood)));
  guide.set('teach');
  focusOn('h1');
  app.querySelector('[data-next]').addEventListener('click', () => { guide.stop(); want(); });
  app.querySelector('[data-skip]').addEventListener('click', () => { guide.stop(); choose([]); });
}

/**
 * Step 2, and the ⋯ menu's "Change what you see" (`change`): Learn something and Build habits, each
 * opening its own list, a line under each thing saying what it is. Picks are kept in the order tapped; home shows
 * them, first (ordered()), and nothing else (choose()). Changing starts from what home shows now.
 */
function want(change = false) {
  const list = [...HABITS.filter((h) => !courses.some((s) => s.habit === h.id)), ...PRESETS];
  // Courses are picked by course id; choose() turns them into the Learning tab.
  const branch = { learn: courses.map((s) => s.id), habits: list.map((h) => h.id) };
  const showing = (id) => (branch.learn.includes(id) ? !habitOf(courses[0].habit).hidden && shownCourses().some((s) => s.id === id)
    : branch.habits.includes(id) && habitOf(id) && !habitOf(id).hidden);
  let picked = progress.picked?.length ? [...new Set([...progress.picked, ...habits().map((h) => h.id)]
    .flatMap((id) => (id === courses[0].habit ? [courseShown.id, ...shownCourses().map((s) => s.id)] : [id])).filter(showing))] : [];
  const on = (id) => picked.includes(id);
  const toggle = (attr, id, pressed, label) => `<button class="choice" ${attr}="${esc(id)}" aria-pressed="${pressed}">${label}</button>`;
  const pickable = (x, label) => choice(`data-pick="${esc(x.id)}" aria-pressed="${on(x.id)}"`, x, label);
  const open = (b) => branch[b].some(on);
  app.innerHTML = `
    ${change ? '' : '<header class="bar"><button class="back" aria-label="Back">←</button></header>'}
    <main class="survey intro">
      <h1>${esc(INTRO_WORDS.want)}</h1>
      <p class="said">${esc(INTRO_WORDS.wantSaid)}</p>
      ${toggle('data-want', 'learn', open('learn'), esc(INTRO_WORDS.learn))}
      <section class="branch" data-branch="learn"${open('learn') ? '' : ' hidden'}>
        <h2>${esc(INTRO_WORDS.courses)}</h2>
        ${courses.map((s) => pickable(s, esc(s.title))).join('')}
        <p class="said picked-too" role="status"></p>
        ${INTRO_WORDS.soonCourses.map((n) => `<button class="choice" disabled>${esc(n)} <small>· ${esc(INTRO_WORDS.soon)}</small></button>`).join('')}
      </section>
      ${toggle('data-want', 'habits', open('habits'), esc(INTRO_WORDS.habits))}
      <section class="branch" data-branch="habits"${open('habits') ? '' : ' hidden'}>
        <h2>${esc(INTRO_WORDS.habitList)}</h2>
        ${list.map((h) => pickable(h, `<span aria-hidden="true">${esc(h.icon)}</span> ${esc(h.name)}`)).join('')}
      </section>
    </main>
    <footer class="cta">
      <button class="next" data-done>${esc(INTRO_WORDS.done)}</button>
      ${change ? `<button class="link" data-back>${esc(INTRO_WORDS.back)}</button>` : `<button class="link" data-skip>${esc(INTRO_WORDS.skip)}</button>`}
    </footer>`;
  focusOn('h1');
  const press = (b, pressed) => b.setAttribute('aria-pressed', pressed);
  for (const b of app.querySelectorAll('[data-pick]')) {
    b.addEventListener('click', () => {
      const id = b.dataset.pick;
      // A course that follows another brings that one along, and says so.
      const parent = parentOf(courses.find((s) => s.id === id) ?? {});
      const also = !on(id) && parent && !on(parent.id);
      picked = on(id) ? picked.filter((x) => x !== id) : [...picked, ...(also ? [parent.id] : []), id];
      if (also) app.querySelector('.picked-too').textContent = fill(INTRO_WORDS.alsoPicked, { parent: parent.title });
      for (const p of app.querySelectorAll('[data-pick]')) press(p, on(p.dataset.pick));
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
  // A list opened with nothing in it picked means all of it: Learning with every course, or every guided habit.
  const all = (b) => (open(b) || app.querySelector(`[data-want="${b}"]`).getAttribute('aria-pressed') !== 'true' ? [] : b === 'learn' ? [courses[0].habit]
    : list.filter((h) => HABITS.includes(h)).map((h) => h.id));
  app.querySelector('[data-done]').addEventListener('click', () => choose([...picked, ...all('learn'), ...all('habits')]));
  app.querySelector('[data-skip]')?.addEventListener('click', () => choose([]));
  app.querySelector('[data-back]')?.addEventListener('click', () => { home(); focusOn('.menu'); });
  app.querySelector('.back')?.addEventListener('click', intro);
}

/**
 * Home after the intro: what was picked is what home shows, the first shown first; the rest wait one tap away under
 * + Habit and + Course, hidden the way + Habit hides (track). A course that follows another brings that one along.
 * [] is a skip: today's default home, everything shown.
 */
function choose(picked) {
  const isCourse = (id) => courses.some((s) => s.id === id);
  picked = [...new Set(picked.flatMap((id) => [parentOf(courses.find((s) => s.id === id) ?? {})?.id, id]).filter(Boolean))];
  const course = picked.find(isCourse);
  if (course) showCourse(course);
  const tracked = (id) => progress.tracked.some((t) => t.id === id);
  const hide = (id, hidden) => { if (hidden || tracked(id)) progress = track(progress, { id, hidden }); };
  for (const s of courses) hide(s.id, !!course && !picked.includes(s.id));
  picked = [...new Set(picked.map((id) => (isCourse(id) ? courses[0].habit : id)))];
  for (const h of HABITS) hide(h.id, picked.length > 0 && !picked.includes(h.id));
  for (const { id } of PRESETS) if (picked.includes(id)) progress = track(progress, { id, hidden: false }); else if (picked.length && tracked(id)) hide(id, true);
  progress = { ...progress, picked };
  save();
  if (picked.length) showHabit(picked[0]);
  scrollTo(0, 0); // home starts at its top, not where the list was scrolled to
  home();
  focusOn(picked.length ? '.cta .next' : 'h1');
}

/**
 * The Android wrapper's bridge (CLAUDE.md): plain functions on one small global, over the live
 * progress. `noteReminder` returns false for an outcome it doesn't know, which changes nothing.
 */
window.wingbeat = {
  reminderHour: () => reminderHour(progress),
  shouldRemind: () => shouldRemind(progress),
  noteReminder: (outcome) => {
    const p = noteReminder(progress, outcome);
    if (p === progress) return false;
    progress = p;
    save();
    return true;
  },
};

tellWidget(); // the widget catches up with a new day even when nothing is saved
sendArt(progress).catch(console.warn);
passNotes();
addEventListener('visibilitychange', () => document.hidden || passNotes()); // a note tapped while the app was open
navigation(app);
// Every screen replaces #app's children; Wind down's night palette rides on one of them.
const bars = () => tellBars(getComputedStyle(document.body).backgroundColor);
new MutationObserver(bars).observe(app, { childList: true });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', bars);
bars();
SIDEWAYS?.addEventListener('change', sideways);
sideways();
const start = () => { if (showsIntro(progress)) intro(); else home(); };
if (!openPairLink({ app, progress: () => progress, adopt, back: start, focusOn })) start();
syncSoon(0);
