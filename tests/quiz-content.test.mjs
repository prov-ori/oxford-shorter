import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import '../dist/quiz-model.js';
import '../dist/model.js';
const read=async p=>JSON.parse(await fs.readFile(new URL('../'+p,import.meta.url),'utf8'));
const bank=await read('dist/data/quiz-bank.json'),sources={oxford:await read('dist/data/book.json'),fish:await read('dist/data/fish.json')};
test('question bank covers every chapter of both actual editions with source-backed evidence',()=>{
 KnowledgeModel.validateBank(bank);assert.equal(bank.questions.length,236);
 for(const [book,b]of Object.entries(sources)){
  assert.equal(bank.books[book].sourceSha256,b.source.sha256);assert.equal(bank.books[book].sourceRevision,b.revision);
  const expected=book==='oxford'?6:8;
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
 assert.equal(new Set(bank.questions.map(q=>q.stem.toLowerCase().replace(/\s+/g,' ').trim())).size,bank.questions.length);
});
test('content expansion preserves every original question and keeps existing attempts and backups readable',async()=>{
 const frozen=await read('content/quiz-v1-fingerprints.json');assert.equal(Object.keys(frozen.questions).length,200);assert.equal(bank.contentRevision,4);assert.equal(bank.revision,frozen.compatibilityRevision);
 for(const [id,hash]of Object.entries(frozen.questions)){const q=bank.questions.find(q=>q.id===id);assert(q,id);assert.equal(createHash('sha256').update(JSON.stringify(q)).digest('hex'),hash,id+' original content');}
 for(const size of [92,164,200]){
 const legacy={...bank,questions:bank.questions.filter(q=>Object.hasOwn(frozen.questions,q.id)&&(size===200||Number(q.id.split('q')[1])<=(q.book==='oxford'?(size===92?52:104):(size===92?40:60))))};delete legacy.contentRevision;assert.equal(legacy.questions.length,size);
 const time=1700000000000;let state=KnowledgeModel.start(KnowledgeModel.emptyState(legacy),legacy,{mode:'training',count:5},time,()=>0.31);
 let question=legacy.questions.find(q=>q.id===state.active.questionIds[0]);state=KnowledgeModel.choose(state,legacy,question.correctOptionId,time+1);state=KnowledgeModel.check(state,legacy,time+2);state=KnowledgeModel.finish(state,legacy,time+3);
 const originalScore=KnowledgeModel.result(state.history[0],legacy);
 state=KnowledgeModel.start(state,legacy,{mode:'exam',count:10,minutes:20},time+10,()=>0.62);question=legacy.questions.find(q=>q.id===state.active.questionIds[0]);state=KnowledgeModel.choose(state,legacy,question.correctOptionId,time+11);
 const active=structuredClone(state.active),events=structuredClone(state.events),saved=KnowledgeModel.backup(state),restored=KnowledgeModel.importBackup(saved,bank);
 assert.deepEqual(restored.active,active);assert.deepEqual(restored.events,events);assert.deepEqual(KnowledgeModel.result(restored.history[0],bank),originalScore);assert.deepEqual(KnowledgeModel.stats(restored,bank),KnowledgeModel.stats(state,legacy));
 assert.equal(KnowledgeModel.pool(bank,{scope:'all'},restored,time).length,236);
 assert(KnowledgeModel.select(bank,{book:'oxford',chapters:['oxford:1'],count:'all'},restored,time).some(q=>!Object.hasOwn(frozen.questions,q.id)));
 }
});
test('generated browser bank matches canonical source data and page links are present throughout the library',async()=>{
 const script=await fs.readFile(new URL('../dist/data/quiz-bank.js',import.meta.url),'utf8');assert(script.includes('window.KNOWLEDGE_BANK='+JSON.stringify(bank)));
 for(const p of ['index.html','fish.html','library.html','lab.html']){const html=await fs.readFile(new URL('../dist/'+p,import.meta.url),'utf8');assert(html.includes('href="quiz.html"'),p+' discovery');}
 const html=await fs.readFile(new URL('../dist/quiz.html',import.meta.url),'utf8');assert(html.includes('начальный авторский банк'));assert(html.includes('Синхронизации между устройствами нет'));assert(!html.includes('data/book.js'));assert(!html.includes('data/fish.js'));
});
