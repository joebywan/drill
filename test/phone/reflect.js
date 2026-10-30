// Reflect: typing with the on-screen keyboard, and the buttons that must sit above it.
export default async ({ page, seed, touch, btn, type, shot }) => {
  await seed();
  await touch(btn('📓 Reflect')); await shot('home');
  await touch(btn('Continue · Three small lines')); await shot('teach');
  await touch(btn('Start')); await shot('prompt1');
  const box = page.getByRole('textbox');
  await touch(box); await page.waitForTimeout(1200); await shot('keyboard');
  await type('Coffee with a friend'); await shot('typed');
  await touch(btn('Next')); await shot('prompt2');
  await touch(btn('Skip')); await shot('prompt3');
  await touch(box); await type('Go for a walk');
  await touch(btn(/Next|Finish|Done/)); await shot('end');
  await touch(btn('Clearer')); await touch(btn(/^Continue/)); await shot('home-after');
  await touch(btn(/^Reflect: /)); await shot('habitview');
};
