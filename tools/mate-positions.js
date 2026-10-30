/**
 * Writes src/data/mate.json from Daybook's proven positions, which come from the Lichess puzzle
 * database (CC0; docs/chess-positions/NOTICE.md). Only the positions are taken.
 *   node tools/mate-positions.js [daybook repo, default ../daybook]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const repo = process.argv[2] || '../daybook';
const kt = execFileSync('git', ['-C', repo, 'show', 'origin/main:app/src/main/java/com/joebywan/daybook/puzzles/ChessPositions.kt'], { encoding: 'utf8', maxBuffer: 1 << 26 });
const tier = (name) => {
  const [, body] = kt.match(new RegExp(`val ${name}: List<String> = listOf\\(([\\s\\S]*?)\\)\\.flatMap`));
  return [...body.matchAll(/"([^"]*)"/g)].flatMap((m) => m[1].split('\\n'));
};
const out = {
  notice: 'Positions from the Lichess puzzle database, CC0. See docs/chess-positions/NOTICE.md.',
  2: tier('STANDARD'), 3: tier('HARD'), 4: tier('EXPERT'),
};
writeFileSync(new URL('../src/data/mate.json', import.meta.url), `${JSON.stringify(out, null, 0)}\n`);
console.log(out[2].length, out[3].length, out[4].length);
