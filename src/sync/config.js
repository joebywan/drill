/** Where Drill's sync API lives (server/). The one place to change it; tests point it at a local worker. */
export const API = 'https://api.knowhowit.com.au';

/**
 * Sync and friends are built but off: there is no backend deployed (server/DEPLOY.md). Flip this to
 * true once the API is live. Tests turn it on per page with `window.DRILL_SYNC = true` before load.
 */
export const SYNC = globalThis.DRILL_SYNC === true;
