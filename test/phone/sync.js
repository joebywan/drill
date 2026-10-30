// Sync and friends on the phone, against the local worker (server/dev.js): the phone's calls to
// the API host are routed by Playwright on this machine, so no adb reverse or DNS is needed.
// The other device and the friend are played from here through the same API.
import { API } from '../../src/sync/config.js';
import { derive, newPairCode, newRecovery, wrap } from '../../src/sync/keys.js';

export default async ({ page, seed, touch, btn, type, shot, check, run }) => {
  const { start } = await import('../../server/dev.js');
  const worker = await start({ port: 0 });
  try {
    await page.route(`${API}/**`, async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(API, worker.url) }) }));
    const as = async (recovery) => {
      const { token } = await derive(recovery);
      return (method, path, body) => fetch(`${worker.url}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then((r) => r.json());
    };
    // The other device: a profile with a lesson's worth of card, and a pairing code for the phone.
    const other = newRecovery();
    const otherCall = await as(other);
    await otherCall('POST', '/v1/profile');
    const code = newPairCode();
    await otherCall('POST', '/v1/pair', { code, wrapped: await wrap(code, other) });

    await seed({ version: 8, habits: { learn: { count: 0, last: null, forgiven: [], days: 0 } }, picked: [] });
    await touch(btn('Settings')); await shot('menu');
    await touch(btn('Use on another device')); await shot('device');
    await touch(btn('Enter a code'));
    await touch(page.getByRole('textbox', { name: 'Code from your other device' }));
    await shot('numeric-keyboard');
    await type(code);
    await page.getByRole('heading', { name: 'This device is linked' }).waitFor({ timeout: 15000 }).catch(() => {});
    await shot('linked');
    const linked = await page.evaluate(() => JSON.parse(localStorage.getItem('drill.sync') || 'null'));
    check('the phone joined the other device\'s profile', linked?.recovery === other);

    // A friend asks; the phone accepts and sends a cheer.
    const friend = await as(newRecovery());
    await friend('POST', '/v1/profile');
    await friend('PUT', '/v1/progress', { rev: 0, blob: 'AAAA', card: { word: 'Calm', animal: 'koala', streak: 4, lessons: 9, unit: 'chess:1' } });
    await friend('POST', '/v1/friends/add', { code: linked?.code });
    await touch(btn('Back'));
    await touch(btn('Friends'));
    await touch(btn('Accept')); await run(500);
    await shot('friends');
    check('the friend\'s card shows', /Calm Koala/.test(await page.locator('.friend').first().textContent()));
    await touch(btn('🌟 Thinking of you')); await run(500);
    check('one cheer today', await page.getByText('Cheered today').count() === 1);
    await shot('cheered');
    await touch(btn('Back'));
    await touch(btn('Recovery code')); await shot('recovery');
    await touch(btn('Back'));
    await touch(btn('Delete my data')); await shot('delete');
    await touch(btn('Delete it')); await run(500);
    await shot('deleted');
    check('deleted on the server', await worker.db.prepare('SELECT COUNT(*) AS n FROM profiles').first('n') === 1);
  } finally {
    await page.unroute(`${API}/**`).catch(() => {});
    await worker.mf.dispose();
  }
};
