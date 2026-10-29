import { subjects } from './subjects.js';
import { emptyProgress, finishSession, currentStreak, dueKeys } from './progress.js';

const STORE = 'drill.progress';
const REVIEW_SIZE = 8;
const app = document.getElementById('app');

let progress = load();

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || emptyProgress(); } catch { return emptyProgress(); }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* private mode: progress lasts the visit */ }
}

// Every item by key, so a review can find what it is reviewing.
const items = new Map();
for (const s of subjects)
  for (const u of s.units)
    for (const l of u.lessons)
      for (const item of l.items) items.set(`${s.id}:${item.id}`, { subject: s, item, topic: u.title });

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function home() {
  const due = dueKeys(progress).filter((k) => items.has(k));
  app.innerHTML = `
    <header class="bar">
      <h1>Drill</h1>
      <span class="stat" title="Day streak">🔥 ${currentStreak(progress)}</span>
      <span class="stat" title="Total XP">⭐ ${progress.xp}</span>
    </header>
    <main class="home">
      ${due.length ? `<button class="review" data-review>Review ${Math.min(due.length, REVIEW_SIZE)} of ${due.length} due</button>` : ''}
      ${subjects.map(subjectPath).join('')}
    </main>`;
  app.querySelector('[data-review]')?.addEventListener('click', () =>
    run(null, due.slice(0, REVIEW_SIZE).map((k) => ({ key: k, ...items.get(k) }))));
  for (const btn of app.querySelectorAll('[data-lesson]')) {
    btn.addEventListener('click', () => {
      const [sid, lid] = btn.dataset.lesson.split('|');
      const subject = subjects.find((s) => s.id === sid);
      const lesson = subject.units.flatMap((u) => u.lessons).find((l) => l.id === lid);
      run(`${sid}:${lid}`, lesson.items.map((item) => ({ key: `${sid}:${item.id}`, ...items.get(`${sid}:${item.id}`) })));
    });
  }
}

/**
 * One subject's units. A unit opens when the previous unit's first lesson is done, so a
 * beginner can move across topics without first clearing every hard tier; within a unit,
 * lessons open in order.
 */
function subjectPath(subject) {
  let unitOpen = true;
  const units = subject.units.map((unit) => {
    let open = unitOpen;
    unitOpen = !!progress.done[`${subject.id}:${unit.lessons[0].id}`];
    return `
    <section class="unit">
      <h2>${esc(unit.title)}</h2>
      <div class="lessons">
        ${unit.lessons.map((l) => {
          const done = progress.done[`${subject.id}:${l.id}`];
          const state = done ? 'done' : open ? 'open' : 'locked';
          if (!done) open = false;
          return `<button class="lesson ${state}" data-lesson="${subject.id}|${l.id}" ${state === 'locked' ? 'disabled' : ''}>
            <span class="badge">${done ? '✓' : state === 'locked' ? '🔒' : '▶'}</span>${esc(l.title)}</button>`;
        }).join('')}
      </div>
    </section>`;
  }).join('');
  return `<h2 class="subject">${esc(subject.title)}</h2>${units}`;
}

/**
 * Plays a session: a lesson (lessonId set) or a review (null). An item missed the first time
 * comes back once at the end; only the first try counts toward review scheduling.
 */
function run(lessonId, queue) {
  const results = [];
  let at = 0;
  let cleanup = () => {};
  app.innerHTML = `
    <header class="bar">
      <button class="close" aria-label="Quit lesson">✕</button>
      <div class="meter"><div class="fill"></div></div>
    </header>
    <main class="play">
      <p class="topic"></p>
      <div class="stage"></div>
      <p class="caption" aria-live="polite"></p>
      <button class="next" hidden>Continue</button>
    </main>`;
  const [topic, stage, caption, next, fill] = ['.topic', '.stage', '.caption', '.next', '.fill'].map((s) => app.querySelector(s));
  app.querySelector('.close').addEventListener('click', () => { cleanup(); home(); });

  const meter = () => { fill.style.width = `${(100 * at) / queue.length}%`; };
  const step = () => {
    cleanup();
    meter();
    if (at === queue.length) return finish();
    const entry = queue[at];
    topic.textContent = entry.topic;
    next.hidden = true;
    cleanup = entry.subject.mount(stage, entry.item, {
      say: (text) => { caption.textContent = text; },
      done: (correct) => {
        if (correct !== null && !entry.retry) results.push({ key: entry.key, correct });
        if (correct === false && !entry.retry) queue.push({ ...entry, retry: true });
        at++;
        meter();
        next.hidden = false;
        next.focus();
      },
    });
  };
  next.addEventListener('click', step);

  const finish = () => {
    const before = progress.xp;
    progress = finishSession(progress, lessonId, results);
    save();
    const right = results.filter((r) => r.correct).length;
    app.innerHTML = `
      <main class="summary">
        <h1>${lessonId ? 'Lesson complete' : 'Review done'}</h1>
        <p class="big">+${progress.xp - before} XP</p>
        <p>${right} of ${results.length} right first time</p>
        <p>🔥 ${currentStreak(progress)} day streak</p>
        <button class="next">Back</button>
      </main>`;
    app.querySelector('.next').addEventListener('click', home);
  };

  step();
}

home();
