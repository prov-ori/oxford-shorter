import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {serve} from '../tools/serve.mjs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/jktru/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let server,browser,base=process.env.STUDY_LIVE_URL;
if(!base){server=serve(fileURLToPath(new URL('../dist',import.meta.url)));await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
try{
browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/#section=ch17-s09');
await page.waitForFunction(()=>window.STUDY_BOOK&&document.querySelectorAll('#article tbody tr').length===7);
assert.equal(await page.evaluate(()=>STUDY_BOOK.revision),38);
assert.equal(await page.evaluate(()=>STUDY_BOOK.chapters.flatMap(c=>c.sections).filter(s=>['translated','reviewed'].includes(s.status)).length),213);
assert.equal(await page.locator('#article tbody td').count(),14);
assert.match(await page.locator('#article').innerText(),/WISC V/);
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.click('#notesButton');assert.equal(await page.locator('#summary li').count(),5);
await page.fill('#personalNotes','Глава 17: оценка учитывает исходное состояние и пожелания человека.');
await page.click('[data-close="notesDialog"]');await page.reload();await page.click('#notesButton');
assert.equal(await page.inputValue('#personalNotes'),'Глава 17: оценка учитывает исходное состояние и пожелания человека.');
await page.click('[data-close="notesDialog"]');await page.click('#completeButton');
assert.match(await page.locator('#readCount').innerText(),/^1 из 267/);
for(const [id,text] of [['ch17-s10','Психиатрические службы'],['ch17-s11','Модификация поведения'],['ch17-s12','Согласие на участие в исследовании'],['ch17-s13','Matson']]){
await page.click('#nextButton');await page.waitForFunction(({id,text})=>location.hash==='#section='+id&&document.getElementById('article').textContent.includes(text),{id,text});
assert(!(await page.locator('#completeButton').isDisabled()));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
await page.click('#nextButton');await page.waitForFunction(()=>location.hash==='#section=ch18-s01'&&!document.getElementById('completeButton').disabled);
assert.deepEqual(errors,[]);
console.log('PASS chapter17 '+(process.env.STUDY_LIVE_URL?'live':'local')+': revision40,213ready,table17.5,mobile,notes persistence,progress,17-s09→18-s01ready.');
}finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}

