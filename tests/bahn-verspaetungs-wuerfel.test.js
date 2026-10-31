// Behaviour tests for bahn-verspaetungs-wuerfel. Run: node tests/bahn-verspaetungs-wuerfel.test.js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const URL = pathToFileURL(path.join(__dirname, '..', 'bahn-verspaetungs-wuerfel', 'index.html')).href;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

async function open(browser, opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 } });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL);
  return { context, page };
}

const code = (page) => page.textContent('#code');
const live = (page) => page.textContent('#live');
const boardText = (page) =>
  page.$$eval('#grid .row', (rows) =>
    rows.map((r) => [...r.querySelectorAll('.ch')].map((c) => c.textContent || ' ').join('')).join(' ').replace(/\s+/g, ' ').trim()
  );

test('initial state', async (b) => {
  const { context, page } = await open(b);
  assert.equal(await code(page), 'RIS-Code -');
  assert.ok((await boardText(page)).includes('NOCH KEIN WURF'));
  assert.equal(await page.locator('#share').isVisible(), false);
  await context.close();
});

test('roll via Enter', async (b) => {
  const { context, page } = await open(b, { reducedMotion: true });
  await page.focus('#scene');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('live').textContent.startsWith('Grund: '));
  assert.match(await code(page), /^RIS-Code \d\d$/);
  assert.equal(await page.locator('#share').isVisible(), true);
  // board shows the reason, ignoring line breaks and wrap hyphens
  const norm = (s) => s.toUpperCase().replace(/[\s-]/g, '');
  assert.equal(norm(await boardText(page)), norm((await live(page)).slice('Grund: '.length)));
  await context.close();
});

test('roll via double-click', async (b) => {
  const { context, page } = await open(b);
  await page.dblclick('#scene');
  await page.waitForTimeout(1700);
  assert.ok((await live(page)).startsWith('Grund: '));
  assert.match(await code(page), /^RIS-Code \d\d$/);
  await context.close();
});

test('66 rolls without a repeat', async (b) => {
  const { context, page } = await open(b, { reducedMotion: true });
  await page.focus('#scene');
  const codes = [];
  for (let i = 0; i < 66; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(15);
    codes.push(await code(page));
  }
  assert.equal(new Set(codes).size, 66);
  await context.close();
});

test('input during a roll is ignored', async (b) => {
  const { context, page } = await open(b);
  await page.evaluate(() => {
    window.__codeChanges = 0;
    new MutationObserver(() => window.__codeChanges++).observe(document.getElementById('code'), {
      childList: true, characterData: true, subtree: true,
    });
  });
  await page.focus('#scene');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  await page.keyboard.press('Enter');
  await page.keyboard.press(' ');
  await page.waitForTimeout(1700);
  assert.equal(await page.evaluate(() => window.__codeChanges), 1);
  await context.close();
});

test('share without share sheet and clipboard is safe', async (b) => {
  const { context, page } = await open(b, {
    reducedMotion: true,
    init: () => {
      Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
      Object.defineProperty(Navigator.prototype, 'clipboard', {
        get: () => ({ writeText: () => Promise.reject(new Error('denied')) }),
        configurable: true,
      });
    },
  });
  await page.focus('#scene');
  await page.keyboard.press('Enter');
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
  test(`fits ${w}x${h}`, async (b) => {
    const { context, page } = await open(b, { viewport: { width: w, height: h }, reducedMotion: true });
    await page.focus('#scene');
    await page.keyboard.press('Enter');
    const r = await page.evaluate(() => {
      const board = document.getElementById('board').getBoundingClientRect();
      const maxTile = Math.max(...[...document.querySelectorAll('.tile')].map((t) => t.getBoundingClientRect().right));
      return { sw: document.documentElement.scrollWidth, boardRight: board.right, maxTile };
    });
    assert.ok(r.sw <= w, `scrollWidth ${r.sw} > ${w}`);
    assert.ok(r.maxTile <= r.boardRight, `tiles overflow board ${r.maxTile} > ${r.boardRight}`);
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
