import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import '../dist/model.js';
const book=JSON.parse(await fs.readFile(new URL('../dist/data/book.json',import.meta.url),'utf8'));
test('actual book has all 26 chapters in order and separates front/back matter',()=>{
  StudyModel.validateBook(book);
  assert.deepEqual(book.chapters.filter(c=>c.number).map(c=>c.number),Array.from({length:26},(_,i)=>i+1));
  assert.equal(book.chapters.length,29);assert.equal(StudyModel.flatten(book).length,267);
  assert.equal(book.source.pageCount,881);assert.equal(book.source.sha256,'fab335843a3b7b270fea2fe8d110eba9cebb69f6a6305bf1baa9fb8471b5a14d');
});
test('chapters and sections run in PDF reading order with separate page labels',()=>{
  let last=0;
  for(const s of StudyModel.flatten(book)){assert(s.source.pdfStart>=last,`${s.id} is out of order`);last=s.source.pdfStart;assert(s.source.printedPages);}
  const clinical=book.chapters.find(c=>c.number===14);assert.equal(clinical.sections.find(s=>s.originalTitle==='Amnesia and amnestic disorders').source.pdfStart,353);
  assert.equal(book.chapters.at(-2).sections[0].source.pdfStart,788);assert.equal(book.chapters.at(-1).sections[0].source.pdfStart,850);
});
test('precise published boundary distinguishes complete, partial and pending material',()=>{
  const sections=StudyModel.flatten(book),done=sections.filter(StudyModel.ready);
  assert.equal(done.length,198);
  assert.deepEqual(done.map(s=>s.id),book.chapters.filter(c=>c.id==='front'||[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].includes(c.number)).flatMap(c=>c.sections.map(s=>s.id)).concat(book.chapters.find(c=>c.number===18).sections.map(s=>s.id),book.chapters.find(c=>c.number===19).sections.map(s=>s.id),book.chapters.find(c=>c.number===20).sections.slice(0,2).map(s=>s.id)));
  assert.equal(done.at(-1).id,'ch20-s02');
  assert.deepEqual(sections.filter(s=>s.status==='partial').map(s=>s.id),['ch20-s03']);
  for(const s of sections.filter(s=>!StudyModel.readable(s))){assert.equal(s.status,'pending');assert.equal(s.blocks.length,0);}
  const completed=sections.find(s=>s.id==='ch01-s03');assert.equal(completed.revision,3);assert.equal(completed.coverage,undefined);assert.equal(completed.source.pdfEnd,29);
  assert(sections.every(s=>/[а-яё]/i.test(s.title)));
});

test('new translation preserves box hierarchy, citations, exceptions and editorial separation',()=>{
  const s=StudyModel.flatten(book).find(s=>s.id==='ch01-s03');const text=s.blocks.map(StudyModel.blockText).join('\n');
  const box=s.blocks.find(b=>b.type==='box');assert.equal(box.title,'Вставка 1.1. Описание галлюцинаций');
  assert.equal(box.blocks.filter(b=>b.type==='list').flatMap(b=>b.items).length,14);
  assert.equal(s.blocks.filter(b=>b.type==='heading').length,64);
  assert.equal(s.blocks.filter(b=>b.type==='box').length,5);
  for(const term of ['Broome et al. 2015','Taylor (1981)','Gedankenlautwerden','écho de la pensée','Doppelgänger','здоровых людей','Бредовое восприятие'])assert(text.includes(term));
  assert.equal(s.editorNotes.length,4);assert(!text.includes('Это пояснение переводчика'));
  assert.match(s.blocks.at(-1).text,/Landi et al\. \(2016\)/);
});

