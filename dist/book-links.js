(function(){
  'use strict';
  const data=window.BOOK_LINKS,topics=data?.topics||[],n=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const topicHref=id=>'connections.html#topic='+encodeURIComponent(id);
  const link=(text,href,cls)=>{const a=n('a',text,cls);a.href=href;return a;};
  function renderReader(book,section){
    const host=document.getElementById('bookConnections');if(!host)return;
    host.replaceChildren();host.hidden=true;if(!book||!section)return;
    const key=book.id.startsWith('fish')?'fish':'oxford';
    const matches=topics.filter(t=>{const s=t.sources[key];return s.sectionId===section.id&&s.bookId===book.id&&s.sourceSha256===book.source?.sha256&&s.revision===book.revision;});
    if(!matches.length)return;
    const other=key==='fish'?'Oxford':'Фишем',details=n('details'),summary=n('summary','Связи с '+other+' · '+matches.length+' '+(matches.length===1?'тема':matches.length<5?'темы':'тем'));
    details.append(summary,n('p','Сопоставьте формулировки двух книг и проверьте различение на задаче.','links-meta'));
    const list=n('ul');for(const t of matches){const li=n('li');li.append(link(t.title+' →',topicHref(t.id)));list.append(li);}details.append(list);host.append(details);host.hidden=false;
  }
  window.BookLinks={renderReader};
  const list=document.getElementById('connectionsList'),detail=document.getElementById('connectionDetail');if(!list||!detail)return;
  const overview=document.getElementById('connectionsOverview'),query=document.getElementById('connectionsQuery'),group=document.getElementById('connectionsGroup'),status=document.getElementById('connectionsStatus');
  if(!data||data.schemaVersion!==1||!topics.length){status.textContent='Связи не загрузились. Обновите страницу или вернитесь в кабинет.';return;}
  for(const name of [...new Set(topics.map(t=>t.group))]){const option=n('option',name);option.value=name;group.append(option);}
  const normalize=s=>s.toLocaleLowerCase('ru').replaceAll('ё','е');
  function catalogue(){
    const q=normalize(query.value.trim()),found=topics.filter(t=>(!group.value||t.group===group.value)&&normalize([t.title,t.group,...t.aliases,t.comparison,...Object.values(t.sources).map(s=>s.focus)].join(' ')).includes(q));
    list.replaceChildren();status.textContent=found.length?'Тем: '+found.length+' из '+topics.length:'Тем не найдено. Измените запрос или сбросьте фильтры.';
    for(const t of found){const card=n('article',undefined,'platform-card links-topic'),h=n('h2');h.append(link(t.title,topicHref(t.id)));card.append(n('span',t.group,'eyebrow'),h,n('p',t.distinguish),link('Фиш → Oxford → задача',topicHref(t.id),'links-route'));list.append(card);}
  }
  function sourceCard(source,key){
    const card=n('section',undefined,'platform-card links-source');card.setAttribute('aria-label',key==='fish'?'Контекст Фиша':'Контекст Oxford');
    card.append(n('span',key==='fish'?'01 / ФИШ':'02 / OXFORD','eyebrow'),n('h2',source.title),n('p',source.focus));
    card.append(n('p',source.edition+' · '+source.chapter,'links-meta'));
    if(source.heading!==source.title)card.append(n('p','В разделе: '+source.heading,'links-meta'));
    const details=n('details'),summary=n('summary','Фрагмент опубликованного перевода');details.append(summary,n('blockquote',source.quote));card.append(details);
    card.append(n('p','Раздел в PDF: стр. '+source.pdfStart+'–'+source.pdfEnd+(source.printedPages?' · В книге: '+source.printedPages:''),'links-meta'),link('Читать в '+(key==='fish'?'Фише':'Oxford')+' →',source.href,'links-read'));
    return card;
  }
  function route(){
    const params=new URLSearchParams(location.hash.slice(1)),id=params.get('topic'),topic=topics.find(t=>t.id===id);
    overview.hidden=Boolean(id);detail.hidden=!id;detail.replaceChildren();
    document.title=topic?topic.title+' · Связи учебников':'Связи Oxford и Фиша · Психиатрия';
    if(!id){catalogue();return;}
    const back=link('← Все связи','connections.html','links-back');detail.append(back);
    if(!topic){detail.append(n('h1','Тема не найдена'),n('p','Эта ссылка не соответствует опубликованной теме. Выберите тему из каталога.'));detail.querySelector('h1').tabIndex=-1;detail.querySelector('h1').focus({preventScroll:true});return;}
    const title=n('h1',topic.title);title.id='connectionTitle';title.tabIndex=-1;
    detail.append(n('p',topic.group,'eyebrow'),title,n('p','Прочитайте описание феномена у Фиша, затем контекст Oxford и выполните задачу на различение.','platform-lead'));
    const nav=n('nav',undefined,'links-steps');nav.setAttribute('aria-label','Маршрут по теме');
    for(const [text,href]of [['1. Фиш',topic.sources.fish.href],['2. Oxford',topic.sources.oxford.href],['3. Задача',topic.task.href]])nav.append(link(text,href));detail.append(nav);
    const sources=n('div',undefined,'links-comparison');sources.append(sourceCard(topic.sources.fish,'fish'),sourceCard(topic.sources.oxford,'oxford'));detail.append(sources);
    const notes=n('section',undefined,'links-commentary');notes.setAttribute('aria-labelledby','comparisonTitle');const heading=n('h2','Что совпадает и что различается');heading.id='comparisonTitle';notes.append(n('p','ПОЯСНЕНИЕ К СОПОСТАВЛЕНИЮ · НЕ ТЕКСТ КНИГ','eyebrow'),heading,n('p',topic.comparison));detail.append(notes);
    const task=n('section',undefined,'platform-card links-task'),taskTitle=n('h2','Проверьте различение');task.setAttribute('aria-labelledby','connectionTaskTitle');taskTitle.id='connectionTaskTitle';
    task.append(n('span','03 / ЗАДАЧА','eyebrow'),taskTitle,n('p',topic.distinguish),n('p','Задание: '+topic.task.title+'. Разбор и подтверждающий фрагмент появятся после ответа.','links-meta'),link('Открыть задачу →',topic.task.href,'links-task-button'));
    task.append(n('p','Откроется подготовка одного вопроса. Если у вас уже идёт попытка, её можно продолжить или завершить — ответы не сбрасываются.','links-meta'));detail.append(task);
    detail.append(n('p','Связь составлена по опубликованным переводам. Фрагменты сохраняют контекст своих книг; пояснение не заменяет чтение разделов. Независимая клиническая редактура ожидается.','links-meta'));
    const adjacent=n('nav',undefined,'platform-actions');adjacent.setAttribute('aria-label','Другие сопоставления');const at=topics.indexOf(topic);if(at>0)adjacent.append(link('← '+topics[at-1].title,topicHref(topics[at-1].id)));if(at<topics.length-1)adjacent.append(link(topics[at+1].title+' →',topicHref(topics[at+1].id)));detail.append(adjacent);
    title.focus({preventScroll:true});window.scrollTo(0,0);
  }
  query.addEventListener('input',catalogue);group.addEventListener('change',catalogue);document.getElementById('resetConnections').onclick=()=>{query.value='';group.value='';catalogue();query.focus();};
  window.addEventListener('hashchange',route);route();
})();
