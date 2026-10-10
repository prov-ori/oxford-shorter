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
  assert.equal(done.length,94);
  assert.deepEqual(done.map(s=>s.id),book.chapters.filter(c=>c.id==='front'||[1,2,3,4,5,6,7,8,9,10].includes(c.number)).flatMap(c=>c.sections.map(s=>s.id)));
  assert.equal(done.at(-1).id,'ch10-s13');
  assert.deepEqual(sections.filter(s=>s.status==='partial'),[]);
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
 assert.equal(c.sections[5].source.pdfStart,191);assert.equal(book.chapters.find(c=>c.number===11).sections[0].status,'pending');
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