test('all chapter 2–3 tables and numbered boxes survive with full text and reading lists',()=>{
  function collect(blocks){return blocks.flatMap(b=>[b,...(b.blocks?collect(b.blocks):[])]);}
  for(const [chapter,boxCount,tableCount] of [[2,2,3],[3,12,2],[4,5,1],[5,6,3],[6,3,4]]){
    const c=book.chapters.find(c=>c.number===chapter),blocks=c.sections.flatMap(s=>collect(s.blocks));
    const boxes=blocks.filter(b=>b.type==='box'),tables=blocks.filter(b=>b.type==='table');
    assert.equal(boxes.length,boxCount);assert.equal(tables.length,tableCount);
    for(let n=1;n<=boxCount;n++)assert(boxes.some(b=>b.title.includes(`${chapter}.${n}.`)||new RegExp(`${chapter}\\.${n}(?:\\s|$)`).test(b.title)),`Missing box ${chapter}.${n}`);
    for(let n=1;n<=(chapter===6?2:tableCount);n++)assert(tables.some(b=>b.caption.includes(`${chapter}.${n}`)),`Missing table ${chapter}.${n}`);
    assert(c.sections.at(-1).blocks.length>0);assert(c.sections.every(s=>s.summary.length>0));
  }
});
test('all general-issues subheadings, references and editor distinction are retained',()=>{
  const s=StudyModel.flatten(book).find(s=>s.id==='ch01-s02');
  assert.equal(s.blocks.filter(b=>b.type==='heading').length,12);
  const text=s.blocks.map(StudyModel.blockText).join('\n');
  for(const citation of ['Berrios, 1996','Stanghellini and Broome, 2014','Oyebode, 2022','Jaspers, 1963','Jaspers (1968)','Fabrega, 2000'])assert(text.includes(citation));
  assert.equal(s.editorNotes.length,2);assert(!text.includes('Обе формулировки исходника сохранены'));
});

test('scientific figures are packaged',async()=>{const s=StudyModel.flatten(book).find(s=>s.id==='ch06-s03');const figures=s.blocks.filter(b=>b.type==='figure');assert.equal(figures.length,2);for(const f of figures){const svg=await fs.readFile(new URL('../dist/'+f.src,import.meta.url),'utf8');assert(svg.includes('<svg'));assert(!/<script|onload=/i.test(svg));}});

test('chapters 7–8 preserve numbered boxes, tables and source boundaries',()=>{
 function collect(blocks){return blocks.flatMap(b=>[b,...(b.blocks?collect(b.blocks):[])]);}
 for(const [number,count] of [[7,8],[8,9]]){
  const c=book.chapters.find(c=>c.number===number),blocks=c.sections.flatMap(s=>collect(s.blocks));
  const boxes=blocks.filter(b=>b.type==='box');assert.equal(boxes.length,count);
  for(let n=1;n<=count;n++)assert(boxes.some(b=>b.title.includes(number+'.'+n)));
 }
 const c=book.chapters.find(c=>c.number===8);assert.equal(c.sections.flatMap(s=>collect(s.blocks)).filter(b=>b.type==='table').length,2);
 assert.equal(c.sections[5].source.pdfStart,191);assert.equal(book.chapters.find(c=>c.number===20).sections[3].status,'pending');
 const panic=c.sections[4].blocks.map(StudyModel.blockText).join(' ');
 for(const value of ['2,7%','4,7%','40%','30 дней','5 мг','шести месяцев','12 недель'])assert(panic.includes(value),value);
});

test('chapter 9 keeps complete clinical and classification source material',()=>{
 const c=book.chapters.find(c=>c.number===9);
 function collect(blocks){return blocks.flatMap(b=>[b,...(b.blocks?collect(b.blocks):[])]);}
 const blocks=c.sections.flatMap(s=>collect(s.blocks));
 assert.equal(blocks.filter(b=>b.type==='box').length,12);assert.equal(blocks.filter(b=>b.type==='table').length,6);
 for(let n=1;n<=3;n++)assert(blocks.some(b=>b.type==='box'&&b.title.includes('9.'+n)));
 for(let n=1;n<=3;n++)assert(blocks.some(b=>b.type==='table'&&b.caption.includes('9.'+n)));
 const criteria=blocks.find(b=>b.type==='box'&&b.title.includes('9.1'));assert.equal(collect(criteria.blocks).filter(b=>b.type==='list').flatMap(b=>b.items).length,10);
 const classification=c.sections[3];assert.equal(classification.editorNotes.length,3);
 const epidemiology=c.sections[5].blocks.map(StudyModel.blockText).join(' ');for(const value of ['2–5%','4–30%','10–20%','27 лет','18–44','1–6%','8%'])assert(epidemiology.includes(value),value);
 assert.equal(c.sections[5].source.pdfEnd,213);assert.equal(c.sections[6].status,'translated');assert.equal(c.sections[6].coverage,undefined);assert.equal(c.sections[6].revision,3);assert.equal(c.sections[12].status,'translated');
});

