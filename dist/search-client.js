(function(root){let worker=null,serial=0;const pending=new Map();
 function search(query,options={}){return new Promise((resolve,reject)=>{if(!worker){try{worker=new Worker('search-worker.js');worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data);};worker.onerror=()=>{for(const p of pending.values())p.reject(Error('Поиск недоступен. Обновите страницу или подключитесь к сети.'));pending.clear();worker.terminate();worker=null;};}catch(e){reject(e);return;}}const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,query,...options});});}
 root.StudySearch={search};
})(globalThis);
