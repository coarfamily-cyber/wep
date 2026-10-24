'use strict';

// Mobile layout contract for computeLayout (hero product capsule).
// Contract:
//   opts.assigned (default true)
//   mobile when viewportWidth <= 768
//   mobile assigned target 360 x 204, gutter 24
//   unassigned (empty slot) compact target 218 x 128
//   desktop assigned 380 x 250, gutter 14 (unchanged)
//   captionOffset = mobile && direction === 'up' ? -(height - 66 + 12) : 0

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const H = require(path.join(__dirname, 'hero-products.js'));

const CLOSED_W = 218;
const CLOSED_H = 66;
const MOBILE_GUTTER = 24;
const DESKTOP_GUTTER = 14;

// Closed capsule rect, left-aligned at the mobile gutter.
function leftRect(top, left = MOBILE_GUTTER) {
  return { top, bottom: top + CLOSED_H, left, right: left + CLOSED_W };
}
// Closed capsule rect, right-aligned at the mobile gutter.
function rightRect(top, vw, gutter = MOBILE_GUTTER) {
  return { top, bottom: top + CLOSED_H, left: vw - gutter - CLOSED_W, right: vw - gutter };
}

function layout(o) {
  return H.computeLayout(o);
}

function expectedCaption(l) {
  return l.mobile && l.direction === 'up' ? -(l.height - CLOSED_H + 12) : 0;
}

function assertWithinGutters(l, o, gutter) {
  const { rect, viewportWidth: vw, viewportHeight: vh } = o;
  const align = o.align === 'left' ? 'left' : 'right';
  if (align === 'left') {
    assert.ok(rect.left + l.width <= vw - gutter, `right edge ${rect.left + l.width} > ${vw - gutter}`);
  } else {
    assert.ok(rect.right - l.width >= gutter, `left edge ${rect.right - l.width} < ${gutter}`);
  }
  assert.ok(l.width <= vw - 2 * gutter, `width ${l.width} wider than viewport minus gutters`);
  if (l.direction === 'up') {
    assert.ok(rect.bottom - l.height >= gutter, `top edge ${rect.bottom - l.height} < ${gutter}`);
  } else {
    assert.ok(rect.top + l.height <= vh - gutter, `bottom edge ${rect.top + l.height} > ${vh - gutter}`);
  }
}

const MOBILE_VIEWPORTS = [
  [320, 568],
  [360, 640],
  [390, 844],
  [430, 640],
  [768, 900]
];

test('mobile assigned: 360x204 target clamped to 24px gutters, no horizontal overflow', () => {
  for (const [vw, vh] of MOBILE_VIEWPORTS) {
    for (const align of ['left', 'right']) {
      // Capsule near the bottom of the hero -> opens up.
      const top = vh - 160;
      const rect = align === 'left' ? leftRect(top) : rightRect(top, vw);
      const o = { rect, viewportWidth: vw, viewportHeight: vh, align };
      const l = layout(o);
      const tag = `${vw}x${vh} ${align}`;
      assert.equal(l.mobile, true, tag);
      assert.equal(l.direction, 'up', tag);
      assert.equal(l.width, Math.min(360, vw - 2 * MOBILE_GUTTER), tag);
      assert.equal(l.height, 204, tag);
      assert.ok(l.width >= CLOSED_W, tag);
      assertWithinGutters(l, o, MOBILE_GUTTER);
    }
  }
});

test('mobile panel is horizontal (wider than tall), never the old 218x340 vertical panel', () => {
  for (const [vw, vh] of MOBILE_VIEWPORTS) {
    const l = layout({ rect: leftRect(vh - 160), viewportWidth: vw, viewportHeight: vh, align: 'left' });
    assert.ok(l.width > l.height, `${vw}x${vh}: ${l.width}x${l.height}`);
    assert.notDeepEqual([l.width, l.height], [218, 340]);
  }
});

