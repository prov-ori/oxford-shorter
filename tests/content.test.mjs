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
  assert.equal(done.length,207);
  assert.deepEqual(done.map(s=>s.id),book.chapters.filter(c=>c.id==='front'||[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].includes(c.number)).flatMap(c=>c.sections.map(s=>s.id)).concat(book.chapters.find(c=>c.number===18).sections.map(s=>s.id),book.chapters.find(c=>c.number===19).sections.map(s=>s.id),book.chapters.find(c=>c.number===20).sections.map(s=>s.id),book.chapters.find(c=>c.number===21).sections.slice(0,6).map(s=>s.id)));
  assert.equal(done.at(-1).id,'ch21-s06');
  assert.deepEqual(sections.filter(s=>s.status==='partial').map(s=>s.id),[]);
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
 assert.equal(c.sections[5].source.pdfStart,191);assert.equal(book.chapters.find(c=>c.number===21).sections[6].status,'pending');
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
 assert.equal(book.chapters.find(c=>c.number===21).sections[6].status,'pending');
});

test('chapter 16 is complete with all numbered source material and appendix',()=>{const c=book.chapters.find(c=>c.number===16);assert.equal(c.sections.length,12);assert(c.sections.every(StudyModel.ready));const collect=bs=>bs.flatMap(b=>[b,...(b.blocks?collect(b.blocks):[])]),bs=c.sections.flatMap(s=>collect(s.blocks)),boxes=bs.filter(b=>b.type==='box'),tables=bs.filter(b=>b.type==='table');assert.equal(boxes.length,11);for(let n=1;n<=11;n++)assert(boxes.some(b=>b.title.startsWith('Вставка 16.'+n+'.')));assert.deepEqual(tables.map(t=>t.rows.length),[8,6,6,5]);for(const [n,counts] of [[10,[9,3,6]],[11,[3,3,4,2,3,3,2,3]]])assert.deepEqual(boxes.find(b=>b.title.startsWith('Вставка 16.'+n+'.')).blocks.filter(b=>b.type==='list').map(b=>b.items.length),counts);assert.equal(c.sections[8].summary.length,40);assert.deepEqual(c.sections[11].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[10,4,5,7,8,8]);assert.equal(book.chapters.find(c=>c.number===21).sections[6].status,'pending');});

test('chapter 17 retains its complete assessment, care and numbered material',()=>{const c=book.chapters.find(c=>c.number===17);assert.equal(c.sections.length,13);assert(c.sections.every(StudyModel.ready));const all=c.sections.flatMap(s=>s.blocks),boxes=all.filter(b=>b.type==='box'),tables=all.filter(b=>b.type==='table');assert.equal(boxes.length,4);assert.deepEqual(tables.map(t=>t.rows.length),[9,34,21,12,7]);for(let n=1;n<=4;n++)assert(boxes.some(b=>b.title.startsWith('Вставка 17.'+n+'.')));assert.equal(boxes[0].blocks[0].items.length,8);assert.deepEqual(boxes[2].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[6,5]);assert.deepEqual(boxes[3].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[5,7]);const assessment=c.sections[8],t=assessment.blocks.find(b=>b.type==='table');assert.equal(t.headers.length,2);assert.equal(t.rows[6][1],'');assert(assessment.blocks.map(StudyModel.blockText).join(' ').includes('уровень E'));assert(c.sections[10].blocks.some(b=>b.type==='heading'&&b.text==='Модификация поведения'));assert.equal(c.sections[12].blocks.length,2);assert.equal(book.chapters.find(c=>c.number===21).sections[6].status,'pending');});


