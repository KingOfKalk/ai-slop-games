// Behaviour tests for denkfehler. Run: node tests/denkfehler.test.js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const URL = pathToFileURL(path.join(__dirname, '..', 'denkfehler', 'index.html')).href;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

async function open(browser, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 390, height: 844 },
    hasTouch: !!opts.touch,
  });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL + (opts.hash || ''));
  return { context, page };
}

const cardId = (page) => page.getAttribute('#card', 'data-id');

test('initial card is shown and back is disabled', async (b) => {
  const { context, page } = await open(b);
  assert.ok(await cardId(page));
  assert.ok((await page.textContent('#name')).length > 0);
  assert.equal(await page.locator('#example p').count(), 2);
  assert.equal(await page.isDisabled('#back'), true);
  assert.equal(await page.textContent('#seen'), '1 / 25');
  assert.equal(new URL_(page.url()).hash.slice(1), await cardId(page));
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('25 cards without a repeat, then a new round', async (b) => {
  const { context, page } = await open(b);
  const ids = [await cardId(page)];
  for (let i = 0; i < 24; i++) {
    await page.click('#next');
    ids.push(await cardId(page));
  }
  assert.equal(new Set(ids).size, 25);
  assert.equal(await page.textContent('#seen'), '25 / 25');
  await page.click('#next');
  assert.notEqual(await cardId(page), ids[24]);
  assert.equal(await page.textContent('#seen'), '1 / 25');
  await context.close();
});

test('back and forward walk the history', async (b) => {
  const { context, page } = await open(b);
  const a = await cardId(page);
  await page.click('#next');
  const c = await cardId(page);
  await page.click('#back');
  assert.equal(await cardId(page), a);
  await page.keyboard.press('ArrowRight');
  assert.equal(await cardId(page), c);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await cardId(page), a);
  await context.close();
});

test('deep link opens the card', async (b) => {
  const { context, page } = await open(b, { hash: '#strohmann' });
  assert.equal(await cardId(page), 'strohmann');
  assert.equal(await page.textContent('#name'), 'Strohmann');
  assert.match(await page.textContent('#cat'), /Ausweichen statt antworten/);
  await page.evaluate(() => { location.hash = '#tu-quoque'; });
  await page.waitForFunction(() => document.getElementById('card').dataset.id === 'tu-quoque');
  await context.close();
});

test('unknown hash falls back to a random card', async (b) => {
  const { context, page } = await open(b, { hash: '#gibtsnicht' });
  assert.notEqual(await cardId(page), 'gibtsnicht');
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('hufeisen card shows its note', async (b) => {
  const { context, page } = await open(b, { hash: '#hufeisen-argument' });
  assert.equal(await page.isVisible('#note'), true);
  await page.evaluate(() => { location.hash = '#strohmann'; });
  await page.waitForFunction(() => document.getElementById('card').dataset.id === 'strohmann');
  assert.equal(await page.isVisible('#note'), false);
  await context.close();
});

test('swipe left shows next card, swipe right goes back', async (b) => {
  const { context, page } = await open(b);
  const a = await cardId(page);
  const box = await page.locator('#card').boundingBox();
  const y = box.y + box.height / 2;
  const swipe = async (from, to) => {
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(to, y, { steps: 5 });
    await page.mouse.up();
  };
  await swipe(box.x + box.width - 20, box.x + 20);
  const c = await cardId(page);
  assert.notEqual(c, a);
  await swipe(box.x + 20, box.x + box.width - 20);
  assert.equal(await cardId(page), a);
  await context.close();
});

test('share without share sheet and clipboard is safe', async (b) => {
  const { context, page } = await open(b, {
    init: () => {
      Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
      Object.defineProperty(Navigator.prototype, 'clipboard', {
        get: () => ({ writeText: () => Promise.reject(new Error('denied')) }),
        configurable: true,
      });
    },
  });
  await page.click('#share');
  await page.waitForTimeout(100);
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('no external requests', async (b) => {
  const context = await b.newContext();
  const page = await context.newPage();
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto(URL);
  await page.waitForLoadState('networkidle');
  assert.deepEqual(urls.filter((u) => !u.startsWith('file://') && !u.startsWith('data:')), []);
  await context.close();
});

for (const [w, h] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
  test(`fits ${w}x${h} for every card`, async (b) => {
    const { context, page } = await open(b, { viewport: { width: w, height: h } });
    for (let i = 0; i < 25; i++) {
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(sw <= w, `scrollWidth ${sw} > ${w} on ${await cardId(page)}`);
      await page.click('#next');
    }
    await context.close();
  });
}

const URL_ = globalThis.URL;

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
