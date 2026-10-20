/* Pure, browser/Node-compatible model. Reader state is never touched. */
(function(root){
 'use strict';
 const DAY=86400000,KEY='psycholibrary:knowledge:v1',MAX_EVENTS=10000;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const finite=x=>Number.isFinite(x)&&x>=0&&x<8640000000000000;
 function validateBank(bank){
  if(!bank||bank.schemaVersion!==1||!Number.isInteger(bank.revision)||!Array.isArray(bank.questions)||!bank.questions.length)throw Error('Неверный формат банка вопросов.');
  const ids=new Set();
  for(const q of bank.questions){
   if(!q||typeof q.id!=='string'||ids.has(q.id)||!bank.books[q.book]||!Number.isInteger(q.chapter)||!bank.books[q.book].chapters.some(c=>c.number===q.chapter)||typeof q.sectionId!=='string'||!['recall','understanding','application'].includes(q.difficulty)||typeof q.stem!=='string'||q.stem.length<20||typeof q.explanation!=='string'||q.explanation.length<20||!Array.isArray(q.options)||q.options.length!==4||new Set(q.options.map(o=>o.id)).size!==4||new Set(q.options.map(o=>o.text)).size!==4||q.options.some(o=>typeof o.id!=='string'||typeof o.text!=='string'||!o.text.trim())||!q.options.some(o=>o.id===q.correctOptionId)||!q.source||!Number.isInteger(q.source.pdfStart)||q.source.pdfStart<1||!Number.isInteger(q.source.pdfEnd)||q.source.pdfEnd<q.source.pdfStart||typeof q.sourceEvidence!=='string'||!q.sourceEvidence.trim())throw Error('Ошибка в вопросе '+(q?.id||'без ID'));
   ids.add(q.id);
  }
  return bank;
 }
 function emptyState(bank){return {schemaVersion:1,bankRevision:bank.revision,version:0,events:[],history:[],active:null};}
 const qmap=bank=>new Map(bank.questions.map(q=>[q.id,q]));
 function validRun(run,bank){
  const questions=qmap(bank);
  if(!run||typeof run.id!=='string'||!['training','exam'].includes(run.mode)||!finite(run.startedAt)||!Array.isArray(run.questionIds)||!run.questionIds.length||run.questionIds.length>bank.questions.length||new Set(run.questionIds).size!==run.questionIds.length||run.questionIds.some(id=>!questions.has(id))||!Number.isInteger(run.index)||run.index<0||run.index>=run.questionIds.length||!run.answers||typeof run.answers!=='object'||Array.isArray(run.answers)||!run.optionOrders||typeof run.optionOrders!=='object'||!Array.isArray(run.checked)||!Array.isArray(run.flags)||run.checked.some(id=>!run.questionIds.includes(id))||run.flags.some(id=>!run.questionIds.includes(id))||(run.mode==='exam'&&(!finite(run.deadline)||run.deadline<=run.startedAt)))throw Error('Повреждена сохранённая попытка.');
  for(const id of run.questionIds){const opts=questions.get(id).options.map(o=>o.id),order=run.optionOrders[id];if(!Array.isArray(order)||order.length!==opts.length||new Set(order).size!==opts.length||order.some(o=>!opts.includes(o))||(Object.hasOwn(run.answers,id)&&!opts.includes(run.answers[id])))throw Error('Повреждены варианты ответа.');}
  if(Object.keys(run.answers).some(id=>!run.questionIds.includes(id)))throw Error('Неизвестный ответ в попытке.');
  if(new Set(run.checked).size!==run.checked.length||new Set(run.flags).size!==run.flags.length||run.checked.some(id=>!run.answers[id])||(run.mode==='exam'&&run.checked.length))throw Error('Неверные отметки проверки ответа.');
  return run;
 }
 function restoreState(raw,bank){
  if(!raw||raw.schemaVersion!==1||raw.bankRevision!==bank.revision||!Number.isInteger(raw.version)||raw.version<0||!Array.isArray(raw.events)||raw.events.length>MAX_EVENTS||!Array.isArray(raw.history)||raw.history.length>100)throw Error('Копия не соответствует этой версии банка вопросов. Исходные данные не изменены.');
  const map=qmap(bank),ids=new Set();
  for(const e of raw.events){const q=map.get(e.questionId);if(!q||typeof e.id!=='string'||ids.has(e.id)||!finite(e.at)||!(e.choice===null||q.options.some(o=>o.id===e.choice)))throw Error('Повреждена история ответов.');ids.add(e.id);}
  const runs=new Set();for(const run of raw.history){validRun(run,bank);if(!finite(run.finishedAt)||run.finishedAt<run.startedAt||runs.has(run.id))throw Error('Повреждён результат попытки.');runs.add(run.id);}
  if(raw.active){validRun(raw.active,bank);if(raw.active.finishedAt!==undefined||runs.has(raw.active.id))throw Error('Попытка уже завершена.');}
  return copy({schemaVersion:1,bankRevision:bank.revision,version:raw.version,events:[...raw.events].sort((a,b)=>a.at-b.at),history:raw.history,active:raw.active||null});
 }
 function stats(state,bank){
  const map=qmap(bank),result={};
  for(const e of [...state.events].sort((a,b)=>a.at-b.at)){const q=map.get(e.questionId);if(!q)continue;const s=result[q.id]||(result[q.id]={attempts:0,correct:0,streak:0,lastCorrect:false,dueAt:0,lastSeen:0});const correct=e.choice===q.correctOptionId;s.attempts++;if(correct)s.correct++;s.streak=correct?s.streak+1:0;s.lastCorrect=correct;s.lastSeen=e.at;s.dueAt=correct?e.at+DAY*[1,3,7,14,30][Math.min(s.streak-1,4)]:e.at;}
  return result;
 }
 function pool(bank,config,state,now=Date.now()){
  const ss=stats(state,bank);
  return bank.questions.filter(q=>(!config.book||config.book==='all'||config.book===q.book)&&(!Array.isArray(config.chapters)||config.chapters.includes(q.book+':'+q.chapter))&&(!config.difficulty||config.difficulty==='all'||q.difficulty===config.difficulty)&&(!config.scope||config.scope==='all'||(config.scope==='mistakes'&&ss[q.id]&&!ss[q.id].lastCorrect)||(config.scope==='due'&&ss[q.id]&&ss[q.id].dueAt<=now)));
 }
 function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function select(bank,config,state,now=Date.now(),random=Math.random){
  const candidates=pool(bank,config,state,now),size=Math.min(config.count==='all'?candidates.length:Number(config.count)||10,candidates.length),groups=new Map();
  for(const q of shuffle(candidates,random)){const key=q.book+':'+q.chapter;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);}
  // Round-robin chapters within each book, then books: broad coverage without duplicates.
  const queues={};for(const book of shuffle(Object.keys(bank.books),random)){const chapters=shuffle([...groups.entries()].filter(([key])=>key.startsWith(book+':')).map(([,v])=>v),random);queues[book]=[];while(chapters.some(c=>c.length))for(const ch of chapters)if(ch.length)queues[book].push(ch.pop());}
  const chosen=[];while(chosen.length<size){let changed=false;for(const book of Object.keys(queues)){if(chosen.length>=size)break;if(queues[book].length){chosen.push(queues[book].shift());changed=true;}}if(!changed)break;}
  return shuffle(chosen,random);
 }
 function bump(state){state.version++;return state;}
 function start(state,bank,config,now=Date.now(),random=Math.random){
  if(state.active)throw Error('Сначала продолжите или завершите текущую попытку.');
  if(!['training','exam'].includes(config.mode))throw Error('Выберите режим.');
  const selected=select(bank,config,state,now,random);if(!selected.length)throw Error('По этим условиям вопросов нет. Измените фильтры.');
  const s=copy(state),id='run-'+now.toString(36)+'-'+Math.floor(random()*1e12).toString(36);
  s.active={id,mode:config.mode,startedAt:now,deadline:config.mode==='exam'?now+Math.max(1,Math.min(120,Number(config.minutes)||10))*60000:null,questionIds:selected.map(q=>q.id),optionOrders:Object.fromEntries(selected.map(q=>[q.id,shuffle(q.options.map(o=>o.id),random)])),index:0,answers:{},checked:[],flags:[],scope:config.scope||'all'};
  return bump(s);
 }
 function ensureActive(state,now){if(!state.active)throw Error('Нет активной попытки.');if(state.active.mode==='exam'&&now>=state.active.deadline)throw Error('Время экзамена истекло.');}
 function choose(state,bank,choice,now=Date.now()){
  ensureActive(state,now);const s=copy(state),run=s.active,id=run.questionIds[run.index],q=qmap(bank).get(id);if(run.checked.includes(id))throw Error('Ответ уже проверен.');if(!q.options.some(o=>o.id===choice))throw Error('Неизвестный вариант.');run.answers[id]=choice;return bump(s);
 }
 function event(state,run,id,now){const key=run.id+':'+id;if(state.events.some(e=>e.id===key))return;state.events.push({id:key,questionId:id,choice:run.answers[id]||null,at:now});state.events=state.events.slice(-MAX_EVENTS);}
 function check(state,bank,now=Date.now()){
  ensureActive(state,now);const s=copy(state),r=s.active,id=r.questionIds[r.index];if(r.mode!=='training')throw Error('Разбор будет доступен после экзамена.');if(!r.answers[id])throw Error('Сначала выберите ответ.');if(!r.checked.includes(id)){r.checked.push(id);event(s,r,id,now);}return bump(s);
 }
 function move(state,index,now=Date.now()){ensureActive(state,now);const s=copy(state);if(!Number.isInteger(index)||index<0||index>=s.active.questionIds.length)throw Error('Нет такого вопроса.');s.active.index=index;return bump(s);}
 function flag(state,now=Date.now()){ensureActive(state,now);const s=copy(state),r=s.active,id=r.questionIds[r.index];r.flags=r.flags.includes(id)?r.flags.filter(x=>x!==id):[...r.flags,id];return bump(s);}
 function finish(state,bank,now=Date.now(),reason='submitted'){
  if(!state.active)return state;const s=copy(state),r=s.active,expired=r.mode==='exam'&&now>=r.deadline,finishedAt=expired?r.deadline:Math.max(r.startedAt,now);for(const id of r.questionIds)event(s,r,id,finishedAt);r.finishedAt=finishedAt;r.reason=expired?'time':reason;s.history.unshift(r);s.history=s.history.slice(0,100);s.active=null;return bump(s);
 }
 function result(run,bank){const map=qmap(bank),total=run.questionIds.length,answered=run.questionIds.filter(id=>run.answers[id]).length,correct=run.questionIds.filter(id=>run.answers[id]===map.get(id)?.correctOptionId).length;return {total,answered,correct,wrong:answered-correct,skipped:total-answered,percent:Math.round(correct/total*100)};}
 function backup(state){return {format:'psycholibrary-knowledge-backup',schemaVersion:1,exportedAt:new Date().toISOString(),state:copy(state)};}
 function importBackup(raw,bank){if(raw?.format!=='psycholibrary-knowledge-backup'||raw.schemaVersion!==1)throw Error('Это не резервная копия проверки знаний.');return restoreState(raw.state,bank);}
 const api={KEY,DAY,validateBank,emptyState,restoreState,stats,pool,select,shuffle,start,choose,check,move,flag,finish,result,backup,importBackup};
 root.KnowledgeModel=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
