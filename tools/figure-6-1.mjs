// A newly drawn scientific plot from values printed in supplied PDF135.
import fs from 'node:fs/promises';
const rows=[
 ['Циталопрам',.96,.74,1.26,'0,96 [0,74; 1,26]',7],
 ['Эсциталопрам',.97,.79,1.19,'0,97 [0,79; 1,19]',7],
 ['Флуоксетин',1.39,.97,1.98,'1,39 [0,97; 1,98]',6],
 ['Пароксетин',.98,.81,1.19,'0,98 [0,81; 1,19]',7],
 ['Сертралин',.72,.57,.91,'0,72 [0,57; 0,91]',8],
 ['Модель случайных эффектов',.96,.74,1.25,'0,96 [0,74; 1,25]',0],
 ['Венлафаксин',1.24,.96,1.60,'124 [0,96; 1,60]*',15],
 ['Миртазапин',.77,.33,1.78,'0,77 [0,33; 1,78]',16]
];
const x=v=>390+Math.log(v/.5)/Math.log(4)*350;
const ys=[125,162,199,236,273,310,410,485];
let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1060 640" role="img" aria-labelledby="title desc"><title id="title">Рисунок 6.1. Клинический ответ при фиксированной и повышаемой дозе антидепрессантов</title><desc id="desc">Русскоязычное воспроизведение значений рисунка на PDF135. Объединённая оценка СИОЗС 0,96, доверительный интервал 0,74–1,25. Строка венлафаксина в исходнике напечатана как 124, хотя точка графика соответствует 1,24. Размеры маркеров приближены к печатному рисунку; численные веса источник не сообщает.</desc><rect width="1060" height="640" fill="white"/><g font-family="Arial,sans-serif" font-size="18" fill="#233c35"><text x="25" y="35" font-weight="bold">Препарат</text><text x="540" y="35" font-weight="bold">ROR</text><text x="790" y="35" font-weight="bold">ROR [95% ДИ]</text><text x="25" y="88" font-weight="bold">СИОЗС</text><path d="M${x(1)} 65V525M390 525H740" stroke="#69756d" fill="none"/>`;
for(let i=0;i<rows.length;i++){
 const [name,v,lo,hi,label,size]=rows[i],y=ys[i];
 s+=`<text x="25" y="${y+6}"${i===5?' font-weight="bold"':''}>${name}</text><text x="790" y="${y+6}"${i===5?' font-weight="bold"':''}>${label}</text>`;
 if(i===5)s+=`<path d="M${x(lo)} ${y}L${x(v)} ${y-9}L${x(hi)} ${y}L${x(v)} ${y+9}Z" fill="#d86677" stroke="#374b43"/>`;
 else {s+=`<path d="M${x(Math.max(lo,.5))} ${y}H${x(hi)}" stroke="#4e5853"/><rect x="${x(v)-size/2}" y="${y-size/2}" width="${size}" height="${size}" fill="#5877ba"/>`;if(lo<.5)s+=`<path d="M400 ${y-6}L390 ${y}L400 ${y+6}" stroke="#4e5853" fill="none"/>`;}
}
s+='<text x="25" y="350" font-size="16">Гетерогенность: I² = 60%; τ² = 0,0236; p = 0,04</text>';
for(const [v,label]of [[.5,'0,5'],[1,'1'],[2,'2']])s+=`<path d="M${x(v)} 525v8" stroke="#69756d"/><text x="${x(v)}" y="555" text-anchor="middle">${label}</text>`;
s+='<text x="375" y="585" text-anchor="middle" font-size="15">В пользу фиксированной низкой дозы</text><text x="745" y="585" text-anchor="middle" font-size="15">В пользу гибко повышаемой дозы</text><text x="25" y="620" font-size="14">* «124» — напечатанное значение оригинала; положение точки воспроизведено как 1,24.</text></g></svg>';
await fs.mkdir(new URL('../dist/assets/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../dist/assets/figure-6-1.svg',import.meta.url),s);