test('specific mobile widths: 320->272, 360->312, 390->342, 430->360, 768->360', () => {
  const expected = { 320: 272, 360: 312, 390: 342, 430: 360, 768: 360 };
  for (const [vw, vh] of MOBILE_VIEWPORTS) {
    const l = layout({ rect: leftRect(vh - 160), viewportWidth: vw, viewportHeight: vh, align: 'left' });
    assert.equal(l.width, expected[vw], `${vw}x${vh}`);
  }
});

test('mobile direction: up near bottom, down near top; caption shift only when up', () => {
  for (const [vw, vh] of MOBILE_VIEWPORTS) {
    const up = layout({ rect: leftRect(vh - 160), viewportWidth: vw, viewportHeight: vh, align: 'left' });
    assert.equal(up.direction, 'up', `${vw}x${vh} up`);
    assert.equal(up.captionOffset, -(204 - 66 + 12), `${vw}x${vh} up caption`);
    assert.equal(up.captionOffset, -150);

    const down = layout({ rect: leftRect(120), viewportWidth: vw, viewportHeight: vh, align: 'left' });
    assert.equal(down.direction, 'down', `${vw}x${vh} down`);
    assert.equal(down.height, 204);
    assert.equal(down.captionOffset, 0, `${vw}x${vh} down caption`);
    assertWithinGutters(down, { rect: leftRect(120), viewportWidth: vw, viewportHeight: vh, align: 'left' }, MOBILE_GUTTER);
  }
});

test('assigned defaults to true (omitted === assigned:true)', () => {
  for (const [vw, vh] of [...MOBILE_VIEWPORTS, [1440, 900]]) {
    const rect = vw > 768 ? rightRect(300, vw, 200) : leftRect(vh - 160);
    const base = { rect, viewportWidth: vw, viewportHeight: vh, align: vw > 768 ? 'right' : 'left' };
    assert.deepEqual(layout(base), layout({ ...base, assigned: true }), `${vw}x${vh}`);
  }
});

test('empty slot (assigned:false) uses compact 218x128 on mobile, not a huge blank panel', () => {
  for (const [vw, vh] of MOBILE_VIEWPORTS) {
    // Compact panel fits below unless the capsule sits within ~150px of the bottom.
    for (const [top, dir] of [[vh - 120, 'up'], [120, 'down']]) {
      const o = { rect: leftRect(top), viewportWidth: vw, viewportHeight: vh, align: 'left', assigned: false };
      const l = layout(o);
      const tag = `${vw}x${vh} ${dir}`;
      assert.equal(l.mobile, true, tag);
      assert.equal(l.direction, dir, tag);
      assert.equal(l.width, 218, tag);
      assert.equal(l.height, 128, tag);
      assert.equal(l.captionOffset, expectedCaption(l), tag);
      assert.equal(l.captionOffset, dir === 'up' ? -(128 - 66 + 12) : 0, tag);
      assertWithinGutters(l, o, MOBILE_GUTTER);
    }
  }
});

test('empty slot is strictly smaller than assigned panel', () => {
  for (const [vw, vh] of [...MOBILE_VIEWPORTS, [1440, 900]]) {
    const rect = vw > 768 ? rightRect(300, vw, 200) : leftRect(vh - 160);
    const align = vw > 768 ? 'right' : 'left';
    const full = layout({ rect, viewportWidth: vw, viewportHeight: vh, align });
    const empty = layout({ rect, viewportWidth: vw, viewportHeight: vh, align, assigned: false });
    assert.ok(empty.height < full.height, `${vw}x${vh} height`);
    assert.ok(empty.width <= full.width, `${vw}x${vh} width`);
    assert.ok(empty.width * empty.height < full.width * full.height, `${vw}x${vh} area`);
  }
});

