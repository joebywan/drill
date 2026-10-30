/**
 * The phone's back button (web and the Android wrapper, whose back is `web.goBack()`). Screens replace
 * #app's children and know nothing of this: watching #app sees every screen change, one history entry
 * goes on for each, and back presses the screen's own back control, so it does what its X or ← does.
 * A screen with no back control is home: history returns to the first entry, and back leaves the app.
 * Entries are added only on a forward screen change, after a tap: Chrome skips an entry whose page
 * pushed without a tap, so back never pushes unless history has run out.
 */
export const BACK = '.close, .back, [data-back], [data-keep], .summary + .cta .next';

export function navigation(app) {
  let settling = false; // on the way back to the first entry
  const depth = () => history.state?.depth ?? 0;
  const inner = () => app.querySelector(BACK) || document.querySelector('dialog[open]');
  const sync = (forward) => {
    if (settling) return;
    if (!inner()) {
      if (depth()) { settling = true; history.go(-depth()); }
    } else if (forward || !depth()) history.pushState({ depth: depth() + 1 }, '');
  };
  const watch = new MutationObserver((changes) => {
    if (changes.some((c) => c.target === app || (c.type === 'attributes' && c.target.matches('dialog')))) sync(true);
  });
  watch.observe(app, { childList: true, attributes: true, attributeFilter: ['open'], subtree: true });
  history.scrollRestoration = 'manual'; // each screen says where it starts
  addEventListener('popstate', () => {
    if (settling) settling = false;
    else {
      const open = document.querySelector('dialog[open]');
      if (open) open.close(); else app.querySelector(BACK)?.click();
      watch.takeRecords(); // that was a step back, not a new screen
    }
    sync(false);
  });
  sync(false); // a reload lands on home with entries left over
}