test('chapter18 first four sections preserve source data without claiming completion',()=>{const c=book.chapters.find(c=>c.number===18);assert(c.sections.slice(0,4).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===21).sections.slice(6).every(s=>s.status==='pending'));const blocks=c.sections.slice(0,4).flatMap(s=>s.blocks),boxes=blocks.filter(b=>b.type==='box'),tables=blocks.filter(b=>b.type==='table');assert.equal(boxes.length,3);assert.equal(tables.length,1);assert.deepEqual(tables[0].rows,[['Расстройство шизофренического спектра','4,8','13,7'],['Аффективные расстройства','3,5','4,3'],['Трудности обучения (learning difficulties)','1,7','—'],['Расстройства личности','5,7','7,9']]);assert.equal(boxes[0].blocks.find(b=>b.type==='list').items.length,3);assert.deepEqual(boxes[1].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[8,4]);assert.equal(boxes[2].blocks[0].items.length,5);assert.deepEqual(c.sections[1].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[4,5,3,6]);for(const term of ['55 008','492 914','286 500','19%','4,5%'])assert(c.sections[1].blocks.map(StudyModel.blockText).join(' ').includes(term));const t=c.sections[3].blocks.map(StudyModel.blockText).join(' ');for(const term of ['18 423','5,2%','10,7%','2,7%','Пиромания','Клептомания','Pages 53, 54'])assert(t.includes(term),term);assert(book.translationBoundary.includes('двадцать глав переведены полностью'));});

