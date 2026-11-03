import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {serve} from '../tools/serve.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/jktru/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let base=process.env.STUDY_LIVE_URL,server;
if(!base){server=serve();await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
function fakeSpeech({initial=[],pauseMode='native',start=true,unavailable=false}={}){
 let list=initial,current=null,listeners=[];
 const engine={speaking:false,pending:false,paused:false,spoken:[],cancelled:0,
  getVoices:()=>list,
  addEventListener(type,fn){if(type==='voiceschanged')listeners.push(fn);},
  setVoices(v){list=v;listeners.forEach(f=>f());},
  cancel(){const old=current;current=null;this.speaking=false;this.pending=false;this.cancelled++;old?.onerror?.({error:'interrupted'});},
  pause(){if(pauseMode==='noop')return;if(pauseMode==='cancel'){this.cancel();return;}this.paused=true;},
  resume(){this.paused=false;},
  speak(u){current=u;this.pending=!start;this.speaking=start;this.spoken.push({text:u.text,lang:u.lang,voice:u.voice?.voiceURI||null,gesture:navigator.userActivation.isActive});if(start)u.onstart?.();},
  finish(){const old=current;current=null;this.speaking=false;this.pending=false;old?.onend?.();},
  fail(code){const old=current;current=null;this.speaking=false;this.pending=false;old?.onerror?.({error:code});},
  current:()=>current
 };
 window.fakeSpeech=engine;
 Object.defineProperty(window,'speechSynthesis',{value:unavailable?undefined:engine,configurable:true});
 Object.defineProperty(window,'SpeechSynthesisUtterance',{value:unavailable?undefined:class{constructor(text){this.text=text;this._voice=null;}get voice(){return this._voice;}set voice(value){if(value===undefined)throw Error('undefined voice is not a valid SpeechSynthesisVoice');this._voice=value;}},configurable:true});
 window.Audio=class{constructor(){this.paused=true;}setAttribute(){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}};
 localStorage.setItem('psychiatry-auto-next','0');
}
const ru={name:'Русский',voiceURI:'test-ru',lang:'ru_RU',localService:true},en={name:'English',voiceURI:'test-en',lang:'en-US',localService:true};
async function pageFor(options={},path='index.html#section=ch10-s09'){
 const context=await browser.newContext({viewport:{width:1024,height:768},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.addInitScript(fakeSpeech,options);const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.goto(base+'/'+path);
 await p.waitForFunction(()=>document.getElementById('article')?.textContent.length>100&&!document.getElementById('reader').hasAttribute('aria-busy'));
 return{p,context};
}
try{
 await fs.mkdir(new URL('../tmp/qa/',import.meta.url),{recursive:true});
 const {p,context}=await pageFor();
 assert(await p.locator('#speakButton').isEnabled(),'an empty voice enumeration must not disable speech');
 await p.click('#speakButton');let log=await p.evaluate(()=>fakeSpeech.spoken);
 assert.equal(log.length,1);assert.equal(log[0].lang,'ru-RU');assert.equal(log[0].voice,null);assert.equal(log[0].gesture,true,'first speech call must stay inside the tap gesture');
 assert.match(await p.locator('#speakButton').innerText(),/Пауза/);
 const cancels=await p.evaluate(()=>fakeSpeech.cancelled);await p.evaluate(ru=>fakeSpeech.setVoices([ru]),ru);
 assert.equal(await p.evaluate(()=>fakeSpeech.cancelled),cancels,'late voices must not interrupt active speech');
 await p.click('#speechSettingsButton');assert.equal(await p.locator('#voiceSelect option').count(),2);await p.selectOption('#voiceSelect','test-ru');
 await p.click('#testVoice');assert.equal(await p.evaluate(()=>fakeSpeech.spoken.at(-1).voice),'test-ru');await p.evaluate(()=>fakeSpeech.finish());assert.match(await p.locator('#voiceHint').innerText(),/завершена/);
 await p.clock.fastForward(1700);assert.match(await p.locator('#voiceHint').innerText(),/завершена/,'late enumeration must not erase the voice test result');
 await p.screenshot({path:new URL('../tmp/qa/speech-tablet-settings.png',import.meta.url).pathname.slice(1)});await p.click('[data-close="speechDialog"]');
 await p.click('#speakButton');await p.evaluate(()=>fakeSpeech.fail('voice-unavailable'));
 assert.equal(await p.evaluate(()=>fakeSpeech.spoken.at(-1).voice),null,'a disappeared explicit voice retries once using automatic language selection');
 assert.match(await p.locator('#speakButton').innerText(),/Пауза/);
 const first=await p.evaluate(()=>fakeSpeech.spoken.at(-1).text);await p.click('#nextParaButton');
 assert.notEqual(await p.evaluate(()=>fakeSpeech.spoken.at(-1).text),first);assert.match(await p.locator('#speakButton').innerText(),/Пауза/,'synchronous cancellation errors must not stop the new paragraph');
 await p.click('#stopButton');await p.clock.fastForward(20000);assert(await p.locator('#stopButton').isDisabled());await context.close();
 console.log('PASS empty list fallback, trusted-tap ru-RU start, delayed voices, valid explicit voice, preview, one-time voice fallback and cancellation-safe paragraph seek');

 for(const pauseMode of ['native','cancel','noop']){
  const {p,context}=await pageFor({pauseMode});await p.click('#speakButton');const text=await p.evaluate(()=>fakeSpeech.spoken[0].text);await p.click('#speakButton');
  await p.clock.fastForward(250);assert.match(await p.locator('#speakButton').innerText(),/Продолжить/);
  if(pauseMode!=='native')assert.equal(await p.evaluate(()=>fakeSpeech.speaking),false,'broken mobile pause must still silence speech');
  await p.click('#speakButton');assert.match(await p.locator('#speakButton').innerText(),/Пауза/);
  assert.equal(await p.evaluate(()=>fakeSpeech.spoken.at(-1).text),text,'fallback resumes from the current fragment without skipping text');
  await p.click('#stopButton');await context.close();
 }
 console.log('PASS normal pause/resume and mobile engines that cancel or ignore pause');

 for(const code of ['language-unavailable','not-allowed','network']){
  const {p,context}=await pageFor({initial:[en]});await p.click('#speakButton');assert.equal(await p.evaluate(()=>fakeSpeech.spoken[0].voice),null,'an English voice must not be forced onto Russian text');await p.evaluate(code=>fakeSpeech.fail(code),code);
  const count=await p.evaluate(()=>fakeSpeech.spoken.length);await p.clock.fastForward(30000);assert.equal(await p.evaluate(()=>fakeSpeech.spoken.length),count,'failed speech must not enter an endless watchdog restart loop');
  const text=await p.locator('#speechStatus').innerText();assert.match(text,code==='language-unavailable'?/Android/:code==='network'?/соединение/:/разрешение звука/);assert(await p.locator('#speakButton').isEnabled());assert(await p.locator('#stopButton').isDisabled());await context.close();
 }
 const pending=await pageFor({start:false});await pending.p.click('#speakButton');await pending.p.clock.fastForward(16000);assert.match(await pending.p.locator('#speechStatus').innerText(),/остановлено/);assert(await pending.p.locator('#stopButton').isDisabled());await pending.context.close();
 console.log('PASS real error messages persist through delayed voice updates; missing-language, activation/network and silent startup failures remain recoverable');

 const fish=await pageFor({},'fish.html#section=fish-ch10-text');await fish.p.click('#speakButton');assert.equal(await fish.p.evaluate(()=>fakeSpeech.spoken[0].lang),'ru-RU');await fish.p.click('#stopButton');await fish.context.close();
 const auto=await pageFor({},'index.html#section=ch03-s11');await auto.p.evaluate(()=>localStorage.setItem('psychiatry-auto-next','1'));await auto.p.click('#speakButton');await auto.p.evaluate(()=>{for(let i=0;i<10000;i++)fakeSpeech.finish();});
 await auto.p.waitForFunction(()=>location.hash==='#section=ch04-s01'&&!document.getElementById('stopButton').disabled);await auto.p.click('#stopButton');await auto.context.close();
 const noAPI=await pageFor({unavailable:true});assert(await noAPI.p.locator('#speakButton').isDisabled());await noAPI.context.close();
 const practiceContext=await browser.newContext({serviceWorkers:'block'});await practiceContext.addInitScript(fakeSpeech,{});const a=await practiceContext.newPage();a.on('pageerror',e=>errors.push(e.message));await a.goto(base+'/practice.html#audio');await a.getByRole('button',{name:'▶ Прослушать',exact:true}).click();assert.equal(await a.evaluate(()=>fakeSpeech.spoken[0].lang),'ru-RU');assert.equal(await a.evaluate(()=>fakeSpeech.spoken[0].voice),null);await practiceContext.close();
 assert.deepEqual(errors,[]);console.log('PASS both textbooks, audio practice and explicit unsupported-API state with no page errors');
}finally{await browser.close();if(server){server.closeAllConnections();server.close();}}
