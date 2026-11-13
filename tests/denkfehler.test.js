// Behaviour tests for denkfehler. Run: node tests/denkfehler.test.js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const URL = pathToFileURL(path.join(__dirname, '..', 'denkfehler', 'index.html')).href;

const IDS = [
  'pauschalisierung', 'anekdotisches-argument', 'rosinenpicken', 'nutpicking', 'stereotypisierung',
  'strohmann', 'derailing', 'whataboutism', 'delegitimierung', 'gish-galopp',
  'pseudo-experten', 'logikfehler', 'unerfuellbare-erwartungen', 'rosinenpickerei', 'verschwoerungsmythen',
  'falsche-gleichsetzung', 'hufeisen-argument', 'falsches-dilemma', 'dammbruchargument', 'scheinkausalitaet',
  'ad-hominem', 'tu-quoque', 'brunnenvergiftung', 'kontaktschuld', 'genetischer-fehlschluss',
];

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

async function open(browser, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 390, height: 844 },
    hasTouch: !!opts.touch,
    colorScheme: opts.colorScheme || 'light',
  });
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  await page.emulateMedia({ reducedMotion: opts.motion || 'reduce' });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL + (opts.hash || ''));
  return { context, page };
}

const cardId = (page) => page.getAttribute('#card', 'data-id');
const goTo = async (page, id) => {
  await page.evaluate((h) => { location.hash = '#' + h; }, id);
  await page.waitForFunction((h) => document.getElementById('card').dataset.id === h, id);
};
// a point inside the card body, away from the share icon
const bodyPoint = async (page) => {
  const box = await page.locator('#main').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
// share stubs: no Web Share API, clipboard missing or rejecting
const noShare = () => {
  Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
};
const noClipboard = () => {
  Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
  Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true });
};

test('initial card is shown with header, no buttons besides share', async (b) => {
  const { context, page } = await open(b);
  const id = await cardId(page);
  assert.ok(IDS.includes(id));
  assert.ok((await page.textContent('#name')).length > 0);
  assert.ok((await page.textContent('#cat')).length > 0);
  assert.match(await page.textContent('#pos'), /^(\d \/ 5|[PLURV] wie)$/);
  assert.equal(await page.locator('#example p').count(), 2);
  assert.equal(await page.textContent('#seen'), '1 / 25');
  assert.equal(await page.locator('button').count(), 1);
  assert.equal(await page.getAttribute('#share', 'aria-label'), 'Teilen');
  assert.equal(new URL_(page.url()).hash.slice(1), id);
  assert.match(await page.textContent('#live'), new RegExp(await page.textContent('#name')));
  const head = await page.evaluate(() => getComputedStyle(document.querySelector('.head')).backgroundColor);
  const meta = await page.getAttribute('meta[name="theme-color"]', 'content');
  assert.notEqual(meta, '#FFFFFF');
  assert.ok(head !== 'rgba(0, 0, 0, 0)');
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('25 cards without a repeat, then a new round', async (b) => {
  const { context, page } = await open(b);
  const ids = [await cardId(page)];
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press('ArrowRight');
    ids.push(await cardId(page));
  }
  assert.equal(new Set(ids).size, 25);
  assert.equal(await page.textContent('#seen'), '25 / 25');
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await cardId(page), ids[24]);
  assert.equal(await page.textContent('#seen'), '1 / 25');
  await context.close();
});

test('keys: Space, Enter, ArrowRight next; ArrowLeft back', async (b) => {
  const { context, page } = await open(b);
  const seen = [await cardId(page)];
  for (const key of ['Space', 'Enter', 'ArrowRight']) {
    await page.keyboard.press(key);
    const id = await cardId(page);
    assert.notEqual(id, seen[seen.length - 1], key);
    seen.push(id);
  }
  await page.keyboard.press('ArrowLeft');
  assert.equal(await cardId(page), seen[2]);
  // Enter on the focused share icon shares, it does not turn the card
  await page.focus('#share');
  const before = await cardId(page);
  await page.evaluate(() => { navigator.share = () => Promise.resolve(); });
  await page.keyboard.press('Enter');
  assert.equal(await cardId(page), before);
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('back and forward walk the history', async (b) => {
  const { context, page } = await open(b);
  const a = await cardId(page);
  await page.keyboard.press('ArrowRight');
  const c = await cardId(page);
  await page.keyboard.press('ArrowRight');
  const d = await cardId(page);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await cardId(page), c);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await cardId(page), a);
  await page.keyboard.press('ArrowLeft'); // nothing before the first card
  assert.equal(await cardId(page), a);
  await page.keyboard.press('ArrowRight');
  assert.equal(await cardId(page), c);
  await page.keyboard.press('ArrowRight');
  assert.equal(await cardId(page), d);
  await context.close();
});