test('desktop 1440x900 unchanged: 380x250, gutter 14, captionOffset 0 in both directions', () => {
  let l = layout({ rect: { top: 300, bottom: 366, left: 900, right: 1118 }, viewportWidth: 1440, viewportHeight: 900, align: 'right' });
  assert.equal(l.mobile, false);
  assert.equal(l.direction, 'down');
  assert.equal(l.width, 380);
  assert.equal(l.height, 250);
  assert.equal(l.captionOffset, 0);

  l = layout({ rect: { top: 780, bottom: 846, left: 900, right: 1118 }, viewportWidth: 1440, viewportHeight: 900, align: 'right' });
  assert.equal(l.mobile, false);
  assert.equal(l.direction, 'up');
  assert.equal(l.width, 380);
  assert.equal(l.height, 250);
  assert.equal(l.captionOffset, 0, 'desktop never shifts the caption');

  // Desktop gutter still 14.
  l = layout({ rect: { top: 100, bottom: 166, left: 80, right: 300 }, viewportWidth: 1000, viewportHeight: 900, align: 'right' });
  assert.equal(l.mobile, false);
  assert.equal(l.width, 300 - DESKTOP_GUTTER);

  // Desktop empty slot is compact too.
  l = layout({ rect: { top: 300, bottom: 366, left: 900, right: 1118 }, viewportWidth: 1440, viewportHeight: 900, align: 'right', assigned: false });
  assert.equal(l.width, 218);
  assert.equal(l.height, 128);
  assert.equal(l.captionOffset, 0);
});

test('breakpoint: 768 is mobile, 769 is desktop', () => {
  const m = layout({ rect: leftRect(600), viewportWidth: 768, viewportHeight: 900, align: 'left' });
  assert.equal(m.mobile, true);
  const d = layout({ rect: { top: 300, bottom: 366, left: 400, right: 618 }, viewportWidth: 769, viewportHeight: 900, align: 'right' });
  assert.equal(d.mobile, false);
  assert.equal(d.width, 380);
  assert.equal(d.height, 250);
  assert.equal(d.captionOffset, 0);
});

test('captionOffset always matches formula and result shape is stable', () => {
  const cases = [];
  for (const [vw, vh] of [...MOBILE_VIEWPORTS, [1440, 900]]) {
    for (const assigned of [true, false, undefined]) {
      for (const top of [80, Math.floor(vh / 2), vh - 160]) {
        for (const align of ['left', 'right']) {
          const rect = align === 'left' ? leftRect(top) : rightRect(top, vw);
          const o = { rect, viewportWidth: vw, viewportHeight: vh, align };
          if (assigned !== undefined) o.assigned = assigned;
          cases.push(o);
        }
      }
    }
  }
  for (const o of cases) {
    const l = layout(o);
    const tag = JSON.stringify(o);
    for (const k of ['direction', 'width', 'height', 'mobile', 'captionOffset']) assert.ok(k in l, `${k} missing ${tag}`);
    assert.ok(l.direction === 'up' || l.direction === 'down', tag);
    assert.ok(Number.isInteger(l.width) && Number.isInteger(l.height), tag);
    assert.ok(Number.isInteger(l.captionOffset), tag);
    assert.ok(l.width >= CLOSED_W && l.height >= CLOSED_H, tag);
    assert.equal(l.captionOffset, expectedCaption(l), tag);
    if (!l.mobile) assert.equal(l.captionOffset, 0, tag);
    if (l.mobile) assert.ok(l.width <= o.viewportWidth - 2 * MOBILE_GUTTER || l.width === CLOSED_W, tag);
  }
});

test('caption shift keeps the original label inside the viewport on mobile', () => {
  // The headline/caption sits directly above the closed capsule (its bottom == rect.top).
  // When the panel opens up it extends (height - 66) above the capsule top; the caption
  // moves up by captionOffset so its bottom lands exactly 12px above the panel top.
  for (const [vw, vh] of MOBILE_VIEWPORTS) {
    for (const assigned of [true, false]) {
      const rect = leftRect(vh - 120);
      const l = layout({ rect, viewportWidth: vw, viewportHeight: vh, align: 'left', assigned });
      assert.equal(l.direction, 'up', `${vw}x${vh} assigned=${assigned}`);
      const panelTop = rect.bottom - l.height;
      const shiftedCaptionBottom = rect.top + l.captionOffset;
      assert.equal(shiftedCaptionBottom, panelTop - 12, `${vw}x${vh} assigned=${assigned}`);
      assert.ok(panelTop >= MOBILE_GUTTER, `${vw}x${vh} panel top inside gutter`);
    }
  }
});
