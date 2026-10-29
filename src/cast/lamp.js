/**
 * A street lamp: one node on the home path. The post takes `currentColor`, so the page themes it.
 *
 *   lit      a finished lesson
 *   bright   the current lamp, today's lesson done
 *   soft     the current lamp, not yet today (the glass flickers)
 *   ember    the current lamp after a missed day: warm and low, never dark
 *   off      not reached yet
 */
const GLASS = { lit: '#F5A524', bright: '#FFD978', soft: '#F5A524', ember: '#D98A3A', off: 'var(--line)' };

export function lamp(state) {
  const glow = state === 'bright' ? 18 : state === 'lit' ? 12 : 0;
  return `<svg class="lamp-${state}" viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${glow ? `<circle cx="20" cy="20" r="${glow}" fill="#FFD978" opacity="${state === 'bright' ? 0.5 : 0.3}"/>` : ''}
    <rect x="18" y="24" width="4" height="34" rx="2" fill="currentColor"/>
    <rect x="11" y="56" width="18" height="6" rx="3" fill="currentColor"/>
    <path d="M9 15 L14 8 L26 8 L31 15 Z" fill="currentColor"/>
    <rect data-part="glass" x="12" y="14" width="16" height="12" rx="3" fill="${GLASS[state] || GLASS.off}"/>
    ${state === 'ember' ? '<rect x="15" y="21" width="10" height="3" rx="1.5" fill="#F2A65A"/>' : ''}
  </svg>`;
}
