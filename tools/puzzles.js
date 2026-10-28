/**
 * Builds src/data/chess.json — the chess course — from the Lichess puzzle database (CC0).
 *
 *   npm run puzzles
 *
 * which is: curl … | zstd -dc | head -n 600000 | node tools/puzzles.js > src/data/chess.json
 *
 * Only the head of the 300MB file is streamed. Rows are ordered by puzzle id, which is random
 * with respect to theme and rating, so the head is a fair sample. The output is committed: the
 * app never touches the network.
 */
import { createInterface } from 'node:readline';

// Curriculum order. Keys are Lichess theme tags.
const THEMES = [
  ['mateIn1', 'Mate in one'],
  ['hangingPiece', 'Free pieces'],
  ['fork', 'Forks'],
  ['pin', 'Pins'],
  ['skewer', 'Skewers'],
  ['backRankMate', 'Back-rank mates'],
  ['mateIn2', 'Mate in two'],
  ['discoveredAttack', 'Discovered attacks'],
  ['doubleCheck', 'Double check'],
  ['trappedPiece', 'Trapped pieces'],
  ['deflection', 'Deflection'],
  ['attraction', 'Attraction'],
  ['promotion', 'Promotion'],
  ['mateIn3', 'Mate in three'],
];
const TIERS = [
  [600, 1200, 'Starter'],
  [1200, 1600, 'Club'],
  [1600, 2000, 'Strong'],
];
const PER_LESSON = 8;

const pools = new Map(); // "theme|tier" -> rows
for await (const line of createInterface({ input: process.stdin })) {
  // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const [id, fen, moves, rating, dev, popularity, plays, themes] = line.split(',');
  if (id === 'PuzzleId' || +dev > 90 || +popularity < 85 || +plays < 300) continue;
  const tags = themes.split(' ');
  const tier = TIERS.findIndex(([lo, hi]) => +rating >= lo && +rating < hi);
  if (tier < 0) continue;
  for (const [theme] of THEMES) {
    if (!tags.includes(theme)) continue;
    const key = `${theme}|${tier}`;
    if (!pools.has(key)) pools.set(key, []);
    pools.get(key).push({ id, fen, moves: moves.split(' '), rating: +rating, plays: +plays });
  }
}

// Each puzzle appears once in the course, in the earliest lesson that wants it. Within a
// lesson the most-played puzzles win (best-vetted ratings), then run easiest first.
const used = new Set();
const units = THEMES.map(([theme, title]) => ({
  title,
  lessons: TIERS.map(([, , tierName], tier) => {
    const items = (pools.get(`${theme}|${tier}`) || [])
      .filter((p) => !used.has(p.id))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, PER_LESSON)
      .sort((a, b) => a.rating - b.rating);
    if (items.length < PER_LESSON) throw new Error(`only ${items.length} puzzles for ${theme} ${tierName}: stream more rows`);
    for (const p of items) used.add(p.id);
    return { id: `${theme}-${tier}`, title: tierName, items: items.map(({ plays, ...p }) => p) };
  }),
}));

process.stdout.write(JSON.stringify({ id: 'chess', title: 'Chess', units }) + '\n');
