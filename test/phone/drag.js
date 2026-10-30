// Dragging a tile into a square with a real touch swipe, which a desktop mouse can't vouch for:
// the browser must not take the gesture for a scroll.
export default async ({ page, seed, dragTo, shot, check }) => {
  await seed();
  await page.evaluate(async () => {
    const { mount } = await import('/src/coding/exercise.js');
    document.body.innerHTML = '<div id="t"></div>';
    mount(document.getElementById('t'), { id: 'x', type: 'build', level: ['..#*', '.#..', '#...', 'S...'], program: [{ repeat: 3, do: [null, null] }], tiles: ['up', 'right'], prompt: 'p', explain: 'e' }, { say() {}, done() {} });
  });
  await shot('empty');
  await dragTo(page.getByRole('button', { name: 'Step up', exact: true }), page.locator('.block.hole').nth(1));
  await shot('dragged');
  check('the second square took the tile', await page.locator('.program button[data-hole="1"]').count() === 1);
  check('the first is still empty', await page.locator('.block.hole').count() === 1);
};
