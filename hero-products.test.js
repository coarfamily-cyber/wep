'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const H = require(path.join(__dirname, 'hero-products.js'));

const PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const SHOP = 'https://coar-store.myshopify.com/products/glow-serum';

test('exports helpers without a DOM and exposes version/constants', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(H.VERSION, '2026-10-25.1');
  assert.equal(H.CLOSE_MS, 480);
  assert.deepEqual(H.SLOTS, ['section2', 'section3']);
  assert.equal(H.DEFAULT_CTA, 'Shopify에서 보기 ›');
  assert.equal(H.EMPTY_MESSAGE, '상품 정보를 준비 중입니다.');
});

test('Shopify URL validation accepts only https myshopify/shopifypreview hosts', () => {
  assert.equal(H.normalizeShopifyUrl(SHOP), SHOP);
  assert.equal(H.normalizeShopifyUrl('  ' + SHOP + '  '), SHOP);
  assert.ok(H.normalizeShopifyUrl('https://abc123.shopifypreview.com/products/x'));
  assert.ok(H.normalizeShopifyUrl('https://COAR.MyShopify.com/products/x?variant=1'));
  const rejects = [
    'http://coar.myshopify.com/products/x',
    'javascript:alert(1)',
    'JavaScript:alert(1)//https://a.myshopify.com',
    'data:text/html,<script>alert(1)</script>',
    'https://user:pass@coar.myshopify.com/products/x',
    'https://user@coar.myshopify.com/products/x',
    'https://evilmyshopify.com/products/x',
    'https://coar.myshopify.com.evil.com/products/x',
    'https://example.com/products/x',
    'https://coar.myshopify.com:8443/products/x',
    '//coar.myshopify.com/products/x',
    'https://coar.myshopify.com/pro ducts',
    'https://coar.myshopify.com\\@evil.com',
    '',
    null,
    123,
    'https://a.myshopify.com/' + 'x'.repeat(3000)
  ];
  for (const r of rejects) assert.equal(H.normalizeShopifyUrl(r), null, String(r));
});

test('image validation: relative repo paths, https, raster data only', () => {
  assert.equal(H.normalizeImageSrc('images/product1.webp'), 'images/product1.webp');
  assert.equal(H.normalizeImageSrc('./section2.jpg'), './section2.jpg');
  assert.equal(H.normalizeImageSrc('product2.jpg'), 'product2.jpg');
  assert.equal(H.normalizeImageSrc('/wep/images/a.png'), '/wep/images/a.png');
  assert.equal(H.normalizeImageSrc('https://cdn.shopify.com/s/files/a.jpg?v=1'), 'https://cdn.shopify.com/s/files/a.jpg?v=1');
  assert.equal(H.normalizeImageSrc(PNG_DATA), PNG_DATA);
  for (const t of ['jpeg', 'webp', 'gif']) {
    assert.ok(H.normalizeImageSrc('data:image/' + t + ';base64,AAAA'), t);
  }
  const rejects = [
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'vbscript:x',
    'http://example.com/a.jpg',
    'https://user:pw@example.com/a.jpg',
    '//evil.com/a.jpg',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'data:text/html;base64,PGgxPg==',
    'data:image/png,rawnotbase64',
    'data:image/png;base64,AA AA',
    'data:image/png;base64,<script>',
    '../secret.png',
    'images/../../x.png',
    'images\\x.png',
    'img"onerror="x.png',
    'a<b>.png',
    '',
    null,
    {}
  ];
  for (const r of rejects) assert.equal(H.normalizeImageSrc(r), null, String(r));
  assert.equal(H.normalizeImageSrc('data:image/png;base64,' + 'A'.repeat(H.LIMITS.imageData)), null);
});

