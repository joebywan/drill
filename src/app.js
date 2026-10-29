import { HABITS, subjects } from './subjects.js';
import { LEARN, emptyProgress, finishPractice, finishSession, noteFeel, currentStreak, dueKeys, habitDays, light, migrate, needsRepair, soonestKeys, startedHabits, today } from './progress.js';
import { FIRST_SQUARE, NO_STREAK, QUIET_DAY, REST_DAY, dateOf, dayName, restDays, sessionLine } from './habitview.js';
import { coach } from './cast/coach.js';
import { rosa } from './cast/rosa.js';
import { lumi } from './cast/lumi.js';
import { reducedMotion } from './cast/kit.js';
import { FEELS, STREAK_LABEL, accuracyLabel, finished, headline, line, paceLabel, rightAnswer } from './cast/lines.js';
import { buzz, move, play, setSound, soundOn } from './feel.js';
import { chip, esc } from './html.js';

const STORE = 'drill.progress';
const REVIEW_SIZE = 8;
const app = document.getElementById('app');

let progress = load();

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
  return HABITS.some((x) => x.id === h) ? h : HABITS[0].id;
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
function home(arrived = null) {
  stopHome();
  const learning = habitShown === 'learn';
  const due = learning ? dueKeys(progress).filter((k) => items.has(k)) : [];
  // A repair needs a review even when nothing is due yet: then the soonest cards stand in.
  const repair = learning && needsRepair(progress);
  const reviewKeys = (due.length ? due : repair ? soonestKeys(progress).filter((k) => items.has(k)) : []).slice(0, REVIEW_SIZE);
  const units = subjects.filter((s) => s.habit === habitShown).flatMap(unitsOf);
  // The next lesson, from the placement survey's starting unit on.
  const from = Math.max(0, units.findIndex((u) => u.title === progress.start));
  const current = [...units.slice(from), ...units].flatMap((u) => u.nodes).find((n) => n.state === 'open');
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

  app.innerHTML = `
    <header class="bar">
      <h1>Drill</h1>
      ${startedHabits(progress, HABITS.map((h) => h.id)).map(habitChip).join('')}
      <button class="sound" aria-pressed="${soundOn()}" aria-label="Sound">${soundOn() ? '🔊' : '🔇'}</button>
      <button class="menu" aria-label="Your progress">⋯</button>
    </header>
    <main class="home">
      <nav class="paths" aria-label="Show the path for">
        ${HABITS.map((h) => `<button class="path-tab" data-path="${h.id}" aria-pressed="${h.id === habitShown}">${h.icon} ${esc(h.name)}</button>`).join('')}
      </nav>
      ${units.map((u) => `
        <section class="street">
          <h2>${esc(u.title)}</h2>
          <div class="trailhead">${trail(u.nodes)}<ol class="path">${u.nodes.map(node).join('')}</ol></div>
        </section>`).join('')}
    </main>
    <footer class="cta">
      ${dueChip}
      ${current ? `<button class="next" data-lesson="${current.id}">Continue · ${esc(current.lesson.title)}</button>` : ''}
    </footer>`;

  const guide = app.querySelector('.guide');
  if (guide) {
    // Lumi rests once today is done, and is content otherwise: never sad, whatever the light.
    const late = new Date().getHours() >= 21;
    const lumiCoach = coach(guide, lumi);
    const guideLight = light(progress, new Date(), habitShown);
    const settle = () => lumiCoach.set(guideLight === 'bright' ? (late ? 'sleepy' : 'complete') : 'teach');
    const from = arrived && app.querySelector(`.node[data-lesson="${arrived}"]`);
    app.querySelector('.here').scrollIntoView({ block: 'center' });
    const walk = from && walkTo(guide, from, app.querySelector('.node.here'));
    if (walk) {
      lumiCoach.set('correct');
      walk.finished.then(settle, () => {});
    } else settle();
    stopHome = () => { walk?.cancel(); lumiCoach.stop(); };
  } else app.querySelector('.here')?.scrollIntoView({ block: 'center' });
  app.querySelector('.sound').addEventListener('click', () => { setSound(!soundOn()); home(); focusOn('.sound'); });
  app.querySelector('.menu').addEventListener('click', () => { stopHome(); keep(); });
  for (const chip of app.querySelectorAll('[data-habit]')) chip.addEventListener('click', () => habitView(chip.dataset.habit));
  for (const b of app.querySelectorAll('[data-path]')) {
    b.addEventListener('click', () => { showHabit(b.dataset.path); home(); focusOn(`[data-path="${b.dataset.path}"]`); });
  }
  app.querySelector('[data-review]')?.addEventListener('click', () =>
    run(null, reviewKeys.map((k) => ({ key: k, ...items.get(k) })), 'Review'));
  for (const btn of app.querySelectorAll('[data-lesson]')) {
    btn.addEventListener('click', () => {
      const n = units.flatMap((u) => u.nodes).find((x) => x.id === btn.dataset.lesson);
      run(n.id, n.lesson.items.map((item) => ({ key: `${n.subject.id}:${item.id}`, ...items.get(`${n.subject.id}:${item.id}`) })), n.lesson.title);
    });
  }
}

