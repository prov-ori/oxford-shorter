import fs from 'node:fs/promises';
// Source PDF749: preserve estimates and confidence intervals; Freeman's printed
// lower limit has four decimal places. Full numbers also accompany the figure.
const rows=[['Wilson 1963',-1.078,-2.289,.133],['West 1981',-1.255,-2.170,-.341],['Lambourn 1978',-.170,-.940,.600],['Freeman 1978',-.629,-1.2647,.006],['Gregory 1985',-1.418,-2.012,-.824],['Johnstone 1980',-.739,-1.253,-.224],['Фиксированная модель',-.911,-1.180,-.645],['Случайные эффекты',-.908,-1.270,-.537]];
const x=v=>230+(v+3)*145;
let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 555" role="img" aria-labelledby="title desc"><title id="title">Рисунок25.1. ЭСТ против имитации при депрессии</title><desc id="desc">Шесть испытаний и два объединённых эффекта. Отрицательные значения в пользу ЭСТ. Все точные значения доступны в таблице под рисунком.</desc><rect width="850" height="555" fill="#fff"/><g font-family="Arial,sans-serif" fill="#173e43">';
svg+='<text x="20" y="34" font-size="23">ЭСТ против имитации: метаанализ</text><text x="20" y="65" font-size="17">Стандартизированный размер эффекта и 95% доверительный интервал</text>';
svg+=`<path d="M${x(0)} 88V450" stroke="#567" stroke-dasharray="5 4"/>`;
rows.forEach(([label,e,lo,hi],i)=>{const y=112+i*44;svg+=`<text x="20" y="${y+6}" font-size="17">${label}</text><path d="M${x(lo)} ${y}H${x(hi)}M${x(lo)} ${y-8}V${y+8}M${x(hi)} ${y-8}V${y+8}" stroke="#48716a" fill="none" stroke-width="2"/>`;svg+=i<6?`<rect x="${x(e)-5}" y="${y-5}" width="10" height="10" fill="#009c70" transform="rotate(45 ${x(e)} ${y})"/>`:`<path d="M${x(lo)} ${y}L${x(e)} ${y-10}L${x(hi)} ${y}L${x(e)} ${y+10}Z" fill="#e1f5ed" stroke="#009c70"/>`;});
svg+='<path d="M230 468H810" stroke="#567"/>';
for(let v=-3;v<=1;v++)svg+=`<path d="M${x(v)} 468V475" stroke="#567"/><text x="${x(v)}" y="496" font-size="17" text-anchor="middle">${v}</text>`;
svg+='<text x="390" y="529" font-size="18" text-anchor="middle">В пользу ЭСТ</text><text x="740" y="529" font-size="18" text-anchor="middle">В пользу имитации</text></g></svg>';
await fs.mkdir(new URL('../dist/assets',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../dist/assets/figure-25-1.svg',import.meta.url),svg);
