import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import '../dist/model.js';
import {practice} from '../content/practice-content.mjs';
const root=new URL('../dist/',import.meta.url),hash=t=>createHash('sha256').update(t).digest('hex');
await fs.mkdir(new URL('data/chapters/',root),{recursive:true});
const catalogue={schemaVersion:1,books:{}};
for(const [key,file]of [['oxford','book'],['fish','fish']]){
 const book=JSON.parse(await fs.readFile(new URL('data/'+file+'.json',root),'utf8')),manifest=structuredClone(book),index=[];
 manifest.lazyContent=true;
 for(const chapter of manifest.chapters){
  const full=book.chapters.find(c=>c.id===chapter.id),raw=JSON.stringify(full),digest=hash(raw),path='data/chapters/'+key+'-'+chapter.id+'-'+digest.slice(0,12)+'.json';
  await fs.writeFile(new URL(path,root),raw);chapter.contentFile=path;chapter.contentSha256=digest;
  const assets=new Set();const walk=b=>{if(b.type==='figure')assets.add(b.src);if(b.blocks)b.blocks.forEach(walk);};full.sections.forEach(s=>s.blocks.forEach(walk));chapter.assets=[...assets];
  chapter.sections=full.sections.map(s=>{const meta={...s,blocks:[],contentFile:path,contentSha256:digest};s.blocks.forEach((b,block)=>index.push({section:s.id,chapter:full.id,block,title:s.title,text:StudyModel.blockText(b)}));return meta;});
 }
 await fs.writeFile(new URL('data/'+file+'-manifest.json',root),JSON.stringify(manifest));
 await fs.writeFile(new URL('data/'+file+'-manifest.js',root),'window.STUDY_BOOK_ID='+JSON.stringify(book.id)+';window.STUDY_BOOK='+JSON.stringify(manifest)+';');
 const indexRaw=JSON.stringify(index),searchPath='data/search-'+key+'-'+hash(indexRaw).slice(0,12)+'.json';
 await fs.writeFile(new URL(searchPath,root),indexRaw);await fs.writeFile(new URL('data/search-'+key+'.json',root),indexRaw);
 catalogue.books[key]={id:book.id,title:book.titleRu||book.title,edition:book.edition,revision:book.revision,source:book.source,manifest:'data/'+file+'-manifest.json',search:searchPath,reader:key==='oxford'?'index.html':'fish.html',chapters:manifest.chapters.map(c=>({id:c.id,number:c.number,title:c.title,contentFile:c.contentFile,contentSha256:c.contentSha256,assets:c.assets,sections:c.sections.map(s=>({id:s.id,title:s.title,source:s.source,revision:s.revision,status:s.status}))}))};
}
await fs.writeFile(new URL('data/catalogue.json',root),JSON.stringify(catalogue));
const bank=JSON.parse(await fs.readFile(new URL('data/quiz-bank.json',root),'utf8')),retired=new Set(bank.retiredQuestionIds||[]),active=bank.questions.filter(q=>!retired.has(q.id));
const compiled=structuredClone(practice),booksByKey={};for(const [key,file]of [['oxford','book'],['fish','fish']])booksByKey[key]=JSON.parse(await fs.readFile(new URL('data/'+file+'.json',root),'utf8'));
for(const group of ['atlas','cases','audio','timelines','explain'])for(const item of compiled[group]){
 item.sources=item.topics.map(topic=>{const q=bank.questions.find(q=>q.topic===topic);if(!q)throw Error('Practice source missing: '+topic);const s=booksByKey[q.book].chapters.flatMap(c=>c.sections).find(s=>s.id===q.sectionId),block=s.blocks.findIndex(b=>StudyModel.blockText(b).includes(q.sourceEvidence));if(block<0)throw Error('Practice evidence mismatch');return{book:q.book==='oxford'?'Oxford':'Fish',edition:booksByKey[q.book].edition,sourceRevision:booksByKey[q.book].revision,sectionId:s.id,block,title:s.title,pdfStart:s.source.pdfStart,pdfEnd:s.source.pdfEnd,quote:q.sourceEvidence,href:catalogue.books[q.book].reader+'#section='+s.id+'&block='+block};});
}
await fs.writeFile(new URL('data/practice.js',root),'window.PRACTICE_CONTENT='+JSON.stringify(compiled)+';');
await fs.writeFile(new URL('data/practice.json',root),JSON.stringify(compiled));
const coverage=Object.entries(catalogue.books).flatMap(([key,b])=>b.chapters.filter(c=>c.number).map(c=>({book:key,chapter:c.number,title:c.title,sections:c.sections.map(s=>({id:s.id,title:s.title,pages:s.source.pdfEnd-s.source.pdfStart+1,questions:active.filter(q=>q.book===key&&q.sectionId===s.id).map(q=>({id:q.id,topic:q.topic,difficulty:q.difficulty})),href:b.reader+'#section='+s.id}))})));
await fs.writeFile(new URL('data/coverage.json',root),JSON.stringify(coverage));
await fs.mkdir(new URL('assets/',root),{recursive:true});
await fs.copyFile(new URL('../content/brain-mri-provenance.json',root),new URL('assets/brain-mri-v2.json',root));
await import('./build-systems.mjs');
const shell=['model-selection.js','systems-content.js','systems-model.js','systems-geometry.js','systems-state.js','systems-export.js','systems-lab.js','assets/basal-mri-v1.json','assets/basal-mri-v1.bin','micro-mesh.js','micro-view.js','synapse-geometry.js','synapse-state.js','synapse-view3d.js','biophysics.js','neuro-sim.js','neuron-geometry.js','neuron-view3d.js','brain-mri.js','assets/brain-mri-v2.json','assets/brain-mri-v2.bin','neuro.html','neuro.css','neuro.js','neuro-model.js','neuro-content.js','evidence.js','study.html','practice.html','index.html','fish.html','quiz.html','lab.html','library.html','styles.css','quiz.css','platform.css','app.js','model.js','content-loader.js','quiz.js','quiz-model.js','platform-model.js','common.js','search-client.js','search-worker.js','study.js','practice.js','manifest.webmanifest','assets/app-icon.svg','assets/app-icon-192.png','assets/app-icon-512.png','data/book-manifest.js','data/fish-manifest.js','data/book-manifest.json','data/fish-manifest.json','data/catalogue.json','data/practice.js','data/practice.json','data/coverage.json','data/quiz-bank.js','data/quiz-bank.json'];
const shellVersion=hash(Buffer.concat(await Promise.all(shell.map(p=>fs.readFile(new URL(p,root)))))).slice(0,16);
await fs.writeFile(new URL('data/offline-assets.js',root),'self.STUDY_OFFLINE='+JSON.stringify({version:shellVersion,assets:shell})+';');
console.log('Generated chapter manifests, verified content shards and search indexes.');