test('double-click with the mouse shows the next card, a single click does not', async (b) => {
  const { context, page } = await open(b);
  const a = await cardId(page);
  const { x, y } = await bodyPoint(page);
  await page.mouse.click(x, y);
  await page.waitForTimeout(450);
  assert.equal(await cardId(page), a);
  await page.mouse.click(x, y);
  await page.waitForTimeout(450);
  assert.equal(await cardId(page), a);
  await page.mouse.dblclick(x, y);
  const c = await cardId(page);
  assert.notEqual(c, a);
  await page.mouse.dblclick(x, y);
  assert.notEqual(await cardId(page), c);
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('double-tap on a touch screen shows the next card', async (b) => {
  const { context, page } = await open(b, { touch: true });
  const a = await cardId(page);
  const { x, y } = await bodyPoint(page);
  await page.touchscreen.tap(x, y);
  await page.touchscreen.tap(x, y);
  await page.waitForFunction((prev) => document.getElementById('card').dataset.id !== prev, a);
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('a tap on the share icon does not count toward a double-tap', async (b) => {
  const { context, page } = await open(b, { init: noClipboard });
  const a = await cardId(page);
  const { x, y } = await bodyPoint(page);
  const share = await page.locator('#share').boundingBox();
  const sx = share.x + share.width / 2, sy = share.y + share.height / 2;
  await page.mouse.click(sx, sy);
  await page.mouse.click(x, y);
  await page.waitForTimeout(450);
  assert.equal(await cardId(page), a);
  await page.mouse.click(x, y);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(450);
  assert.equal(await cardId(page), a);
  await page.mouse.dblclick(sx, sy);
  await page.waitForTimeout(100);
  assert.equal(await cardId(page), a);
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('swipe left shows next card, swipe right goes back', async (b) => {
  const { context, page } = await open(b);
  const a = await cardId(page);
  const box = await page.locator('#main').boundingBox();
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
  // a short or mostly vertical drag does nothing
  await page.mouse.move(box.x + 100, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, y + 120, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(450);
  assert.equal(await cardId(page), a);
  await context.close();
});

test('deep link opens the card, hashchange switches it', async (b) => {
  const { context, page } = await open(b, { hash: '#strohmann' });
  assert.equal(await cardId(page), 'strohmann');
  assert.equal(await page.textContent('#name'), 'Strohmann');
  assert.equal(await page.textContent('#cat'), 'Ausweichen statt antworten');
  assert.equal(await page.textContent('#pos'), '1 / 5');
  assert.equal(await page.title(), 'Strohmann · Denkfehler in Diskussionen');
  await goTo(page, 'tu-quoque');
  assert.equal(new URL_(page.url()).hash, '#tu-quoque');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await cardId(page), 'strohmann');
  assert.equal(new URL_(page.url()).hash, '#strohmann');
  await context.close();
});

test('unknown hash falls back to a random card', async (b) => {
  const { context, page } = await open(b, { hash: '#gibtsnicht' });
  assert.ok(IDS.includes(await cardId(page)));
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('hufeisen card shows its note', async (b) => {
  const { context, page } = await open(b, { hash: '#hufeisen-argument' });
  assert.equal(await page.isVisible('#note'), true);
  assert.equal(await page.textContent('#note'), 'Die Hufeisentheorie selbst ist in der Politikwissenschaft umstritten.');
  await goTo(page, 'strohmann');
  assert.equal(await page.isVisible('#note'), false);
  await context.close();
});

test('share without share sheet and without clipboard is safe', async (b) => {
  const { context, page } = await open(b, { init: noClipboard });
  await page.click('#share');
  await page.waitForTimeout(100);
  assert.equal(await page.isVisible('#flash'), true);
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('share without share sheet and with a rejecting clipboard is safe', async (b) => {
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

test('share falls back to the clipboard and shows feedback', async (b) => {
  const { context, page } = await open(b, {
    hash: '#strohmann',
    init: () => {
      Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
      window.__copied = null;
      Object.defineProperty(Navigator.prototype, 'clipboard', {
        get: () => ({ writeText: (t) => { window.__copied = t; return Promise.resolve(); } }),
        configurable: true,
      });
    },
  });
  await page.click('#share');
  await page.waitForFunction(() => window.__copied !== null);
  const copied = await page.evaluate(() => window.__copied);
  assert.match(copied, /^Denkfehler: Strohmann - /);
  assert.match(copied, /#strohmann$/);
  assert.equal(await page.textContent('#flash'), 'Link kopiert');
  assert.equal(await cardId(page), 'strohmann');
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('share uses the Web Share API when available', async (b) => {
  const { context, page } = await open(b, {
    hash: '#gish-galopp',
    init: () => {
      window.__shared = null;
      navigator.share = (d) => { window.__shared = d; return Promise.resolve(); };
    },
  });
  await page.click('#share');
  const shared = await page.evaluate(() => window.__shared);
  assert.equal(shared.title, 'Gish-Galopp');
  assert.match(shared.url, /#gish-galopp$/);
  assert.deepEqual(page.__errors, []);
  await context.close();
});

test('dark mode renders a dark card', async (b) => {
  const colors = {};
  for (const scheme of ['light', 'dark']) {
    const { context, page } = await open(b, { colorScheme: scheme, hash: '#strohmann' });
    colors[scheme] = await page.evaluate(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.getElementById('def')).color,
      label: getComputedStyle(document.querySelector('.label')).color,
    }));
    assert.deepEqual(page.__errors, []);
    await context.close();
  }
  assert.notEqual(colors.dark.bg, colors.light.bg);
  assert.notEqual(colors.dark.ink, colors.light.ink);
  assert.notEqual(colors.dark.label, colors.light.label);
});

test('slide animation only without reduced motion', async (b) => {
  for (const [motion, expected] of [['reduce', 0], ['no-preference', 1]]) {
    const { context, page } = await open(b, { motion });
    await page.keyboard.press('ArrowRight');
    const n = await page.evaluate(() => document.getElementById('main').getAnimations().length);
    assert.equal(n, expected, motion);
    await context.close();
  }
});

test('no external requests', async (b) => {
  const context = await b.newContext();
  const page = await context.newPage();
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto(URL);
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(urls.filter((u) => !u.startsWith('file://') && !u.startsWith('data:')), []);
  await context.close();
});

test('fit step shrinks the text of a card that would not fit', async (b) => {
  const { context, page } = await open(b, { viewport: { width: 320, height: 568 }, hash: '#strohmann' });
  assert.equal(await page.getAttribute('#card', 'data-fit'), '1.00');
  // simulate a card with too much text by enlarging the body text
  await page.addStyleTag({ content: '.card { --fs-m: calc(var(--u) * 26 * var(--fit)); }' });
  await goTo(page, 'hufeisen-argument');
  const fit = Number(await page.getAttribute('#card', 'data-fit'));
  assert.ok(fit < 1, `fit ${fit}`);
  const over = await page.evaluate(() => {
    const m = document.getElementById('main');
    return m.scrollHeight > m.clientHeight + 1;
  });
  assert.equal(over, false);
  await context.close();
});

const report = [];
for (const [w, h] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
  test(`every card fits ${w}x${h} without scrolling`, async (b) => {
    const { context, page } = await open(b, { viewport: { width: w, height: h } });
    let minFont = Infinity;
    const shrunk = [];
    for (const id of IDS) {
      await goTo(page, id);
      const r = await page.evaluate(() => {
        const de = document.documentElement;
        const main = document.getElementById('main');
        const mr = main.getBoundingClientRect();
        const boxes = [main, ...main.querySelectorAll('.col')].filter((el) => getComputedStyle(el).display !== 'contents');
        const over = boxes.filter((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1).map((el) => el.className);
        const out = [];
        let min = Infinity;
        for (const el of document.querySelectorAll('#card h1, #card p, #card span, #card strong')) {
          if (el.hidden || !el.getClientRects().length || !el.textContent.trim()) continue;
          min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
          const er = el.getBoundingClientRect();
          if (el.closest('#main') && (er.bottom > mr.bottom + 0.5 || er.top < mr.top - 0.5)) out.push(el.id || el.className);
          if (er.right > innerWidth + 0.5 || er.left < -0.5) out.push(el.id || el.className);
        }
        const card = document.getElementById('card');
        return {
          page: [de.scrollWidth, de.scrollHeight, innerWidth, innerHeight],
          over, out, min, fit: card.dataset.fit, nfit: card.dataset.nfit,
        };
      });
      const [sw, sh, iw, ih] = r.page;
      assert.ok(sw <= iw && sh <= ih, `page scrolls on ${id}: ${sw}x${sh}`);
      assert.deepEqual(r.over, [], `overflow on ${id}`);
      assert.deepEqual(r.out, [], `outside on ${id}`);
      minFont = Math.min(minFont, r.min);
      if (r.fit !== '1.00' || r.nfit !== '1.00') shrunk.push(`${id} (fit ${r.fit}, name ${r.nfit})`);
    }
    if (w === 320) assert.ok(minFont >= 11, `smallest text ${minFont}px at ${w}x${h}`);
    report.push(`  ${w}x${h}: smallest text ${minFont.toFixed(1)}px, shrunk: ${shrunk.join(', ') || 'none'}`);
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
  if (report.length) console.log(['Fit:', ...report].join('\n'));
  console.log(`${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