test('complete depression chapter retains all numbered boxes and treatment source data',async()=>{
 const c=book.chapters.find(c=>c.number===9);function collect(bs){return bs.flatMap(b=>[b,...(b.blocks?collect(b.blocks):[])]);}
 const bs=c.sections.flatMap(s=>collect(s.blocks));
 for(let n=1;n<=12;n++)assert(bs.some(b=>b.type==='box'&&new RegExp('9\\.'+n+'(?:[^0-9]|$)').test(b.title)),n);
 const drug=bs.find(b=>b.type==='table'&&/9\.4/.test(b.caption));assert.equal(drug.rows.length,10);assert.equal(drug.headers.length,6);assert.deepEqual(drug.rows[0],['Амитриптилин','+++','+++','+++','+','+++']);
 const relapse=bs.find(b=>b.type==='table'&&b.caption.includes('Данные рисунка'));assert.equal(relapse.rows.length,6);assert.deepEqual(relapse.rows.at(-1),['Всего','32','465/2527 (18%)','1031/2505 (41%)','−245,7','205,4']);
 const figures=bs.filter(b=>b.type==='figure');assert.equal(figures.length,2);for(const f of figures){const s=await fs.readFile(new URL('../dist/'+f.src,import.meta.url),'utf8');assert(s.includes('<svg'));assert(!/<script|onload=/i.test(s));}
 assert(c.sections.every(s=>s.summary.length>0&&StudyModel.ready(s)));assert.equal(c.sections.at(-1).blocks.length,3);
});

test('bipolar chapter preserves diagnostic, trial and monitoring data from the PDF',async()=>{
 const c=book.chapters.find(c=>c.number===10);function all(bs){return bs.flatMap(b=>[b,...(b.blocks?all(b.blocks):[])]);}const bs=c.sections.flatMap(s=>all(s.blocks));
 assert.equal(c.sections.length,13);assert(c.sections.every(StudyModel.ready));
 const boxes=bs.filter(b=>b.type==='box');assert.equal(boxes.length,5);for(let n=1;n<=5;n++)assert(boxes.some(b=>b.title.includes('10.'+n+'.')));
 const tables=bs.filter(b=>b.type==='table');assert.equal(tables.length,3);assert.deepEqual(tables[0].rows.at(-1),['Среднее число эпизодов','10','4']);
 assert.equal(tables[1].rows.length,13);assert.equal(tables[1].rows[3][0],'');assert.equal(tables[2].rows.length,8);assert.deepEqual(tables[2].rows[6],['Литий','1,27','0,65–2,47']);
 const text=c.sections.map(s=>s.blocks.map(StudyModel.blockText).join('\n')).join('\n');for(const marker of ['20 мг/кг/сут','NNT), — 6,6','100 мг каждую неделю','HbA1c','младше 55 лет','31%','16%','59%','69%','54%'])assert(text.includes(marker),marker);
 const figures=bs.filter(b=>b.type==='figure');assert.equal(figures.length,1);const svg=await fs.readFile(new URL('../dist/'+figures[0].src,import.meta.url),'utf8');assert.equal((svg.match(/<circle /g)||[]).length,14);assert(!/<script|onload=/i.test(svg));
 assert.equal(c.sections.at(-1).blocks.length,3);assert(c.sections[3].editorNotes[0].includes('не обязательно'));
});

