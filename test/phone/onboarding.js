// The first-visit intro with real taps: what Drill does, then Build habits with Calm and Walk; home
// puts them first, Walk logs with one tap, and "Change what you see" in ⋯ brings Learning forward.
export default async ({ page, touch, btn, shot, check }) => {
  const tabs = () => page.locator('.path-tab[data-path]').evaluateAll((t) => t.map((x) => x.dataset.path));
  const pick = (name) => page.getByRole('button', { name, exact: true });
  const vh = await page.evaluate(() => innerHeight);
  const inThumbZone = async (loc) => { const b = await loc.boundingBox(); return b.y + b.height > vh - 160; };

  check('a first visit opens the intro', await page.getByRole('heading', { name: 'What can Drill do for you?' }).isVisible());
  await shot('does');
  check('Next is in the thumb zone', await inThumbZone(btn('Next')));
  await touch(btn('Next')); await shot('want');
  await touch(pick('Build habits'));
  await touch(pick('Calm'));
  await touch(pick('Walk')); await shot('picked');
  check('Show my home is in the thumb zone', await inThumbZone(btn('Show my home')));
  await touch(btn('Show my home')); await shot('home');
  const order = await tabs();
  check('Calm, then Walk, come first', order[0] === 'calm' && order[1] === 'walk', order.join(','));
  check('Calm is selected', await page.locator('.path-tab[aria-pressed="true"]').getAttribute('data-path') === 'calm');
  check("Lumi's line names Calm", await page.getByText('Calm is first.').isVisible());

  await touch(page.locator('.path-tab[data-path="walk"]'));
  await touch(btn('I walked today')); await shot('walked');
  check('Walk logged', (await page.locator('.path-tab[data-path="walk"]').getAttribute('aria-label')) === 'Walk, 1-day streak');

  await touch(btn('Your progress'));
  await touch(btn('Change what you see')); await shot('change');
  await touch(pick('Learn something')); await shot('change-learn');
  await touch(btn('Show my home')); await shot('home-after');
  check('Learning joins after the habits', (await tabs()).slice(0, 3).join(',') === 'calm,walk,learn', (await tabs()).join(','));

  await page.reload({ waitUntil: 'networkidle' });
  check('no intro after a reload', !(await page.getByRole('heading', { name: 'What can Drill do for you?' }).isVisible()));
};
