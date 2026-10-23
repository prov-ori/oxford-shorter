(function(root){
 'use strict';const pending=new Map();
 async function loadSection(book,section){
  if(!section.contentFile||section.blocks.length)return section;
  if(!/^data\/chapters\/[a-z0-9-]+\.json$/.test(section.contentFile))throw Error('Некорректный путь главы');
  let request=pending.get(section.contentFile);
  if(!request){request=(async()=>{const r=await fetch(section.contentFile).catch(()=>{throw Error('Глава недоступна. Подключитесь к сети или заранее скачайте её на вкладке «Офлайн».');});if(!r.ok)throw Error('Глава недоступна. Подключитесь к сети или скачайте её для офлайн-чтения.');const raw=await r.text(),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)),hex=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');if(hex!==section.contentSha256)throw Error('Версия главы не совпала с оглавлением. Обновите страницу при подключении к сети.');const chapter=JSON.parse(raw);StudyModel.validateBook({...book,lazyContent:false,chapters:[chapter]});return chapter;})();pending.set(section.contentFile,request);request.catch(()=>pending.delete(section.contentFile));}
  const chapter=await request,item=chapter.sections.find(s=>s.id===section.id);if(!item)throw Error('Раздел не найден в главе');Object.assign(section,item);return section;
 }
 root.StudyContent={loadSection};
})(globalThis);
