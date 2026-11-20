# Wingbeat

Small daily practice, for learning and for habits. A short lesson or a two-minute routine is one
wingbeat, and they add up. *Small beats go a long way.*

No ads. No accounts. No subscription. No server: it is a static page, and progress lives on the device.

Play it at **https://knowhowit.com.au/wingbeat/**, published from `main` by `.github/workflows/pages.yml`.

It was called Drill until November 2026; [docs/NAMING.md](docs/NAMING.md) says why it became Wingbeat.

## What is in it

**Seven courses**, 281 lessons of a few minutes each, taught from zero by a coach:

| Course | Coach | Units | Lessons |
| --- | --- | --- | --- |
| Chess | Rosa, a park-champion grandmother | 18 | 69 |
| Maths | Ada, an octopus | 9 | 36 |
| Japanese | Kaede, a red panda | 11 | 44 |
| Coding | Fennel, a fennec fox | 13 | 64 |
| JavaScript | Fennel | 10 | 39 |
| TypeScript | Fennel | 5 | 15 |
| Test writing | Fennel | 6 | 14 |

Every wrong answer says why. A missed item comes back before the lesson ends, and again later through
spaced review ([FSRS](https://github.com/open-spaced-repetition/ts-fsrs)). Each unit ends in a
checkpoint that mixes it.

**Six practice habits**, guided routines with a timer and no right or wrong: Calm and Wind down
(Moss, a capybara), Move (Clover, a rabbit), Screen break (Mira, a lemur), Focus (Hazel, a beaver)
and Reflect (Lumi).

**One-tap habits** for things done away from the phone: Walk, Read, Water, Outside, Tidy, Floss,
Music, Make, Call, or your own.

**Lumi**, a baby seal, is the guide. She walks the path with you and says nothing about a day off.

## What keeps you going

- **Your butterfly.** The first session of each day colours one of the 14 panels on its wings, and
  nothing fades. It flies on a day you've practised, basks until you do, and rests after a day off.
- **A butterfly for every course and habit.** Each one raises a real species from egg to caterpillar
  to chrysalis to butterfly. The field guide has a page on each of the 27, with its source.
- **A garden.** Each habit is a plant that grows with the days you practise and never wilts.
- **A streak that forgives.** One missed day in seven is forgiven, and a longer gap is mended by one review.
- **Things for Lumi to wear**, given for things done. Nothing is bought and nothing expires.

There are no hearts, leagues, currency or countdowns, and no character is sad at you for being away.
The reasoning is in the cast brief (linked from [CLAUDE.md](CLAUDE.md)); the rules a code review can
check are in `test/guardrails.test.js`.

## Running it

```bash
npm install
npm start                     # http://localhost:8124
npm test                      # unit tests
npm run e2e                   # browser tests (Playwright)
npm run phone -- butterfly    # one scenario on an Android emulator, by real taps
```

To try it on a phone on the same network: `HOST=0.0.0.0 npm start`, then open
`http://<this computer's IP>:8124` on the phone.

There is no build step. `index.html` maps the three dependencies straight out of
`node_modules/` with an import map.

## Android

`android/` wraps the same files in a small app (a WebView with no internet permission) and adds a
home-screen widget and an optional daily note. How to build it is in [CLAUDE.md](CLAUDE.md), under
Android. It is not on Google Play.

## Where things are

- [CLAUDE.md](CLAUDE.md): how the code is laid out, the rules, and how to test.
- [docs/WINGBEAT.md](docs/WINGBEAT.md): the butterfly theme, what was decided and the task list.
- [docs/HABITS.md](docs/HABITS.md): the plan for the habits.
- [docs/TODO.md](docs/TODO.md): what is open, and what playing it on a phone has found.
- [docs/DUO.md](docs/DUO.md): what Wingbeat takes from Duolingo, and what it leaves.
- [docs/NAMING.md](docs/NAMING.md): how the name was chosen.

## Adding a course

1. Produce a course: `{ id, title, units: [{ title, lessons: [{ id, title, items }] }] }`,
   every item with a stable `id`.
2. Write `mount(el, item, { say, done })` that plays one item and calls `done(correct)` once
   (`null` for an unmarked card such as a teach card).
3. Add both to `src/subjects.js`.

Home, lessons, the streak, review and the garden pick it up from there. It raises a butterfly from
the shared pool until you give it a species of its own in `src/data/butterflies.json` (`raisedBy`).

## Dependency updates

Renovate runs weekly from `.github/workflows/renovate.yml`. Patch bumps and GitHub Actions
automerge; minor and major open a pull request. It needs the `RENOVATE_TOKEN` secret to open them
(docs/TODO.md, Still open).

## Credits

- Chess puzzles: [Lichess open database](https://database.lichess.org/), CC0.
- Board: [cm-chessboard](https://github.com/shaack/cm-chessboard) by Stefan Haack, MIT.
- Chess rules: [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause.
- Scheduling: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs), MIT.
- Each butterfly fact and each Move exercise names its source in the app.
