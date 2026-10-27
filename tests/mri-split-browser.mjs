import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { serve } from '../tools/serve.mjs';

const require = createRequire(import.meta.url);
const runtime = 'C:/Users/jktru/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || runtime + 'playwright');
const { PNG } = require(process.env.PNGJS_MODULE || runtime + 'pngjs');
let base = process.env.STUDY_LIVE_URL, server, release = 'a';
if (!base) {
  // Simulate a new release even when the old imported manifest has a long HTTP cache lifetime.
  server = serve(undefined, async (url, res) => {
    if (url.pathname !== '/data/offline-assets.js') return false;
    const raw = await fs.readFile(new URL('../dist/data/offline-assets.js', import.meta.url), 'utf8');
    const body = raw.replace(/"version":"([^"]+)"/, (_, hash) => '"version":"' + hash + '-' + release + '"');
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=31536000' });
    res.end(body); return true;
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], watch = p => p.on('pageerror', e => errors.push(e.message));
const ready = p => p.waitForFunction(() => document.querySelector('canvas')?.dataset.geometry === 'source-hemisphere-v1');
async function silhouette(p, name) {
  const bytes = await p.locator('canvas').screenshot(), png = PNG.sync.read(bytes);
  let count = 0, minX = png.width, minY = png.height, maxX = -1, maxY = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4, [r, g, b] = png.data.subarray(i, i + 3);
    if (r > 195 && g < 85 && b > 105 && b < 195 && r > b * 1.35) {
      count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  assert(count > 100, 'selected MRI surface must be visible');
  await fs.writeFile(new URL('../tmp/qa/mri-' + name + '.png', import.meta.url), bytes);
  return { count, width: maxX - minX, height: maxY - minY, minX, minY };
}
try {
  await fs.mkdir(new URL('../tmp/qa/', import.meta.url), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const p = await context.newPage(); watch(p);
  await p.goto(base + '/neuro.html#atlas'); await ready(p);
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await p.setViewportSize(viewport);
    for (const side of ['left', 'right']) {
      await p.getByLabel('Корковые полушария', { exact: true }).selectOption(side);
      await p.getByLabel('Поворот по горизонтали', { exact: true }).fill('0');
      await p.getByLabel('Наклон', { exact: true }).fill('0');
      await p.getByLabel('Раздвинуть корковые полушария', { exact: true }).fill('0');
      const original = await silhouette(p, viewport.width + '-' + side + '-0');
      for (const split of ['20', '40']) {
        await p.getByLabel('Раздвинуть корковые полушария', { exact: true }).fill(split);
        const moved = await silhouette(p, viewport.width + '-' + side + '-' + split);
        assert(Math.abs(moved.width - original.width) <= 2, 'hemisphere must translate without widening into spikes');
        assert(Math.abs(moved.height - original.height) <= 2, 'hemisphere must retain height');
        assert(Math.abs(moved.count / original.count - 1) < .025, 'projected cortical area must stay constant');
      }
    }
    await p.getByLabel('Корковые полушария', { exact: true }).selectOption('both');
    await p.getByLabel('Поворот по горизонтали', { exact: true }).fill('45');
    await p.getByLabel('Наклон', { exact: true }).fill('11');
    await silhouette(p, viewport.width + '-both-separated');
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await p.getByRole('button', { name: 'Исходный ракурс', exact: true }).click();
  assert.equal(await p.getByLabel('Раздвинуть корковые полушария', { exact: true }).inputValue(), '0');
  await p.getByLabel('Раздвинуть корковые полушария', { exact: true }).fill('40');
  await p.locator('canvas').focus(); await p.keyboard.press('Home');
  assert.equal(await p.getByLabel('Раздвинуть корковые полушария', { exact: true }).inputValue(), '0');
  await context.close();
  console.log('PASS tablet portrait/landscape, source-based left/right hemisphere visibility, rigid 0/20/40mm separation without stretched silhouette and reset');

  const offline = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
  const o = await offline.newPage(); watch(o);
  await o.goto(base + '/neuro.html#atlas'); await ready(o);
  await o.evaluate(() => navigator.serviceWorker.ready);
  await o.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.equal(await o.evaluate(async () => (await navigator.serviceWorker.getRegistration()).updateViaCache), 'none');
  if (server) {
    await o.evaluate(async () => {
      localStorage.setItem('mri-regression-note', 'keep');
      const c = await caches.open('psycholibrary-chapters-v1');
      await c.put('mri-regression-chapter', new Response('keep downloaded chapter'));
    });
    release = 'b';
    await o.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg.update();
    });
    await o.waitForFunction(async () => (await caches.keys()).some(k => k.startsWith('psycholibrary-shell-') && k.endsWith('-b')) && !(await caches.keys()).some(k => k.startsWith('psycholibrary-shell-') && k.endsWith('-a')));
    assert.equal(await o.evaluate(() => localStorage.getItem('mri-regression-note')), 'keep');
    assert.equal(await o.evaluate(async () => (await (await caches.open('psycholibrary-chapters-v1')).match('mri-regression-chapter')).text()), 'keep downloaded chapter');
  }
  await offline.setOffline(true); await o.reload(); await ready(o);
  await o.getByLabel('Раздвинуть корковые полушария', { exact: true }).fill('40');
  await silhouette(o, 'offline-separated');
  assert.equal(await o.locator('canvas').getAttribute('data-split'), '40');
  assert.equal(await o.locator('#neuroMenu a').count(), 13);
  await offline.close(); assert.deepEqual(errors, []);
  console.log('PASS uncached worker manifest updates, preserved notes/downloads, current 13 modules and offline MRI separation');
} finally {
  await browser.close();
  if (server) { server.closeAllConnections(); server.close(); }
}
