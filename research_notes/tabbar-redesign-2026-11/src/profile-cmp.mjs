import { bar, BASE, COL, cream } from './gen3.mjs';
import { writeFileSync } from 'node:fs';
const cell = (a, cap) => `<div class="cell"><div style="position:relative;width:150px;height:92px;overflow:hidden;background:${COL.cream};zoom:2">${bar({ active: a, bottom: 14, margin: 75 - (176.5 + 105), label: 'all' })}</div><span class="cap">${cap}</span></div>`;
writeFileSync('g-prof.html', `<!doctype html><meta charset=utf-8><style>${BASE}</style><div style="display:grid;grid-template-columns:repeat(2,300px);gap:12px;padding:12px">${cell('calendar', process.env.CAP + ' inactive')}${cell('profile', process.env.CAP + ' active')}</div>`);
