# Drill

Short daily lessons with XP, a day streak and spaced review, for the subjects I actually want
to practise. Chess is the first; maths, Japanese, JavaScript, TypeScript and writing TypeScript
tests are planned.

No ads. No accounts. No server. It is a static page; progress lives in the browser.

## Running it

```bash
npm install
npm start          # http://localhost:8124
npm test
```

To try it on a phone on the same network: `HOST=0.0.0.0 npm start`, then open
`http://<this computer's IP>:8124` on the phone.

There is no build step. `index.html` maps the three dependencies straight out of
`node_modules/` with an import map.

## Chess

The course is 14 tactical themes — mate in one, forks, pins, skewers, through to mate in
three — each in three tiers (Starter under 1200, Club 1200–1600, Strong 1600–2000), eight
puzzles a lesson. A unit opens when the previous unit's Starter lesson is done; within a unit,
tiers open in order.

Puzzles come from the [Lichess puzzle database](https://database.lichess.org/#puzzles), which
is released under CC0. `npm run puzzles` streams the head of the 300MB file — rows are ordered
by a random id, so the head is a fair sample — and keeps well-played, well-rated puzzles
(popularity ≥ 85, ≥ 300 plays, rating deviation ≤ 90). The result, `src/data/chess.json`, is
committed: the app never touches the network.

A move is right if it is the stored move **or any legal move that checkmates**, as on Lichess.
Two wrong tries and the answer's squares are marked; the player still has to play it, and the
puzzle counts as missed.

## Review

Every answered item gets an [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) card:
right first time is rated *Good*, anything else *Again*. Due items show up as a review session
on the home screen. Reviews keep the streak alive but unlock nothing. In any session, an item
missed the first time comes back once before the end.

## Adding a subject

1. Produce a course JSON: `{ id, title, units: [{ title, lessons: [{ id, title, items }] }] }`,
   every item with a stable `id`.
2. Write `mount(el, item, { say, done })` that plays one item and calls `done(correct)` once
   (`null` for an unmarked card such as a teach card).
3. Add both to `src/subjects.js`.

Home, lessons, XP, streak and review pick it up from there.

## Dependency updates

Renovate runs weekly from `.github/workflows/renovate.yml`. Patch bumps and GitHub Actions
automerge; minor and major open a PR. Pull requests opened with the default `GITHUB_TOKEN` do
not trigger CI, so add a `RENOVATE_TOKEN` PAT for CI to run on them.

## Credits

- Puzzles: [Lichess open database](https://database.lichess.org/), CC0.
- Board: [cm-chessboard](https://github.com/shaack/cm-chessboard) by Stefan Haack, MIT.
- Rules: [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause.
- Scheduling: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs), MIT.

## Not done yet

- The other subjects
- Installable / offline (manifest and service worker), and an Android build
- Promotion always uses the stored piece; there is no piece picker
- No accessibility work beyond what cm-chessboard gives by default
