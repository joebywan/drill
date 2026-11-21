// Links that leave the app, tapped for real: the field guide's source on a species page (target _blank: a new tab, and
// the app's tab as it was when the phone's back brings you home) and privacy.html's links (the issues address leaves in
// the same tab; "Back to Wingbeat" returns). Chrome's own tab list says what opened; a marker set on the app's window
// before the tap says it was not reloaded.
import { writeFileSync } from 'node:fs';
import { thirtyDays } from './lib/seed.js';

export default async ({ page, seed, touch, btn, shot, check, adb, screenXml, uiNodes, browser }) => {
  // Playwright only lists the tabs it drives, so Chrome's own tab button and address bar (the UI tree) say what opened.
  // Firefox's are its own views outside the page: the tab counter ("2 open tabs…") and the address shown in its toolbar.
  const firefox = async () => {
    const xml = await screenXml();
    const own = uiNodes(xml).filter((x) => !x.page).flatMap((x) => [x.text, x.desc]).filter(Boolean);
    if (!own.some((t) => /open tabs?/i.test(t))) writeFileSync(new URL(`../../test-results/phone/touch-links/ui-${Date.now()}.xml`, import.meta.url), xml); // to teach this reader Firefox's views
    return { n: Number(own.map((t) => t.match(/^(\d+) open tabs?/i)?.[1]).find(Boolean) ?? 0), url: own.find((t) => /^(https?:\/\/)?(localhost:\d+|[\w-]+(\.[\w-]+)+)(\/\S*)?$/.test(t)) ?? '' };
  };
  const chrome = async () => { if (browser === 'firefox') return firefox(); const ui = await screenXml(); return { n: Number(ui.match(/(\d+) tabs?/)?.[1] ?? ui.match(/tab_switcher_button[^>]*text="(\d+)"/)?.[1] ?? 0), url: ui.match(/url_bar"[^>]*text="([^"]*)"/)?.[1] ?? ui.match(/text="([^"]*)"[^>]*resource-id="com.android.chrome:id\/url_bar"/)?.[1] ?? '' }; };
  // The addresses open: Playwright's pages in Chrome; a bridged browser has only the address bar.
  const tabs = async () => (browser === 'chrome' ? page.context().pages().map((p) => p.url()) : [(await chrome()).url]);
  const back = async () => { adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await page.waitForTimeout(2500); };

  await seed(thirtyDays(1));
  await touch(btn(/^Your garden/)); await touch(btn('Field guide'));
  await touch(page.locator('[data-species="common-brown"]'));
  const link = page.locator('.source a').first();
  const href = await link.getAttribute('href');
  check('the source link opens in a new tab, without handing the tab over', await link.getAttribute('target') === '_blank' && /noopener/.test(await link.getAttribute('rel') ?? ''));
  await page.evaluate(() => { window.__marker = 'same page'; });
  const before = await chrome();
  await touch(link); await page.waitForTimeout(5000);
  const after = await chrome();
  await shot('after-source-tap');
  console.log(`  tabs: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  check('a tap opens one more tab, on the source address', after.n === before.n + 1 && new URL(href).hostname.endsWith(after.url.replace(/^www\./, '').split('/')[0]) , `${href} / ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  await back();
  await shot('after-back');
  const home = await chrome();
  check('back closes the new tab, and the address bar is the app again', home.n === before.n && /localhost/.test(home.url), JSON.stringify(home));
  check('the app tab is the same page: marker kept, species page still showing', await page.evaluate(() => window.__marker) === 'same page' && await page.locator('.guide-page h1').textContent() === 'Common Brown');
  await touch(btn('Back'));
  check('and it still works: Back reaches the field guide', await page.locator('.guide-tile').count() > 0);

  // privacy.html, in the app's own tab.
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/privacy.html`, { waitUntil: 'networkidle' }); await shot('privacy');
  const issues = page.getByRole('link', { name: /github.com\/joebywan/ });
  check('privacy: the issues link goes to the project on GitHub', (await issues.getAttribute('href')) === 'https://github.com/joebywan/wingbeat/issues');
  await touch(issues); await page.waitForTimeout(4000); await shot('privacy-issues');
  console.log(`  after the issues tap: ${page.url()} / ${JSON.stringify(await tabs())}`);
  check('privacy: the issues link leaves for the GitHub address', /github\.com\/joebywan\/wingbeat\/issues/.test((await tabs()).join(' ')) || /github/.test(page.url()), page.url());
  await back();
  check('privacy: the phone back returns to the policy', /privacy\.html/.test(page.url()), page.url());
  await touch(page.getByRole('link', { name: 'Back to Wingbeat' })); await page.waitForTimeout(1500); await shot('privacy-back');
  check('privacy: "Back to Wingbeat" returns to the app', await page.locator('.home').count() === 1 || await page.locator('main').count() > 0, page.url());
};
