// Chrome put down with no debugger on it (see lib/bare.js): does a routine pause, go quiet and let the screen sleep when Home
// or the lock screen is pressed, and what is found after Chrome is killed in the background?
import { bareTour } from './lib/bare.js';

export default (h) => bareTour(h, 'com.android.chrome', 'away-bare');
