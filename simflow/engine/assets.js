/**
 * SimFlow Asset Library
 * Built-in SVG assets for entities.
 * Each asset uses CSS variables for theming:
 *   --entity-color      : primary fill color (set by visual_states)
 *   --entity-stroke     : border color
 *   --entity-label      : label text
 *   --entity-sublabel   : sublabel text
 */

export const ASSETS = {

  process: ({ color = '#AFA9EC', stroke = '#534AB7' } = {}) => `
<svg viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="40" height="28" rx="5"
        fill="${color}" stroke="${stroke}" stroke-width="1.2"/>
  <rect x="7" y="9" width="10" height="3.5" rx="1.5" fill="${stroke}" opacity="0.7"/>
  <rect x="7" y="15" width="16" height="3.5" rx="1.5" fill="${stroke}" opacity="0.5"/>
  <circle cx="34" cy="16" r="6" fill="${stroke}"/>
</svg>`,

  packet: ({ color = '#85B7EB', stroke = '#185FA5' } = {}) => `
<svg viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="5" width="40" height="22" rx="4"
        fill="${color}" stroke="${stroke}" stroke-width="1.2"/>
  <polyline points="2,5 22,18 42,5" fill="none" stroke="${stroke}" stroke-width="1.2"/>
</svg>`,

  page: ({ color = '#9FE1CB', stroke = '#0F6E56' } = {}) => `
<svg viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="32" height="40" rx="3"
        fill="${color}" stroke="${stroke}" stroke-width="1.2"/>
  <line x1="7" y1="12" x2="29" y2="12" stroke="${stroke}" stroke-width="1.2"/>
  <line x1="7" y1="18" x2="29" y2="18" stroke="${stroke}" stroke-width="1.2"/>
  <line x1="7" y1="24" x2="22" y2="24" stroke="${stroke}" stroke-width="1.2"/>
  <line x1="7" y1="30" x2="26" y2="30" stroke="${stroke}" stroke-width="1.2" opacity="0.5"/>
</svg>`,

  'db-record': ({ color = '#FAC775', stroke = '#BA7517' } = {}) => `
<svg viewBox="0 0 48 36" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="44" height="32" rx="3"
        fill="${color}" stroke="${stroke}" stroke-width="1.2"/>
  <line x1="2" y1="12" x2="46" y2="12" stroke="${stroke}" stroke-width="1"/>
  <line x1="16" y1="2" x2="16" y2="34" stroke="${stroke}" stroke-width="0.8"/>
  <line x1="32" y1="2" x2="32" y2="34" stroke="${stroke}" stroke-width="0.8"/>
  <rect x="3" y="3" width="12" height="8" rx="1" fill="${stroke}" opacity="0.25"/>
</svg>`,

  story: ({ color = '#F4C0D1', stroke = '#993556' } = {}) => `
<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="40" height="40" rx="5"
        fill="${color}" stroke="${stroke}" stroke-width="1.2"/>
  <line x1="8" y1="14" x2="36" y2="14" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="8" y1="21" x2="36" y2="21" stroke="${stroke}" stroke-width="1.2"/>
  <line x1="8" y1="28" x2="26" y2="28" stroke="${stroke}" stroke-width="1.2"/>
  <circle cx="34" cy="34" r="7" fill="${stroke}"/>
</svg>`,

  'tree-node': ({ color = '#D3D1C7', stroke = '#5F5E5A' } = {}) => `
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="17" fill="${color}" stroke="${stroke}" stroke-width="1.2"/>
  <line x1="20" y1="3" x2="20" y2="10" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="20" y1="30" x2="20" y2="37" stroke="${stroke}" stroke-width="1.5"/>
</svg>`,

  frame: ({ color = '#D3D1C7', stroke = '#5F5E5A' } = {}) => `
<svg viewBox="0 0 44 36" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="40" height="32" rx="3"
        fill="none" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="4 3"/>
  <rect x="6" y="6" width="32" height="24" rx="2"
        fill="${color}" stroke="${stroke}" stroke-width="1"/>
</svg>`,

  lock: ({ color = '#F09595', stroke = '#A32D2D' } = {}) => `
<svg viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="20" width="26" height="22" rx="4"
        fill="${color}" stroke="${stroke}" stroke-width="1.2"/>
  <path d="M10 20 v-7 a8 8 0 0 1 16 0 v7"
        fill="none" stroke="${stroke}" stroke-width="1.5"/>
  <circle cx="18" cy="30" r="3.5" fill="${stroke}"/>
  <line x1="18" y1="33" x2="18" y2="38" stroke="${stroke}" stroke-width="2"/>
</svg>`,

  'cpu-chip': ({ color = '#C0DD97', stroke = '#3B6D11' } = {}) => `
<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="24" height="24" rx="4"
        fill="${color}" stroke="${stroke}" stroke-width="1.2"/>
  <rect x="14" y="14" width="16" height="16" rx="2" fill="${stroke}"/>
  <line x1="2" y1="16" x2="10" y2="16" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="2" y1="22" x2="10" y2="22" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="2" y1="28" x2="10" y2="28" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="34" y1="16" x2="42" y2="16" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="34" y1="22" x2="42" y2="22" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="34" y1="28" x2="42" y2="28" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="16" y1="2" x2="16" y2="10" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="22" y1="2" x2="22" y2="10" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="28" y1="2" x2="28" y2="10" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="16" y1="34" x2="16" y2="42" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="22" y1="34" x2="22" y2="42" stroke="${stroke}" stroke-width="1.5"/>
  <line x1="28" y1="34" x2="28" y2="42" stroke="${stroke}" stroke-width="1.5"/>
</svg>`,

  server: ({ color = '#B5D4F4', stroke = '#185FA5' } = {}) => `
<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4"  width="36" height="10" rx="2" fill="${color}" stroke="${stroke}" stroke-width="1"/>
  <rect x="4" y="17" width="36" height="10" rx="2" fill="${color}" stroke="${stroke}" stroke-width="1"/>
  <rect x="4" y="30" width="36" height="10" rx="2" fill="${color}" stroke="${stroke}" stroke-width="1"/>
  <circle cx="36" cy="9"  r="2.5" fill="#1D9E75"/>
  <circle cx="36" cy="22" r="2.5" fill="#EF9F27"/>
  <circle cx="36" cy="35" r="2.5" fill="${stroke}"/>
</svg>`,

  thread: ({ color = '#AFA9EC', stroke = '#534AB7' } = {}) => `
<svg viewBox="0 0 44 36" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 8 Q22 4 38 12 Q22 20 6 28 Q22 36 38 28"
        fill="none" stroke="${stroke}" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="6"  cy="8"  r="4" fill="${color}" stroke="${stroke}" stroke-width="1"/>
  <circle cx="38" cy="28" r="4" fill="${color}" stroke="${stroke}" stroke-width="1"/>
</svg>`,

  // Generic box with label (fallback)
  box: ({ color = '#D3D1C7', stroke = '#5F5E5A' } = {}) => `
<svg viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="40" height="28" rx="4"
        fill="${color}" stroke="${stroke}" stroke-width="1.2"/>
</svg>`,
};