test('chapters 11–12 preserve source inserts, family risk and diagnostic distinctions',async()=>{
 function all(bs){return bs.flatMap(b=>[b,...(b.blocks?all(b.blocks):[])]);}
 for(const [number,sections,boxes,tables] of [[11,12,22,4],[12,10,4,1]]){
  const c=book.chapters.find(c=>c.number===number),bs=c.sections.flatMap(s=>all(s.blocks));
  assert.equal(c.sections.length,sections);assert(c.sections.every(StudyModel.ready));assert.equal(bs.filter(b=>b.type==='box').length,boxes);assert.equal(bs.filter(b=>b.type==='table').length,tables);
  for(let n=1;n<=boxes;n++)assert(bs.some(b=>b.type==='box'&&new RegExp(number+'\\.'+n+'(?:[^0-9]|$)').test(b.title)),number+'.'+n);
 }
 const c=book.chapters.find(c=>c.number===11),bs=c.sections.flatMap(s=>all(s.blocks));const risk=bs.find(b=>b.type==='table'&&b.caption.includes('11.4'));assert.equal(risk.rows.length,8);assert.equal(risk.rows[0][1],'48%');assert.equal(risk.rows[5][1],'46%');
 const figures=bs.filter(b=>b.type==='figure');assert.equal(figures.length,1);const svg=await fs.readFile(new URL('../dist/'+figures[0].src,import.meta.url),'utf8');assert(svg.includes('<svg'));assert(!/<script|onload=/i.test(svg));assert.equal(c.sections.at(-1).blocks.length,2);
 const d=book.chapters.find(c=>c.number===12),dbs=d.sections.flatMap(s=>all(s.blocks));assert.equal(dbs.find(b=>b.type==='table').rows.length,6);assert.equal(d.sections.at(-1).blocks[0].items.length,3);
 const text=d.sections.map(s=>s.blocks.map(StudyModel.blockText).join(' ')).join(' ');for(const value of ['трёх месяцев','одного месяца','0,18%','21%','43%','Более 90%','56%','отношением шансов 6'])assert(text.includes(value),value);
 assert(d.sections[3].editorNotes[0].includes('12.3'));assert(d.sections[5].editorNotes[0].includes('не являются индивидуальной вероятностью'));
});

test('chapters 13–15 are complete and preserve numbered source material',async()=>{
 function all(bs){return bs.flatMap(b=>[b,...(b.blocks?all(b.blocks):[])]);}
 for(const [number,sections,boxes,tables] of [[13,5,17,4],[14,15,28,6],[15,15,10,3]]){
 const c=book.chapters.find(c=>c.number===number),bs=c.sections.flatMap(s=>all(s.blocks));assert.equal(c.sections.length,sections);assert(c.sections.every(StudyModel.ready));assert(c.sections.every(s=>s.summary.length>0));assert.equal(bs.filter(b=>b.type==='box').length,boxes);assert.equal(bs.filter(b=>b.type==='table').length,tables);
 for(let n=1;n<=boxes;n++)assert(bs.some(b=>b.type==='box'&&new RegExp(number+'\\.'+n+'(?:[^0-9]|$)').test(b.title)),number+'.'+n);
 for(const table of bs.filter(b=>b.type==='table'))assert(table.rows.every(r=>r.length===table.headers.length));
 }
 const c=book.chapters.find(c=>c.number===15);assert.equal(c.sections[7].blocks.find(b=>b.type==='table').rows.length,10);const text=c.sections.flatMap(s=>s.blocks).map(StudyModel.blockText).join(' ');for(const value of ['7,8%','6,1–9,5%','88%','0,35–0,81','5-HT2A','SCID II'])assert(text.includes(value),value);assert.equal(c.sections.at(-1).blocks.length,4);
 const figure=book.chapters.find(c=>c.number===13).sections.flatMap(s=>s.blocks).find(b=>b.type==='figure');const svg=await fs.readFile(new URL('../dist/'+figure.src,import.meta.url),'utf8');assert(svg.includes('<svg'));assert(!/<script|onload=/i.test(svg));
 assert.equal(book.chapters.find(c=>c.number===20).sections[3].status,'pending');
});

test('chapter 16 is complete with all numbered source material and appendix',()=>{const c=book.chapters.find(c=>c.number===16);assert.equal(c.sections.length,12);assert(c.sections.every(StudyModel.ready));const collect=bs=>bs.flatMap(b=>[b,...(b.blocks?collect(b.blocks):[])]),bs=c.sections.flatMap(s=>collect(s.blocks)),boxes=bs.filter(b=>b.type==='box'),tables=bs.filter(b=>b.type==='table');assert.equal(boxes.length,11);for(let n=1;n<=11;n++)assert(boxes.some(b=>b.title.startsWith('Вставка 16.'+n+'.')));assert.deepEqual(tables.map(t=>t.rows.length),[8,6,6,5]);for(const [n,counts] of [[10,[9,3,6]],[11,[3,3,4,2,3,3,2,3]]])assert.deepEqual(boxes.find(b=>b.title.startsWith('Вставка 16.'+n+'.')).blocks.filter(b=>b.type==='list').map(b=>b.items.length),counts);assert.equal(c.sections[8].summary.length,40);assert.deepEqual(c.sections[11].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[10,4,5,7,8,8]);assert.equal(book.chapters.find(c=>c.number===20).sections[3].status,'pending');});