/** A habit's chip on the home bar: its icon and streak, coloured by today's light. */
function habitChip(id) {
  const h = HABITS.find((x) => x.id === id);
  const n = currentStreak(progress, new Date(), id);
  return `<button class="stat streak-${light(progress, new Date(), id)}" data-habit="${id}"${id === LEARN ? ' title="Day streak"' : ''}
    aria-label="${esc(h.name)}: ${n}-day streak">${h.icon} ${n}</button>`;
}

/**
 * A habit's view: its streak, the last seven days (each day's sessions, today first) and a month
 * of filled squares. The week ends today rather than on a Sunday, so it is always seven real days
 * and never a row of days still to come. Days without a session are plain.
 */
function habitView(id) {
  stopHome();
  const h = HABITS.find((x) => x.id === id);
  const now = new Date();
  const n = currentStreak(progress, now, id);
  const rest = restDays(progress.habits[id]);
  const month = habitDays(progress, id, 28, now);
  const week = month.slice(-7);
  const active = month.slice(-14).filter((d) => d.sessions.length).length;
  const cell = ({ date, sessions }) => `<li class="${sessions.length ? 'on' : rest.has(date) ? 'rest' : ''}">
    <span>${dateOf(date).toLocaleDateString('en', { weekday: 'narrow' })}</span><b>${dateOf(date).getDate()}</b></li>`;
  const day = ({ date, sessions }) => `<section class="day"><h3>${dayName(date, now)}</h3>${sessions.length
    ? `<ul>${sessions.map((e) => `<li>${esc(sessionLine(e))}</li>`).join('')}</ul>`
    : `<p class="quiet">${rest.has(date) ? REST_DAY : QUIET_DAY}</p>`}</section>`;
  app.innerHTML = `
    <header class="bar"><button class="back" aria-label="Back">←</button></header>
    <main class="habit">
      <h1><span aria-hidden="true">${h.icon}</span> ${esc(h.name)}</h1>
      <p class="said">${n ? `${n}-day streak` : NO_STREAK}</p>
      <h2>This week</h2>
      <ol class="week" aria-hidden="true">${week.map(cell).join('')}</ol>
      ${[...week].reverse().map(day).join('')}
      <h2>Keeping it up</h2>
      <p>${active ? `${active} of the last 14 days` : FIRST_SQUARE}</p>
      <div class="month" role="img" aria-label="Days with a session, last four weeks">${month.map((d) => `<i${d.sessions.length ? ' class="on"' : ''}></i>`).join('')}</div>
    </main>`;
  focusOn('h1');
  app.querySelector('.back').addEventListener('click', () => { home(); focusOn(`[data-habit="${id}"]`); });
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
 * One subject's units, each lesson marked done, open or locked. A unit opens when the previous
 * unit's first lesson is done, so a beginner can move across topics without first clearing every
 * hard tier; within a unit, lessons open in order. Units before the placement survey's starting
 * point are open all through, to go back to.
 */
function unitsOf(subject) {
  const start = subject.units.findIndex((u) => u.title === progress.start);
  let unitOpen = true;
  return subject.units.map((unit, i) => {
    let open = unitOpen || i <= start;
    unitOpen = !!progress.done[`${subject.id}:${unit.lessons[0].id}`];
    const nodes = unit.lessons.map((lesson) => {
      const id = `${subject.id}:${lesson.id}`;
      const state = progress.done[id] ? 'done' : open ? 'open' : 'locked';
      if (state !== 'done' && i >= start) open = false;
      return { id, subject, lesson, state };
    });
    return { title: unit.title, nodes };
  });
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
      <div class="coach">
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
  const flare = (text) => {
    const el = $('.flare');
    el.textContent = text;
    move(el, [
      { opacity: 0, transform: 'translate(-50%, 6px) scale(.6)' },
      { opacity: 1, transform: 'translate(-50%, 0) scale(1.1)', offset: 0.2 },
      { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%, -4px) scale(1)' },
    ], { duration: 1600, easing: 'ease-out' });
  };
  const step = () => {
    cleanup();
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
      done: (correct, text = '') => {
        // A practice item goes straight on: its own buttons were the Continue.
        if (practice) { if (text) did.push(text); at++; return step(); }
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
    if (!foot.classList.contains('show')) stage.querySelector('svg[tabindex], .choice, .practice-go')?.focus();
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
    progress = finishPractice(progress, subject.habit, lessonId, new Date(), { title: technique, mins });
    save();
    const h = HABITS.find((x) => x.id === subject.habit);
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
        <section class="feel" aria-labelledby="feel-q">
          <h2 id="feel-q">How do you feel?</h2>
          <div class="feels">${FEELS.map(([value, label]) => `<button class="choice" data-feel="${value}">${esc(label)}</button>`).join('')}</div>
          <p class="said" role="status"></p>
        </section>
      </main>
      <footer class="cta"><button class="next">Continue</button></footer>`;
    const endCoach = coach(app.querySelector('.hero'), who.draw);
    endCoach.set('done');
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
        if (feel === 'no different' && who.help) section.insertAdjacentHTML('beforeend', who.help());
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

/** A first visit with nothing done yet: ask once where to start. */
const PLACEMENT = [
  ["I've never played", 'The board'],
  ['I know how the pieces move', 'Capturing'],
  ['I play now and then', 'Forks'],
  ['I play often and know some tactics', 'Mate in one'],
];

function survey() {
  app.innerHTML = `
    <main class="survey">
      <div class="hero"></div>
      <h1>Have you played chess before?</h1>
      <p class="said">Pick the closest. It only sets where you start: every earlier lesson stays open.</p>
      ${PLACEMENT.map(([label], i) => `<button class="choice" data-i="${i}">${esc(label)}</button>`).join('')}
    </main>`;
  const guide = coach(app.querySelector('.hero'), lumi);
  guide.set('teach');
  for (const b of app.querySelectorAll('[data-i]')) {
    b.addEventListener('click', () => { guide.stop(); suggest(PLACEMENT[b.dataset.i][1]); });
  }
}

function suggest(unit) {
  const first = subjects[0].units[0].title;
  if (unit === first) return place(first);
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
  app.querySelector('[data-start]').addEventListener('click', () => { guide.stop(); place(unit); });
  app.querySelector('[data-first]').addEventListener('click', () => { guide.stop(); place(first); });
}

function place(unit) {
  progress = { ...progress, start: unit };
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
      <button class="choice" data-back>Back</button>
    </main>`;
  const status = app.querySelector('[role="status"]');
  const input = app.querySelector('input');
  focusOn('h1');
  app.querySelector('[data-back]').addEventListener('click', () => { home(); focusOn('.menu'); });
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

const fresh = progress.start == null && !Object.keys(progress.done).length && !Object.keys(progress.cards).length;
if (fresh) survey(); else home();
