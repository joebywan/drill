// A first visit with empty storage opens the intro; skipping it lands on home with no questions,
// and Calm never offers placement.
export default async ({ page, touch, btn, shot, check }) => {
  check('first screen is the intro', await page.getByRole('heading', { name: 'What can Drill do for you?' }).isVisible());
  await touch(btn('Skip'));
  const survey = () => page.getByRole('heading', { name: /chess before\?/ }).count();
  const skip = () => page.locator('[data-place]').count();
  check('after Skip: home (garden strip, no survey)', await btn(/^Your garden/).isVisible() && !(await survey()));
  check('Learning offers Skip ahead', (await skip()) === 1);
  await shot('home');
  await touch(btn(/^Calm(,|$)/)); await shot('calm');
  check('Calm: no survey and no Skip ahead', !(await survey()) && !(await skip()));
};