test('chapter 17 retains its complete assessment, care and numbered material',()=>{const c=book.chapters.find(c=>c.number===17);assert.equal(c.sections.length,13);assert(c.sections.every(StudyModel.ready));const all=c.sections.flatMap(s=>s.blocks),boxes=all.filter(b=>b.type==='box'),tables=all.filter(b=>b.type==='table');assert.equal(boxes.length,4);assert.deepEqual(tables.map(t=>t.rows.length),[9,34,21,12,7]);for(let n=1;n<=4;n++)assert(boxes.some(b=>b.title.startsWith('Вставка 17.'+n+'.')));assert.equal(boxes[0].blocks[0].items.length,8);assert.deepEqual(boxes[2].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[6,5]);assert.deepEqual(boxes[3].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[5,7]);const assessment=c.sections[8],t=assessment.blocks.find(b=>b.type==='table');assert.equal(t.headers.length,2);assert.equal(t.rows[6][1],'');assert(assessment.blocks.map(StudyModel.blockText).join(' ').includes('уровень E'));assert(c.sections[10].blocks.some(b=>b.type==='heading'&&b.text==='Модификация поведения'));assert.equal(c.sections[12].blocks.length,2);assert.equal(book.chapters.find(c=>c.number===20).sections[3].status,'pending');});


test('chapter18 first four sections preserve source data without claiming completion',()=>{const c=book.chapters.find(c=>c.number===18);assert(c.sections.slice(0,4).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===20).sections.slice(3).every(s=>s.status==='pending'));const blocks=c.sections.slice(0,4).flatMap(s=>s.blocks),boxes=blocks.filter(b=>b.type==='box'),tables=blocks.filter(b=>b.type==='table');assert.equal(boxes.length,3);assert.equal(tables.length,1);assert.deepEqual(tables[0].rows,[['Расстройство шизофренического спектра','4,8','13,7'],['Аффективные расстройства','3,5','4,3'],['Трудности обучения (learning difficulties)','1,7','—'],['Расстройства личности','5,7','7,9']]);assert.equal(boxes[0].blocks.find(b=>b.type==='list').items.length,3);assert.deepEqual(boxes[1].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[8,4]);assert.equal(boxes[2].blocks[0].items.length,5);assert.deepEqual(c.sections[1].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[4,5,3,6]);for(const term of ['55 008','492 914','286 500','19%','4,5%'])assert(c.sections[1].blocks.map(StudyModel.blockText).join(' ').includes(term));const t=c.sections[3].blocks.map(StudyModel.blockText).join(' ');for(const term of ['18 423','5,2%','10,7%','2,7%','Пиромания','Клептомания','Pages 53, 54'])assert(t.includes(term),term);assert(book.translationBoundary.includes('девятнадцать глав переведены полностью'));});

