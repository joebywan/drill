/** Whether Chrome (or the phone's TTS engine) has an audio stream started right now, from `dumpsys audio`. */
export function streamStarted(adb) {
  const uids = ['com.android.chrome', 'com.google.android.tts'].flatMap((p) =>
    adb('shell', 'cmd', 'package', 'list', 'packages', '-U', p).match(/uid:\d+/g)?.map((u) => u.slice(4)) || []);
  return adb('shell', 'dumpsys', 'audio').split('\n').some((l) => l.includes('state:started') && uids.some((u) => l.includes(`u/pid:${u}/`)));
}

/**
 * Runs in the page (page.evaluate or page.addInitScript): keeps what the page asks the voice to say in
 * `window.__spoken`, and counts in `window.__started` the utterances the engine really began. A one-kana card is said
 * in well under a second, so a look at `speechSynthesis.speaking` or the audio stream after a tap's wait is too late.
 */
export const recordSpeech = () => {
  window.__spoken = []; window.__started = 0;
  const speak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { window.__spoken.push(u.text); u.addEventListener('start', () => { window.__started++; }); return speak(u); };
};