test('chapter18 offender groups and specific crimes retain complete source hierarchy and safeguards',()=>{
 const c=book.chapters.find(c=>c.number===18),groups=c.sections[4],crimes=c.sections[5];
 assert(c.sections.slice(0,6).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===21).sections.slice(6).every(s=>s.status==='pending'));
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
 assert(c.sections.slice(0,9).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===21).sections.slice(6).every(s=>s.status==='pending'));
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
 assert.equal(c.sections[12].blocks.length,2);assert.match(c.sections[12].editorNotes[0],/пустая/);assert(book.chapters.find(c=>c.number===21).sections.slice(6).every(s=>s.status==='pending'));
});
test('chapter19 first three sections preserve age distinctions and all source tables',()=>{
 const c=book.chapters.find(c=>c.number===19);assert(c.sections.slice(0,3).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===21).sections.slice(6).every(s=>s.status==='pending'));
 assert.deepEqual(c.sections.slice(0,3).map(s=>[s.source.pdfStart,s.source.pdfEnd]),[[530,530],[530,532],[532,534]]);
 const [intro,age,epi]=c.sections;assert.equal(intro.blocks.find(b=>b.type==='list').items.length,2);assert.deepEqual([intro.summary.length,age.summary.length,epi.summary.length],[3,5,6]);
 assert.equal(age.blocks.filter(b=>b.type==='heading').length,5);assert.equal(epi.blocks.filter(b=>b.type==='heading').length,5);
 const tables=c.sections.slice(0,3).flatMap(s=>s.blocks.filter(b=>b.type==='table'));assert.deepEqual(tables.map(t=>[t.rows.length,t.headers.length]),[[8,4],[6,2],[7,5],[8,2]]);
 assert.deepEqual(tables[0].rows[0],['Население, миллионы — мир','7 713','8 548','9 735']);assert.deepEqual(tables[2].rows.at(-1),['Объединённые показатели','3,9','7,5','24,3 млн','В 2,3 раза']);assert.deepEqual(tables[3].rows[0],['60–65','0,15 (0–2,3)']);assert.deepEqual(tables[3].rows.at(-1),['>95','44,7 (39,8–49,6)']);
 const t=epi.blocks.map(StudyModel.blockText).join(' ');for(const term of ['Stallard et al., 2025','13,5%','9,8%','1,8%','78%','0,1–0,5%','20–25%'])assert(t.includes(term),term);
 assert.match(age.blocks.map(StudyModel.blockText).join(' '),/Кратковременная память.*Тесты рабочей памяти/);assert(epi.editorNotes.some(s=>s.includes('не суммируются')));
});
test('chapter19 practice retains complete services, assessment, treatment and legal material',()=>{
 const c=book.chapters.find(c=>c.number===19),s=c.sections[3];assert(c.sections.slice(0,4).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===21).sections.slice(6).every(s=>s.status==='pending'));
 assert.deepEqual([s.source.pdfStart,s.source.pdfEnd],[534,541]);assert.equal(s.blocks.filter(b=>b.type==='heading').length,30);
 assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>[!!b.ordered,b.items.length]),[[false,11],[true,3],[false,6],[false,3],[true,3],[true,2],[false,3],[false,3],[false,5]]);
 const boxes=s.blocks.filter(b=>b.type==='box');assert.equal(boxes.length,2);assert.equal(boxes[0].blocks[0].items.length,6);assert.deepEqual(boxes[1].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[3,2]);assert.equal(boxes[1].blocks.filter(b=>b.type==='paragraph').length,5);
 assert.equal(s.blocks.filter(b=>b.type==='table'||b.type==='figure').length,0);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['700 000','50%','2–10%','MMSE','MoCA','CGA','CPA','ADRT','Court of Protection','Patel et al. (2021)'])assert(text.includes(term),term);
 assert(s.editorNotes.some(t=>t.includes('смешивает разные механизмы')));assert.equal(s.summary.length,12);
 const idx=s.blocks.findIndex(b=>b.type==='heading'&&b.text==='Ухаживающие');assert.match(s.blocks[idx-1].text,/Добровольческие организации/);assert.match(s.blocks.at(-1).text,/Patel et al\. \(2021\)/);
});
test('chapter19 clinical section preserves depression distinctions, doses and late-onset features',()=>{
 const c=book.chapters.find(c=>c.number===19),s=c.sections[4];assert(c.sections.slice(0,5).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===21).sections.slice(6).every(s=>s.status==='pending'));assert.deepEqual([s.source.pdfStart,s.source.pdfEnd],[541,545]);
 assert.equal(s.blocks.filter(b=>b.type==='heading').length,17);assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[4,6]);const box=s.blocks.find(b=>b.type==='box');assert.deepEqual(box.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[3,3,6]);assert.equal(s.blocks.filter(b=>b.type==='table'||b.type==='figure').length,0);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['277','32%','44%','23%','12 месяцев','0,4–0,6 ммоль/л','10–20%','3:1','1760','10–15%','Connors et al., 2019','Riisgaard et al., 2015','Hamedani and Pelak (2019)'])assert(text.includes(term),term);
 assert(s.editorNotes.some(t=>t.includes('не суммируются')));assert(s.editorNotes.some(t=>t.includes('напряжении с предыдущим разделом')));assert.equal(s.summary.length,9);assert.match(s.blocks.at(-1).text,/Hamedani/);
});
test('chapter19 complete dementia treatment retains all numbered material and source limitations',()=>{
 const c=book.chapters.find(c=>c.number===19);assert.equal(c.sections.length,7);assert(c.sections.every(StudyModel.ready));const bs=c.sections.flatMap(s=>s.blocks);assert.equal(bs.filter(b=>b.type==='table').length,4);const boxes=bs.filter(b=>b.type==='box');assert.equal(boxes.length,5);for(let n=1;n<=5;n++)assert(boxes.some(b=>b.title.startsWith('Вставка 19.'+n+'.')));
 const s=c.sections[5];assert.equal(s.blocks.filter(b=>b.type==='heading').length,15);assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>[!!b.ordered,b.items.length]),[[false,7],[false,4],[false,3],[true,3],[true,3]]);assert.deepEqual(boxes[3].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[6,4,4]);assert.deepEqual(boxes[4].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[5,2,2,6]);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['27%','ADAS-Cog','CIBIC-Plus','выше 12','ARIA','SPRINT-MIND','5-HT1A'])assert(text.includes(term),term);
 assert.match(s.editorNotes[1],/ошибочно.*5-HT1A/);assert(s.editorNotes[1].includes('5-HT2A'));assert(s.editorNotes[1].includes('207318s010lbl.pdf'));assert.deepEqual([s.summary.length,c.sections[6].summary.length],[8,1]);assert.equal(c.sections[6].blocks.length,2);assert.match(c.sections[6].editorNotes[0],/пустая/);assert(book.chapters.find(c=>c.number===21).sections.slice(6).every(s=>s.status==='pending'));
});
test('chapter20 classification preserves source tables, linked box and diagnostic distinctions',()=>{
 const c=book.chapters.find(c=>c.number===20),s=c.sections[1];assert(c.sections.slice(0,2).every(StudyModel.ready));assert(book.chapters.find(c=>c.number===21).sections.slice(6).every(s=>s.status==='pending'));assert.deepEqual([s.source.pdfStart,s.source.pdfEnd],[552,555]);const tables=s.blocks.filter(b=>b.type==='table');assert.deepEqual(tables.map(t=>[t.rows.length,t.headers.length]),[[12,2],[11,2],[5,2]]);assert.deepEqual(tables[0].rows[2],['','Зависимость']);assert.equal(tables[0].rows.at(-1)[1],'');assert.equal(s.blocks.filter(b=>b.type==='heading').length,5);
 const box=s.blocks.find(b=>b.type==='box');assert.equal(box.blocks.find(b=>b.type==='list').items.length,11);assert(box.blocks[0].text.includes('2–3'));const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['не менее12','трёх месяцев','stave off alcohol dependence','МКБ-10','MDMA'])assert(text.replaceAll('не менее 12','не менее12').includes(term),term);assert(s.editorNotes.some(t=>/вопросы\s*3 и\s*4/.test(t)));assert.deepEqual(c.sections.slice(0,2).map(s=>s.summary.length),[2,6]);
});
test('complete alcohol section retains source extent and unchanged quantities',()=>{
 const c=book.chapters.find(c=>c.number===20),s=c.sections[2];assert.equal(s.status,'translated');assert.equal(s.source.pdfEnd,574);assert.equal(s.coverage,undefined);assert.equal(s.blocks.filter(b=>b.type==='heading').length,69);assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>[!!b.ordered,b.items.length]),[[true,4],[true,3],[false,4],[false,2],[true,4],[true,4],[false,3],[true,4]]);assert.equal(s.blocks.filter(b=>b.type==='box').length,11);
 const table=s.blocks.find(b=>b.type==='table');assert.equal(table.headers.length,4);assert.equal(table.rows.length,14);assert.deepEqual(table.rows[8],['Столовое вино — бокал','10–14','10','2']);assert.deepEqual(table.rows[9],['Столовое вино — бутылка','10–14','70','12']);assert.match(s.editorNotes[1],/не соответствуют/);assert.equal(s.summary.length,30);assert.equal(s.blocks.at(-1).type,'list');assert.match(s.blocks.at(-1).items[3],/Просвещение/);
});
test('expanded alcohol partial preserves previous content and expires earlier partial progress',async()=>{
 const s=book.chapters.find(c=>c.number===20).sections[2],{translations:old}=await import('../content/translation-ch20b.mjs');assert.deepEqual(s.blocks.slice(0,old['ch20-s03'].blocks.length),old['ch20-s03'].blocks);assert.equal(s.revision,6);assert.deepEqual(s.blocks.find(b=>b.type==='box').blocks.filter(b=>b.type==='list').map(b=>b.items.length),[4,5,5]);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['5%','194','129','48 часов','2%','3,3 миллиона','5,9%','сознание в тот момент сохранялось','неотложное медицинское состояние'])assert(text.includes(term),term);
 const state=StudyModel.emptyState();state.completed[s.id]={revision:2,source:book.source.sha256};state.notes[s.id]='Старая заметка';assert.equal(StudyModel.isPartRead(s,state,book),false);assert.equal(state.notes[s.id],'Старая заметка');assert.equal(StudyModel.stats(book,state).read,0);assert.equal(StudyModel.stats(book,state).partialRead,0);
});

