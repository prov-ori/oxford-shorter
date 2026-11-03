(function(){
 'use strict';const n=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function download(name,data){const url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'})),a=n('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function sourceBox(sources){const box=n('div',undefined,'platform-sources');box.append(n('p','Учебный материал. Независимая клиническая редактура ожидается.','platform-meta'));for(const s of sources||[]){const a=n('a',s.book+' · '+(s.edition?s.edition+' · ':'')+s.title+' · PDF '+s.pdfStart+'–'+s.pdfEnd);a.href=s.href;box.append(a);if(s.sourceRevision)box.append(n('small',' Редакция перевода: '+s.sourceRevision));const d=n('details'),summary=n('summary','Фрагмент источника');d.append(summary,n('blockquote',s.quote));box.append(d);}return box;}
 function highlight(container,text,query){container.replaceChildren(...PlatformModel.highlightParts(text,query).map(x=>x.match?n('mark',x.text):document.createTextNode(x.text)));}
 async function json(path){const r=await fetch(path);if(!r.ok)throw Error('Не удалось загрузить '+path);return r.json();}
 window.PlatformUI={n,download,sourceBox,highlight,json};
 const speechSupported=()=>typeof window.SpeechSynthesisUtterance==='function'&&typeof window.speechSynthesis?.speak==='function';
 function russianVoices(){try{return speechSupported()?Array.from(speechSynthesis.getVoices()||[]).filter(v=>/^ru(?:[-_]|$)/i.test(v.lang||'')).sort((a,b)=>Number(b.localService)-Number(a.localService)):[];}catch{return[];}}
 function configureSpeech(utterance,uri=''){utterance.lang='ru-RU';const voice=uri&&russianVoices().find(v=>v.voiceURI===uri);if(voice)utterance.voice=voice;return utterance;}
 function speechError(code){
  if(code==='language-unavailable'||code==='synthesis-unavailable')return 'Система не смогла озвучить русский текст. На Android откройте настройки устройства → «Преобразование текста в речь» (или «Синтез речи»), выберите движок и добавьте русский язык. Затем вернитесь и нажмите «Слушать».';
  if(code==='voice-unavailable')return 'Выбранный голос недоступен. В настройках голоса выберите «Автоматически · русский язык» и повторите запуск.';
  if(code==='not-allowed')return 'Браузер не разрешил запуск речи. Нажмите «Слушать» ещё раз непосредственно на странице и проверьте разрешение звука для сайта.';
  if(code==='network')return 'Не удалось загрузить сетевой голос. Проверьте соединение или выберите голос «на устройстве» в настройках речи.';
  if(code==='audio-busy'||code==='audio-hardware')return 'Система не смогла вывести звук. Проверьте громкость мультимедиа, подключённые наушники и другие приложения, затем повторите запуск.';
  return 'Озвучивание остановлено. Нажмите «Слушать» ещё раз или откройте настройки голоса и выполните проверку.';
 }
 window.PlatformSpeech={supported:speechSupported,russianVoices,configure:configureSpeech,errorMessage:speechError};
 function scrollHints(){for(const strip of document.querySelectorAll('.tabs[role=tablist]')){const update=()=>strip.classList.toggle('at-end',strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-4);strip.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);const sel=()=>{const b=strip.querySelector('[aria-selected=true]');if(b&&strip.scrollWidth>strip.clientWidth){const l=b.offsetLeft-strip.offsetLeft,r=l+b.offsetWidth;if(l<strip.scrollLeft||r>strip.scrollLeft+strip.clientWidth)strip.scrollTo({left:Math.max(0,l-24)});}update();};new MutationObserver(sel).observe(strip,{subtree:true,attributes:true,attributeFilter:['aria-selected']});sel();}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scrollHints);else scrollHints();
 if('serviceWorker'in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(()=>{const s=document.getElementById('offlineServiceStatus');if(s)s.textContent='Офлайн-служба готова. Скачайте нужные главы и дождитесь подтверждения комплектности.';}).catch(()=>{const s=document.getElementById('offlineServiceStatus');if(s)s.textContent='Офлайн-служба недоступна в этом браузере.';}));
})();
