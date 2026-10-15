import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import '../dist/model.js';
import {entries,additions,translations} from '../content/translation-index-complete.mjs';
import {entries as prior} from '../content/translation-index-b.mjs';
const book=JSON.parse(await fs.readFile(new URL('../dist/data/book.json',import.meta.url),'utf8'));
test('complete index preserves prior text, all three hierarchy levels, source anomalies and honest review status',()=>{
 const s=book.chapters.find(c=>c.id==='index').sections[0],byId=new Map(entries.map(e=>[e.id,e]));
 assert.deepEqual(entries.slice(0,321),prior);assert.equal(entries.length,4885);assert.equal(additions.length,4564);
 assert.equal(byId.size,4885);assert.deepEqual([0,1,2].map(level=>entries.filter(e=>e.level===level).length),[1112,3294,479]);
 for(const e of additions){assert(e.translation.trim());assert(!e.original.includes('(cont.)'));if(e.level)assert.equal(byId.get(e.parent)?.level,e.level-1);else assert.equal(e.parent,null);}
 assert(additions.slice(0,2).every(e=>e.parent==='idx-0296'));
 assert.equal(entries.at(-1).original,'zopiclone');assert.equal(entries.at(-1).refs,'699');assert.equal(entries.at(-1).page,879);
 assert(entries.some(e=>e.original==='5-HT2 receptor antagonists'&&e.refs==='703'));
 assert(entries.some(e=>e.original==='and individuals with DID'&&e.refs==='17–33-6'));
 assert(entries.some(e=>e.original==='chromosome 21'&&e.refs==='107'));
 assert(entries.some(e=>e.original==='Covid-19'&&e.refs==='618–36'));
 assert(entries.some(e=>e.original==='delirium'&&e.translation==='Делирий'));
 assert(entries.some(e=>e.original==='Young Mania Rating Scale (YMRS)'&&e.translation.includes('Янга')));
 assert.equal(s.status,'translated');assert.equal(s.revision,4);assert.equal(s.coverage,undefined);assert.equal(s.reviewStatus,'independent-clinical-review-pending');
 assert.match(s.blocks[0].text,/880–881 пустые/);assert.match(s.blocks[1].blocks[0].text,/машинной помощью/);
 assert.equal(s.blocks.filter(b=>b.type==='heading'&&b.level===3).length,1112);
 assert.equal(s.blocks.filter(b=>b.type==='list').flatMap(b=>b.items).length,3773);
 const rendered=s.blocks.map(StudyModel.blockText).join('\n');for(const e of entries){assert(rendered.includes(e.original),e.id);assert(rendered.includes(e.translation),e.id);if(e.refs)assert(rendered.includes(e.refs),e.id);}
 const state=StudyModel.emptyState();state.notes[s.id]='Заметки к частичному указателю';state.completed[s.id]={revision:3,source:book.source.sha256};assert(!StudyModel.isRead(s,state,book));assert(!StudyModel.isPartRead(s,state,book));assert.equal(state.notes[s.id],'Заметки к частичному указателю');
 state.completed[s.id].revision=4;assert(StudyModel.isRead(s,state,book));assert.deepEqual([StudyModel.stats(book,state).translated,StudyModel.stats(book,state).partial,StudyModel.stats(book,state).read],[267,0,1]);
 assert.equal(translations['index-main'].status,'translated');
});
