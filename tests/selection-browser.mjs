import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serve } from '../tools/serve.mjs';

const require = createRequire(import.meta.url);
const runtime = 'C:/Users/jktru/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || runtime + 'playwright');
const { PNG } = require(process.env.PNGJS_MODULE || runtime + 'pngjs');
let base = process.env.STUDY_LIVE_URL, server;
if (!base) {
  server = serve();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const watch = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /WebGL|GL_INVALID/.test(m.text())) errors.push(m.text()); });
};
const pink = (rgba, i) => rgba[i] > 195 && rgba[i + 1] < 85 && rgba[i + 2] > 105 && rgba[i + 2] < 195 && rgba[i] > rgba[i + 2] * 1.35;
const ready = page => page.waitForFunction(() => document.querySelector('canvas')?.dataset.ready === 'true');
async function frame(page, name, key) {
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const bytes = await canvas.screenshot({ style: '.systems-label{visibility:hidden!important}' });
  const png = PNG.sync.read(bytes), hits = [];
  for (let i = 0; i < png.data.length; i += 4) if (pink(png.data, i)) hits.push(i);
  assert(hits.length >= 6, name + ': selected surface/markers must actually be bright pink');
  await fs.writeFile(new URL('../tmp/qa/selection-' + name + '.png', import.meta.url), bytes);
  // The visual material must not corrupt the separate GPU picking pass, including point sprites.
  const prior = await canvas.getAttribute('data-' + key), pixel = hits[Math.floor(hits.length / 2)] / 4;
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: (pixel % png.width + .5) * box.width / png.width, y: (Math.floor(pixel / png.width) + .5) * box.height / png.height } });
  assert.equal(await canvas.getAttribute('data-' + key), prior, name + ': pink pixel must pick the same structure');
  return { png, hits };
}
try {
  await fs.mkdir(new URL('../tmp/qa/', import.meta.url), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 1000 }, serviceWorkers: 'block' });
  const p = await context.newPage(); watch(p);
  await p.goto(base + '/neuro.html#neuron'); await ready(p);
  for (const type of ['multipolar', 'bipolar', 'pseudo']) {
    await p.getByLabel('Морфология', { exact: true }).selectOption(type);
    await frame(p, 'neuron-' + type, 'part');
    if (type === 'pseudo') {
      assert(await p.getByRole('button', { name: 'Дендриты', exact: true, includeHidden: true }).isHidden());
      assert(await p.getByRole('button', { name: 'Начальный сегмент', exact: true, includeHidden: true }).isHidden());
    }
  }
  await p.getByLabel('Морфология', { exact: true }).selectOption('multipolar');
  for (const name of ['Ядро', 'Митохондрии', 'Дендриты', 'Миелин']) {
    await p.getByRole('button', { name, exact: true }).click();
    await frame(p, 'neuron-' + name, 'part');
  }
  await p.goto(base + '/neuro.html#synapse'); await ready(p);
  await p.getByLabel('Структура синапса', { exact: true }).selectOption('1');
  const before = await frame(p, 'presynaptic', 'part');
  await p.getByLabel('Структура синапса', { exact: true }).selectOption('2');
  const after = await frame(p, 'postsynaptic', 'part');
  assert.equal(before.png.width, after.png.width);
  assert(before.hits.filter(i => pink(after.png.data, i)).length / before.hits.length < .05, 'old structure must lose its highlight when selection moves');
  await p.getByRole('button', { name: 'Медиатор и рецепторы', exact: true }).click();
  await p.getByLabel('Структура синапса', { exact: true }).selectOption('16');
  await frame(p, 'transmitter-particles', 'part');
  await p.getByLabel('Структура синапса', { exact: true }).selectOption('9');
  await frame(p, 'ampa', 'part');
  await p.getByLabel('Тип синапса', { exact: true }).selectOption('electrical');
  await p.getByRole('button', { name: 'Каналы крупно', exact: true }).click();
  await frame(p, 'electrical', 'part');
  await p.goto(base + '/neuro.html#atlas'); await ready(p);
  for (const id of ['frontal', 'thalamus']) {
    await p.getByLabel('Структура', { exact: true }).selectOption(id);
    await frame(p, 'atlas-' + id, 'region');
  }
  for (const [id, parts] of [['plasticity', ['21', '9', '24']], ['astrocyte', ['30', '33', '37']], ['basal', ['3', '4', '6']]]) {
    await p.goto(base + '/neuro.html#' + id); await ready(p);
    for (const part of parts) {
      await p.getByLabel('Структура 3D-модели', { exact: true }).selectOption(part);
      await frame(p, id + '-' + part, 'selected');
    }
    await p.locator('canvas').focus(); await p.keyboard.press('ArrowRight');
    await frame(p, id + '-rotated', 'selected');
  }
  await context.close();
  console.log('PASS bright pink pixels in every selectable model, three neuron morphologies, electrical/chemical synapses, particles, MRI and circuit overlays; old selection clears; GPU picking preserves IDs');
  const offline = await browser.newContext({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
  const o = await offline.newPage(); watch(o);
  await o.goto(base + '/neuro.html#astrocyte'); await ready(o);
  await o.evaluate(() => navigator.serviceWorker.ready);
  await o.waitForFunction(() => !!navigator.serviceWorker.controller);
  await offline.setOffline(true); await o.reload(); await ready(o);
  await o.getByLabel('Структура 3D-модели', { exact: true }).selectOption('37');
  await frame(o, 'offline-mobile', 'selected');
  assert(await o.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await offline.close(); assert.deepEqual(errors, []);
  console.log('PASS actual offline/mobile320 highlight, selection labels and no page/WebGL errors');
} finally {
  await browser.close();
  if (server) { server.closeAllConnections(); server.close(); }
}
