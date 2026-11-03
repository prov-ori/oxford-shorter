(function(root){
 'use strict';const PREFIX='learn-',day=86400000,intervals=[1,3,7,14,30],copy=x=>JSON.parse(JSON.stringify(x));
 const check=(ok,text)=>{if(!ok)throw Error(text);},recordId=id=>typeof id==='string'&&/^learn-[a-z0-9-]{1,90}$/.test(id);
 function validate(r){
  check(r&&typeof r==='object'&&!Array.isArray(r),'Повреждена учебная запись');check(['response','card','journal','variant','experiment'].includes(r.kind),'Неизвестный вид учебной записи');
  for(const [k,v]of Object.entries(r)){check(!['__proto__','constructor','prototype'].includes(k),'Недопустимое поле');if(typeof v==='string')check(v.length<=10000,'Запись слишком длинная');if(['draft','question','answer','choice','reason','concept','situation','belief','evidence','change','reflection','prediction','explanation','metric','unit'].includes(k)||k.startsWith('field-'))check(typeof v==='string','Повреждён текст учебной записи');}
  for(const k of ['locked','unlocked','ran','correct','deleted'])if(r[k]!==undefined)check(typeof r[k]==='boolean','Повреждён статус учебной записи');
  for(const k of ['dueAt','updatedAt','reviewedAt','lastReviewed','reviews','stage','before','after','base','target'])if(r[k]!==undefined)check(typeof r[k]==='number'&&Number.isFinite(r[k]),'Повреждено число учебной записи');
  if(r.checks!==undefined)check(Array.isArray(r.checks)&&r.checks.length<=100&&r.checks.every(x=>typeof x==='string'),'Повреждена самопроверка');
  if(r.kind==='card'){check(typeof r.question==='string'&&typeof r.answer==='string','Повреждена карточка');check(Number.isFinite(r.dueAt)&&r.dueAt>=0&&Number.isInteger(r.stage)&&r.stage>=0&&r.stage<=intervals.length,'Повреждено расписание карточки');}
  if(r.kind==='experiment'&&r.ran)check(Number.isFinite(r.before)&&Number.isFinite(r.after)&&typeof r.unit==='string','Повреждён результат эксперимента');
  if(r.source){check(['oxford','fish'].includes(r.source.book)&&/^[a-z0-9-]+$/.test(r.source.sectionId),'Повреждён источник');if(r.source.block!==undefined)check(Number.isInteger(r.source.block)&&r.source.block>=0,'Повреждён абзац');}
  return copy(r);
 }
 function sourceHref(s){if(!s||!['fish','oxford'].includes(s.book)||!/^[a-z0-9-]+$/.test(s.sectionId))return null;return(s.book==='fish'?'fish.html':'index.html')+'#section='+s.sectionId+(Number.isInteger(s.block)&&s.block>=0?'&block='+s.block:'');}
 function reviewCard(card,rating,now=Date.now()){validate(card);check(['again','hard','good'].includes(rating)&&Number.isFinite(now)&&now>=0,'Неверное повторение');const stage=rating==='again'?0:rating==='hard'?Math.max(0,card.stage-1):Math.min(intervals.length,card.stage+1),delay=rating==='again'?10*60000:rating==='hard'?day:intervals[Math.max(0,stage-1)]*day;return{...card,stage,dueAt:now+delay,lastReviewed:now,reviews:(card.reviews||0)+1};}
 function nextVariant(items,records,exclude){const pool=items.filter(x=>x.id!==exclude);return pool.find(x=>!records['learn-variant-'+x.id]?.locked)||pool.slice().sort((a,b)=>(records['learn-variant-'+a.id]?.updatedAt||0)-(records['learn-variant-'+b.id]?.updatedAt||0))[0]||null;}
 class Store{
  constructor(storage){this.storage=storage;this.state=root.PlatformModel.emptyPractice();this.writable=Boolean(storage);this.notice=storage?'':'Сохранение в браузере недоступно. Скачайте копию перед закрытием вкладки.';try{if(storage){const raw=storage.getItem(root.PlatformModel.PRACTICE);if(raw)this.state=root.PlatformModel.cleanPractice(JSON.parse(raw));for(const [id,r]of Object.entries(this.state.cases))if(id.startsWith(PREFIX))validate(r);}}catch{this.state=root.PlatformModel.emptyPractice();this.writable=false;this.notice='Сохранение не удалось прочитать. Исходные данные не изменены; новые записи доступны в этой вкладке. Скачайте копию перед закрытием.';}}
  get(id){return this.state.cases[id]?copy(this.state.cases[id]):null;}
  list(kind){return Object.entries(this.state.cases).filter(([id,r])=>id.startsWith(PREFIX)&&r.kind===kind&&!r.deleted).map(([id,r])=>({id,...copy(r)}));}
  update(id,fields,expected=null,restore=false){
   check(recordId(id),'Недопустимый идентификатор');let latest=this.state;
   if(this.writable)try{const raw=this.storage.getItem(root.PlatformModel.PRACTICE);latest=raw?root.PlatformModel.cleanPractice(JSON.parse(raw)):root.PlatformModel.emptyPractice();}catch{this.writable=false;this.notice='Сохранение недоступно. Новые записи остаются в этой вкладке; скачайте копию.';latest=this.state;}
   const old=latest.cases[id]||{};check(!old.deleted||fields.deleted===true||restore,'Запись удалена в другой вкладке. Создайте новую запись.');
   check(!(expected&&Object.hasOwn(expected,'updatedAt')&&!old.kind),'Запись удалена или заменена при восстановлении копии. Обновите страницу перед продолжением.');
   if(expected&&old.kind)for(const k of Object.keys(fields))if(k!=='updatedAt'&&JSON.stringify(old[k])!==JSON.stringify(expected[k]))throw Error('Эта запись изменена в другой вкладке. Ваш текст остаётся в поле; скопируйте его и обновите страницу перед повторным сохранением.');
   const next=validate({...old,...fields,updatedAt:Date.now()});latest=copy(latest);latest.cases[id]=next;root.PlatformModel.cleanPractice(latest);
   this.state=latest;if(this.writable)try{this.storage.setItem(root.PlatformModel.PRACTICE,JSON.stringify(latest));}catch{this.writable=false;this.notice='Запись в браузер недоступна. Скачайте копию: изменения пока только в этой вкладке.';}
   return copy(next);
  }
  refresh(){if(!this.writable)return;const raw=this.storage.getItem(root.PlatformModel.PRACTICE);if(raw){const state=root.PlatformModel.cleanPractice(JSON.parse(raw));for(const [id,r]of Object.entries(state.cases))if(id.startsWith(PREFIX))validate(r);this.state=state;}}
 }
 root.LearningModel={PREFIX,intervals,validate,sourceHref,reviewCard,nextVariant,Store,newId:kind=>'learn-'+kind+'-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2))};
 if(typeof module!=='undefined')module.exports=root.LearningModel;
})(globalThis);