test('neurocognitive and societal addition retains source boundaries and prior content',async()=>{
 const s=book.chapters.find(c=>c.number===20).sections[2],{translations:old}=await import('../content/translation-ch20c.mjs');assert.deepEqual(s.blocks.slice(0,old['ch20-s03'].blocks.length),old['ch20-s03'].blocks);
 const box=s.blocks.find(b=>b.type==='box'&&b.title.includes('20.3'));assert.equal(box.blocks[0].items.length,4);assert.equal(box.blocks[0].ordered,true);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['17%','9000','20 единиц','ALDH2','40–70%','D2/3','55%','32%','14%','7%','Beeston et al., 2020','Yap al., 2017','ясном сознании'])assert(text.includes(term),term);
 assert(s.blocks.some(b=>b.type==='heading'&&/Скрининговые опросники/.test(b.text)));assert.equal(s.coverage,undefined);
 const state=StudyModel.emptyState();state.completed[s.id]={revision:3,source:book.source.sha256};state.notes[s.id]='Сохранить заметку';assert.equal(StudyModel.isPartRead(s,state,book),false);assert.equal(state.notes[s.id],'Сохранить заметку');
});

test('alcohol recognition and withdrawal retain complete questions and clinical distinctions',async()=>{
 const s=book.chapters.find(c=>c.number===20).sections[2],{translations:old}=await import('../content/translation-ch20d.mjs');assert.deepEqual(s.blocks.slice(0,old['ch20-s03'].blocks.length),old['ch20-s03'].blocks);assert.equal(s.revision,6);
 const boxes=s.blocks.filter(b=>b.type==='box');assert.deepEqual(boxes.map(b=>b.title.match(/20\.\d+/)[0]),['20.2','20.3','20.4','20.5','20.6','20.7','20.8','20.9','20.10','20.11','20.12']);
 const audit=boxes[2];assert.equal(audit.blocks.filter(b=>b.type==='heading').length,10);assert.deepEqual(audit.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[5,5,5,5,5,5,5,5,3,3]);
 assert.match(audit.blocks[2].text,/Сколько единиц/);assert.match(audit.blocks[4].text,/шесть или более порций/);assert.equal(boxes[3].blocks[0].items.length,6);assert.equal(boxes[5].blocks[0].items.length,7);assert.equal(boxes[6].blocks[0].items.length,5);assert.equal(boxes[7].blocks[0].items.length,4);assert.equal(boxes[8].blocks[0].items.length,6);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['AUDIT-C','8–15','16–19','20–40','0, 2 и 4','5 баллов','70%','60%','24 часов','SADQ','выше 30','20–30 мг четыре раза','5–7 дней','парентерально','профилактике делирия','ежедневная оценка'])assert(text.includes(term),term);
 assert(s.blocks.some(b=>b.type==='heading'&&b.text==='Психологическое лечение'));assert.equal(s.coverage,undefined);
 const state=StudyModel.emptyState();state.completed[s.id]={revision:4,source:book.source.sha256};state.notes[s.id]='Старые заметки';assert.equal(StudyModel.isPartRead(s,state,book),false);assert.equal(state.notes[s.id],'Старые заметки');assert.equal(StudyModel.stats(book,state).partialRead,0);
});

