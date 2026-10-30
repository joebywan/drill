// Coach voice: three evenings of Calm, then home on the Calm tab greets in Moss's voice, wrapped
// to the phone's width, never overlapping the streak line under it.
export default async ({ page, seed, touch, btn, shot, check }) => {
  const date = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toLocaleDateString('en-CA'); };
  const log = [3, 2, 1].map((back) => ({ date: date(back), hour: 19, habit: 'calm', title: 'Breathing', mins: 2 }));
  await seed({ habits: { learn: { count: 0, last: null, forgiven: [] }, calm: { count: 3, last: date(1), forgiven: [] } }, log });
  await touch(btn(/^Calm(,|$)/)); await shot('calm-greeting');
  const greeting = page.locator('.greeting');
  check('Moss greets home', (await greeting.innerText()).startsWith('Moss '), await greeting.innerText());
  const [g, s] = [await greeting.boundingBox(), await page.locator('.streak-line').boundingBox()];
  check('the greeting sits above the streak line', g.y + g.height <= s.y, `${Math.round(g.y + g.height)} vs ${Math.round(s.y)}`);
  await touch(btn(/^Learning(,|$)/)); await shot('learn-greeting');
  check('Rosa greets Learning', (await greeting.innerText()).startsWith('Rosa '), await greeting.innerText());
};
