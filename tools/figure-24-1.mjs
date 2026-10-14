import fs from 'node:fs/promises';
// Russian redrawing of PDF689, figure24.1. Household membership and connections
// were checked against a separately rendered detail of the original PDF.
let s='';const txt=(x,y,t,size=18,anchor='start')=>s+=`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${t}</text>`;
const line=(x,y,a,b,dash='')=>s+=`<path d="M${x} ${y}L${a} ${b}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const person=(x,y,female=false,age='',patient=false,dead=false)=>{s+=female?`<circle cx="${x}" cy="${y}" r="13"/>`:`<rect x="${x-13}" y="${y-13}" width="26" height="26"/>`;if(patient)s+=female?`<circle cx="${x}" cy="${y}" r="19"/>`:`<rect x="${x-19}" y="${y-19}" width="38" height="38"/>`;if(dead){line(x-13,y-13,x+13,y+13);line(x+13,y-13,x-13,y+13);}if(age)txt(x,y+6,age,16,'middle');};
const union=(x,a,y,dash='')=>{line(x,y+13,x,y+35,dash);line(x,y+35,a,y+35,dash);line(a,y+13,a,y+35,dash);};
const slash=(x,y,two=false)=>{line(x-4,y+8,x+4,y-8);if(two)line(x+4,y+8,x+12,y-8);};
txt(20,32,'Рисунок 24.1. Обозначения генограммы',23);txt(20,62,'Возраст — число внутри символа; даты — рядом со связью.',16);
person(45,104,false,'45');txt(74,110,'Мужчина');person(280,104,true,'39');txt(308,110,'Женщина');
person(45,165,false,'',true);person(110,165,true,'',true);txt(153,171,'Пациент (двойной контур)');
person(45,230);person(175,230,true);union(45,175,230);txt(100,259,'брак 1948',16,'middle');txt(220,250,'Брак');
person(45,325);person(175,325,true);union(45,175,325);slash(105,360,true);txt(45,397,'Раздельно с 1988; развод 1990',16);
person(45,443);person(175,443,true);person(340,443);union(45,175,443);union(175,340,443);slash(250,478,true);txt(105,470,'брак 1987',16,'middle');txt(230,421,'брак 1965; развод 1980',16);txt(45,515,'Развод и повторный брак');
person(45,555);person(175,555,true);union(45,175,555,'5 4');txt(110,584,'встреча 1979',16,'middle');txt(45,628,'Совместная жизнь без брака');
person(45,676,false,'',false,true);txt(83,681,'Умер (1950)');
person(45,746,false,'50');person(175,746,true,'50');union(45,175,746);txt(110,776,'брак 1948',16,'middle');line(110,781,110,800);line(72,800,160,800);for(const [x,f,a] of [[72,false,'30'],[116,true,'27'],[160,true,'22']]){line(x,800,x,828);person(x,841,f,a);}txt(45,888,'Дети');
line(275,756,340,756);line(307,756,307,809,'4 3');person(307,822,true);txt(257,860,'Усыновление',16);
line(410,756,475,756);line(442,756,442,809,'4 3');s+='<circle cx="442" cy="822" r="6"/>';line(437,817,447,827);line(447,817,437,827);txt(386,860,'Мертворождение',16);
txt(20,947,'Состав домохозяйств',22);person(45,1001);person(190,1001,true);person(365,1001);person(505,1001,true);union(45,190,1001);union(190,365,1001);union(365,505,1001,'5 4');txt(115,1028,'брак 1987',15,'middle');slash(277,1036,true);txt(235,974,'брак 1965',15);txt(235,995,'развод 1980',15);for(const [x,a,f] of [[111,'2',false],[245,'9',true],[335,'7',false]]){line(x,1036,x,1078);person(x,1091,f,a);}
s+='<path d="M24 963C-5 967 1 1048 46 1066C67 1090 67 1150 123 1150C180 1150 182 1105 211 1080C223 1060 218 1047 222 1000C226 954 73 950 24 963Z" stroke-dasharray="5 4"/><path d="M361 962C327 979 327 1048 291 1059C263 1067 218 1059 217 1096C213 1159 368 1162 440 1150C495 1141 530 1060 523 988C520 950 427 946 361 962Z" stroke-dasharray="5 4"/>';
txt(20,1190,'Пунктирные границы обозначают два домохозяйства.',16);
txt(20,1250,'Отношения',22);person(45,1303);person(210,1303,true);union(45,210,1303);line(127,1338,127,1380);line(80,1380,180,1380);line(80,1380,80,1390);line(180,1380,180,1390);person(80,1403);person(180,1403,true);person(360,1403);
for(const d of [-4,0,4])line(210+d,1316,180+d,1390);txt(246,1340,'Очень близкие / слитные',16);
s+='<path d="M193 1403l8 -7 8 14 8 -14 8 14 8 -14 8 14 8 -14 8 14 8 -14 8 14 8 -14 8 14 8 -14 8 14 8 -14 8 14 8 -7"/>';line(329,1403,347,1403);txt(230,1385,'Конфликтные',16);
union(180,360,1403);line(270,1438,270,1450);line(210,1450,335,1450);for(const [x,f] of [[210,true],[270,true],[335,false]]){line(x,1450,x,1490);person(x,1503,f);}
line(193,1416,322,1490);slash(255,1451,true);txt(22,1475,'Отчуждённые',16);line(356,1416,331,1490);line(364,1416,339,1490);txt(393,1475,'Близкие',16);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 1540" role="img" aria-labelledby="title desc"><title id="title">Рисунок24.1. Условные обозначения генограммы</title><desc id="desc">Русская перерисовка рисунка PDF689: пол, возраст, пациент, брак, разлука и развод, повторный брак, сожительство, смерть, дети, усыновление, мертворождение, состав двух домохозяйств и четыре вида отношений. Сохраняются числа и связи примеров исходника. Текстовая легенда размещена рядом на странице учебника.</desc><rect width="560" height="1540" fill="white"/><g stroke="#303c36" stroke-width="1.3" fill="none">${s}</g><style>text{fill:#20382b;stroke:none;font-family:Arial,sans-serif}</style></svg>`;
await fs.writeFile(new URL('../dist/assets/figure-24-1.svg',import.meta.url),svg);
