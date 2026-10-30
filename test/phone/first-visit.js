// A first visit with empty storage lands on home, no questions; Calm never offers placement.
export default async ({ page, touch, btn, shot, check }) => {
  const survey = () => page.getByRole('heading', { name: /chess before\?/ }).count();
  const skip = () => page.locator('[data-place]').count();
  check('first screen is home (garden strip, no survey)', await btn(/^Your garden/).isVisible() && !(await survey()));
  check('Learning offers Skip ahead', (await skip()) === 1);
  await shot('home');
  await touch(btn(/^Calm(,|$)/)); await shot('calm');
  check('Calm: no survey and no Skip ahead', !(await survey()) && !(await skip()));
};
