import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/model.js';
import {fixture} from './fixture.mjs';
const M = globalThis.StudyModel;
test('source-linked outline and nested sections are accepted', () => assert.equal(M.flatten(M.validateBook(fixture)).length,3));
test('source, page ranges, unique IDs and reviewed attribution are required', () => {
  for (const mutate of [b=>b.source=null,b=>b.chapters[0].sections[0].source.pdfEnd=6,b=>b.chapters[0].sections[1].id='test-first',b=>b.chapters[0].sections[0].status='reviewed',b=>b.chapters[0].sections[0].level=3,b=>b.chapters[0].sections[0].summary=[]]) {
    const b=structuredClone(fixture); mutate(b); assert.throws(()=>M.validateBook(b));
  }
});
test('unsupported blocks and remote images are rejected', () => {
  const b=structuredClone(fixture); b.chapters[0].sections[0].blocks=[{type:'html',text:'<script />'}]; assert.throws(()=>M.validateBook(b));
  b.chapters[0].sections[0].blocks=[{type:'figure',src:'https://example.com/a.png',caption:'a',alt:'a'}]; assert.throws(()=>M.validateBook(b));
});
test('pending sections cannot contain unmarked translations', () => { const b=structuredClone(fixture); b.chapters[0].sections[1].blocks=[{type:'paragraph',text:'text'}]; assert.throws(()=>M.validateBook(b)); });
test('reading progress tracks only checked sections of the same source and revision', () => {
  const s=M.emptyState(); s.completed['test-first']={revision:1,source:fixture.source.sha256}; s.completed['test-last']={revision:1,source:fixture.source.sha256};
  assert.deepEqual(M.stats(fixture,s),{total:3,translated:1,read:1,partial:0,partialRead:0,draft:1});
  const b=structuredClone(fixture); b.chapters[0].sections[0].revision++; assert.equal(M.stats(b,s).read,0);
  b.chapters[0].sections[0].revision=1; b.source.sha256='b'.repeat(64); assert.equal(M.stats(b,s).read,0);
});
test('notes survive backup roundtrip and incompatible copies fail', () => { const s=M.emptyState();s.notes['test-first']='Личная заметка';assert.deepEqual(M.cleanState(JSON.parse(JSON.stringify(s))),s);assert.throws(()=>M.cleanState({...s,bookId:'other'}));assert.throws(()=>M.cleanState({...s,notes:{'test-first':42}})); });
test('speech chunks are bounded and preserve text including long tokens', () => { const txt='Раздел '.repeat(200);const parts=M.chunks(txt);assert(parts.every(p=>p.length<=220));assert.equal(parts.join(' '),txt.trim()); assert.equal(M.chunks('а'.repeat(500)).join(''),'а'.repeat(500)); });
test('empty scaffold does not claim the whole outline', () => { const b={...fixture,source:null,chapters:[],outlineComplete:false};assert.equal(M.stats(M.validateBook(b),M.emptyState()).total,0);assert.throws(()=>M.validateBook({...b,outlineComplete:true})); });

function partialBook() {
  const b=structuredClone(fixture), s=b.chapters[0].sections[0];
  s.status='partial';s.coverage={pdfStart:s.source.pdfStart,pdfEnd:s.source.pdfStart,printedPages:'1',through:'До следующего подраздела.',next:'Следующий подраздел.'};
  return b;
}
test('partial translations require checked content and a precise source boundary',()=>{
  M.validateBook(partialBook());
  for(const mutate of [s=>delete s.coverage,s=>s.coverage.pdfEnd=999,s=>s.coverage.pdfStart=0,s=>s.coverage.pdfEnd=1.5,s=>s.coverage.through='',s=>s.coverage.next='',s=>s.summary=[],s=>delete s.checkedAgainstSourceAt]){
    const b=partialBook();mutate(b.chapters[0].sections[0]);assert.throws(()=>M.validateBook(b));
  }
});
test('reading a partial translation never claims a complete section and expires on additions',()=>{
  const b=partialBook(),s=b.chapters[0].sections[0],state=M.emptyState();state.notes[s.id]='Сохранить вопрос';state.completed[s.id]={revision:s.revision,source:b.source.sha256};
  assert(M.isPartRead(s,state,b));assert(!M.isRead(s,state,b));
  assert.deepEqual(M.stats(b,state),{total:3,translated:0,read:0,partial:1,partialRead:1,draft:1});
  s.revision++;assert(!M.isPartRead(s,state,b));assert.equal(state.notes[s.id],'Сохранить вопрос');
  s.status='translated';assert(!M.isRead(s,state,b));
});
