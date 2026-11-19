/** Small helpers shared by every screen built from template strings. */

/** Text made safe to put inside HTML. */
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** A stat chip on an end screen: tone class, uppercase label, value ("STREAK", "🌿 3"), and optional drawn `art` (markup) before it. */
export const chip = (tone, label, value, art = '') => `<div class="chip ${tone}"><span>${esc(label)}</span><b>${art}${esc(value)}</b></div>`;
