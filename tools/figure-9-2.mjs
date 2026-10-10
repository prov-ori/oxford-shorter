import fs from 'node:fs/promises';
const groups=[['NARI',2,-57.5,60.7],['ИМАО',4,-15.7,6],['ТЦА',15,-70.7,50.5],['СИОЗС',10,-94.9,80.7],['Другие',1,-6.9,7.5],['Всего',32,-245.7,205.4]];
const x=v=>270+v*360;
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="620" viewBox="0 0 1080 620" role="img" aria-labelledby="title desc"><title id="title">Рисунок9.2. Отношение шансов рецидива</title><desc id="desc">Оценки восстановлены из логрангового O−E и дисперсии;99% интервалы классов и95% общий. Меньше1 — преимущество антидепрессанта.</desc><rect width="1080" height="620" fill="white"/><g font-family="Arial,sans-serif" font-size="22" fill="#17324d"><text x="25" y="38">Класс / испытаний</text><text x="340" y="38">Отношение шансов (антидепрессант : плацебо)</text>';
svg+='<path d="M630 60V475" stroke="#6b7280" stroke-dasharray="5 5"/>';
for(let i=0;i<groups.length;i++){
 const [name,n,oe,v]=groups[i],or=Math.exp(oe/v),z=i===5?1.96:2.5758293035,se=1/Math.sqrt(v),lo=Math.exp(oe/v-z*se),hi=Math.exp(oe/v+z*se),y=95+i*65;
 svg+=`<text x="25" y="${y+7}">${name} / ${n}</text><line x1="${x(lo)}" y1="${y}" x2="${x(hi)}" y2="${y}" stroke="#10886c" stroke-width="3"/>`;
 svg+=i===5?`<path d="M${x(lo)} ${y}L${x(or)} ${y-10}L${x(hi)} ${y}L${x(or)} ${y+10}Z" fill="#10886c"/>`:`<circle cx="${x(or)}" cy="${y}" r="5" fill="#10886c"/>`;
 svg+=`<text x="${x(hi)+12}" y="${y+7}" font-size="19">${or.toFixed(2)} [${lo.toFixed(2)}; ${hi.toFixed(2)}]</text>`;
}
svg+='<line x1="270" y1="475" x2="990" y2="475" stroke="#17324d"/>';
for(const v of [0,.5,1,1.5,2])svg+=`<line x1="${x(v)}" y1="475" x2="${x(v)}" y2="484" stroke="#17324d"/><text x="${x(v)}" y="511" text-anchor="middle">${String(v).replace('.',',')}</text>`;
svg+='<text x="435" y="545" text-anchor="middle" font-size="19">Антидепрессант лучше</text><text x="820" y="545" text-anchor="middle" font-size="19">Антидепрессант хуже</text><text x="25" y="581" font-size="18">Гетерогенность: χ²₄=18,6; P=0,001. Эффект: 2P&lt;0,00001. Снижение70% (SE4).</text></g></svg>';
await fs.writeFile(new URL('../dist/assets/figure-9-2.svg',import.meta.url),svg);
