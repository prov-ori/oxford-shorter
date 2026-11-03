(function(){'use strict';
 const n=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const file=location.pathname.split('/').pop()||'index.html',reader=['index.html','fish.html'].includes(file),page=reader?'reader':file.replace('.html','');
 document.body.classList.add('ui-page-'+page);
 const header=document.querySelector('.topbar');
 if(header){
  const brand=header.querySelector('.brand'),notes=header.querySelector('#notesButton'),materials=header.querySelector('#libraryButton'),nav=n('nav',undefined,'ui-nav'),actions=n('div',undefined,'ui-header-actions'),toggle=n('button','Меню','quiet outlined ui-menu-toggle');
  header.classList.add('ui-header');nav.id='uiGlobalNav';nav.setAttribute('aria-label','Основные разделы');
  if(brand){brand.href='study.html';brand.setAttribute('aria-label','Психиатрия — учебный кабинет');}
  const active=reader||file==='connections.html'?'study.html':file==='neuro.html'?'lab.html':file;
  for(const [href,text]of[['study.html','Кабинет'],['quiz.html','Тесты'],['practice.html','Практика'],['lab.html','Инструменты'],['library.html','Библиотека']]){const a=n('a',text,'nav-link');a.href=href;if(href===active)a.setAttribute('aria-current',file===href?'page':'location');nav.append(a);}
  if(materials){materials.classList.add('ui-materials');nav.append(materials);}
  const search=n('a',undefined,'ui-search quiet');search.href='study.html#search';search.setAttribute('aria-label','Поиск по материалам');search.title='Поиск по материалам · /';search.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
  const connection=n('div',undefined,'ui-connection'),offlineLink=n('a','Вы без сети · Офлайн-материалы');offlineLink.href='study.html#offline';connection.append(offlineLink);connection.setAttribute('role','status');const network=()=>{connection.hidden=navigator.onLine;};network();window.addEventListener('online',network);window.addEventListener('offline',network);
  actions.append(search);if(notes)actions.append(notes);actions.append(toggle);toggle.type='button';toggle.setAttribute('aria-controls',nav.id);
  header.replaceChildren(...[brand,nav,actions].filter(Boolean));header.after(connection);
  const small=matchMedia('(max-width:1100px)');let open=false;
  function menu(value,focus=false){open=value&&small.matches;nav.hidden=small.matches&&!open;toggle.hidden=!small.matches;toggle.setAttribute('aria-expanded',String(open));header.classList.toggle('ui-menu-open',open);if(focus)toggle.focus({preventScroll:true});}
  toggle.onclick=()=>menu(!open);small.addEventListener('change',()=>menu(false));menu(false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open&&!document.querySelector('dialog[open]')){e.preventDefault();menu(false,true);}if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest('input,textarea,select,[contenteditable=true]')&&!document.querySelector('dialog[open]')){e.preventDefault();location.href='study.html#search';}});
  document.addEventListener('pointerdown',e=>{if(open&&!header.contains(e.target)&&!document.querySelector('dialog[open]'))menu(false);});
  header.addEventListener('focusout',()=>requestAnimationFrame(()=>{if(open&&!header.contains(document.activeElement)&&!document.querySelector('dialog[open]'))menu(false);}));
  nav.addEventListener('click',e=>{if(e.target.closest('a'))menu(false);});
 }
 let searchObserver;
 function route(){
  searchObserver?.disconnect();
  if(file==='study.html'&&location.hash==='#search'){
   const input=document.getElementById('globalQuery'),section=input?.closest('section');
   const focus=()=>{if(location.hash!=='#search'){searchObserver?.disconnect();return;}if(input?.getClientRects().length){input.focus({preventScroll:true});searchObserver?.disconnect();}};
   if(section){searchObserver=new MutationObserver(focus);searchObserver.observe(section,{attributes:true,attributeFilter:['hidden']});focus();}
  }
  if(reader)document.body.classList.toggle('ui-reading',new URLSearchParams(location.hash.slice(1)).has('section'));
 }
 window.addEventListener('hashchange',route);route();
 // Keep the laboratory switcher one row high on touch screens. The existing
 // tab handlers remain the source of truth for routing and simulation state.
 if(file==='lab.html'){
  const tablist=document.querySelector('.lab .tabs'),tabs=[...document.querySelectorAll('.lab .tabs [role=tab]')];
  if(tablist&&tabs.length){
   const picker=n('div',undefined,'ui-lab-picker'),label=n('label','Инструмент'),select=n('select');
   select.id='labToolSelect';label.htmlFor=select.id;
   for(const tab of tabs){const option=n('option',tab.textContent.trim());option.value=tab.id.slice(2);select.append(option);}
   const sync=()=>{const active=tabs.find(t=>t.getAttribute('aria-selected')==='true');if(active){select.value=active.id.slice(2);select.setAttribute('aria-controls',active.getAttribute('aria-controls'));}};
   sync();picker.append(label,select);tablist.before(picker);tablist.classList.add('ui-lab-tabs');
   new MutationObserver(sync).observe(tablist,{subtree:true,attributes:true,attributeFilter:['aria-selected']});
   select.onchange=()=>{const tab=tabs.find(t=>t.id==='t-'+select.value);if(!tab)return;tab.click();requestAnimationFrame(()=>document.getElementById(tab.getAttribute('aria-controls'))?.scrollIntoView({block:'start'}));};
  }
 }
 // A quick attempt uses the existing validated form and all currently selected topic filters.
 if(file==='quiz.html'){
  const hero=document.querySelector('.q-hero'),start=document.getElementById('startButton'),resume=document.getElementById('resumeCard');
  if(hero&&start){
   const card=n('section',undefined,'ui-quick-quiz'),copy=n('div'),b=n('button','Начать 5 вопросов','primary');card.setAttribute('aria-label','Быстрая тренировка');copy.append(n('h2','Короткая тренировка'),n('p','По выбранным темам, без таймера. Разбор — после каждого ответа.'));card.append(copy,b);hero.after(card);
   const update=()=>{const active=resume&&!resume.hidden,count=Math.min(5,Number(start.dataset.available??5));b.textContent=active?'Продолжить попытку':count?'Начать '+count+' '+(count===1?'вопрос':count<5?'вопроса':'вопросов'):'Нет вопросов';b.disabled=!active&&start.disabled;};
   new MutationObserver(update).observe(start,{attributes:true,attributeFilter:['disabled','data-available']});if(resume)new MutationObserver(update).observe(resume,{attributes:true,attributeFilter:['hidden']});update();
   b.onclick=()=>{if(resume&&!resume.hidden){document.getElementById('resumeButton').click();return;}for(const[id,value]of[['modeSelect','training'],['countSelect','5']]){const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));}if(!start.disabled)document.getElementById('configForm').requestSubmit(start);};
  }
 }
 // Notify without interrupting an answer, a note or an ongoing simulation.
 if('serviceWorker'in navigator){let controlled=!!navigator.serviceWorker.controller;const changed=()=>{if(!controlled){controlled=true;return;}if(document.getElementById('uiUpdate'))return;const box=n('aside',undefined,'ui-update');box.id='uiUpdate';box.setAttribute('aria-label','Обновление сайта');const text=n('p','Доступна новая версия сайта.');text.setAttribute('role','status');const refresh=n('button','Обновить страницу','primary'),later=n('button','Позже','quiet');refresh.onclick=()=>location.reload();later.onclick=()=>box.remove();box.append(text,refresh,later);document.body.append(box);};navigator.serviceWorker.addEventListener('controllerchange',changed);}
 window.SiteUI={watchLab(root){const stage=root.querySelector('.systems-stage,.synapse-stage');if(!stage)return()=>{};const check=()=>{const height=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height'))||64;stage.classList.toggle('ui-stage-static',stage.getBoundingClientRect().height>innerHeight-height-24);};const observer=new ResizeObserver(check);observer.observe(stage);window.addEventListener('resize',check);check();return()=>{observer.disconnect();window.removeEventListener('resize',check);};}};document.documentElement.dataset.uiReady='true';
})();