test('name/cta normalization strips control + bidi chars, limits length, default CTA', () => {
  assert.equal(H.normalizeName('  Glow\u0000  Serum\n\t50ml '), 'Glow Serum 50ml');
  assert.equal(H.normalizeName('abc\u202Edef'), 'abcdef');
  assert.equal(Array.from(H.normalizeName('가'.repeat(500))).length, H.LIMITS.name);
  assert.equal(H.normalizeName('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>'); // text only, rendered via textContent
  assert.equal(H.normalizeCta(''), 'Shopify에서 보기 ›');
  assert.equal(H.normalizeCta(undefined), 'Shopify에서 보기 ›');
  assert.equal(H.normalizeCta(' 지금 구매 '), '지금 구매');
  assert.ok(Array.from(H.normalizeCta('x'.repeat(200))).length <= H.LIMITS.cta);
});

test('normalizeRecord distinguishes missing, explicit empty, assigned, invalid', () => {
  assert.deepEqual(H.normalizeRecord(null), { status: 'missing' });
  assert.deepEqual(H.normalizeRecord(undefined), { status: 'missing' });
  assert.deepEqual(H.normalizeRecord({ empty: true }), { status: 'empty' });
  const ok = H.normalizeRecord({ name: 'Serum', image: 'images/product1.webp', url: SHOP });
  assert.equal(ok.status, 'assigned');
  assert.deepEqual(ok.product, { name: 'Serum', image: 'images/product1.webp', url: SHOP, cta: 'Shopify에서 보기 ›' });
  assert.equal(H.normalizeRecord({ name: 'No image', url: SHOP }).status, 'assigned');
  assert.equal(H.normalizeRecord({ name: '', url: SHOP }).status, 'invalid');
  assert.equal(H.normalizeRecord({ name: 'x', url: 'https://example.com' }).status, 'invalid');
  assert.equal(H.normalizeRecord({ name: 'x', url: SHOP, image: 'javascript:1' }).status, 'invalid');
  assert.equal(H.normalizeRecord([1, 2]).status, 'invalid');
  assert.equal(H.normalizeRecord('str').status, 'invalid');
});

test('resolveSlots: independent slots, remote overrides known slots only', () => {
  const defaults = {
    version: 1,
    section2: { name: 'Default S2', image: 'images/product1.webp', url: SHOP, cta: 'Shopify에서 보기 ›' },
    section3: null
  };

  // No remote: section2 default, section3 unassigned (no arbitrary second product).
  let r = H.resolveSlots(defaults, null);
  assert.equal(r.slots.section2.status, 'assigned');
  assert.equal(r.slots.section2.source, 'default');
  assert.equal(r.slots.section2.product.name, 'Default S2');
  assert.deepEqual(r.slots.section3, { status: 'unassigned', source: 'default', product: null });

  // Remote section3 only: section2 unchanged.
  r = H.resolveSlots(defaults, { section3: { name: 'Remote S3', url: 'https://x.myshopify.com/products/s3', image: PNG_DATA } });
  assert.equal(r.slots.section2.product.name, 'Default S2');
  assert.equal(r.slots.section3.status, 'assigned');
  assert.equal(r.slots.section3.source, 'remote');
  assert.equal(r.slots.section3.product.image, PNG_DATA);

  // Explicit empty record clears the default (does not fall back).
  r = H.resolveSlots(defaults, { section2: { empty: true } });
  assert.deepEqual(r.slots.section2, { status: 'unassigned', source: 'remote', product: null });

  // Invalid remote keeps default and warns; unknown keys ignored.
  r = H.resolveSlots(defaults, {
    section2: { name: 'Evil', url: 'javascript:alert(1)' },
    section4: { name: 'Nope', url: SHOP },
    __proto__x: 1
  });
  assert.equal(r.slots.section2.product.name, 'Default S2');
  assert.ok(r.warnings.includes('remote:section2'));
  assert.deepEqual(Object.keys(r.slots).sort(), ['section2', 'section3']);

  // Remote null slot value = missing -> keep default.
  r = H.resolveSlots(defaults, { section2: null });
  assert.equal(r.slots.section2.source, 'default');

  // Garbage inputs never throw.
  r = H.resolveSlots(null, 'oops');
  assert.equal(r.slots.section2.status, 'unassigned');
  assert.equal(r.slots.section3.status, 'unassigned');
  r = H.resolveSlots([], []);
  assert.equal(r.slots.section2.status, 'unassigned');
});

test('remote namespace paths never touch /products.json', () => {
  const base = 'https://coarfamily-e4960-default-rtdb.firebaseio.com';
  assert.equal(H.slotPath('section2'), '/learnMoreProducts/section2.json');
  assert.equal(H.slotPath('section3'), '/learnMoreProducts/section3.json');
  assert.equal(H.slotUrl(base, 'section2'), base + '/learnMoreProducts/section2.json');
  assert.equal(H.slotUrl(base + '/', 'section3'), base + '/learnMoreProducts/section3.json');
  assert.equal(H.collectionUrl(base), base + '/learnMoreProducts.json');
  for (const bad of ['products', '../products', 'section4', '', null, 'section2/../../products']) {
    assert.throws(() => H.slotPath(bad), /Unknown hero product slot/);
  }
  assert.ok(!H.slotUrl(base, 'section2').includes('/products.json'));
});

test('buildSavePayload: clear saves explicit empty record, validation errors are reported', () => {
  assert.deepEqual(H.buildSavePayload({ clear: true, name: 'ignored' }), { ok: true, payload: { empty: true } });
  const ok = H.buildSavePayload({ name: ' Serum ', image: 'images/product1.webp', url: SHOP, cta: '' });
  assert.deepEqual(ok, { ok: true, payload: { name: 'Serum', image: 'images/product1.webp', url: SHOP, cta: 'Shopify에서 보기 ›' } });
  const bad = H.buildSavePayload({ name: '', image: 'data:image/svg+xml;base64,AAAA', url: 'https://u:p@x.myshopify.com/' });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors.map((e) => e.field).sort(), ['image', 'name', 'url']);
  // Never produces a null payload (which would delete in Firebase).
  assert.notEqual(H.buildSavePayload({}).payload, null);
});

