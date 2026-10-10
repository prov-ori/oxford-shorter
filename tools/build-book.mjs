import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as batch001 from '../content/translation-001.mjs';
import * as batch003 from '../content/translation-003.mjs';
import * as chapter02 from '../content/translation-ch02.mjs';
import * as chapter03a from '../content/translation-ch03a.mjs';
import * as chapter03b from '../content/translation-ch03b.mjs';
import * as chapter04 from '../content/translation-ch04.mjs';
import * as chapter05a from '../content/translation-ch05a.mjs';
import * as chapter05b from '../content/translation-ch05b.mjs';
import * as chapter06a from '../content/translation-ch06a.mjs';
import * as chapter06b from '../content/translation-ch06b.mjs';
import * as chapter06c from '../content/translation-ch06c.mjs';
import * as chapter07 from '../content/translation-ch07.mjs';
import * as chapter08a from '../content/translation-ch08a.mjs';
import * as chapter08b from '../content/translation-ch08b.mjs';
import * as chapter08c from '../content/translation-ch08c.mjs';
import * as chapter08d from '../content/translation-ch08d.mjs';
import * as chapter08e from '../content/translation-ch08e.mjs';
import * as chapter08f from '../content/translation-ch08f.mjs';
import * as chapter09a from '../content/translation-ch09a.mjs';
import * as chapter09b from '../content/translation-ch09b.mjs';
const batches=[batch001,batch003,chapter02,chapter03a,chapter03b,chapter04,chapter05a,chapter05b,chapter06a,chapter06b,chapter06c,chapter07,chapter08a,chapter08b,chapter08c,chapter08d,chapter08e,chapter08f,chapter09a,chapter09b];
const translations=Object.assign({},...batches.map(b=>b.translations));
const glossary=[...new Map(batches.flatMap(b=>b.glossary||[]).map(g=>[g.en.toLowerCase(),g])).values()];
import '../dist/model.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const read=name=>fs.readFile(path.join(root,name),'utf8');
const source=JSON.parse(await read('content/source-outline.json'));
const normalize=s=>s.toLowerCase().replace(/[–—]/g,'-').replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim();
const dictionary=new Map((await read('content/outline-ru.tsv')).trim().split(/\r?\n/).map(line=>{const [en,ru]=line.split('|');return [normalize(en),ru];}));
const names=[
 'Признаки и симптомы психических расстройств','Классификация','Психиатрическое обследование','Этика и гражданское право','Этиология','Доказательные подходы в психиатрии','Реакции на стрессовые переживания','Тревожные и обсессивно-компульсивные расстройства','Депрессия','Биполярное расстройство','Шизофрения','Параноидные симптомы и синдромы','Расстройства пищевого поведения, сна и бодрствования и сексуальные расстройства','Деменция, делирий и другие нейропсихиатрические расстройства','Личность и расстройства личности','Детская и подростковая психиатрия','Расстройства интеллектуального развития','Судебная психиатрия','Психиатрия пожилого возраста','Злоупотребление алкоголем и психоактивными веществами','Самоубийство и самоповреждение','Психиатрия и медицина','Общественное и глобальное психическое здоровье','Психологические методы лечения','Лекарственные средства и другие физические методы лечения','Психиатрические службы'
];
const originals=['Signs and symptoms of psychiatric disorders','Classification','Assessment','Ethics and civil law','Aetiology','Evidence-based approaches to psychiatry','Reactions to stressful experiences','Anxiety and obsessive–compulsive disorders','Depression','Bipolar disorder','Schizophrenia','Paranoid symptoms and syndromes','Eating, sleep–wake, and sexual disorders','Dementia, delirium, and other neuropsychiatric disorders','Personality and personality disorder','Child and adolescent psychiatry','Disorders of intellectual development','Forensic psychiatry','Psychiatry of the elderly','The misuse of alcohol and drugs','Suicide and self-harm','Psychiatry and medicine','Public mental health and global mental health','Psychological treatments','Drugs and other physical treatments','Psychiatric services'];
function section(id,title,originalTitle,start,end,printedPages,extra={}) {
 return {id,title,originalTitle,level:1,revision:1,status:'pending',source:{pdfStart:start,pdfEnd:end,printedPages},blocks:[],summary:[],...extra,...translations[id]};
}
const chapters=[{id:'front',kind:'frontmatter',title:'Перед началом',originalTitle:'Front matter',sections:[
 section('front-title','Титульный лист','Title page',2,4,'i–iii'),
 section('front-publication','Выходные данные и примечание издательства','Copyright page',5,5,'iv'),
 section('front-preface','Предисловие к восьмому изданию','Preface to the eighth edition',6,6,'v')
]}];
for(let num=1;num<=26;num++){
 const rows=source.filter(r=>r.chapter===num);const prefix='ch'+String(num).padStart(2,'0');
 const end=source.find(r=>r.chapter===num+1)?.pdfPage-1 || 787;
 const sections=rows.map((row,i)=>{
  const title=dictionary.get(normalize(row.title));if(!title)throw new Error('Missing heading translation: '+row.title);
  const next=rows[i+1];const last=next ? (next.top<85 ? Math.max(row.pdfPage,next.pdfPage-1) : next.pdfPage) : end;
  const id=prefix+'-s'+String(i+1).padStart(2,'0');
  return section(id,title,row.title,row.pdfPage,last,`${row.pdfPage-9}${last!==row.pdfPage?'–'+(last-9):''}`,{sourceAnchor:{top:row.top,bottom:row.bottom}});
 });
 chapters.push({id:prefix,number:num,title:`${num}. ${names[num-1]}`,originalTitle:originals[num-1],sections});
}
chapters.push({id:'references',kind:'backmatter',title:'Список литературы',originalTitle:'References',sections:[section('references-main','Список литературы','References',788,849,'779–840')]});
chapters.push({id:'index',kind:'backmatter',title:'Предметный указатель',originalTitle:'Index',sections:[section('index-main','Предметный указатель','Index',850,881,'841–872')]});
// Accurate, visually verified extents for the completed material.
Object.assign(chapters[1].sections[0].source,{pdfEnd:10,printedPages:'1'});
Object.assign(chapters[1].sections[1].source,{pdfEnd:13,printedPages:'2–4'});
const book={schemaVersion:1,id:'shorter-oxford-psychiatry-8-ru',revision:9,title:'Shorter Oxford Textbook of Psychiatry',titleRu:'Краткий Оксфордский учебник психиатрии',edition:'8-е издание · 2026',source:{filename:'v4o9kdwe8i3gfuy.pdf',sha256:'fab335843a3b7b270fea2fe8d110eba9cebb69f6a6305bf1baa9fb8471b5a14d',pageCount:881,bibliographicTitle:'Shorter Oxford Textbook of Psychiatry, 8th edition',authors:['Paul Harrison','Philip Cowen','Mina Fazel','Kamaldeep Bhui'],isbn:'9780192871053',publishedYear:2026},outlineComplete:true,outlineScope:'major-sections',outlineNote:'Все 26 глав, их основные разделы, рекомендуемая литература, список литературы и указатель. Вложенные заголовки сохраняются внутри переведённых разделов.',translationBoundary:'Предварительные материалы и первые восемь глав переведены полностью. В главе 9 готовы первые шесть разделов: введение, клинические проявления, культурные факторы, классификация, дифференциальная диагностика и эпидемиология. Перевод до печатной стр.204 (PDF213), перед разделом «Этиология депрессии».',chapters,glossary};
StudyModel.validateBook(book);
const json=JSON.stringify(book,null,2);
await fs.mkdir(path.join(root,'dist/data'),{recursive:true});
await fs.writeFile(path.join(root,'dist/data/book.js'),'// Generated by tools/build-book.mjs from verified source-linked content.\nwindow.STUDY_BOOK = '+json+';\n');
await fs.writeFile(path.join(root,'dist/data/book.json'),json+'\n');
const stats=StudyModel.stats(book,StudyModel.emptyState());console.log(JSON.stringify({chapters:26,topLevelGroups:chapters.length,...stats}));
