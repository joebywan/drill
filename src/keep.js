/**
 * Asking the browser to keep progress (navigator.storage.persist). Chrome, Safari and the Android WebView answer by
 * themselves; Gecko asks the person, with a prompt over the page. No API says which kind a call will be:
 * permissions.query answers 'prompt' in Chrome too. So one constant, true for Gecko (Chrome and Safari say
 * "like Gecko", with no slash after it). Tests set `window.WINGBEAT_ASKS` before load to try either kind.
 */
export const ASKS = globalThis.WINGBEAT_ASKS ?? /Gecko\//.test(globalThis.navigator?.userAgent || '');

/** In a browser that asks: once ever on this device, at home, with something logged to keep, and not kept already (`kept` unknown, undefined, until persisted() answers). */
export const shouldAsk = ({ asks, asked, entries, kept }) => asks && !asked && entries > 0 && kept !== true;