test('computeLayout: desktop/mobile targets, direction choice and viewport clamping', () => {
  // Desktop, plenty of room below.
  let l = H.computeLayout({ rect: { top: 300, bottom: 366, left: 900, right: 1118 }, viewportWidth: 1440, viewportHeight: 900, align: 'right' });
  assert.deepEqual(l, { direction: 'down', width: 380, height: 250, mobile: false, captionOffset: 0 });

  // Desktop near bottom -> opens up.
  l = H.computeLayout({ rect: { top: 780, bottom: 846, left: 900, right: 1118 }, viewportWidth: 1440, viewportHeight: 900, align: 'right' });
  assert.equal(l.direction, 'up');
  assert.equal(l.height, 250);

  // Mobile (<=768): compact horizontal card; upward growth reserves title space.
  l = H.computeLayout({ rect: { top: 700, bottom: 766, left: 24, right: 242 }, viewportWidth: 390, viewportHeight: 844, align: 'left' });
  assert.deepEqual(l, { direction: 'up', width: 342, height: 204, mobile: true, captionOffset: -150 });

  // Tight viewport: clamps to margins, never below closed size.
  l = H.computeLayout({ rect: { top: 100, bottom: 166, left: 20, right: 238 }, viewportWidth: 600, viewportHeight: 300, align: 'left' });
  assert.equal(l.mobile, true);
  assert.ok(l.height <= 300 - 24 * 2 || l.height === 66);
  assert.ok(l.height >= 66);

  // Right-aligned with little room on the left: width shrinks to fit margin.
  l = H.computeLayout({ rect: { top: 100, bottom: 166, left: 80, right: 300 }, viewportWidth: 1000, viewportHeight: 900, align: 'right' });
  assert.equal(l.width, 300 - 14);
});

test('alignFromTextAlign maps computed textAlign', () => {
  assert.equal(H.alignFromTextAlign('right'), 'right');
  assert.equal(H.alignFromTextAlign('end', 'ltr'), 'right');
  assert.equal(H.alignFromTextAlign('left'), 'left');
  assert.equal(H.alignFromTextAlign('start', 'ltr'), 'left');
  assert.equal(H.alignFromTextAlign('start', 'rtl'), 'right');
  assert.equal(H.alignFromTextAlign('-webkit-right'), 'right');
});

test('describeHttpError surfaces Firebase denial text', () => {
  assert.equal(H.describeHttpError(401, '{"error":"Permission denied"}'), '저장 권한이 거부되었습니다 (HTTP 401: Permission denied)');
  assert.match(H.describeHttpError(500, 'boom'), /HTTP 500: boom/);
  assert.match(H.describeHttpError(503, ''), /HTTP 503\)$/);
});

// ---- lifecycle (fake scheduler) ----