// Default color palettes for entity states
export const STATE_COLORS = {
  default:  { color: '#D3D1C7', stroke: '#5F5E5A' },
  ready:    { color: '#AFA9EC', stroke: '#534AB7' },
  running:  { color: '#9FE1CB', stroke: '#0F6E56' },
  blocked:  { color: '#F09595', stroke: '#A32D2D' },
  waiting:  { color: '#FAC775', stroke: '#BA7517' },
  done:     { color: '#B5D4F4', stroke: '#185FA5' },
  idle:     { color: '#D3D1C7', stroke: '#888780' },
  active:   { color: '#C0DD97', stroke: '#3B6D11' },
  error:    { color: '#F09595', stroke: '#A32D2D' },
  green:    { color: '#9FE1CB', stroke: '#0F6E56' },
  blue:     { color: '#AFA9EC', stroke: '#534AB7' },
  red:      { color: '#F09595', stroke: '#A32D2D' },
  yellow:   { color: '#FAC775', stroke: '#BA7517' },
  teal:     { color: '#9FE1CB', stroke: '#0F6E56' },
  purple:   { color: '#D4A0F0', stroke: '#7B2FA0' },
};

// Auto-color palette for multiple entities (by index)
export const AUTO_COLORS = [
  { color: '#AFA9EC', stroke: '#534AB7' },
  { color: '#9FE1CB', stroke: '#0F6E56' },
  { color: '#FAC775', stroke: '#BA7517' },
  { color: '#F09595', stroke: '#A32D2D' },
  { color: '#B5D4F4', stroke: '#185FA5' },
  { color: '#F4C0D1', stroke: '#993556' },
  { color: '#C0DD97', stroke: '#3B6D11' },
  { color: '#D4A0F0', stroke: '#7B2FA0' },
];

/**
 * Render an entity as an SVG string with label overlay.
 */
export function renderEntitySVG(entity, entityDef, options = {}) {
  const assetName = options.visual || entityDef?.meta?.visual || 'box';
  const visualStates = options.visual_states || entityDef?.meta?.visual_states || {};

  // Determine colors from state
  let colors = STATE_COLORS.default;
  if (entity.state && visualStates[entity.state]) {
    const vs = visualStates[entity.state];
    colors = STATE_COLORS[vs.color] || STATE_COLORS.default;
  } else if (options.color) {
    colors = STATE_COLORS[options.color] || colors;
  } else if (options.autoColor) {
    colors = options.autoColor;
  }

  const assetFn = ASSETS[assetName] || ASSETS.box;
  const svgContent = assetFn(colors);

  // Determine label
  const labelExpr  = options.label     || entityDef?.meta?.label    || null;
  const sublabelExpr = options.sublabel || entityDef?.meta?.sublabel || null;

  // Evaluate label expressions (simple field references)
  const evalLabel = (expr) => {
    if (!expr) return null;
    // Simple substitution: 'P' + pid → P1, etc.
    return expr.replace(/\b(\w+)\b/g, (_, name) => {
      if (entity[name] !== undefined) return entity[name];
      return name.replace(/^['"]|['"]$/g, '');
    }).replace(/['"]/g, '').replace(/\+/g, '').replace(/\s+/g, '');
  };

  const label    = labelExpr    ? evalLabel(labelExpr)    : (entity.pid !== undefined ? `P${entity.pid}` : entity.id !== undefined ? String(entity.id) : '');
  const sublabel = sublabelExpr ? evalLabel(sublabelExpr) : (entity.remaining !== undefined ? `${entity.remaining}ms` : entity.value !== undefined ? String(entity.value) : '');

  const pulse = entity.state === 'running' && (visualStates.running?.pulse);

  return { svgContent, label, sublabel, pulse, colors };
}
