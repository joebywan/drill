import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the Play workflow runs by hand only, to the internal track, and checks its secret and the bundle first', () => {
  const y = readFileSync('.github/workflows/publish-play.yml', 'utf8');
  const triggers = /^on:\n((?: .*\n)+)/m.exec(y)[1];
  assert.deepEqual(triggers.match(/^ {2}\w+/gm).map((t) => t.trim()), ['workflow_dispatch']);
  assert.match(y, /track: internal/);
  assert.match(y, /packageName: com\.joebywan\.drill/);
  const at = (text) => { const i = y.indexOf(text); assert.ok(i >= 0, text); return i; };
  assert.ok(at('PLAY_JSON') < at('Fetch the bundle') && at('Fetch the bundle') < at('verify-aab.sh') && at('verify-aab.sh') < at('r0adkll/upload-google-play'));
});

test('the release builds the bundle in the same signed step as the APK, and verifies both', () => {
  const y = readFileSync('.github/workflows/android-release.yml', 'utf8');
  assert.match(y, /assembleRelease bundleRelease -PrequireSigning=true/);
  assert.match(y, /verify-apk\.sh/);
  assert.match(y, /verify-aab\.sh/);
  assert.doesNotMatch(y, /assembleDebug|bundleDebug/);
});
