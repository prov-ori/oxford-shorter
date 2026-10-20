import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {serve} from '../tools/serve.mjs';
import '../dist/quiz-model.js';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/jktru/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const KEY = 'psycholibrary:knowledge:v1';
let base = process.env.STUDY_LIVE_URL, server, browser;
if (!base) {
  server = serve(fileURLToPath(new URL('../dist', import.meta.url)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
}
const url = base.replace(/\/$/, '') + '/quiz.html';
const qa = new URL('../tmp/qa/', import.meta.url);
const errors = [];
function watch(page) { page.on('pageerror', e => errors.push(e.message)); }
async function open(page) {
  await page.goto(url + '#setup');
  await page.waitForFunction(() => window.KNOWLEDGE_BANK && document.getElementById('poolHint').textContent.length > 0);
  assert(await page.locator('#fatalError').isHidden());
}
async function active(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)).active, KEY); }
async function state(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY); }
async function choose(page, correct = true) {
  const choice = await page.evaluate(({key, correct}) => {
    const run = JSON.parse(localStorage.getItem(key)).active;
    const question = KNOWLEDGE_BANK.questions.find(q => q.id === run.questionIds[run.index]);
    return correct ? question.correctOptionId : question.options.find(o => o.id !== question.correctOptionId).id;
  }, {key: KEY, correct});
  await page.locator(`#answerChoices input[value="${choice}"]`).check();
  return choice;
}
async function start(page, mode = 'training') {
  await page.selectOption('#modeSelect', mode);
  await page.selectOption('#countSelect', '5');
  await page.click('#startButton');
  await page.waitForFunction(() => location.hash === '#attempt' && !document.getElementById('runScreen').hidden);
  assert.equal(await page.locator('#answerChoices input').count(), 4);
}
async function finish(page, skipped) {
  await page.click('#finishButton');
  assert(await page.locator('#finishDialog').isVisible());
  assert.match(await page.locator('#finishDescription').innerText(), new RegExp('Пропущено: ' + skipped));
  await page.click('#confirmFinish');
  await page.waitForFunction(() => location.hash.startsWith('#result=') && !document.getElementById('resultScreen').hidden);
}
async function noOverflow(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow on 360 px viewport');
}

