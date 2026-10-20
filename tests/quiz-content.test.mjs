import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import '../dist/quiz-model.js';
import '../dist/model.js';
const read=async p=>JSON.parse(await fs.readFile(new URL('../'+p,import.meta.url),'utf8'));
const bank=await read('dist/data/quiz-bank.json'),sources={oxford:await read('dist/data/book.json'),fish:await read('dist/data/fish.json')};
test('question bank covers every chapter of both actual editions with source-backed evidence',()=>{
 KnowledgeModel.validateBank(bank);assert.equal(bank.questions.length,92);
 for(const [book,b]of Object.entries(sources)){
  assert.equal(bank.books[book].sourceSha256,b.source.sha256);assert.equal(bank.books[book].sourceRevision,b.revision);
  const expected=book==='oxford'?2:4;
  for(const chapter of b.chapters.filter(c=>c.number))assert.equal(bank.questions.filter(q=>q.book===book&&q.chapter===chapter.number).length,expected,book+' '+chapter.number);
 }
 for(const q of bank.questions){
  const chapter=sources[q.book].chapters.find(c=>c.number===q.chapter),section=chapter.sections.find(s=>s.id===q.sectionId);assert(section,q.id);
  assert.deepEqual(q.source,{pdfStart:section.source.pdfStart,pdfEnd:section.source.pdfEnd,printedPages:section.source.printedPages},q.id);
  assert(section.blocks.some(b=>StudyModel.blockText(b).includes(q.sourceEvidence)),q.id+' evidence');
  assert(q.sourceEvidence.length>=60&&q.sourceEvidence.length<=350,q.id+' bounded excerpt');
  assert(q.options.every(o=>o.text.trim().length>=3),q.id);assert(q.explanation.length>=60,q.id+' explanation');
 }
 assert(bank.questions.filter(q=>q.difficulty!=='recall').length>bank.questions.length/2);
});
test('generated browser bank matches canonical source data and page links are present throughout the library',async()=>{
 const script=await fs.readFile(new URL('../dist/data/quiz-bank.js',import.meta.url),'utf8');assert(script.includes('window.KNOWLEDGE_BANK='+JSON.stringify(bank)));
 for(const p of ['index.html','fish.html','library.html','lab.html']){const html=await fs.readFile(new URL('../dist/'+p,import.meta.url),'utf8');assert(html.includes('href="quiz.html"'),p+' discovery');}
 const html=await fs.readFile(new URL('../dist/quiz.html',import.meta.url),'utf8');assert(html.includes('начальный авторский банк'));assert(html.includes('Синхронизации между устройствами нет'));assert(!html.includes('data/book.js'));assert(!html.includes('data/fish.js'));
});
