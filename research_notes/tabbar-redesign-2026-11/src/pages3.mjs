import { out, BASE, COL, bar, phone, FR, cream, busy, dark } from './gen3.mjs';
const beforeFrame = `<figure class="ph"><div class="scr"><div style="position:absolute;left:0;top:0;width:393px;height:852px;background:url(../img/01-home-rest.png) top left/393px auto"></div></div><figcaption>BEFORE: current bar</figcaption></figure>`;
out('g-final', `<!doctype html><meta charset=utf-8><style>${BASE}</style><div class="t">Crest, final</div><div class="row">${beforeFrame}${phone('home')}${phone('calendar')}${phone('scan')}${phone('scrolled')}</div>`);
const strip = (inner, cap, h = 118, bg = cream()) => `<div class="cell"><div class="strip" style="height:${h}px">${bg}${inner}</div><span class="cap">${cap}</span></div>`;
out('g-final-states', `<!doctype html><meta charset=utf-8><style>${BASE}</style><div class="t">Crest, final: every state</div><div style="display:grid;grid-template-columns:repeat(3,393px);gap:14px 20px;padding:20px 28px">
${strip(bar({ active: 'collection', badge: '3', bottom: 16 }), 'Collection active, badge 3')}
${strip(bar({ active: 'calendar', bottom: 16 }), 'Calendar active')}
${strip(bar({ active: 'scan', discState: 'active', bottom: 16 }), 'Scan active')}
${strip(bar({ active: 'boards', bottom: 16 }), 'Boards active')}
${strip(bar({ active: 'profile', badge: '9+', bottom: 16 }), 'Profile active, collection badge 9+')}
${strip(bar({ active: 'calendar', badge: '9+', dt: 1.15, bottom: 16 }), 'Dynamic Type 1.15x (the cap), badge 9+')}
${strip(bar({ active: 'calendar', discState: 'pressed', bottom: 16 }), 'Scan pressed')}
${strip(bar({ active: 'boards', badge: '1', bottom: 16 }), 'Over a busy photo grid', 118, busy())}
${strip(bar({ active: 'collection', badge: '1', bottom: 16 }), 'Over the dark camera frame', 118, dark())}
</div>`);
const zc = (o, off, cap) => `<div class="cell"><div style="position:relative;width:150px;height:92px;overflow:hidden;background:${COL.cream};zoom:2">${bar({ bottom: 14, margin: 75 - (176.5 + off), ...o })}</div><span class="cap">${cap}</span></div>`;
out('g-final-zoom', `<!doctype html><meta charset=utf-8><style>${BASE}</style><div class="t">Crest, final at 6x</div><div style="display:grid;grid-template-columns:repeat(3,300px);gap:16px 18px;padding:20px 24px">
${zc({ active: 'calendar' }, 0, 'centre, idle')}
${zc({ active: 'scan', discState: 'active' }, 0, 'centre, Scan active')}
${zc({ active: 'calendar', discState: 'pressed' }, 0, 'centre, pressed')}
${zc({ active: 'calendar' }, -64, 'crest shoulder, left')}
${zc({ active: 'collection', badge: '3' }, -128, 'Collection active + badge')}
${zc({ active: 'boards', badge: '9+' }, 128, 'Boards active, right end')}
</div>`);
