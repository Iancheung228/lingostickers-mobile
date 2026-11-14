// Rendering helpers shared by the sheet builder and the JSON exporter.
export const INK_OFF = '#5A2429', INK_ON = '#3A1519', KO = '#E4A0A1';
export const PILL = 'linear-gradient(180deg,#EBAEAF 0%,#E4A0A1 50%,#E09A9B 100%)';

// resolve one part to attribute tokens for a state
export function partAttrs(role, state) {
  const filled = state === 'filled';
  switch (role) {
    case 'shape': return filled ? { fill: 'ink', stroke: 'ink' } : { fill: 'none', stroke: 'ink' };
    case 'detail': return filled ? { fill: 'none', stroke: 'ko' } : { fill: 'none', stroke: 'ink' };
    case 'dot': return filled ? { fill: 'ko', stroke: 'none' } : { fill: 'ink', stroke: 'none' };
    case 'knock': return filled ? { fill: 'ko', stroke: 'ko' } : { fill: 'none', stroke: 'ink' };
    case 'fixed': return { fill: 'none', stroke: 'ink' };
  }
  throw new Error('role ' + role);
}

export function glyphInner(variant, state, ink, ko = KO) {
  const col = (t) => (t === 'ink' ? ink : t === 'ko' ? ko : 'none');
  return variant.parts.map((p) => {
    const a = partAttrs(p.role, state);
    return `<path d="${p.d}" fill="${col(a.fill)}" stroke="${col(a.stroke)}"/>`;
  }).join('');
}

export function glyphSvg(variant, state, { size = 24, sw = 1.65, ink, ko = KO, grid = false, id = '' } = {}) {
  ink = ink || (state === 'filled' ? INK_ON : INK_OFF);
  return `<svg ${id ? `id="${id}"` : ''}width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${grid ? gridUnder() : ''}${glyphInner(variant, state, ink, ko)}${grid ? gridOver() : ''}</svg>`;
}

export function cameraSvg(cam, { size = 24, color = '#fff', sw = 1.65 } = {}) {
  if (cam.stroke) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${cam.d}"/></svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${cam.d}" fill="${color}" fill-rule="evenodd"/></svg>`;
}

// grid: 1-unit lines, live area, keylines
function gridUnder() {
  let s = '<g stroke="#fff" stroke-opacity=".38" stroke-width=".05" fill="none">';
  for (let i = 0; i <= 24; i++) s += `<path d="M${i} 0V24M0 ${i}H24"/>`;
  s += '</g>';
  s += '<rect x="2" y="2" width="20" height="20" fill="#2a6df4" fill-opacity=".07" stroke="none"/>';
  return s;
}
function gridOver() {
  const k = 'stroke="#2a6df4" stroke-width=".07" fill="none"';
  return `<g ${k}><rect x="2" y="2" width="20" height="20" stroke-dasharray=".4 .3"/>
<circle cx="12" cy="12" r="10"/><rect x="3" y="3" width="18" height="18" rx="0"/>
<rect x="4" y="2" width="16" height="20"/><rect x="2" y="4" width="20" height="16"/>
<path d="M12 0V24M0 12H24" stroke="#e8365d"/></g>`;
}