test('complete alcohol section keeps therapies, trial data and source inconsistencies',async()=>{
 const s=book.chapters.find(c=>c.number===20).sections[2],{translations:old}=await import('../content/translation-ch20e.mjs');assert.deepEqual(s.blocks.slice(0,old['ch20-s03'].blocks.length),old['ch20-s03'].blocks);assert.equal(s.status,'translated');assert.equal(s.coverage,undefined);assert.equal(s.revision,6);
 const boxes=s.blocks.filter(b=>b.type==='box');assert.equal(boxes[9].blocks.filter(b=>b.type==='heading').length,6);assert.equal(boxes[10].blocks[0].items.length,3);assert.match(boxes[10].blocks[0].items[0],/20.9/);assert(s.editorNotes.some(x=>/ошибочная ссылка/.test(x)));assert(s.editorNotes.some(x=>/какой исход/.test(x)));
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['800 мг','100–200 мг','333 мг','60 кг','0,77–0,88','0,75–0,91','45 единиц','35 единиц','COMBINE','19 рандомизированных','27 рандомизированных','27 до 19','30% до 45%','GRIK1','35%','11%','2%','£800 млн'])assert(text.includes(term),term);assert.equal(s.blocks.at(-1).items.length,4);
 const state=StudyModel.emptyState();state.completed[s.id]={revision:5,source:book.source.sha256};state.notes[s.id]='Заметка из неполного перевода';assert.equal(StudyModel.isRead(s,state,book),false);assert.equal(StudyModel.stats(book,state).read,0);assert.equal(state.notes[s.id],'Заметка из неполного перевода');assert.equal(StudyModel.stats(book,state).partial,0);
});