function fakeScheduler() {
  let next = 1;
  const frames = new Map();
  const timers = new Map();
  return {
    frames, timers,
    requestAnimationFrame: (f) => { const id = next++; frames.set(id, f); return id; },
    cancelAnimationFrame: (id) => { frames.delete(id); },
    setTimeout: (f, ms) => { const id = next++; timers.set(id, { f, ms }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    flushFrames() { const fs = [...frames.values()]; frames.clear(); fs.forEach((f) => f()); },
    flushTimers() { const ts = [...timers.values()]; timers.clear(); ts.forEach((t) => t.f()); },
    closeMs: 480
  };
}

function recorder() {
  const log = [];
  return {
    log,
    hooks: {
      show: () => log.push('show'),
      commitOpen: () => log.push('commitOpen'),
      startClose: (o) => log.push('startClose:' + !!(o && o.restoreFocus)),
      hide: () => log.push('hide')
    }
  };
}

test('lifecycle: open commits after one frame, close hides after closeMs', () => {
  const s = fakeScheduler();
  const r = recorder();
  const d = H.createDisclosure(r.hooks, s);
  assert.equal(d.phase(), 'closed');
  assert.equal(d.open(), true);
  assert.deepEqual(r.log, ['show']);
  assert.equal(d.phase(), 'opening');
  assert.deepEqual(d.pending(), { frame: true, hide: false });
  assert.equal(d.open(), false, 'double open is a no-op');
  assert.equal(s.frames.size, 1, 'no extra frame scheduled');
  s.flushFrames();
  assert.deepEqual(r.log, ['show', 'commitOpen']);
  assert.equal(d.phase(), 'open');

  assert.equal(d.close({ restoreFocus: true }), true);
  assert.deepEqual(r.log.slice(2), ['startClose:true']);
  assert.equal(d.phase(), 'closing');
  assert.deepEqual(d.pending(), { frame: false, hide: true });
  assert.equal([...s.timers.values()][0].ms, 480);
  assert.equal(d.close(), false, 'double close is a no-op');
  assert.equal(s.timers.size, 1);
  s.flushTimers();
  assert.deepEqual(r.log.slice(3), ['hide']);
  assert.equal(d.phase(), 'closed');
  assert.deepEqual(d.pending(), { frame: false, hide: false });
  assert.equal(s.frames.size + s.timers.size, 0, 'nothing left pending');
});

test('lifecycle: reopening during close cancels the pending hide (no race)', () => {
  const s = fakeScheduler();
  const r = recorder();
  const d = H.createDisclosure(r.hooks, s);
  d.open(); s.flushFrames();
  d.close();
  assert.equal(s.timers.size, 1);
  d.open();
  assert.equal(s.timers.size, 0, 'hide timer cancelled');
  assert.equal(d.phase(), 'opening');
  s.flushTimers();
  s.flushFrames();
  assert.deepEqual(r.log, ['show', 'commitOpen', 'startClose:false', 'show', 'commitOpen']);
  assert.ok(!r.log.includes('hide'));
  assert.equal(d.phase(), 'open');
});

test('lifecycle: closing before the commit frame cancels it; stale callbacks are inert', () => {
  const s = fakeScheduler();
  const r = recorder();
  const d = H.createDisclosure(r.hooks, s);
  d.open();
  const staleFrame = [...s.frames.values()][0];
  d.close();
  assert.equal(s.frames.size, 0, 'commit frame cancelled');
  staleFrame(); // even if a browser fired it anyway
  assert.ok(!r.log.includes('commitOpen'));
  const staleHide = [...s.timers.values()][0].f;
  d.open();
  staleHide(); // stale hide after reopen must not hide
  assert.ok(!r.log.includes('hide'));
  s.flushFrames();
  assert.equal(d.phase(), 'open');
  d.destroy();
  assert.equal(s.frames.size + s.timers.size, 0);
});

test('lifecycle: rapid toggling never accumulates timers or frames', () => {
  const s = fakeScheduler();
  const d = H.createDisclosure(recorder().hooks, s);
  for (let i = 0; i < 50; i++) { d.open(); d.close(); }
  assert.equal(s.frames.size, 0);
  assert.equal(s.timers.size, 1);
  s.flushTimers();
  assert.equal(d.phase(), 'closed');
  assert.equal(s.timers.size, 0);
});

test('inputModeForKey: navigation/activation keys switch to keyboard only', () => {
  for (const k of ['Tab', 'Enter', ' ', 'Spacebar', 'Escape', 'Esc', 'ArrowDown', 'Home', 'End']) {
    assert.equal(H.inputModeForKey(k, ''), 'keyboard', k);
  }
  assert.equal(H.inputModeForKey('', 'Space'), 'keyboard');
  for (const k of ['a', 'Shift', 'Control', 'Meta', '', undefined]) {
    assert.equal(H.inputModeForKey(k, 'KeyA'), null, String(k));
  }
});
