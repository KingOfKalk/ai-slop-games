// Behaviour tests for el-clasico-bingo. Run: node tests/el-clasico-bingo.test.js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const URL = pathToFileURL(path.join(__dirname, '..', 'el-clasico-bingo', 'index.html')).href;
const KEY = 'el-clasico-bingo:v1';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

async function open(browser, opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 } });
  const page = await context.newPage();
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.__bingoEvents = [];
    document.addEventListener('bingo', (e) => window.__bingoEvents.push(e.detail.lines));
  });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL);
  return { context, page };
}

const pressed = (page) =>
  page.$$eval('.cell', (cs) => cs.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => +c.dataset.index));
const bingos = (page) => page.evaluate(() => document.body.dataset.bingos);
const events = (page) => page.evaluate(() => window.__bingoEvents);
const tap = async (page, ...idx) => {
  for (const i of idx) await page.click(`.cell[data-index="${i}"]`);
};

test('initial state', async (b) => {
  const { context, page } = await open(b);
  assert.equal(await page.locator('.cell').count(), 25);
  assert.deepEqual(await pressed(page), [12]);
  assert.equal(await page.locator('.cell[data-index="12"]').isDisabled(), true);
  assert.equal(await bingos(page), '0');
  for (const t of ['El Clásico Bingo', 'FC Bayern München', 'BVB', '1 Kurzer', '5 Kurze']) {
    assert.ok((await page.textContent('body')).includes(t), `missing copy: ${t}`);
  }
  await context.close();
});

test('toggle', async (b) => {
  const { context, page } = await open(b);
  await tap(page, 0);
  assert.deepEqual(await pressed(page), [0, 12]);
  await tap(page, 0);
  assert.deepEqual(await pressed(page), [12]);
  await context.close();
});

test('row bingo', async (b) => {
  const { context, page } = await open(b);
  await tap(page, 10, 11, 13, 14);
  assert.equal(await bingos(page), '1');
  const ev = await events(page);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].length, 1);
  await context.close();
});

test('column bingo', async (b) => {
  const { context, page } = await open(b);
  await tap(page, 2, 7, 17, 22);
  assert.equal(await bingos(page), '1');
  await context.close();
});

test('diagonal bingos', async (b) => {
  const { context, page } = await open(b);
  await tap(page, 0, 6, 18, 24);
  assert.equal(await bingos(page), '1');
  await tap(page, 4, 8, 16, 20);
  assert.equal(await bingos(page), '2');
  await context.close();
});

test('no bingo on 4 in a row', async (b) => {
  const { context, page } = await open(b);
  await tap(page, 0, 1, 2, 3);
  assert.equal(await bingos(page), '0');
  assert.equal((await events(page)).length, 0);
  await context.close();
});

test('re-trigger after unmark and re-mark', async (b) => {
  const { context, page } = await open(b);
  await tap(page, 10, 11, 13, 14, 10, 10);
  assert.equal((await events(page)).length, 2);
  assert.equal(await bingos(page), '1');
  await context.close();
});

test('persistence across reload', async (b) => {
  const { context, page } = await open(b);
  await tap(page, 0);
  await page.reload();
  assert.deepEqual(await pressed(page), [0, 12]);
  await context.close();
});

test('reload with completed line fires nothing', async (b) => {
  const { context, page } = await open(b);
  await tap(page, 10, 11, 13, 14);
  await page.reload();
  assert.equal((await events(page)).length, 0);
  assert.equal(await bingos(page), '1');
  await context.close();
});

test('corrupt storage falls back to fresh board', async (b) => {
  const { context, page } = await open(b);
  await page.evaluate((k) => localStorage.setItem(k, 'garbage'), KEY);
  await page.reload();
  assert.deepEqual(await pressed(page), [12]);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify([true, 'x'])), KEY);
  await page.reload();
  assert.deepEqual(await pressed(page), [12]);
  await context.close();
});

test('throwing storage still playable', async (b) => {
  const { context, page } = await open(b, {
    init: () => {
      Storage.prototype.getItem = () => { throw new Error('denied'); };
      Storage.prototype.setItem = () => { throw new Error('denied'); };
    },
  });
  await tap(page, 0);
  assert.deepEqual(await pressed(page), [0, 12]);
  await context.close();
});

test('reset', async (b) => {
  const { context, page } = await open(b);
  await tap(page, 10, 11, 13, 14, 0);
  await page.click('#reset');
  assert.deepEqual(await pressed(page), [12]);
  assert.equal(await bingos(page), '0');
  await page.reload();
  assert.deepEqual(await pressed(page), [12]);
  assert.equal(await page.getAttribute('#reset', 'aria-label'), 'Spiel zurücksetzen');
  await context.close();
});

test('no external requests', async (b) => {
  const context = await b.newContext();
  const page = await context.newPage();
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto(URL);
  await page.waitForLoadState('networkidle');
  assert.deepEqual(urls.filter((u) => !u.startsWith('file://')), []);
  await context.close();
});

for (const [w, h] of [[390, 844], [844, 390], [360, 640], [1440, 900]]) {
  test(`fits ${w}x${h}`, async (b) => {
    const { context, page } = await open(b, { viewport: { width: w, height: h } });
    const s = await page.evaluate(() => ({
      sh: document.documentElement.scrollHeight,
      sw: document.documentElement.scrollWidth,
    }));
    assert.ok(s.sh <= h, `scrollHeight ${s.sh} > ${h}`);
    assert.ok(s.sw <= w, `scrollWidth ${s.sw} > ${w}`);
    const box = await page.locator('.cell[data-index="24"]').boundingBox();
    assert.ok(box.y + box.height <= h && box.x + box.width <= w, 'cell 24 out of view');
    assert.ok(box.width >= 44 && box.height >= 44, `cell too small ${box.width}x${box.height}`);
    const r = await page.locator('#reset').boundingBox();
    assert.ok(r.width >= 44 && r.height >= 44, 'reset too small');
    await context.close();
  });
}

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn(browser);
      console.log(`PASS ${t.name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${t.name}: ${e.message.split('\n')[0]}`);
    }
  }
  await browser.close();
  console.log(`${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