test('complete other substances section keeps statistics, mechanisms and diagnostic limits',()=>{
 const c=book.chapters.find(c=>c.number===20),s=c.sections[3];assert.equal(s.status,'translated');assert.equal(s.revision,5);assert.equal(s.source.pdfEnd,595);assert.equal(s.coverage,undefined);assert.equal(s.blocks.filter(b=>b.type==='heading').length,96);assert.equal(s.summary.length,27);
 const boxes=s.blocks.filter(b=>b.type==='box');assert.deepEqual(boxes.map(b=>b.title.match(/20\.\d+/)[0]),['20.13','20.14','20.15','20.16','20.17','20.18','20.19']);const table=boxes[0].blocks.find(b=>b.type==='table');assert.equal(table.rows.length,14);assert.deepEqual(table.rows[2],['Закись азота','2,4%']);assert.deepEqual(table.rows.at(-1),['Летучие вещества','0,1%']);assert.deepEqual(boxes[1].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[3,4]);assert.equal(boxes[2].blocks.filter(b=>b.type==='heading').length,6);assert.equal(boxes[3].blocks[0].items.length,9);assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[4,3,4,3,2,7,3]);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['13%','17,5%','11,3%','6,0%','14,3%','5,9%','9,7%','0,4%','26,4%','17,1%','4,3%','1,9%','3,7%','1,6%','24%','30%','15%','50–80%','30–50%','£15 млрд','3000','50%','reinstatement','двух дней','трёх недель','хроматографическим','Abraham and Luty (2010)'])assert(text.includes(term),term);assert(s.blocks.some(b=>b.type==='heading'&&/реабилитация/.test(b.text)));
 const state=StudyModel.emptyState();state.completed[s.id]={revision:4,source:book.source.sha256};assert.equal(StudyModel.stats(book,state).read,0);assert.equal(StudyModel.stats(book,state).partialRead,0);assert.equal(StudyModel.stats(book,state).translated,207);
});

test('opioid addition preserves prior material, withdrawal risks and separate treatment aims',async()=>{
 const s=book.chapters.find(c=>c.number===20).sections[3],{translations:old}=await import('../content/translation-ch20g.mjs');assert.deepEqual(s.blocks.slice(0,old['ch20-s04'].blocks.length),old['ch20-s04'].blocks);const boxes=s.blocks.filter(b=>b.type==='box');assert.equal(boxes[4].blocks.filter(b=>b.type==='heading').length,6);assert.equal(boxes[5].blocks[0].items.length,3);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['57 000','1,0%','12%','36–48 часов','10–20%','50%','95%','налоксона','налтрексон','10–40 мг','четыре часа','свыше 30 мг','60–120 мг','12–16 мг','QTc','пять дней','втором триместре','смертельное угнетение дыхания','Otasowie, 2021','Prochaska and DiClemente (1986)'])assert(text.toLowerCase().includes(term.toLowerCase()),term);
 assert(s.blocks.some(b=>b.type==='heading'&&b.text==='Анксиолитики и снотворные'));assert.equal(s.coverage,undefined);assert.match(s.blocks.at(-1).text,/Iacobucci, 2018/);
 const state=StudyModel.emptyState();state.completed[s.id]={revision:2,source:book.source.sha256};state.notes[s.id]='Сохранить предыдущий конспект';assert.equal(StudyModel.isPartRead(s,state,book),false);assert.equal(StudyModel.stats(book,state).partialRead,0);assert.equal(state.notes[s.id],'Сохранить предыдущий конспект');
});

