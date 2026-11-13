// Behaviour tests for skandal-quartett-spd. Run: node tests/skandal-quartett-spd.test.js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const URL = pathToFileURL(path.join(__dirname, '..', 'skandal-quartett-spd', 'index.html')).href;
const WERTE = ['empoerung', 'geld', 'karriere', 'nachhall'];

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
  page.on('console', (m) => m.type() === 'error' && page.__errors.push(m.text()));
  await page.goto(URL);
  return { context, page };
}

const code = (page) => page.textContent('.card .code');
const data = (page) => page.evaluate(() => JSON.parse(document.getElementById('daten').textContent));

test('card data: 32 cards, unique codes, known group, werte 1-10', async (b) => {
  const { context, page } = await open(b);
  const d = await data(page);
  assert.equal(d.karten.length, 32);
  const codes = d.karten.map((k) => k.code);
  assert.equal(new Set(codes).size, 32);
  for (const k of d.karten) {
    assert.ok(d.gruppen[k.code.charAt(0)], `no group for ${k.code}`);
    for (const w of WERTE) {
      const v = k.werte[w];
      assert.ok(Number.isInteger(v) && v >= 1 && v <= 10, `${k.code}.${w} = ${v}`);
    }
  }
  await context.close();
});

test('a card renders', async (b) => {
  const { context, page } = await open(b);
  assert.match(await code(page), /^[A-H]\d+$/);
  assert.ok((await page.textContent('.card h1')).trim().length > 0);
  assert.equal(await page.locator('.card .bar').count(), 4);
  assert.match(await page.textContent('.card .hint'), /^\d+\/32$/);
  assert.ok((await page.title()).includes('Skandal-Quartett'));
  await context.close();
});

test('double-click shows a different card', async (b) => {
  const { context, page } = await open(b);
  const before = await code(page);
  await page.dblclick('.card .head');
  assert.notEqual(await code(page), before);
  await context.close();
});

test('double-tap (touch) shows a different card', async (b) => {
  const { context, page } = await open(b, { touch: true });
  const before = await code(page);
  await page.touchscreen.tap(195, 40);
  await page.touchscreen.tap(195, 40);
  assert.notEqual(await code(page), before);
  await context.close();
});

test('single tap, or two taps too far apart, keep the card', async (b) => {
  const { context, page } = await open(b);
  const before = await code(page);
  await page.mouse.click(195, 40);
  assert.equal(await code(page), before);
  await page.waitForTimeout(450);
  await page.mouse.click(60, 40);
  await page.mouse.click(300, 40);
  assert.equal(await code(page), before);
  await context.close();
});

for (const key of ['Space', 'Enter', 'ArrowRight']) {
  test(`${key} shows a different card`, async (b) => {
    const { context, page } = await open(b);
    const before = await code(page);
    await page.keyboard.press(key);
    assert.notEqual(await code(page), before);
    await context.close();
  });
}

test('32 draws show only valid cards', async (b) => {
  const { context, page } = await open(b);
  const codes = new Set((await data(page)).karten.map((k) => k.code));
  let prev = await code(page);
  for (let i = 0; i < 32; i++) {
    await page.keyboard.press('Space');
    const c = await code(page);
    assert.ok(codes.has(c), `unknown code ${c}`);
    assert.notEqual(c, prev);
    prev = c;
  }
  await context.close();
});

test('no external requests', async (b) => {
  const context = await b.newContext();
  const page = await context.newPage();
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto(URL);
  await page.waitForLoadState('networkidle');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Space');
  assert.deepEqual(urls.filter((u) => !u.startsWith('file://') && !u.startsWith('data:')), []);
  await context.close();
});

test('no page errors, CSP violations or console errors', async (b) => {
  const { context, page } = await open(b);
  for (let i = 0; i < 32; i++) await page.keyboard.press('Space');
  assert.deepEqual(page.__errors, []);
  await context.close();
});

for (const [w, h] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
  test(`no horizontal scroll at ${w}x${h} for 32 cards`, async (b) => {
    const { context, page } = await open(b, { viewport: { width: w, height: h } });
    for (let i = 0; i < 32; i++) {
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(sw <= w, `scrollWidth ${sw} > ${w} on ${await code(page)}`);
      await page.keyboard.press('Space');
    }
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
