import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {serve} from '../tools/serve.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/jktru/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let base=process.env.STUDY_LIVE_URL,server;
if(!base){server=serve();await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/WebGL|GL_INVALID/.test(m.text()))errors.push(m.text());});};
const go=async(p,path)=>{await p.goto(base+'/'+path);await p.waitForFunction(()=>document.documentElement.dataset.uiReady==='true');};
const fit=async p=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page must fit without masking horizontal overflow');
try{
 await fs.mkdir(new URL('../tmp/qa/',import.meta.url),{recursive:true});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await context.newPage();watch(p);
 await go(p,'study.html');await p.locator('#todayPlan article').first().waitFor();
 assert((await p.locator('.ui-header').boundingBox()).height<=65);
 assert(await p.locator('#uiGlobalNav').isHidden());await p.getByRole('button',{name:'Меню',exact:true}).click();
 assert.equal(await p.locator('#uiGlobalNav a').count(),5);await p.keyboard.press('Escape');
 assert(await p.locator('#uiGlobalNav').isHidden());assert(await p.getByRole('button',{name:'Меню',exact:true}).evaluate(e=>e===document.activeElement));
 await p.getByRole('button',{name:'Меню',exact:true}).click();await p.locator('#uiGlobalNav').getByRole('link',{name:'Тесты',exact:true}).click();
 await p.waitForURL('**/quiz.html');assert.equal(await p.locator('#uiGlobalNav a[href="quiz.html"]').getAttribute('aria-current'),'page');
 const quick=p.locator('.ui-quick-quiz button');assert((await quick.boundingBox()).y<650,'quick training must be available on the first phone screen');
 await p.check('input[name=book][value=fish]');await p.selectOption('#countSelect','20');await quick.click();
 await p.waitForFunction(()=>location.hash==='#attempt');
 const run=await p.evaluate(()=>JSON.parse(localStorage.getItem(KnowledgeModel.KEY)).active);
 assert.equal(run.questionIds.length,5);assert.equal(run.mode,'training');assert(await p.evaluate(ids=>ids.every(id=>KNOWLEDGE_BANK.questions.find(q=>q.id===id).book==='fish'),run.questionIds));
 await p.click('#backToSetup');await quick.getByText('Продолжить попытку').waitFor();await quick.click();
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(KnowledgeModel.KEY)).active.id),run.id,'quick action must resume rather than replace an unfinished attempt');
 await p.evaluate(()=>localStorage.removeItem(KnowledgeModel.KEY));await go(p,'quiz.html');await p.locator('.q-chapters summary').click();await p.click('#clearChapters');
 await p.waitForFunction(()=>document.querySelector('.ui-quick-quiz button').disabled);assert(await quick.isDisabled());
 const one=await p.evaluate(()=>KnowledgeModel.activeQuestions(KNOWLEDGE_BANK)[0].id);
 await go(p,'quiz.html?question='+encodeURIComponent(one));
 await quick.getByText('Начать 1 вопрос',{exact:true}).waitFor();await quick.click();
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(KnowledgeModel.KEY)).active.questionIds.length),1);
 await p.evaluate(()=>localStorage.removeItem(KnowledgeModel.KEY));
 console.log('PASS compact navigation, keyboard Escape, explicit Test route, first-screen quick training respecting book filters, resume protection and empty pool');

 await go(p,'index.html#section=ch01-s03');await p.locator('#article p').first().waitFor();
 await p.getByRole('button',{name:'Меню',exact:true}).click();await p.click('#libraryButton');assert(await p.locator('#libraryDialog').isVisible());
 await p.keyboard.press('Escape');assert(await p.locator('#libraryDialog').isHidden());
 assert(await p.locator('#libraryButton').evaluate(e=>e===document.activeElement));
 await p.keyboard.press('Escape');assert(await p.locator('#uiGlobalNav').isHidden());
 await p.click('#tocButton');assert.equal(await p.locator('#sidebar').getAttribute('role'),'dialog');await p.keyboard.press('Escape');
 assert(await p.locator('#sidebar').isHidden());await p.click('#notesButton');await p.fill('#personalNotes','UI audit: заметка сохраняется после обновления интерфейса.');
 await p.keyboard.press('Escape');await p.reload();await p.locator('#article p').first().waitFor();await p.click('#notesButton');assert.match(await p.locator('#personalNotes').inputValue(),/UI audit/);await p.keyboard.press('Escape');
 await p.locator('body').click({position:{x:5,y:300}});await p.keyboard.press('/');await p.waitForURL('**/study.html#search');
 await p.waitForFunction(()=>document.activeElement?.id==='globalQuery');await p.fill('#globalQuery','тест');await p.keyboard.type('/');assert.equal(new URL(p.url()).hash,'#search');assert.equal(await p.locator('#globalQuery').inputValue(),'тест/');
 console.log('PASS menu/native dialog Escape ordering, contents focus/close, preserved reader notes, search shortcut and no shortcut interception while typing');

 await go(p,'library.html');await p.getByLabel('Тема книги',{exact:true}).selectOption('anatomy');assert.match(await p.locator('#count').innerText(),/7 книг/);
 await p.fill('#search','Неттера');await p.click('#reset');assert.equal(await p.locator('#libraryCategory').inputValue(),'all');assert.match(await p.locator('#count').innerText(),/51 книга/);
 await go(p,'neuro.html#astrocyte');await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true');
 assert.equal(await p.locator('#neuroModelSelect option').count(),13);assert(await p.locator('#neuroIntro').isHidden());
 await p.getByRole('link',{name:'Параметры',exact:true}).click();assert.equal(new URL(p.url()).hash,'#astrocyte');assert(await p.locator('#neuroParameters').evaluate(e=>e===document.activeElement));
 await p.getByRole('link',{name:'Модель',exact:true}).click();assert.equal(new URL(p.url()).hash,'#astrocyte');
 await p.getByLabel('Выберите модель',{exact:true}).selectOption('atlas');await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true'&&document.querySelector('canvas').dataset.source);
 await p.getByLabel('Раздвинуть корковые полушария',{exact:true}).fill('40');assert.equal(await p.locator('canvas').getAttribute('data-split'),'40');
 for(const width of[320,390,768,1024,1440]){await p.setViewportSize({width,height:960});await fit(p);}
 await p.setViewportSize({width:768,height:1024});await p.getByLabel('Выберите модель',{exact:true}).selectOption('astrocyte');await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.model==='astrocyte');
 const stage=await p.locator('.systems-stage').boundingBox(),controls=await p.locator('#neuroParameters').boundingBox();assert(controls.x>stage.x+stage.width-5,'tablet must show the model and controls side by side');
 await p.screenshot({path:new URL('../tmp/qa/ui-model-tablet.png',import.meta.url).pathname.slice(1)});
 await go(p,'neuro.html#missing-model');assert.match(await p.locator('#neuroStatus').innerText(),/модели нет/);assert.equal(await p.locator('#neuroOverview .neuro-index>a').count(),13);
 await context.close();console.log('PASS library category/reset, 13-model selector, in-page anchors preserve model route, tablet split view and unknown-model recovery');

 const recovery=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),r=await recovery.newPage();watch(r);
 await r.route('**/data/catalogue.json',route=>route.fulfill({status:503,body:'Unavailable'}));
 await go(r,'study.html');await r.getByRole('button',{name:'Повторить загрузку',exact:true}).waitFor();
 assert.match(await r.locator('#hubStatus').innerText(),/Кабинет не загрузился/);assert(!(await r.locator('#hubStatus').innerText()).includes('data/catalogue'));
 await r.unroute('**/data/catalogue.json');await r.getByRole('button',{name:'Повторить загрузку',exact:true}).click();await r.locator('#todayPlan article').first().waitFor();
 await recovery.close();console.log('PASS clear loading failure, safe retry and recovered dashboard');

 const offline=await browser.newContext({viewport:{width:390,height:844}}),o=await offline.newPage();watch(o);
 await go(o,'study.html');await o.evaluate(()=>navigator.serviceWorker.ready);await o.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await offline.setOffline(true);await o.reload();assert(await o.locator('.ui-connection').isVisible());
 await o.getByRole('button',{name:'Меню',exact:true}).click();await o.locator('#uiGlobalNav').getByRole('link',{name:'Инструменты',exact:true}).click();await o.waitForURL('**/lab.html');
 await go(o,'neuro.html#astrocyte');await o.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true');await fit(o);
 await offline.close();assert.deepEqual(errors,[]);console.log('PASS offline navigation/design/model, explicit connection state and no page/WebGL errors');
}finally{await browser.close();if(server){server.closeAllConnections();server.close();}}
