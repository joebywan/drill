/** Whether Chrome (or the phone's TTS engine) has an audio stream started right now, from `dumpsys audio`. */
export function streamStarted(adb) {
  const uids = ['com.android.chrome', 'com.google.android.tts'].flatMap((p) =>
    adb('shell', 'cmd', 'package', 'list', 'packages', '-U', p).match(/uid:\d+/g)?.map((u) => u.slice(4)) || []);
  return adb('shell', 'dumpsys', 'audio').split('\n').some((l) => l.includes('state:started') && uids.some((u) => l.includes(`u/pid:${u}/`)));
}
