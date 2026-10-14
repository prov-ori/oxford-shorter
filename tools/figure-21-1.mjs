import fs from 'node:fs/promises';
// Approximate positions read from PDF599. The PDF attributes its own chart to ChatGPT.
// These coordinates reproduce that illustration; they are not a verified statistical dataset.
const series=[
 ['Центральная и Восточная Европа, Центральная Азия','#7961ad','',[9,11,10,9.5,10,9.5,8,7,6.5,6],[38,45,55,51,49,54,53,51,50,46,44,40,38,37,36.5,36.5]],
 ['Высокий доход','#ffaa00','8 6',[7.5,7,7,6.5,6.5,6.5,6.5,6,5.8,5.5],[19.5,20,20,19.5,19.5,19,18.8,18.5]],
 ['Латинская Америка и Карибы','#ff28a1','3 3',[3,3,3,3,3,3,2.8,2.5,2.5,2.5],[11,11.5,12,12,12,11.5,11.5,11]],
 ['Северная Африка и Ближний Восток','#287cdb','9 5',[3,3,3,3,3,3,2.8,2.8,2.8,2.7],[7,7.2,7.5,7.5,7.2,7.2,7.2,7]],
 ['Южная Азия','#ff3232','14 9',[17.5,18,18.5,17.5,17,17,16.5,14.5,14,13],[19.5,19.5,19.7,19.8,19.4,19.4,19.2,19]],
 ['Юго-Восточная и Восточная Азия, Океания','#00b6b3','',[20.5,20.5,19,16.5,14,12,10.5,8.5,7,6],[22,21,20,18,17,15,13,11]],
 ['Африка южнее Сахары','#ff7938','7 4 2 4',[9,9,9,9,9,9,8,7,6.5,6],[16,17,17,17,17,16.8,16.5,16.2]]
];
const x0=150,w=610,height=255,xEnd=530/610;let markup='';
for(const [panel,y] of [['Женщины',80],['Мужчины',430]]){
 markup+=`<text x="${x0}" y="${y-18}" font-size="22" font-weight="bold">${panel}</text>`;
 for(let n=0;n<=60;n+=10){const yy=y+height-n/60*height;markup+=`<path d="M${x0} ${yy}h${w}" stroke="#ccc"/><text x="${x0-15}" y="${yy+6}" text-anchor="end">${n}</text>`;}
 markup+=`<path d="M${x0} ${y}v${height}h${w}" fill="none" stroke="#444"/><text transform="translate(35 ${y+height/2}) rotate(-90)" text-anchor="middle" font-size="17">Смертность, стандартизованная по возрасту</text>`;
 for(const [name,color,dash,women,men] of series){const values=panel==='Женщины'?women:men,points=values.map((v,i)=>`${x0+i/(values.length-1)*w*xEnd},${y+height-v/60*height}`).join(' ');markup+=`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" ${dash?`stroke-dasharray="${dash}"`:''}/>`;}
}
for(let year=1990;year<=2020;year+=5){const x=x0+(year-1990)/30*w;markup+=`<text x="${x}" y="710" text-anchor="middle">${year}</text>`;}
markup+='<text x="455" y="740" text-anchor="middle">Год</text>';
series.forEach(([name,color,dash],i)=>{const y=785+i*33;markup+=`<path d="M110 ${y}h50" fill="none" stroke="${color}" stroke-width="2.5" ${dash?`stroke-dasharray="${dash}"`:''}/><text x="175" y="${y+6}" font-size="18">${name}</text>`;});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 1100" role="img" aria-labelledby="title desc"><title id="title">Рисунок 21.1. Тенденции смертности: схематическая иллюстрация из книги</title><desc id="desc">Две панели и семь групп перерисованы приблизительно с PDF599. Оригинал приписан ChatGPT, исходная таблица данных не дана. График не подтверждён как статистический ряд ВОЗ или IHME.</desc><rect width="880" height="1100" fill="white"/><g font-family="Arial,sans-serif" font-size="18" fill="#222">${markup}<text x="75" y="1050" font-size="17">Схематическая перерисовка исходного рисунка; данные не верифицированы.</text><text x="75" y="1080" font-size="17">В PDF указана атрибуция ChatGPT / тенденции WHO и IHME, 2024.</text></g></svg>`;
await fs.writeFile(new URL('../dist/assets/figure-21-1.svg',import.meta.url),svg);