test('sedative, cannabis and stimulant addition keeps dose, causality and trial limits',async()=>{
 const s=book.chapters.find(c=>c.number===20).sections[3],{translations:old}=await import('../content/translation-ch20h.mjs');assert.deepEqual(s.blocks.slice(0,old['ch20-s04'].blocks.length),old['ch20-s04'].blocks);assert.equal(s.revision,5);assert.equal(s.source.pdfEnd,595);assert.equal(s.coverage,undefined);const b=s.blocks.find(b=>b.type==='box'&&b.title.includes('20.19'));assert.equal(b.blocks[1].items.length,4);assert.equal(b.blocks.filter(x=>x.type==='heading').length,2);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['20–40 недель','30 мг диазепама','α2δ','26%','7,2%','2,6%','45 570','2,5 раза','9%','32%','23%','17%','15%','6,2%','0,5%','0,1%','7,9%','1,2%','0,4%','6,1%','6,4%','50–150 мг','гипонатриемии','Smith et al., 2022','делирий']){assert(text.includes(term),term);}assert(s.blocks.some(x=>x.type==='heading'&&x.text==='Галлюциногены'));assert(s.editorNotes.some(x=>/не является доказательством безопасности/.test(x)));assert(s.blocks.some(b=>b.text&&/трудности скрыть/.test(b.text)));
 const state=StudyModel.emptyState();state.completed[s.id]={revision:3,source:book.source.sha256};state.notes[s.id]='Прежние заметки';assert.equal(StudyModel.isPartRead(s,state,book),false);assert.equal(state.notes[s.id],'Прежние заметки');
});

test('chapter20 completion retains final table, all reading entries and expired partial progress',async()=>{
 const c=book.chapters.find(c=>c.number===20),s=c.sections[3],{translations:old}=await import('../content/translation-ch20i.mjs');assert(c.sections.every(StudyModel.ready));assert.deepEqual(s.blocks.slice(0,old['ch20-s04'].blocks.length),old['ch20-s04'].blocks);assert.equal(s.status,'translated');assert.equal(s.coverage,undefined);assert.equal(s.revision,5);
 const table=s.blocks.find(b=>b.type==='table'&&b.caption.includes('20.5'));assert.equal(table.headers.length,3);assert.equal(table.rows.length,4);assert.match(table.rows[1][1],/κ-рецептора/);assert.match(table.rows[2][0],/MDPV/);assert.match(table.rows[3][2],/кома/);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['5-HT2A','8–14 часов','72 часов','9%','B12','гомоцистеин','4,2%','40%','38 в 2020','6–12 месяцев','1,4%','хлорпромазина','фентоламином','Ling et al., 2022'])assert(text.toLowerCase().includes(term.toLowerCase()),term);assert.equal(c.sections[4].blocks.length,3);assert.equal(c.sections[4].summary.length,1);assert(c.sections[4].blocks[1].text.includes('https://www.nice.org.uk/guidance/cg115'));
 const state=StudyModel.emptyState();state.completed[s.id]={revision:4,source:book.source.sha256};state.notes[s.id]='Заметки неполной версии';assert.equal(StudyModel.isRead(s,state,book),false);assert.equal(StudyModel.stats(book,state).partial,0);assert.equal(state.notes[s.id],'Заметки неполной версии');assert.equal(StudyModel.stats(book,state).translated,207);
});

