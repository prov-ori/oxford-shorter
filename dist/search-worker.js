'use strict';const cache=new Map(),fold=s=>String(s).normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё','е');
const synonyms={akathisia:['акатиз'],delirium:['делир'],depersonalization:['деперсонализац'],derealization:['дереализац'],obsession:['обсес','навязчив'],bipolar:['биполяр'],hallucination:['галлюцинац'],mse:['психического статуса'],ssri:['сиозс'],ptsd:['птср'],cptsd:['комплексное птср'],'трансляция мыслей':['thought broadcasting','трансляц'],'паническая атака':['панический приступ'],'знс':['злокачественный нейролептический']};
let catalogue;async function indexPath(book){catalogue||=fetch('data/catalogue.json').then(r=>{if(!r.ok)throw Error('Оглавление поиска недоступно');return r.json();}).catch(e=>{catalogue=null;throw e;});return (await catalogue).books[book].search;}
async function load(key,path){if(!cache.has(key))cache.set(key,fetch(path).then(r=>{if(!r.ok)throw Error('Индекс поиска недоступен');return r.json();}).then(rows=>rows.map(r=>({...r,normalized:fold(r.title+' '+r.text)}))).catch(e=>{cache.delete(key);throw e;}));return cache.get(key);}
self.onmessage=async({data})=>{const {id,query,books=['oxford','fish'],scope='books'}=data;try{
 const q=fold(query.trim());if(q.length<2){postMessage({id,results:[],total:0});return;}const needles=[q,...(synonyms[q]||[])];let rows=[];
 if(scope==='books'||scope==='all')for(const book of books)rows.push(...(await load(book,await indexPath(book))).map(r=>({...r,book,kind:'book'})));
 if(scope==='questions'||scope==='all'){
  if(!cache.has('quiz'))cache.set('quiz',fetch('data/quiz-bank.json').then(r=>{if(!r.ok)throw Error('Банк недоступен');return r.json();}).then(b=>b.questions.filter(q=>!(b.retiredQuestionIds||[]).includes(q.id)).map(q=>({book:q.book,chapter:q.chapter,section:q.sectionId,title:q.topic,text:q.stem,kind:'question',qid:q.id,normalized:fold(q.topic+' '+q.stem)}))).catch(e=>{cache.delete('quiz');throw e;}));
  rows.push(...(await cache.get('quiz')).filter(r=>books.includes(r.book)));
 }
 if(scope==='atlas'||scope==='all'){
  if(!cache.has('atlas'))cache.set('atlas',fetch('data/practice.json').then(r=>{if(!r.ok)throw Error('Атлас недоступен');return r.json();}).then(p=>p.atlas.map(a=>({title:a.title,text:a.features.join(' ')+' '+a.quote,kind:'atlas',item:a.id,normalized:fold(a.title+' '+a.features.join(' ')+' '+a.quote)}))).catch(e=>{cache.delete('atlas');throw e;}));rows.push(...await cache.get('atlas'));
 }
 const found=[];for(const r of rows){let hit=needles.find(n=>r.normalized.includes(n));if(!hit&&q.includes(' ')&&q.split(/\s+/).every(w=>r.normalized.includes(w)))hit=q.split(/\s+/)[0];if(!hit)continue;const at=fold(r.text).indexOf(hit),start=Math.max(0,at-70),snippet=(start?'…':'')+r.text.slice(start,start+250)+(r.text.length>start+250?'…':'');found.push({...r,normalized:undefined,text:undefined,snippet,hit,rank:fold(r.title).includes(hit)?0:1});}
 found.sort((a,b)=>a.rank-b.rank);const sections=data.includeSections?[...new Map([...found].reverse().filter(r=>r.kind==='book').map(r=>[r.section,r])).values()]:undefined;postMessage({id,total:found.length,results:found.slice(0,60),sections});
 }catch(e){postMessage({id,error:e instanceof TypeError?'Индекс недоступен. Подключитесь к сети или заранее скачайте индексы поиска.':e.message});}};
