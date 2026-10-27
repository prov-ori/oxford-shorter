(function(){
 'use strict';
 const M=window.KnowledgeModel,$=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 let bank,state,targetQuestion=null,lastSavedRaw=null,storageWritable=true,originalRaw=null,toastTimer,pendingImport=null,shownResult=null;
 const now=()=>Date.now(),date=t=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(t);
 function toast(text){$('quizToast').textContent=text;$('quizToast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('quizToast').hidden=true,6000);}
 function download(value,name,type='application/json'){const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportProgress(){download(M.backup(state),'psycholibrary-progress.json');}
 function storageWarning(message,raw){
  const box=$('storageWarning');box.replaceChildren(node('span',message));box.hidden=false;const save=node('button','Скачать текущий прогресс','quiet outlined');save.onclick=exportProgress;box.append(save);
  if(raw!==undefined&&raw!==null){const original=node('button','Скачать исходные данные','quiet outlined');original.onclick=()=>download(raw,'psycholibrary-original-data.json');box.append(original);const reset=node('button','Создать новое хранилище','quiet outlined');reset.onclick=()=>{if(!confirm('Заменить повреждённые данные текущим прогрессом? Перед заменой скачайте исходные данные.'))return;storageWritable=true;lastSavedRaw=raw;persist();if(storageWritable)box.hidden=true;};box.append(reset);}
 }
 function persist(){
  if(!storageWritable)return false;
  try{const raw=JSON.stringify(state);localStorage.setItem(M.KEY,raw);lastSavedRaw=raw;return true;}
  catch{storageWritable=false;storageWarning('Сохранение в браузере недоступно. Сейчас прогресс хранится только до закрытия страницы; скачайте копию.');return false;}
 }
 function apply(operation){
  if(storageWritable){try{const current=localStorage.getItem(M.KEY);if(current!==lastSavedRaw){if(current)state=M.restoreState(JSON.parse(current),bank);else state=M.emptyState(bank);lastSavedRaw=current;toast('Прогресс изменён в другой вкладке. Данные обновлены; повторите действие.');render();return false;}}catch{storageWritable=false;storageWarning('Не удалось прочитать сохранение. Работа продолжается в памяти; скачайте прогресс.');}}
  try{state=operation(state);persist();return true;}catch(e){toast(e.message);return false;}
 }
 function go(hash){if(location.hash===hash)render();else location.hash=hash;}
 function selectedBook(){return document.querySelector('input[name=book]:checked')?.value||'all';}
 function config(){return {questionIds:targetQuestion?[targetQuestion]:(bank.collections||[]).find(c=>c.id===$('collectionSelect').value)?.questionIds,book:selectedBook(),chapters:[...document.querySelectorAll('#chapterChoices input:checked')].map(i=>i.value),mode:$('modeSelect').value,scope:$('scopeSelect').value,count:$('countSelect').value,difficulty:$('difficultySelect').value,minutes:Number($('minutesSelect').value)};}
 function bookLabel(key){return bank.books[key].shortTitle;}
 const difficultyLabels={recall:'Определения',understanding:'Понимание',application:'Учебная ситуация'};
 function chapterChoices(only){
  const box=$('chapterChoices');box.replaceChildren();const book=selectedBook();
  for(const [key,b]of Object.entries(bank.books)){if(book!=='all'&&book!==key)continue;box.append(node('p',b.shortTitle,'q-chapter-group'));for(const ch of b.chapters){const label=node('label',undefined,'q-chapter-choice'),input=node('input');input.type='checkbox';input.value=key+':'+ch.number;input.checked=only?only.includes(input.value):true;input.addEventListener('change',poolHint);label.append(input,node('span',ch.title));box.append(label);}}
  poolHint();
 }
 function poolHint(){
  const cfg=config(),list=M.pool(bank,cfg,state,now()),size=Math.min(cfg.count==='all'?list.length:Number(cfg.count),list.length),books=[...new Set(list.map(q=>q.book))].map(bookLabel);
  const collection=(bank.collections||[]).find(c=>c.id===$('collectionSelect').value);$('collectionHint').textContent=collection?collection.description+' В наборе '+collection.questionIds.length+' вопросов; другие фильтры уточняют этот набор.':'';
  $('selectedChapterCount').textContent=document.querySelectorAll('#chapterChoices input:checked').length+' выбрано';
  $('poolHint').textContent=(targetQuestion?'Выбран конкретный вопрос из поиска. ':'')+(list.length?`Доступно ${list.length} · В попытке ${size} · ${books.join(' + ')}`:'Нет вопросов по выбранным условиям.');
  $('modeHint').textContent=cfg.mode==='exam'?'Разбор появится после завершения. Время продолжает идти при закрытии вкладки. Ответы сохраняются автоматически.':'Ответ фиксируется кнопкой «Проверить». После этого доступны объяснение и ссылка на учебник.';
  $('timeField').hidden=cfg.mode!=='exam';$('startButton').disabled=!list.length||!!state.active;$('startButton').firstChild.textContent=cfg.mode==='exam'?'Начать экзамен ':'Начать тренировку ';
  if(state.active)$('modeHint').textContent+=' Сначала завершите или продолжите текущую попытку.';
 }
 function statTiles(container,items){container.replaceChildren(...items.map(([title,value,detail])=>{const div=node('div');div.append(node('span',title),node('strong',value));if(detail)div.append(node('small',detail));return div;}));}
 function dashboard(){
  const ss=M.stats(state,bank),active=M.activeQuestions(bank),activeIds=new Set(active.map(q=>q.id)),values=Object.entries(ss).filter(([id])=>activeIds.has(id)).map(([,v])=>v),attempts=values.reduce((n,s)=>n+s.attempts,0),correct=values.reduce((n,s)=>n+s.correct,0),mistakes=values.filter(s=>!s.lastCorrect).length,due=values.filter(s=>s.dueAt<=now()).length;
  $('bankSize').textContent=M.activeQuestions(bank).length+' вопросов · '+Object.values(bank.books).reduce((n,b)=>n+b.chapters.length,0)+' глав';$('bankCoverage').textContent=Object.entries(bank.books).map(([key,b])=>b.shortTitle+': '+M.activeQuestions(bank).filter(q=>q.book===key).length+' вопросов, '+b.chapters.length+' глав').join('. ')+'.';
  statTiles($('overviewStats'),[['Проверено вопросов',values.length+' / '+M.activeQuestions(bank).length,'Актуальные версии; прежние ответы сохранены в истории'],['Точность ответов',attempts?Math.round(correct/attempts*100)+'%':'—',attempts+' ответов в истории'],['Завершено попыток',String(state.history.length),'Последние 100 попыток'],['К повторению',String(due),mistakes+' ошибок и пропусков'],['Ошибки с уверенностью',String(values.filter(s=>s.confidentError).length),'Последний ответ: неверно и «уверен(а)»']]);
  $('reviewHint').textContent=mistakes?`Сейчас ${mistakes} вопросов с ошибкой или пропуском в последнем ответе. Вернитесь к ним и проверьте понимание.`:'Пока нет вопросов с ошибкой в последнем ответе. Начните тренировку — здесь появятся темы для закрепления.';
  $('practiceMistakes').disabled=!mistakes;$('resumeCard').hidden=!state.active;
  if(state.active){const r=state.active;$('resumeDescription').textContent=`${r.mode==='exam'?'Экзамен':'Тренировка'} · ${Object.keys(r.answers).length} из ${r.questionIds.length} ответов · ${date(r.startedAt)}${r.mode==='exam'?' · время идёт':''}`;}
  const topics=$('chapterStats');topics.replaceChildren();
  for(const [key,b]of Object.entries(bank.books)){
   const bookQuestions=M.activeQuestions(bank).filter(q=>q.book===key),bookKnown=bookQuestions.map(q=>ss[q.id]).filter(Boolean),bookAttempts=bookKnown.reduce((n,s)=>n+s.attempts,0),bookCorrect=bookKnown.reduce((n,s)=>n+s.correct,0),group=node('details',undefined,'q-book-progress'),summary=node('summary');summary.append(node('strong',b.shortTitle+' · '+b.chapters.length+' глав'),node('span',bookKnown.length+' / '+bookQuestions.length+' вопросов'+(bookAttempts?' · '+Math.round(bookCorrect/bookAttempts*100)+'% верно':'')),node('small','Развернуть главы'));group.append(summary);const chapterList=node('div',undefined,'q-book-topic-list');
   for(const ch of b.chapters){
   const questions=M.activeQuestions(bank).filter(q=>q.book===key&&q.chapter===ch.number),known=questions.map(q=>ss[q.id]).filter(Boolean),count=known.reduce((n,s)=>n+s.attempts,0),right=known.reduce((n,s)=>n+s.correct,0),button=node('button',undefined,'q-topic');button.type='button';
   button.append(node('span',b.shortTitle+' · '+ch.title,'q-topic-title'));const meta=node('span',undefined,'q-topic-meta');meta.append(node('span',known.length+' / '+questions.length+' вопросов'),node('span',count?Math.round(right/count*100)+'% верно':'Ещё не проверяли'));const progress=node('progress');progress.max=questions.length;progress.value=known.length;progress.setAttribute('aria-label','Проверено разных вопросов по главе');button.append(meta,progress);
   button.onclick=()=>{document.querySelector('input[name=book][value='+key+']').checked=true;$('scopeSelect').value='all';chapterChoices([key+':'+ch.number]);$('configTitle').scrollIntoView({block:'start'});$('startButton').focus({preventScroll:true});};chapterList.append(button);
   }
   group.append(chapterList);topics.append(group);
  }
  const list=$('historyList');list.replaceChildren();
  if(!state.history.length)list.append(node('p','Ваша первая проверка ещё впереди. Завершённые попытки и их разбор появятся здесь.','q-empty'));
  for(const r of state.history){const score=M.result(r,bank),row=node('div',undefined,'q-history-row'),text=node('div'),books=[...new Set(r.questionIds.map(id=>question(id).book))].map(bookLabel);text.append(node('strong',(r.mode==='exam'?'Экзамен':'Тренировка')+' · '+books.join(' + ')),node('small',date(r.finishedAt)+' · '+score.correct+' из '+score.total+' · '+score.skipped+' пропущено'));const button=node('button','Разбор →','quiet');button.onclick=()=>go('#result='+encodeURIComponent(r.id));row.append(text,node('span',score.percent+'%','q-history-score'),button);list.append(row);}
  poolHint();
 }
 function question(id){return bank.questions.find(q=>q.id===id);}
 function sourceLink(q){const a=node('a','Открыть раздел '+bookLabel(q.book)+' ↗','q-source-link');a.href=(q.book==='fish'?'fish.html':'index.html')+'#section='+encodeURIComponent(q.sectionId)+'&block='+(bank.sourceLocations?.[q.id]??0)+'&find='+encodeURIComponent(q.sourceEvidence.slice(0,70));a.target='_blank';a.rel='noopener';return a;}
 function feedback(q,choice){
  const right=choice===q.correctOptionId,wrap=node('div',undefined,'q-feedback'+(right?'':' q-wrong')),answer=q.options.find(o=>o.id===q.correctOptionId);
  if((bank.retiredQuestionIds||[]).includes(q.id))wrap.append(node('p','Прежняя версия вопроса: сохранена для этой попытки и истории. Новые тренировки используют отредактированные варианты.','q-muted'));wrap.append(node('strong',right?'Верно.':choice?'Есть что уточнить.':'Вопрос пропущен.'));
  if(!right)wrap.append(node('p','Правильный ответ: '+answer.text));wrap.append(node('p',q.explanation),sourceLink(q));
  const pages=node('p','Раздел в PDF: '+q.source.pdfStart+(q.source.pdfEnd!==q.source.pdfStart?'–'+q.source.pdfEnd:'')+(q.source.printedPages?' · печатные страницы '+q.source.printedPages:''),'q-muted');wrap.append(pages);
  const details=node('details',undefined,'q-evidence');details.append(node('summary','Фрагмент учебного перевода'),node('blockquote',q.sourceEvidence));wrap.append(details);return wrap;
 }
 function expire(){
  if(state.active?.mode==='exam'&&now()>=state.active.deadline){const id=state.active.id;if(apply(s=>M.finish(s,bank,now(),'time'))){$('finishDialog').close();go('#result='+encodeURIComponent(id));toast('Время закончилось. Попытка завершена с сохранёнными ответами.');}return true;}return false;
 }
 function timer(){const r=state.active;$('timer').hidden=r?.mode!=='exam';if(r?.mode==='exam'){const seconds=Math.max(0,Math.ceil((r.deadline-now())/1000));$('timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');$('timer').classList.toggle('urgent',seconds<=60);if(seconds<=0)expire();}}
 function runMeta(){
  const r=state.active;if(!r)return;const total=r.questionIds.length,answered=Object.keys(r.answers).length;
  $('runProgress').textContent=`${answered} из ${total} ответов · ${r.flags.length} отложено`;$('mapLegend').textContent='Заливка — выбран ответ. Точка — отложен. '+(r.mode==='exam'?'Правильность ответов здесь не показывается.':'Разбор доступен после проверки ответа.');
  const map=$('questionMap');map.replaceChildren(...r.questionIds.map((id,i)=>{const button=node('button',String(i+1),[r.answers[id]?'answered':'',r.flags.includes(id)?'flagged':''].join(' '));button.type='button';button.setAttribute('aria-label','Вопрос '+(i+1)+(r.answers[id]?', ответ выбран':', без ответа')+(r.flags.includes(id)?', отложен':''));if(i===r.index)button.setAttribute('aria-current','step');button.onclick=()=>navigateQuestion(i);return button;}));
 }
 function runView(focus=false){
  const r=state.active;if(!r){go('#setup');return;}const q=question(r.questionIds[r.index]),checked=r.mode==='training'&&r.checked.includes(q.id),choice=r.answers[q.id];
  $('runMode').textContent=r.mode==='exam'?'Экзамен':'Тренировка';$('questionMeta').textContent=`Вопрос ${r.index+1} из ${r.questionIds.length} · ${bookLabel(q.book)}`;const chapter=bank.books[q.book].chapters.find(c=>c.number===q.chapter);$('questionTopic').textContent=`Глава ${q.chapter} · ${checked?q.topic:chapter.title} · ${difficultyLabels[q.difficulty]}`;$('questionTitle').textContent=q.stem;$('questionProgress').value=(r.index+1)/r.questionIds.length*100;
  $('flagButton').setAttribute('aria-pressed',String(r.flags.includes(q.id)));$('flagButton').textContent=r.flags.includes(q.id)?'⚑ Отложен':'⚑ Отложить';
  const choices=$('answerChoices');choices.replaceChildren(node('legend','Выберите один ответ','q-sr-only'));
  for(const id of r.optionOrders[q.id]){const o=q.options.find(x=>x.id===id),label=node('label',undefined,'q-option');if(checked){if(id===q.correctOptionId)label.classList.add('q-correct');else if(id===choice)label.classList.add('q-wrong');}const input=node('input');input.type='radio';input.name='answer';input.value=id;input.checked=id===choice;input.disabled=checked;input.addEventListener('change',()=>{if(expire())return;if(apply(s=>M.choose(s,bank,id,now()))){$('answerError').hidden=true;runMeta();}});label.append(input,node('span',o.text));choices.append(label);}
  const confidence=$('confidenceChoices');confidence.replaceChildren(node('legend','Насколько вы уверены? Необязательно; фиксируется до разбора.'));for(const [value,title]of [['guess','Угадываю'],['some','Сомневаюсь'],['confident','Уверен(а)']]){const label=node('label'),input=node('input');input.type='radio';input.name='confidence';input.value=value;input.checked=r.confidence?.[q.id]===value;input.disabled=checked;input.onchange=()=>{if(!expire())apply(s=>M.confidence(s,value,now()));};label.append(input,document.createTextNode(' '+title));confidence.append(label);}const clear=node('button','Не указывать','quiet');clear.type='button';clear.disabled=checked;clear.onclick=()=>{if(!expire()&&apply(s=>M.confidence(s,null,now())))runView();};confidence.append(clear);
  $('answerError').hidden=true;const response=$('answerFeedback');response.replaceChildren();response.hidden=!checked;if(checked)response.append(feedback(q,choice));
  $('previousQuestion').disabled=r.index===0;$('checkAnswer').hidden=r.mode!=='training'||checked;$('nextQuestion').textContent=r.index===r.questionIds.length-1?'К завершению →':'Далее →';
  runMeta();timer();if(focus)$('questionTitle').focus({preventScroll:true});
 }
 function navigateQuestion(index){if(expire())return;if(apply(s=>M.move(s,index,now()))){runView(true);$('runScreen').scrollIntoView({block:'start'});}}
 function finishPrompt(){if(expire())return;const r=state.active;if(!r)return;const skipped=r.questionIds.length-Object.keys(r.answers).length;$('finishDescription').textContent=`Выбрано ответов: ${Object.keys(r.answers).length} из ${r.questionIds.length}. Пропущено: ${skipped}. Отложено: ${r.flags.length}.`;$('finishDialog').showModal();}
 function showResult(run){
  shownResult=run;const r=M.result(run,bank);$('resultMode').textContent=(run.mode==='exam'?'Экзамен':'Тренировка')+' · '+date(run.finishedAt);$('resultPercent').textContent=r.percent+'%';$('resultFraction').textContent=r.correct+' из '+r.total+' верно';$('resultDescription').textContent=(run.reason==='time'?'Время закончилось. ':'')+'Разберите ответы и вернитесь к понятиям, которые пока путаются. В результат включены все вопросы, в том числе пропущенные.';
  statTiles($('resultStats'),[['Верно',String(r.correct)],['Ошибки',String(r.wrong)],['Пропущено',String(r.skipped)],['Время',Math.max(1,Math.round((run.finishedAt-run.startedAt)/60000))+' мин','От начала до завершения']]);
  $('retryErrors').disabled=r.correct===r.total;const review=$('resultReview');review.replaceChildren();
  run.questionIds.forEach((id,i)=>{const q=question(id),right=run.answers[id]===q.correctOptionId,details=node('details',undefined,'q-result-item'),summary=node('summary');summary.append(node('span',right?'Верно':run.answers[id]?'Ошибка':'Пропуск','q-result-badge'+(right?'':' wrong')),node('span',(i+1)+'. '+q.stem));const body=node('div',undefined,'q-review-body'),options=node('ol',undefined,'q-result-options');for(const o of run.optionOrders[id].map(oid=>q.options.find(x=>x.id===oid)))options.append(node('li',o.text+(run.answers[id]===o.id?' — ваш ответ':'')+(q.correctOptionId===o.id?' ✓':'')));if(run.confidence?.[id])body.append(node('p','Уверенность до проверки: '+({guess:'угадывал(а)',some:'сомневался(ась)',confident:'уверен(а)'}[run.confidence[id]])+(!right&&run.confidence[id]==='confident'?' · приоритет повторения':''),'platform-note'));body.append(node('p',bookLabel(q.book)+' · глава '+q.chapter+' · '+q.topic,'q-muted'),options,feedback(q,run.answers[id]));details.append(summary,body);review.append(details);});
 }
 function render(){
  if(expire())return;let hash=location.hash;
  $('setupScreen').hidden=hash==='#attempt'||hash.startsWith('#result=');$('runScreen').hidden=hash!=='#attempt';$('resultScreen').hidden=!hash.startsWith('#result=');
  if(hash==='#attempt'){runView();return;}
  if(hash.startsWith('#result=')){let id;try{id=decodeURIComponent(hash.slice(8));}catch{go('#setup');return;}const run=state.history.find(r=>r.id===id);if(run)showResult(run);else go('#setup');return;}
  $('setupScreen').hidden=false;dashboard();
 }
 try{
  bank=M.validateBank(window.KNOWLEDGE_BANK);state=M.emptyState(bank);
  try{const raw=localStorage.getItem(M.KEY);lastSavedRaw=raw;if(raw){originalRaw=raw;state=M.restoreState(JSON.parse(raw),bank);}}
  catch{storageWritable=false;storageWarning(originalRaw?'Сохранённый прогресс не удалось восстановить. Исходные данные сохранены без изменений. Новые ответы временно хранятся в памяти.':'Хранилище браузера недоступно. Прогресс будет доступен только до закрытия страницы.',originalRaw);}
  for(const c of bank.collections||[]){const o=node('option',c.title);o.value=c.id;$('collectionSelect').append(o);}
  const params=new URLSearchParams(location.search),initialBook=params.get('book'),initialChapter=Number(params.get('chapter'));
  if((bank.collections||[]).some(c=>c.id===params.get('collection')))$('collectionSelect').value=params.get('collection');
  $('collectionSelect').onchange=()=>{targetQuestion=null;$('singleQuestionHint')?.remove();document.querySelector('input[name=book][value=all]').checked=true;$('scopeSelect').value='all';$('difficultySelect').value='all';chapterChoices();};
  const requested=params.get('question'),replacement=bank.replacements?.[requested];targetQuestion=M.activeQuestions(bank).find(q=>q.id===(replacement||requested))?.id||null;
  if(targetQuestion){const hint=node('p',undefined,'platform-note');hint.id='singleQuestionHint';hint.append(node('span','Открыт один вопрос из поиска. '));const reset=node('button','Снять ограничение','quiet');reset.type='button';reset.onclick=()=>{targetQuestion=null;hint.remove();poolHint();};hint.append(reset);$('configForm').prepend(hint);}
  if(['all','mistakes','due','confident-errors'].includes(params.get('scope')))$('scopeSelect').value=params.get('scope');if(['5','10','20','40','all'].includes(params.get('count')))$('countSelect').value=params.get('count');
  if(['oxford','fish'].includes(initialBook))document.querySelector('input[name=book][value='+initialBook+']').checked=true;
  if(initialBook&&bank.books[initialBook]?.chapters.some(c=>c.number===initialChapter))chapterChoices([initialBook+':'+initialChapter]);else chapterChoices();
  for(const input of document.querySelectorAll('input[name=book]'))input.addEventListener('change',()=>chapterChoices());
  for(const id of ['modeSelect','scopeSelect','countSelect','difficultySelect','minutesSelect'])$(id).addEventListener('change',poolHint);
  $('selectChapters').onclick=()=>{document.querySelectorAll('#chapterChoices input').forEach(i=>i.checked=true);poolHint();};$('clearChapters').onclick=()=>{document.querySelectorAll('#chapterChoices input').forEach(i=>i.checked=false);poolHint();};
  $('configForm').onsubmit=e=>{e.preventDefault();$('setupError').hidden=true;if(expire())return;if(apply(s=>M.start(s,bank,config(),now()))){go('#attempt');$('quizMain').scrollIntoView({block:'start'});setTimeout(()=>$('questionTitle').focus({preventScroll:true}),0);}};
  $('practiceMistakes').onclick=()=>{$('scopeSelect').value='mistakes';document.querySelector('input[name=book][value=all]').checked=true;chapterChoices();$('configTitle').scrollIntoView({block:'start'});$('startButton').focus({preventScroll:true});};
  $('resumeButton').onclick=()=>go('#attempt');$('finishSavedButton').onclick=finishPrompt;$('backToSetup').onclick=()=>go('#setup');$('finishButton').onclick=finishPrompt;
  $('cancelFinish').onclick=()=>$('finishDialog').close();$('confirmFinish').onclick=()=>{const id=state.active?.id;if(!id)return;$('finishDialog').close();if(apply(s=>M.finish(s,bank,now()))){go('#result='+encodeURIComponent(id));$('quizMain').scrollIntoView({block:'start'});}};
  $('previousQuestion').onclick=()=>navigateQuestion(state.active.index-1);$('nextQuestion').onclick=()=>{if(!state.active)return;if(state.active.index===state.active.questionIds.length-1)finishPrompt();else navigateQuestion(state.active.index+1);};
  $('flagButton').onclick=()=>{if(expire())return;if(apply(s=>M.flag(s,now())))runView();};
  $('checkAnswer').onclick=()=>{if(expire())return;const r=state.active,id=r.questionIds[r.index];if(!r.answers[id]){$('answerError').textContent='Выберите один ответ перед проверкой.';$('answerError').hidden=false;return;}if(apply(s=>M.check(s,bank,now()))){runView();$('answerFeedback').scrollIntoView({block:'nearest'});}};
  $('resultHome').onclick=() =>go('#setup');$('newSession').onclick=()=>go('#setup');$('retryErrors').onclick=()=>{if(state.active){go('#setup');toast('Сначала завершите текущую попытку.');return;}const ids=shownResult.questionIds.filter(id=>shownResult.answers[id]!==question(id).correctOptionId),subset={...bank,questions:bank.questions.filter(q=>ids.map(id=>bank.replacements?.[id]||id).includes(q.id))};if(apply(s=>M.start(s,subset,{mode:'training',book:'all',scope:'all',count:'all'},now()))){go('#attempt');$('quizMain').scrollIntoView({block:'start'});}};
  $('exportBackup').onclick=exportProgress;$('exportResult').onclick=()=>download({format:'psycholibrary-result',bankRevision:bank.revision,run:shownResult,score:M.result(shownResult,bank),questions:shownResult.questionIds.map(question)},'psycholibrary-result.json');
  $('importBackup').onclick=()=>$('backupFile').click();$('backupFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>5*1024*1024)throw Error('Файл слишком большой. Допустимо до 5 МБ.');pendingImport=M.importBackup(JSON.parse(await file.text()),bank);$('importDescription').textContent=`В файле: ${pendingImport.history.length} завершённых попыток, ${pendingImport.events.length} ответов${pendingImport.active?', есть незавершённая попытка':''}.`;$('importDialog').showModal();}catch(err){pendingImport=null;toast(err.message||'Не удалось прочитать файл.');}};
  $('cancelImport').onclick=()=>{pendingImport=null;$('importDialog').close();};$('confirmImport').onclick=()=>{if(!pendingImport)return;state=pendingImport;pendingImport=null;state.version++;$('importDialog').close();if(storageWritable)persist();else storageWarning('Копия восстановлена в памяти. Для сохранения на устройстве сначала устраните проблему хранилища.');go(state.active?'#attempt':'#setup');toast('Прогресс восстановлен.');};
  window.addEventListener('hashchange',render);window.addEventListener('pageshow',()=>{timer();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)timer();});
  window.addEventListener('storage',e=>{if(e.key!==M.KEY||!storageWritable)return;try{state=e.newValue?M.restoreState(JSON.parse(e.newValue),bank):M.emptyState(bank);lastSavedRaw=e.newValue;toast('Прогресс обновлён из другой вкладки.');render();}catch{storageWritable=false;storageWarning('Другая вкладка записала несовместимые данные. Скачайте свой прогресс перед закрытием.');}});
  render();setInterval(timer,1000);
 }catch(e){$('fatalError').hidden=false;$('fatalError').textContent='Не удалось загрузить проверку знаний. '+e.message+' Учебники доступны по ссылкам вверху страницы.';$('startButton').disabled=true;}
})();
