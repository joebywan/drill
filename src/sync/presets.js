/**
 * The only things a friend ever sees besides numbers: a preset word, a preset animal and a preset
 * cheer. No free text anywhere, so there is nothing to moderate. The sync server (server/worker.js)
 * imports this file to check every card and cheer against these same lists.
 */
export const WORDS = ['Sunny', 'Brave', 'Calm', 'Quick', 'Bright', 'Steady', 'Curious', 'Gentle', 'Bold', 'Merry', 'Cosy', 'Breezy'];

export const ANIMALS = {
  fox: ['🦊', 'Fox'], turtle: ['🐢', 'Turtle'], panda: ['🐼', 'Panda'], otter: ['🦦', 'Otter'],
  bee: ['🐝', 'Bee'], hedgehog: ['🦔', 'Hedgehog'], penguin: ['🐧', 'Penguin'], dolphin: ['🐬', 'Dolphin'],
  koala: ['🐨', 'Koala'], frog: ['🐸', 'Frog'], lion: ['🦁', 'Lion'], butterfly: ['🦋', 'Butterfly'],
};

export const CHEERS = {
  hi: '👋 Hi from here',
  nice: '🎉 Nice one',
  grow: '🌱 Growing together',
  with: '☕ Practising with you',
  star: '🌟 Thinking of you',
};

/** "Sunny Fox", from a card's preset word and animal. */
export const displayName = (card) => `${card?.word ?? ''} ${ANIMALS[card?.animal]?.[1] ?? ''}`.trim();

/** A friend's public card, checked: { word, animal, streak, lessons, unit }, or null when anything is off. */
export function checkCard(c) {
  if (c == null || typeof c !== 'object' || Array.isArray(c)) return null;
  const count = (n) => Number.isInteger(n) && n >= 0 && n < 1e6;
  if (!WORDS.includes(c.word) || !Object.hasOwn(ANIMALS, c.animal) || !count(c.streak) || !count(c.lessons)) return null;
  if (!(c.unit === null || (typeof c.unit === 'string' && /^[a-z]{1,20}:\d{1,3}$/.test(c.unit)))) return null;
  return { word: c.word, animal: c.animal, streak: c.streak, lessons: c.lessons, unit: c.unit };
}
