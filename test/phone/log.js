// Self-reported habits: + Habit, add Walk (skipping "When will you do it?"), one tap, Undo, then a
// habit of your own typed on the phone's keyboard, logged; Music with its "when" typed on the keyboard
// and changed in its habit view; and a garden with the new plants.
export default async ({ page, seed, touch, btn, type, shot, check }) => {
  await seed();
  await touch(btn('Add a habit')); await shot('sheet');
  await touch(btn(/Walk/)); await shot('when-ask');
  await touch(btn('Skip')); await shot('walk-before');
  const big = await btn('I walked today').boundingBox();
  const vh = await page.evaluate(() => innerHeight);
  check('the big button is in the thumb zone', big.y + big.height > vh - 160, `${Math.round(big.y)} of ${vh}`);
  await touch(btn('I walked today')); await shot('walk-after');
  check('streak at 1', (await page.locator('.path-tab[data-path="walk"]').getAttribute('aria-label')) === 'Walk, 1-day streak');
  check('a tulip in the garden', await page.locator('.garden-link svg.plant-tulip').count() === 1);
  await touch(btn('Undo')); await shot('walk-undone');
  check('undo takes the tap back', (await page.locator('.path-tab[data-path="walk"]').getAttribute('aria-label')) === 'Walk');

  await touch(btn('Add a habit'));
  await touch(btn('Make your own'));
  await touch(page.getByRole('textbox', { name: 'Name' })); await type('Stretch'); await shot('own-keyboard');
  await touch(page.getByRole('heading', { name: 'Make your own' })); // off the field: the keyboard goes
  await touch(page.locator('label:has(input[value="🧘"])'));
  await touch(page.locator('label:has(input[value="mushroom"])')); await shot('own-form');
  await touch(btn('Add habit'));
  await touch(btn('Skip'));
  check('Stretch has a tab', await page.locator('.path-tab[data-path="own-1"]').count() === 1);
  await touch(btn('Done today')); await shot('own-after');

  await touch(btn('Add a habit')); await shot('sheet-nine');
  const own = btn('Make your own');
  const box = await own.boundingBox();
  check('the sheet fits nine presets and Make your own', box.y + box.height <= vh, `${Math.round(box.y + box.height)} of ${vh}`);
  await touch(btn(/Music/));
  await touch(page.getByRole('textbox', { name: 'Or in your own words' })); await type('After work'); await shot('when-keyboard');
  await touch(page.getByRole('heading', { name: 'When will you do it?' }));
  await touch(btn('Save')); await shot('music-panel');
  check('the when is on the panel', (await page.locator('.log-habit .when').textContent()) === 'After work');
  await touch(btn('I played today'));
  await touch(page.locator('.streak-line'));
  await touch(btn('Change when'));
  await touch(btn('Before bed')); await shot('music-view');
  check('changed in the habit view', (await page.locator('main.habit .when').textContent()) === 'Before bed');
  await touch(btn('Back'));

  for (const id of ['read', 'water', 'outside']) {
    await touch(btn('Add a habit'));
    await touch(page.locator(`[data-track="${id}"]`));
    await touch(btn('Skip'));
    await touch(page.locator('[data-log]'));
  }
  await shot('many-tabs');
  await touch(btn(/^Your garden/)); await shot('garden');
};
