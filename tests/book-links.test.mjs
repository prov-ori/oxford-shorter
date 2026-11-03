import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {bookLinks} from '../content/book-links.mjs';
import {compileBookLinks} from '../tools/compile-book-links.mjs';
const read=async name=>JSON.parse(await fs.readFile(new URL('../dist/data/'+name+'.json',import.meta.url),'utf8'));
const books={fish:await read('fish'),oxford:await read('book')},bank=await read('quiz-bank');
test('every bridge resolves both exact source paragraphs and an active task in a compared section',()=>{
 const compiled=compileBookLinks(bookLinks,books,bank);assert.equal(compiled.topics.length,12);
 for(const t of compiled.topics){for(const [key,s]of Object.entries(t.sources)){const original=books[key].chapters.flatMap(c=>c.sections).find(x=>x.id===s.sectionId);assert.equal(original.blocks[s.block].text,s.quote);assert.equal(s.sourceSha256,books[key].source.sha256);assert.match(s.href,/&block=\d+$/);assert.equal(s.quoteSha256.length,64);}assert.match(t.task.href,/question=/);assert(!('correctOptionId'in t.task));}
});
test('source changes, duplicate ids and retired/outside tasks fail the build instead of silently mislinking',()=>{
 const broken=structuredClone(bookLinks);broken[0].fish.match='This exact evidence no longer exists in the translation';assert.throws(()=>compileBookLinks(broken,books,bank),/evidence/);
 assert.throws(()=>compileBookLinks([...bookLinks,bookLinks[0]],books,bank),/duplicate/);
 const retired=structuredClone(bank);retired.retiredQuestionIds.push(bookLinks[0].taskId);assert.throws(()=>compileBookLinks(bookLinks,books,retired),/retired/);
 const wrong=structuredClone(bookLinks);wrong[0].taskId='ox-q028';assert.throws(()=>compileBookLinks(wrong,books,bank),/outside/);
});
test('generated public payload matches compiled editorial sources and is in the offline shell',async()=>{
 const payload=await read('book-links');assert.deepEqual(payload,compileBookLinks(bookLinks,books,bank));
 const raw=await fs.readFile(new URL('../dist/data/offline-assets.js',import.meta.url),'utf8'),shell=JSON.parse(raw.slice(raw.indexOf('=')+1,-1));
 for(const p of ['connections.html','book-links.css','book-links.js','data/book-links.js','data/book-links.json'])assert(shell.assets.includes(p),p+' missing offline');
});
