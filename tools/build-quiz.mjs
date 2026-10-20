import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import '../dist/quiz-model.js';
import '../dist/model.js';
const root=new URL('../',import.meta.url),read=async name=>JSON.parse(await fs.readFile(new URL(name,root),'utf8'));
const sourceBooks={oxford:await read('dist/data/book.json'),fish:await read('dist/data/fish.json')};
const questions=[...await read('content/questions-oxford.json'),...await read('content/questions-fish.json')];
const books=Object.fromEntries(Object.entries(sourceBooks).map(([key,b])=>[key,{id:b.id,shortTitle:key==='fish'?'Фиш':'Oxford',title:b.titleRu||b.title,edition:b.edition,sourceSha256:b.source.sha256,sourceRevision:b.revision,chapters:b.chapters.filter(c=>Number.isInteger(c.number)).map(c=>({number:c.number,title:c.title.replace(/^\d+\.\s*/, '')}))}]));
// Content can grow without invalidating compatible saved attempts. Changed keys/meaning need a migration.
const bank={schemaVersion:1,revision:1,contentRevision:2,title:'Проверка знаний · Oxford и Fish',books,questions};
KnowledgeModel.validateBank(bank);
const frozen=await read('content/quiz-v1-fingerprints.json');
if(frozen.compatibilityRevision!==bank.revision)throw Error('Question compatibility baseline mismatch');
for(const [id,hash]of Object.entries(frozen.questions)){
 const q=questions.find(q=>q.id===id);
 if(!q||createHash('sha256').update(JSON.stringify(q)).digest('hex')!==hash)throw Error(id+': published question changed; provide an explicit compatibility migration');
}
for(const q of questions){
 const chapter=sourceBooks[q.book].chapters.find(c=>c.number===q.chapter),section=chapter.sections.find(s=>s.id===q.sectionId);
 if(!section)throw Error(q.id+': source section does not belong to chapter');
 if(['pdfStart','pdfEnd','printedPages'].some(key=>q.source[key]!==section.source[key]))throw Error(q.id+': source range mismatch');
 if(!section.blocks.some(block=>StudyModel.blockText(block).includes(q.sourceEvidence)))throw Error(q.id+': supporting excerpt not found verbatim in source section');
}
for(const [key,b]of Object.entries(books))for(const ch of b.chapters)if(!questions.some(q=>q.book===key&&q.chapter===ch.number))throw Error(key+': chapter '+ch.number+' has no questions');
const output=JSON.stringify(bank);
await fs.writeFile(new URL('dist/data/quiz-bank.js',root),'// Generated from source-linked question banks.\nwindow.KNOWLEDGE_BANK='+output+';\n');
await fs.writeFile(new URL('dist/data/quiz-bank.json',root),JSON.stringify(bank,null,2)+'\n');
console.log(JSON.stringify({quizQuestions:questions.length,oxford:questions.filter(q=>q.book==='oxford').length,fish:questions.filter(q=>q.book==='fish').length,chapters:Object.values(books).reduce((n,b)=>n+b.chapters.length,0)}));
