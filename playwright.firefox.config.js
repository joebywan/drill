// The same suite in Firefox (Gecko): `npm run e2e:firefox`, after `npx playwright install firefox`.
// Firefox plays sound for real, where Chromium's headless shell is mute: unless it is cut off, the app's chimes and the
// system's speech service (reading lesson text aloud) come out of this computer's speakers. So: no route to the sound
// server, Firefox's volume at nothing, and its own silent test voices in place of the system's.
import base from './playwright.config.js';

process.env.PULSE_SERVER = 'unix:/nonexistent/pulse';

export default {
  ...base,
  use: { ...base.use, browserName: 'firefox', launchOptions: { firefoxUserPrefs: { 'media.volume_scale': '0.0', 'media.webspeech.synth.test': true } } },
};