try {
  browser = await chromium.launch({channel: 'msedge', headless: true});
  await fs.mkdir(qa, {recursive: true});
  // A real v1 bank attempt must survive adding questions: preserve answers, ordering, deadline and score.
  const expandedBank=JSON.parse(await fs.readFile(new URL('../dist/data/quiz-bank.json',import.meta.url),'utf8'));
  const frozen=JSON.parse(await fs.readFile(new URL('../content/quiz-v1-fingerprints.json',import.meta.url),'utf8'));
  const originalBank={...expandedBank,questions:expandedBank.questions.filter(q=>Object.hasOwn(frozen.questions,q.id))};delete originalBank.contentRevision;
  assert.equal(originalBank.questions.length,236);
  const legacyNow=Date.now();let legacyState=KnowledgeModel.start(KnowledgeModel.emptyState(originalBank),originalBank,{mode:'exam',count:5,minutes:20},legacyNow,()=>0.45);
  const oldQuestion=originalBank.questions.find(q=>q.id===legacyState.active.questionIds[0]);legacyState=KnowledgeModel.choose(legacyState,originalBank,oldQuestion.correctOptionId,legacyNow+1);
  const legacyContext=await browser.newContext({viewport:{width:360,height:800}});await legacyContext.addInitScript(({key,saved})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(saved));},{key:KEY,saved:legacyState});
  const legacyPage=await legacyContext.newPage();watch(legacyPage);await legacyPage.goto(url+'#attempt');await legacyPage.waitForFunction(()=>!document.getElementById('runScreen').hidden&&document.querySelector('#answerChoices input:checked'));
  assert.equal(await legacyPage.evaluate(()=>KNOWLEDGE_BANK.questions.length),308);assert.deepEqual((await active(legacyPage)),legacyState.active);assert(await legacyPage.locator('#answerFeedback').isHidden());
  await legacyPage.click('#nextQuestion');await choose(legacyPage,true);await legacyPage.reload();await legacyPage.waitForFunction(()=>document.querySelector('#answerChoices input:checked'));
  assert.equal((await active(legacyPage)).deadline,legacyState.active.deadline);assert.deepEqual((await active(legacyPage)).optionOrders,legacyState.active.optionOrders);
  await finish(legacyPage,3);assert.equal(await legacyPage.locator('#resultPercent').innerText(),'40%');assert.equal((await state(legacyPage)).history.length,1);assert.equal((await state(legacyPage)).events.length,5);await legacyContext.close();
  // Render a new, long question from each book, rather than relying on a random draw to include new content.
  for(const book of ['oxford','fish']){
    const newest=expandedBank.questions.filter(q=>q.book===book&&!Object.hasOwn(frozen.questions,q.id));
    assert.equal(newest.length,book==='oxford'?52:20);
    const length=q=>q.stem.length+q.options.reduce((sum,o)=>sum+o.text.length,0);
    const q=newest.sort((a,b)=>length(b)-length(a))[0];
    const singleBank={...expandedBank,questions:[q]},saved=KnowledgeModel.start(KnowledgeModel.emptyState(singleBank),singleBank,{mode:'training',count:'all'},Date.now(),()=>0.4);
    const fresh=await browser.newContext({viewport:{width:360,height:800}});
    await fresh.addInitScript(({key,saved})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(saved));},{key:KEY,saved});
    const sample=await fresh.newPage();watch(sample);await sample.goto(url+'#attempt');
    await sample.waitForFunction(()=>!document.getElementById('runScreen').hidden&&document.querySelector('#answerChoices input'));
    assert((await sample.locator('#questionTitle').innerText()).includes(q.stem));
    await choose(sample,true);await sample.click('#checkAnswer');
    await sample.locator('#answerFeedback details').evaluate(element=>element.open=true);
    assert.equal((await sample.locator('#answerFeedback blockquote').innerText()).trim(),q.sourceEvidence);
    assert((await sample.locator('#answerFeedback .q-source-link').getAttribute('href')).endsWith('#section='+q.sectionId));
    await noOverflow(sample);await sample.screenshot({path:fileURLToPath(new URL('quiz-new-'+book+'.png',qa)),fullPage:true});
    await finish(sample,0);assert.equal(await sample.locator('#resultPercent').innerText(),'100%');await fresh.close();
  }
  const context = await browser.newContext({viewport: {width: 360, height: 800}, acceptDownloads: true});
  const page = await context.newPage(); watch(page);
  await open(page); await noOverflow(page);
  const counts = await page.evaluate(() => Object.fromEntries(Object.keys(KNOWLEDGE_BANK.books).map(book => [book, KNOWLEDGE_BANK.questions.filter(q => q.book === book).length])));
  assert.deepEqual(counts,{oxford:208,fish:100});
  assert.equal(await page.locator('#chapterChoices input').count(), 36);
  await page.screenshot({path: fileURLToPath(new URL('quiz-mobile-setup.png', qa)), fullPage: true});

  // Training: committing an answer exposes its rationale/source and survives refresh.
  await start(page);
  const firstRun = await active(page);
  assert.equal(new Set(firstRun.questionIds).size, 5);
  assert.equal(await page.evaluate(ids => new Set(KNOWLEDGE_BANK.questions.filter(q => ids.includes(q.id)).map(q => q.book)).size, firstRun.questionIds), 2);
  assert(await page.locator('#answerFeedback').isHidden());
  const firstQuestionMeta = await page.evaluate(key => {const r=JSON.parse(localStorage.getItem(key)).active,q=KNOWLEDGE_BANK.questions.find(q=>q.id===r.questionIds[r.index]);return {chapter:KNOWLEDGE_BANK.books[q.book].chapters.find(c=>c.number===q.chapter).title};},KEY);
  assert((await page.locator('#questionTopic').innerText()).includes(firstQuestionMeta.chapter),'Unanswered question must show chapter, not answer-revealing topic');
  await page.click('#checkAnswer');
  assert.match(await page.locator('#answerError').innerText(), /Выберите один ответ/);
  const firstChoice = await choose(page, false);
  await page.click('#checkAnswer');
  assert(await page.locator('#answerFeedback').isVisible());
  assert.match(await page.locator('#answerFeedback').innerText(), /Правильный ответ/);
  assert.equal(await page.locator('.q-option.q-wrong input:checked').count(),1);
  assert.equal(await page.locator('.q-option.q-wrong').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(248, 238, 233)');
  assert.equal(await page.locator('#answerFeedback .q-source-link').count(), 1);
  const sourceHref = await page.locator('#answerFeedback .q-source-link').getAttribute('href');
  assert.match(sourceHref, /(?:index|fish)\.html#section=/);
  assert(await page.locator('#answerChoices input').first().isDisabled());
  await page.locator('#answerFeedback details').evaluate(element => element.open = true);
  assert((await page.locator('#answerFeedback blockquote').innerText()).length > 10);
  await noOverflow(page);
  await page.screenshot({path: fileURLToPath(new URL('quiz-mobile-feedback.png', qa)), fullPage: true});
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('answerFeedback').hidden);
  assert.equal((await active(page)).id, firstRun.id);
  assert.deepEqual((await active(page)).optionOrders, firstRun.optionOrders);
  assert.equal(await page.locator('#answerChoices input:checked').inputValue(), firstChoice);
  assert.equal(await page.locator('#answerFeedback .q-source-link').getAttribute('href'), sourceHref);
  await page.click('#nextQuestion');
  const secondChoice = await choose(page, true);
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('runScreen').hidden);
  assert.equal((await active(page)).index, 1);
  assert.equal(await page.locator('#answerChoices input:checked').inputValue(), secondChoice);
  assert(await page.locator('#answerFeedback').isHidden());
  await page.click('#backToSetup');
  assert(await page.locator('#resumeCard').isVisible());
  assert(await page.locator('#startButton').isDisabled());
  await page.click('#resumeButton');
  assert.equal((await active(page)).index, 1);
  await finish(page, 3);
  assert.equal(await page.locator('#resultPercent').innerText(), '20%');
  assert.equal(await page.locator('#resultReview > details').count(), 5);
  assert.equal((await state(page)).events.length, 5);
  assert.equal((await state(page)).history.length, 1);

  // Progress export is portable; invalid imports preserve current data and require no confirmation.
  await page.click('#resultHome');
  const downloadPromise = page.waitForEvent('download');
  await page.click('#exportBackup');
  const download = await downloadPromise;
  const progress = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  assert.equal(progress.format, 'psycholibrary-knowledge-backup');
  assert.equal(progress.state.history.length, 1);
  const beforeImport = await state(page);
  await page.setInputFiles('#backupFile', {name: 'wrong-copy.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"wrong"}')});
  await page.waitForFunction(() => !document.getElementById('quizToast').hidden);
  assert.match(await page.locator('#quizToast').innerText(), /не резервная копия/i);
  assert(await page.locator('#importDialog').isHidden());
  assert.deepEqual(await state(page), beforeImport);
  await page.setInputFiles('#backupFile', {name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(progress))});
  assert(await page.locator('#importDialog').isVisible());
  await page.click('#cancelImport');
  assert.deepEqual(await state(page), beforeImport);
  await page.setInputFiles('#backupFile', {name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(progress))});
  await page.click('#confirmImport');
  assert.equal((await state(page)).history.length, 1);
  assert.equal((await state(page)).events.length, 5);

  // Exam does not expose keys, explanations, source links or grading colours before submission.
  await page.evaluate(key => localStorage.removeItem(key), KEY); await page.reload();
  await start(page, 'exam');
  const exam = await active(page);
  await choose(page, false);
  assert(await page.locator('#checkAnswer').isHidden());
  assert(await page.locator('#answerFeedback').isHidden());
  assert.equal(await page.locator('#answerFeedback .q-source-link').count(), 0);
  assert.equal(await page.locator('#answerChoices .q-correct, #answerChoices .q-wrong').count(), 0);
  assert.equal(await page.locator('#resultReview').textContent(), '');
  assert.equal((await state(page)).events.length, 0);
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('runScreen').hidden);
  const resumedExam = await active(page);
  assert.equal(resumedExam.deadline, exam.deadline);
  assert.deepEqual(resumedExam.optionOrders, exam.optionOrders);
  assert.equal(await page.locator('#answerChoices input:checked').count(), 1);
  await noOverflow(page);
  await finish(page, 4);
  assert.equal(await page.locator('#resultPercent').innerText(), '0%');
  assert.equal(await page.locator('#resultReview .q-source-link').count(), 5);
  assert.equal((await state(page)).events.filter(e => e.choice === null).length, 4);
  await context.close();

  // A background/closed-tab deadline cannot be reset by reloading.
  const timed = await browser.newContext({viewport: {width: 360, height: 800}});
  await timed.addInitScript(() => {const realNow = Date.now.bind(Date); Date.now = () => realNow() + Number(localStorage.getItem('quiz-test-clock-offset') || 0);});
  const timedPage = await timed.newPage(); watch(timedPage);
  await open(timedPage); await start(timedPage, 'exam');
  const timedRun = await active(timedPage);
  await choose(timedPage, true);
  await timedPage.evaluate(() => localStorage.setItem('quiz-test-clock-offset', String(86400000)));
  await timedPage.reload();
  await timedPage.waitForFunction(() => location.hash.startsWith('#result=') && !document.getElementById('resultScreen').hidden);
  const timedDone = await state(timedPage);
  assert.equal(timedDone.active, null);
  assert.equal(timedDone.history.length, 1);
  assert.equal(timedDone.history[0].questionIds.length, 5);
  assert.equal(timedDone.history[0].deadline, timedRun.deadline);
  assert.equal(timedDone.history[0].finishedAt, timedRun.deadline, 'Expired exam finish time must be the actual deadline, not next opening');
  await timedPage.reload();
  assert.equal((await state(timedPage)).history.length, 1);
  assert.equal((await state(timedPage)).events.length, 5);
  await timed.close();

  // Corrupt storage remains recoverable; new answers continue only in memory.
  const damaged = await browser.newContext({viewport: {width: 360, height: 800}, acceptDownloads: true});
  const damagedPage = await damaged.newPage(); watch(damagedPage);
  await open(damagedPage);
  await damagedPage.evaluate(key => localStorage.setItem(key, '{"broken":true}'), KEY);
  await damagedPage.reload();
  assert(await damagedPage.locator('#storageWarning').isVisible());
  await start(damagedPage);
  await damagedPage.locator('#answerChoices input').first().check();
  await damagedPage.click('#checkAnswer');
  assert(await damagedPage.locator('#answerFeedback').isVisible());
  assert.equal(await damagedPage.evaluate(key => localStorage.getItem(key), KEY), '{"broken":true}');
  const memoryDownloadPromise = damagedPage.waitForEvent('download');
  await damagedPage.locator('#storageWarning button').first().click();
  const memoryDownload = await memoryDownloadPromise;
  const memoryProgress = JSON.parse(await fs.readFile(await memoryDownload.path(), 'utf8'));
  assert.equal(memoryProgress.state.events.length, 1);
  assert(memoryProgress.state.active);
  await noOverflow(damagedPage);
  await damaged.close();

  // A full/blocked store must not prevent answering or falsely promise persistence.
  const blocked = await browser.newContext({viewport: {width: 360, height: 800}, acceptDownloads: true});
  await blocked.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'psycholibrary:knowledge:v1') throw new DOMException('Storage full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  const blockedPage = await blocked.newPage(); watch(blockedPage);
  await open(blockedPage); await start(blockedPage);
  assert(await blockedPage.locator('#storageWarning').isVisible());
  assert.match(await blockedPage.locator('#storageWarning').innerText(), /до закрытия страницы|в памяти/);
  await blockedPage.locator('#answerChoices input').first().check();
  await blockedPage.click('#checkAnswer');
  assert(await blockedPage.locator('#answerFeedback').isVisible());
  assert.equal(await blockedPage.evaluate(key => localStorage.getItem(key), KEY), null);
  const blockedDownloadPromise = blockedPage.waitForEvent('download');
  await blockedPage.locator('#storageWarning button').first().click();
  const blockedDownload = await blockedDownloadPromise;
  const blockedProgress = JSON.parse(await fs.readFile(await blockedDownload.path(), 'utf8'));
  assert.equal(blockedProgress.state.events.length, 1);
  assert.equal(blockedProgress.state.active.checked.length, 1);
  await blocked.close();

  // Two open tabs observe the same attempt and cannot double-count checking/completion.
  const shared = await browser.newContext({viewport: {width: 360, height: 800}});
  const firstTab = await shared.newPage(); watch(firstTab);
  await open(firstTab); await start(firstTab);
  const secondTab = await shared.newPage(); watch(secondTab);
  await open(secondTab); await secondTab.click('#resumeButton');
  const sharedChoice = await choose(firstTab, true);
  await secondTab.waitForFunction(() => document.querySelector('#answerChoices input:checked'));
  assert.equal(await secondTab.locator('#answerChoices input:checked').inputValue(), sharedChoice);
  await secondTab.click('#checkAnswer');
  await firstTab.waitForFunction(() => !document.getElementById('answerFeedback').hidden);
  assert.equal((await state(firstTab)).events.length, 1);
  await finish(firstTab, 4);
  await secondTab.waitForFunction(() => !document.getElementById('setupScreen').hidden && document.getElementById('resumeCard').hidden);
  assert.equal((await state(secondTab)).events.length, 5);
  assert.equal((await state(secondTab)).history.length, 1);
  await shared.close();

  assert.deepEqual(errors, []);
  console.log('PASS knowledge platform:308 questions/legacy236 attempt preserved/both books/training/feedback/source/resume/exam secrecy/skip scoring/backup/import/deadline/corrupt or blocked storage/two tabs/mobile360.');
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
