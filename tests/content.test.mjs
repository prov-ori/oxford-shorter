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
  assert.equal(done.length,68);
  assert.deepEqual(done.map(s=>s.id),book.chapters.filter(c=>c.id==='front'||[1,2,3,4,5,6,7,8].includes(c.number)).flatMap(c=>c.sections.map(s=>s.id)));
  assert.equal(done.at(-1).id,'ch08-s09');
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
 assert.equal(c.sections[5].source.pdfStart,191);assert.equal(book.chapters.find(c=>c.number===9).sections[0].status,'pending');
 const panic=c.sections[4].blocks.map(StudyModel.blockText).join(' ');
 for(const value of ['2,7%','4,7%','40%','30 дней','5 мг','шести месяцев','12 недель'])assert(panic.includes(value),value);
});