test('chapter21 introduction and suicide preserve nested risk factors and evidence limits',async()=>{
 const c=book.chapters.find(c=>c.number===21);assert(c.sections.slice(0,2).every(StudyModel.ready));assert(c.sections.slice(6).every(s=>s.status==='pending'));assert.deepEqual([c.sections[0].source.pdfStart,c.sections[0].source.pdfEnd],[598,599]);assert.deepEqual([c.sections[1].source.pdfStart,c.sections[1].source.pdfEnd],[599,604]);assert.equal(c.sections[0].summary.length,3);assert.equal(c.sections[1].summary.length,10);
 const f=c.sections[0].blocks.find(b=>b.type==='figure'),svg=await fs.readFile(new URL('../dist/'+f.src,import.meta.url),'utf8');assert(svg.includes('<svg'));assert(!/<script|onload=/i.test(svg));assert.equal((svg.match(/<polyline /g)||[]).length,14);assert.match(f.caption,/ChatGPT/);assert.match(f.caption,/не верифицированы/);
 const s=c.sections[1],box=s.blocks.find(b=>b.type==='box');assert.deepEqual(box.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[3,7,5,8,4,5,4]);assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[5,4]);assert.equal(s.blocks.filter(b=>b.type==='heading').length,17);
 const text=s.blocks.map(StudyModel.blockText).join(' ');for(const term of ['58%','21%','25–29%','55–99%','55–86%','17–36%','7,7','3,5','44 раза','5,6%','18 403','1673','27%','24%','70%','918','276','39','400','стресс–диатез','Cramer, R. J.'])assert(text.includes(term),term);assert.match(s.blocks.at(-1).text,/Galante et al., 2022/);assert.equal(StudyModel.stats(book,StudyModel.emptyState()).translated,207);
});

test('chapter21 assessment, care and prevention keep complete source checklists',()=>{
 const c=book.chapters.find(c=>c.number===21),[a,m,r]=c.sections.slice(2,5);assert(c.sections.slice(0,5).every(StudyModel.ready));assert(c.sections.slice(6).every(s=>s.status==='pending'));assert.deepEqual([a.source.pdfStart,a.source.pdfEnd,m.source.pdfStart,m.source.pdfEnd,r.source.pdfStart,r.source.pdfEnd],[605,606,606,607,607,608]);assert.deepEqual([a.summary.length,m.summary.length,r.summary.length],[5,6,4]);assert.equal(a.blocks.find(b=>b.type==='list').items.length,9);
 const boxes=m.blocks.filter(b=>b.type==='box');assert.equal(boxes[0].blocks[0].items.length,7);assert.deepEqual(boxes[1].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[4,5,4,4]);assert.equal(m.blocks.find(b=>b.type==='list').items.length,3);assert.deepEqual(r.blocks.find(b=>b.type==='box').blocks.filter(b=>b.type==='list').map(b=>b.items.length),[3,3,3]);assert.equal(r.blocks.find(b=>b.type==='list').items.length,5);
 const text=[a,m,r].flatMap(s=>s.blocks).map(StudyModel.blockText).join(' ');for(const term of ['40–60%','Polihronis et al., 2022','Brand et al., 2023','Velupillai et al., 2019','конфиденциальности']){assert(text.includes(term),term);}assert.match(a.blocks.at(-1).text,/плохо различают/);assert.match(m.blocks.at(-1).text,/поиск виновного/);assert.match(r.blocks.at(-1).text,/низкая положительная/);
});

test('nonfatal selfharm keeps definitions, motives and limitations of treatment evidence',()=>{const s=book.chapters.find(c=>c.number===21).sections[5];assert.equal(s.status,'translated');assert.deepEqual([s.source.pdfStart,s.source.pdfEnd],[608,612]);assert.equal(s.summary.length,8);const boxes=s.blocks.filter(b=>b.type==='box');assert.equal(boxes.length,2);assert.equal(boxes[0].blocks.filter(b=>b.type==='heading'&&b.level===4).length,9);assert.deepEqual(boxes[1].blocks.filter(b=>b.type==='list').map(b=>b.items.length),[5,4,4]);assert.deepEqual(s.blocks.filter(b=>b.type==='list').map(b=>b.items.length),[3,4]);const text=s.blocks.map(StudyModel.blockText).join(' ');for(const x of ['низкой социально-экономической депривацией','90%','75%','6%','4 на 1000','129','45 исследований','DBT-A','Witt et al., 2021','8%'])assert(text.includes(x),x);assert.match(s.blocks.at(-1).text,/Geulayov et al., 2022a/);});