test('chapter18 offender groups and specific crimes retain complete source hierarchy and safeguards',()=>{
 const c=book.chapters.find(c=>c.number===18),groups=c.sections[4],crimes=c.sections[5];
 assert(c.sections.slice(0,6).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===20).sections.slice(3).every(s=>s.status==='pending'));
 assert.deepEqual([groups.source.pdfStart,groups.source.pdfEnd,crimes.source.pdfStart,crimes.source.pdfEnd],[510,511,511,516]);
 assert.equal(groups.blocks.filter(b=>b.type==='heading').length,3);
 assert.equal(crimes.blocks.filter(b=>b.type==='heading').length,25);
 assert.deepEqual(crimes.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[3,4,2,6,4,2,3,4]);
 const boxes=crimes.blocks.filter(b=>b.type==='box');assert.equal(boxes.length,2);
 assert.equal(boxes[0].blocks.filter(b=>b.type==='paragraph').length,4);assert.equal(boxes[1].blocks[0].items.length,10);
 const text=crimes.blocks.map(StudyModel.blockText).join(' ');
 for(const term of ['0,230','0,238','30,6%','13,7%','74,6%','91,9%','49%','16%','38%','34%','44%','37%','54%','6%','Mews et al., 2017','Schmucker and Lösel, 2015','никогда не оправдывает насилие','нельзя интерпретировать как согласие'])assert(text.includes(term),term);
 assert.equal(crimes.blocks.at(-1).type,'paragraph');assert.match(crimes.blocks.at(-1).text,/Martin et al., 2004/);
 assert.deepEqual([groups.summary.length,crimes.summary.length],[4,9]);
 assert(crimes.editorNotes.some(s=>s.includes('а не к доле психиатрических пациентов')));
});
test('chapter18 victims, criminal courts and treatment retain the PDF boundaries and distinctions',()=>{
 const c=book.chapters.find(c=>c.number===18),victims=c.sections[6],courts=c.sections[7],treatment=c.sections[8];
 assert(c.sections.slice(0,9).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===20).sections.slice(3).every(s=>s.status==='pending'));
 assert.deepEqual([victims,courts,treatment].map(s=>[s.source.pdfStart,s.source.pdfEnd]),[[517,518],[518,520],[520,522]]);
 assert.deepEqual([victims,courts,treatment].map(s=>s.blocks.filter(b=>b.type==='heading').length),[9,12,7]);
 assert.deepEqual(courts.blocks.filter(b=>b.type==='list').map(b=>[!!b.ordered,b.items.length]),[[true,3],[false,5],[true,3]]);
 assert.match(victims.blocks.at(-1).text,/этиологии.*планирования лечения/);
 const t=courts.blocks.map(StudyModel.blockText).join(' ');
 for(const term of ['doli incapax','mens rea','1843','coerced–compliant','coerced–internalized','неэтично'])assert(t.includes(term),term);
 assert(courts.editorNotes.some(s=>s.includes('действующее законодательство не проверялось')));
 assert.equal(treatment.blocks.find(b=>b.type==='box').blocks[0].items.length,5);
 assert.deepEqual(treatment.blocks.filter(b=>b.type==='list').map(b=>[!!b.ordered,b.items.length]),[[true,2]]);
 const tx=treatment.blocks.map(StudyModel.blockText).join(' ');for(const term of ['4%','10%','1999','1983','2007','2023','административная категория','в тюрьму вместо стационара'])assert(tx.includes(term),term);
 assert.deepEqual([victims.summary.length,courts.summary.length,treatment.summary.length],[5,7,6]);
});
test('chapter18 is complete with all numbered source material and translated diagrams',async()=>{
 const c=book.chapters.find(c=>c.number===18);assert.equal(c.sections.length,13);assert(c.sections.every(StudyModel.ready));
 const bs=c.sections.flatMap(s=>s.blocks),boxes=bs.filter(b=>b.type==='box'),figures=bs.filter(b=>b.type==='figure');
 assert.equal(boxes.length,9);for(let n=1;n<=9;n++)assert(boxes.some(b=>b.title.startsWith('Вставка 18.'+n+'.')));
 assert.equal(figures.length,2);for(const f of figures){const svg=await fs.readFile(new URL('../dist/'+f.src,import.meta.url),'utf8');assert(svg.includes('<svg'));assert(!/<script|onload=/i.test(svg));}
 const manage=c.sections[9],risk=c.sections[10],report=c.sections[11];
 assert.deepEqual(manage.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[4,5]);
 assert.equal(manage.blocks.find(b=>b.type==='box').blocks[0].items.length,3);
 assert.deepEqual(risk.blocks.find(b=>b.type==='box').blocks.filter(b=>b.type==='list').map(b=>b.items.length),[6,4,6,3]);
 assert.deepEqual(risk.blocks.filter(b=>b.type==='list').map(b=>[!!b.ordered,b.items.length]),[[true,2],[false,4]]);
 assert.equal(report.blocks.find(b=>b.type==='box').blocks[0].items.length,7);assert.equal(report.blocks.find(b=>b.type==='table').headers.length,4);assert.equal(report.blocks.find(b=>b.type==='table').rows.length,2);
 assert.equal(report.blocks.find(b=>b.type==='list').items.length,6);assert.equal(report.blocks.filter(b=>b.type==='heading').length,5);
 assert.equal(c.sections[12].blocks.length,2);assert.match(c.sections[12].editorNotes[0],/пустая/);assert(book.chapters.find(c=>c.number===20).sections.slice(3).every(s=>s.status==='pending'));
});
test('chapter19 first three sections preserve age distinctions and all source tables',()=>{
 const c=book.chapters.find(c=>c.number===19);assert(c.sections.slice(0,3).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===20).sections.slice(3).every(s=>s.status==='pending'));
 assert.deepEqual(c.sections.slice(0,3).map(s=>[s.source.pdfStart,s.source.pdfEnd]),[[530,530],[530,532],[532,534]]);
 const [intro,age,epi]=c.sections;assert.equal(intro.blocks.find(b=>b.type==='list').items.length,2);assert.deepEqual([intro.summary.length,age.summary.length,epi.summary.length],[3,5,6]);
 assert.equal(age.blocks.filter(b=>b.type==='heading').length,5);assert.equal(epi.blocks.filter(b=>b.type==='heading').length,5);
 const tables=c.sections.slice(0,3).flatMap(s=>s.blocks.filter(b=>b.type==='table'));assert.deepEqual(tables.map(t=>[t.rows.length,t.headers.length]),[[8,4],[6,2],[7,5],[8,2]]);
 assert.deepEqual(tables[0].rows[0],['Население, миллионы — мир','7 713','8 548','9 735']);assert.deepEqual(tables[2].rows.at(-1),['Объединённые показатели','3,9','7,5','24,3 млн','В 2,3 раза']);assert.deepEqual(tables[3].rows[0],['60–65','0,15 (0–2,3)']);assert.deepEqual(tables[3].rows.at(-1),['>95','44,7 (39,8–49,6)']);
 const t=epi.blocks.map(StudyModel.blockText).join(' ');for(const term of ['Stallard et al., 2025','13,5%','9,8%','1,8%','78%','0,1–0,5%','20–25%'])assert(t.includes(term),term);
 assert.match(age.blocks.map(StudyModel.blockText).join(' '),/Кратковременная память.*Тесты рабочей памяти/);assert(epi.editorNotes.some(s=>s.includes('не суммируются')));
});
test('chapter19 practice retains complete services, assessment, treatment and legal material',()=>{
 const c=book.chapters.find(c=>c.number===19),s=c.sections[3];assert(c.sections.slice(0,4).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===20).sections.slice(3).every(s=>s.status==='pending'));
 assert.deepEqual([s.source.pdfStart,s.source.pdfEnd],[534,541]);assert.equal(s.blocks.filter(b=>b.type==='heading').length,30);
 assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>[!!b.ordered,b.items.length]),[[false,11],[true,3],[false,6],[false,3],[true,3],[true,2],[false,3],[false,3],[false,5]]);
 const boxes=s.blocks.filter(b=>b.type==='box');assert.equal(boxes.length,2);assert.equal(boxes[0].blocks[0].items.length,6);assert.deepEqual(boxes[1].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[3,2]);assert.equal(boxes[1].blocks.filter(b=>b.type==='paragraph').length,5);
 assert.equal(s.blocks.filter(b=>b.type==='table'||b.type==='figure').length,0);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['700 000','50%','2–10%','MMSE','MoCA','CGA','CPA','ADRT','Court of Protection','Patel et al. (2021)'])assert(text.includes(term),term);
 assert(s.editorNotes.some(t=>t.includes('смешивает разные механизмы')));assert.equal(s.summary.length,12);
 const idx=s.blocks.findIndex(b=>b.type==='heading'&&b.text==='Ухаживающие');assert.match(s.blocks[idx-1].text,/Добровольческие организации/);assert.match(s.blocks.at(-1).text,/Patel et al\. \(2021\)/);
});
test('chapter19 clinical section preserves depression distinctions, doses and late-onset features',()=>{
 const c=book.chapters.find(c=>c.number===19),s=c.sections[4];assert(c.sections.slice(0,5).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===20).sections.slice(3).every(s=>s.status==='pending'));assert.deepEqual([s.source.pdfStart,s.source.pdfEnd],[541,545]);
 assert.equal(s.blocks.filter(b=>b.type==='heading').length,17);assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[4,6]);const box=s.blocks.find(b=>b.type==='box');assert.deepEqual(box.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[3,3,6]);assert.equal(s.blocks.filter(b=>b.type==='table'||b.type==='figure').length,0);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['277','32%','44%','23%','12 месяцев','0,4–0,6 ммоль/л','10–20%','3:1','1760','10–15%','Connors et al., 2019','Riisgaard et al., 2015','Hamedani and Pelak (2019)'])assert(text.includes(term),term);
 assert(s.editorNotes.some(t=>t.includes('не суммируются')));assert(s.editorNotes.some(t=>t.includes('напряжении с предыдущим разделом')));assert.equal(s.summary.length,9);assert.match(s.blocks.at(-1).text,/Hamedani/);
});
test('chapter19 complete dementia treatment retains all numbered material and source limitations',()=>{
 const c=book.chapters.find(c=>c.number===19);assert.equal(c.sections.length,7);assert(c.sections.every(StudyModel.ready));const bs=c.sections.flatMap(s=>s.blocks);assert.equal(bs.filter(b=>b.type==='table').length,4);const boxes=bs.filter(b=>b.type==='box');assert.equal(boxes.length,5);for(let n=1;n<=5;n++)assert(boxes.some(b=>b.title.startsWith('Вставка 19.'+n+'.')));
 const s=c.sections[5];assert.equal(s.blocks.filter(b=>b.type==='heading').length,15);assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>[!!b.ordered,b.items.length]),[[false,7],[false,4],[false,3],[true,3],[true,3]]);assert.deepEqual(boxes[3].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[6,4,4]);assert.deepEqual(boxes[4].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[5,2,2,6]);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['27%','ADAS-Cog','CIBIC-Plus','выше 12','ARIA','SPRINT-MIND','5-HT1A'])assert(text.includes(term),term);
 assert.match(s.editorNotes[1],/ошибочно.*5-HT1A/);assert(s.editorNotes[1].includes('5-HT2A'));assert(s.editorNotes[1].includes('207318s010lbl.pdf'));assert.deepEqual([s.summary.length,c.sections[6].summary.length],[8,1]);assert.equal(c.sections[6].blocks.length,2);assert.match(c.sections[6].editorNotes[0],/пустая/);assert(book.chapters.find(c=>c.number===20).sections.slice(3).every(s=>s.status==='pending'));
});
test('chapter20 classification preserves source tables, linked box and diagnostic distinctions',()=>{
 const c=book.chapters.find(c=>c.number===20),s=c.sections[1];assert(c.sections.slice(0,2).every(StudyModel.ready));assert(c.sections.slice(3).every(s=>s.status==='pending'));assert.deepEqual([s.source.pdfStart,s.source.pdfEnd],[552,555]);const tables=s.blocks.filter(b=>b.type==='table');assert.deepEqual(tables.map(t=>[t.rows.length,t.headers.length]),[[12,2],[11,2],[5,2]]);assert.deepEqual(tables[0].rows[2],['','Зависимость']);assert.equal(tables[0].rows.at(-1)[1],'');assert.equal(s.blocks.filter(b=>b.type==='heading').length,5);
 const box=s.blocks.find(b=>b.type==='box');assert.equal(box.blocks.find(b=>b.type==='list').items.length,11);assert(box.blocks[0].text.includes('2–3'));const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['не менее12','трёх месяцев','stave off alcohol dependence','МКБ-10','MDMA'])assert(text.replaceAll('не менее 12','не менее12').includes(term),term);assert(s.editorNotes.some(t=>/вопросы\s*3 и\s*4/.test(t)));assert.deepEqual(c.sections.slice(0,2).map(s=>s.summary.length),[2,6]);
});
test('alcohol section has a precise partial boundary and unchanged source quantities',()=>{
 const c=book.chapters.find(c=>c.number===20),s=c.sections[2];assert.equal(s.status,'partial');assert.equal(s.source.pdfEnd,574);assert.deepEqual([s.coverage.pdfStart,s.coverage.pdfEnd],[554,558]);assert.match(s.coverage.next,/558/);assert.equal(s.blocks.filter(b=>b.type==='heading').length,15);assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>[!!b.ordered,b.items.length]),[[true,4],[true,3],[false,4],[false,2]]);assert.equal(s.blocks.filter(b=>b.type==='box').length,0);
 const table=s.blocks.find(b=>b.type==='table');assert.equal(table.headers.length,4);assert.equal(table.rows.length,14);assert.deepEqual(table.rows[8],['Столовое вино — бокал','10–14','10','2']);assert.deepEqual(table.rows[9],['Столовое вино — бутылка','10–14','70','12']);assert.match(s.editorNotes[1],/не соответствуют/);assert.equal(s.summary.length,8);assert.equal(s.blocks.at(-1).type,'paragraph');assert.match(s.blocks.at(-1).text,/рецептурными препаратами/);
});
