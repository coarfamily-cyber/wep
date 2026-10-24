/*!
 * COAR hero "Learn more" products (section2 / section3).
 * Version 2026-10-24.1
 *
 * - Public: each Learn more trigger expands IN PLACE into a glass capsule that
 *   shows exactly one independently selected product (or a "preparing" note).
 * - Admin (existing client-side sessionStorage gate, isAdmin()): a native
 *   <dialog> editor that saves ONLY the edited slot via
 *   PUT {FIREBASE_URL}/learnMoreProducts/{slot}.json.
 * - Never touches the Full Catalog or /products.json.
 * - Note: the admin gate is the site's existing client-side check. It is NOT
 *   server-side authentication; Firebase rules decide what writes are accepted.
 *
 * Works as a deferred classic script. When `document` is undefined (Node),
 * pure helpers are exported via CommonJS for unit tests.
 */
(function (root) {
  'use strict';

  var VERSION = '2026-10-25.1';
  var CLOSE_MS = 480; // keep panel unhidden this long after close so CSS clip/fade can finish
  var SLOTS = ['section2', 'section3'];
  var SLOT_LABELS = { section2: 'Section 2', section3: 'Section 3' };
  var REMOTE_NAMESPACE = 'learnMoreProducts';
  var DEFAULTS_URL = 'hero-products.json';
  var FALLBACK_FIREBASE_URL = 'https://coarfamily-e4960-default-rtdb.firebaseio.com';
  var DEFAULT_CTA = 'Shopify에서 보기 \u203A';
  var EMPTY_MESSAGE = '상품 정보를 준비 중입니다.';

  var LIMITS = {
    name: 80,
    cta: 40,
    url: 2048,
    imageUrl: 2048,
    imageData: 2000000
  };

  var LAYOUT = {
    closedWidth: 218,
    closedHeight: 66,
    desktopWidth: 380,
    desktopHeight: 250,
    mobileWidth: 360,
    mobileHeight: 204,
    mobileMax: 768,
    mobileMargin: 24,
    emptyWidth: 218,
    emptyHeight: 128,
    captionGap: 12,
    margin: 14
  };

  var UPLOAD = {
    maxSide: 900,
    quality: 0.82,
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  };

  var SHOPIFY_HOST_SUFFIXES = ['myshopify.com', 'shopifypreview.com'];

  /* ------------------------------------------------------------------ */
  /* Pure helpers (no DOM)                                                */
  /* ------------------------------------------------------------------ */

  function isKnownSlot(slot) {
    return typeof slot === 'string' && SLOTS.indexOf(slot) !== -1;
  }

  // Strip C0/C1 control chars and bidi override/isolate chars, collapse whitespace.
  function cleanText(value, maxLen) {
    if (typeof value !== 'string') return '';
    var s = value
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    var chars = Array.from(s);
    if (chars.length > maxLen) s = chars.slice(0, maxLen).join('').trim();
    return s;
  }

  function normalizeName(value) {
    return cleanText(value, LIMITS.name);
  }

  function normalizeCta(value) {
    var s = cleanText(value, LIMITS.cta);
    return s || DEFAULT_CTA;
  }

  function hostMatchesSuffix(host, suffix) {
    return host === suffix || (host.length > suffix.length + 1 &&
      host.slice(-(suffix.length + 1)) === '.' + suffix);
  }

  // Returns normalized href string or null.
  function normalizeShopifyUrl(value) {
    if (typeof value !== 'string') return null;
    var s = value.trim();
    if (!s || s.length > LIMITS.url) return null;
    if (/[\s\u0000-\u001F\u007F\\]/.test(s)) return null;
    if (!/^https:\/\//i.test(s)) return null;
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (u.port && u.port !== '443') return null;
    var host = u.hostname.toLowerCase().replace(/\.$/, '');
    var ok = SHOPIFY_HOST_SUFFIXES.some(function (suf) { return hostMatchesSuffix(host, suf); });
    if (!ok) return null;
    return u.href;
  }

  var DATA_IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

  // Returns normalized image src (relative repo path, https URL, or raster data URL) or null.
  function normalizeImageSrc(value) {
    if (typeof value !== 'string') return null;
    var s = value.trim();
    if (!s) return null;
    if (/^data:/i.test(s)) {
      if (s.length > LIMITS.imageData) return null;
      var m = DATA_IMAGE_RE.exec(s);
      if (!m) return null; // rejects SVG, non-base64, wrong case variants, junk
      return s;
    }
    if (s.length > LIMITS.imageUrl) return null;
    if (/[\s\u0000-\u001F\u007F\\"'<>`]/.test(s)) return null;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(s) || s.indexOf('//') === 0) {
      if (!/^https:\/\//i.test(s)) return null;
      var u;
      try { u = new URL(s); } catch (e) { return null; }
      if (u.protocol !== 'https:') return null;
      if (u.username || u.password) return null;
      if (!u.hostname) return null;
      return u.href;
    }
    // Relative repo path, e.g. "images/product1.webp", "./section2.jpg", "/wep/images/a.png".
    if (s.indexOf(':') !== -1) return null;
    if (!/^[A-Za-z0-9._~\-\/%()+]+$/.test(s)) return null;
    var parts = s.split(/[?#]/)[0].split('/');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '..') return null;
    }
    if (!/[A-Za-z0-9]/.test(s)) return null;
    return s;
  }

  /**
   * Normalize one stored record.
   * Returns:
   *   { status: 'missing' }                 raw is null/undefined (no value stored)
   *   { status: 'empty' }                   explicit cleared record {empty:true}
   *   { status: 'assigned', product }       valid product
   *   { status: 'invalid', errors: [] }     unusable
   */
  function normalizeRecord(raw) {
    if (raw === null || raw === undefined) return { status: 'missing' };
    if (typeof raw !== 'object' || Array.isArray(raw)) return { status: 'invalid', errors: ['not-object'] };
    if (raw.empty === true) return { status: 'empty' };
    var errors = [];
    var name = normalizeName(raw.name);
    if (!name) errors.push('name');
    var url = normalizeShopifyUrl(raw.url);
    if (!url) errors.push('url');
    var image = '';
    if (raw.image !== undefined && raw.image !== null && String(raw.image).trim() !== '') {
      image = normalizeImageSrc(String(raw.image));
      if (!image) errors.push('image');
    }
    if (errors.length) return { status: 'invalid', errors: errors };
    return {
      status: 'assigned',
      product: { name: name, image: image || '', url: url, cta: normalizeCta(raw.cta) }
    };
  }

  function unassignedSlot(source) {
    return { status: 'unassigned', source: source, product: null };
  }

  /**
   * Resolve slot state from bundled defaults and remote overrides.
   * Only known slots are read. A remote slot overrides its default only when
   * it holds a valid product or an explicit empty record; missing/invalid
   * remote values keep the default.
   */
  function resolveSlots(defaults, remote) {
    var out = {};
    var warnings = [];
    var d = (defaults && typeof defaults === 'object' && !Array.isArray(defaults)) ? defaults : {};
    var r = (remote && typeof remote === 'object' && !Array.isArray(remote)) ? remote : null;
    SLOTS.forEach(function (slot) {
      var base = normalizeRecord(Object.prototype.hasOwnProperty.call(d, slot) ? d[slot] : null);
      var state;
      if (base.status === 'assigned') state = { status: 'assigned', source: 'default', product: base.product };
      else {
        if (base.status === 'invalid') warnings.push('default:' + slot);
        state = unassignedSlot('default');
      }
      if (r && Object.prototype.hasOwnProperty.call(r, slot)) {
        var rem = normalizeRecord(r[slot]);
        if (rem.status === 'assigned') state = { status: 'assigned', source: 'remote', product: rem.product };
        else if (rem.status === 'empty') state = unassignedSlot('remote');
        else if (rem.status === 'invalid') warnings.push('remote:' + slot);
      }
      out[slot] = state;
    });
    return { slots: out, warnings: warnings };
  }

  function slotPath(slot) {
    if (!isKnownSlot(slot)) throw new Error('Unknown hero product slot: ' + slot);
    return '/' + REMOTE_NAMESPACE + '/' + slot + '.json';
  }

  function slotUrl(baseUrl, slot) {
    return String(baseUrl).replace(/\/+$/, '') + slotPath(slot);
  }

  function collectionUrl(baseUrl) {
    return String(baseUrl).replace(/\/+$/, '') + '/' + REMOTE_NAMESPACE + '.json';
  }

  /**
   * Build the payload for saving one slot from editor input.
   * input: { name, image, url, cta, clear }
   * Returns { ok: true, payload } or { ok: false, errors: [{field, message}] }.
   */
  function buildSavePayload(input) {
    input = input || {};
    if (input.clear === true) return { ok: true, payload: { empty: true } };
    var errors = [];
    var name = normalizeName(input.name);
    if (!name) errors.push({ field: 'name', message: '상품명을 입력하세요. (최대 ' + LIMITS.name + '자)' });
    var url = normalizeShopifyUrl(input.url);
    if (!url) errors.push({ field: 'url', message: 'Shopify 상품 주소는 https://…myshopify.com 또는 shopifypreview.com 주소여야 합니다.' });
    var image = '';
    var rawImage = typeof input.image === 'string' ? input.image.trim() : '';
    if (rawImage) {
      image = normalizeImageSrc(rawImage);
      if (!image) errors.push({ field: 'image', message: '이미지 주소는 저장소 상대 경로, https 주소, 또는 JPEG/PNG/WebP/GIF 이미지여야 합니다.' });
    }
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, payload: { name: name, image: image || '', url: url, cta: normalizeCta(input.cta) } };
  }

  /**
   * Compute capsule layout. rect = wrapper bounding rect (closed size).
   * Returns { direction: 'up'|'down', width, height, mobile }.
   */
  function computeLayout(opts) {
    var rect = opts.rect;
    var vw = opts.viewportWidth;
    var vh = opts.viewportHeight;
    var align = opts.align === 'left' ? 'left' : 'right';
    var mobile = vw <= LAYOUT.mobileMax;
    var m = mobile ? LAYOUT.mobileMargin : LAYOUT.margin;
    var assigned = opts.assigned !== false;
    var targetW = assigned ? (mobile ? LAYOUT.mobileWidth : LAYOUT.desktopWidth) : LAYOUT.emptyWidth;
    var targetH = assigned ? (mobile ? LAYOUT.mobileHeight : LAYOUT.desktopHeight) : LAYOUT.emptyHeight;

    var availW = align === 'right' ? rect.right - m : vw - rect.left - m;
    var width = Math.min(targetW, availW, vw - 2 * m);
    width = Math.max(LAYOUT.closedWidth, Math.floor(width));

    var downAvail = vh - rect.top - m;
    var upAvail = rect.bottom - m;
    var direction;
    if (downAvail >= targetH) direction = 'down';
    else if (upAvail >= targetH) direction = 'up';
    else direction = upAvail > downAvail ? 'up' : 'down';
    var avail = direction === 'down' ? downAvail : upAvail;
    var height = Math.min(targetH, avail, vh - 2 * m);
    height = Math.max(LAYOUT.closedHeight, Math.floor(height));

    var captionOffset = mobile && direction === 'up'
      ? -(height - LAYOUT.closedHeight + LAYOUT.captionGap) : 0;
    return { direction: direction, width: width, height: height, mobile: mobile, captionOffset: captionOffset };
  }

  function alignFromTextAlign(textAlign, dir) {
    var t = String(textAlign || '').toLowerCase();
    var rtl = String(dir || '').toLowerCase() === 'rtl';
    if (t === 'right' || t === '-webkit-right') return 'right';
    if (t === 'left' || t === '-webkit-left') return 'left';
    if (t === 'end') return rtl ? 'left' : 'right';
    if (t === 'start') return rtl ? 'right' : 'left';
    return 'left'; // center/justify/unknown
  }

  function describeHttpError(status, bodyText) {
    var detail = '';
    if (bodyText) {
      try {
        var j = JSON.parse(bodyText);
        if (j && typeof j.error === 'string') detail = j.error;
      } catch (e) {
        detail = String(bodyText).slice(0, 160);
      }
    }
    var head = (status === 401 || status === 403)
      ? '저장 권한이 거부되었습니다'
      : '저장에 실패했습니다';
    return head + ' (HTTP ' + status + (detail ? ': ' + cleanText(detail, 160) : '') + ')';
  }

  /**
   * Map a keydown to an input mode. Returns 'keyboard' for navigation /
   * activation keys, otherwise null (typing letters etc. does not switch).
   */
  function inputModeForKey(key, code) {
    var k = String(key || '');
    if (code === 'Space') return 'keyboard';
    if (k === 'Tab' || k === 'Enter' || k === ' ' || k === 'Spacebar' ||
        k === 'Escape' || k === 'Esc' || k === 'Home' || k === 'End' ||
        k === 'PageUp' || k === 'PageDown' || k.indexOf('Arrow') === 0) {
      return 'keyboard';
    }
    return null;
  }

  /**
   * Open/close lifecycle for one capsule. No DOM access; side effects go
   * through hooks so it can be unit tested with fake timers.
   *
   * open():  cancels any pending hide/frame, show() synchronously, then after
   *          one animation frame commitOpen() (only if still open).
   * close(): cancels a pending commit frame, startClose() synchronously, then
   *          after closeMs hide() (only if still closed). Reopening during the
   *          close window cancels the hide.
   * phase(): 'closed' | 'opening' | 'open' | 'closing'.
   * At most one frame and one timer are pending at any time; both are
   * cleared when they fire or are cancelled (no permanent loops).
   */
  function createDisclosure(hooks, sched) {
    sched = sched || {};
    var setT = sched.setTimeout || function (f, ms) { return setTimeout(f, ms); };
    var clrT = sched.clearTimeout || function (id) { clearTimeout(id); };
    var raf = sched.requestAnimationFrame || function (f) { return setT(f, 16); };
    var caf = sched.cancelAnimationFrame || function (id) { clrT(id); };
    var closeMs = typeof sched.closeMs === 'number' ? sched.closeMs : CLOSE_MS;
    var isOpen = false;
    var phase = 'closed';
    var frameId = null;
    var hideId = null;

    function cancelFrame() { if (frameId !== null) { caf(frameId); frameId = null; } }
    function cancelHide() { if (hideId !== null) { clrT(hideId); hideId = null; } }

    return {
      open: function () {
        if (isOpen) return false;
        isOpen = true;
        cancelHide();
        cancelFrame();
        phase = 'opening';
        if (hooks.show) hooks.show();
        frameId = raf(function () {
          frameId = null;
          if (!isOpen) return;
          phase = 'open';
          if (hooks.commitOpen) hooks.commitOpen();
        });
        return true;
      },
      close: function (opts) {
        if (!isOpen) return false;
        isOpen = false;
        cancelFrame();
        phase = 'closing';
        if (hooks.startClose) hooks.startClose(opts);
        hideId = setT(function () {
          hideId = null;
          if (isOpen) return;
          phase = 'closed';
          if (hooks.hide) hooks.hide();
        }, closeMs);
        return true;
      },
      isOpen: function () { return isOpen; },
      phase: function () { return phase; },
      pending: function () { return { frame: frameId !== null, hide: hideId !== null }; },
      destroy: function () { cancelFrame(); cancelHide(); }
    };
  }

  var helpers = {
    VERSION: VERSION,
    CLOSE_MS: CLOSE_MS,
    inputModeForKey: inputModeForKey,
    createDisclosure: createDisclosure,
    SLOTS: SLOTS.slice(),
    DEFAULT_CTA: DEFAULT_CTA,
    EMPTY_MESSAGE: EMPTY_MESSAGE,
    LIMITS: LIMITS,
    LAYOUT: LAYOUT,
    isKnownSlot: isKnownSlot,
    cleanText: cleanText,
    normalizeName: normalizeName,
    normalizeCta: normalizeCta,
    normalizeShopifyUrl: normalizeShopifyUrl,
    normalizeImageSrc: normalizeImageSrc,
    normalizeRecord: normalizeRecord,
    resolveSlots: resolveSlots,
    slotPath: slotPath,
    slotUrl: slotUrl,
    collectionUrl: collectionUrl,
    buildSavePayload: buildSavePayload,
    computeLayout: computeLayout,
    alignFromTextAlign: alignFromTextAlign,
    describeHttpError: describeHttpError
  };

  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
    return;
  }

  /* ------------------------------------------------------------------ */
  /* Browser runtime                                                      */
  /* ------------------------------------------------------------------ */

  try { document.documentElement.dataset.heroProductsVersion = VERSION; } catch (e) { /* ignore */ }

  if (root.CoarHeroProducts && root.CoarHeroProducts.version === VERSION) return; // double-load guard

  var state = {
    version: VERSION,
    loaded: false,
    defaultsError: null,
    remoteError: null,
    warnings: [],
    admin: false,
    open: null,
    slots: {
      section2: unassignedSlot('none'),
      section3: unassignedSlot('none')
    }
  };

  var anchors = {}; // slot -> { wrapper, surface, trigger, label, panel, edit, overlay }
  var editor = null; // dialog refs
  var resizeRaf = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function firebaseBase() {
    var u = root.FIREBASE_URL;
    if (typeof u === 'string' && /^https:\/\/[a-z0-9\-]+\.firebaseio\.com\/?$/i.test(u)) return u;
    return FALLBACK_FIREBASE_URL;
  }

  function currentIsAdmin() {
    try { return typeof root.isAdmin === 'function' && root.isAdmin() === true; } catch (e) { return false; }
  }

  // inert + aria-hidden only; `hidden` is managed separately so the close
  // animation can finish before content is removed from rendering.
  function setInert(node, on) {
    if (on) { node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true'); }
    else { node.removeAttribute('inert'); node.removeAttribute('aria-hidden'); }
    try { node.inert = !!on; } catch (e) { /* older browsers */ }
  }

  /* ---------- input mode (pointer / keyboard) ---------- */

  var inputMode = 'pointer';
  function setInputMode(mode) {
    if (mode !== 'pointer' && mode !== 'keyboard') return;
    inputMode = mode;
    var de = document.documentElement;
    if (de && de.dataset.coarHeroInput !== mode) de.dataset.coarHeroInput = mode;
  }
  function onInputKeydown(e) {
    var m = inputModeForKey(e.key, e.code);
    if (m) setInputMode(m);
  }
  function onInputPointer() { setInputMode('pointer'); }

  function stopBubble(e) { e.stopPropagation(); }

  /* ---------- markup enhancement ---------- */

  function findTrigger(slot) {
    var a = document.querySelector('a[data-hero-product-slot="' + slot + '"]');
    if (!a) {
      var byId = document.getElementById(slot + '-learn-more');
      if (byId && byId.tagName === 'A') a = byId;
    }
    return a;
  }

  function enhanceSlot(slot) {
    var trigger = findTrigger(slot);
    if (!trigger || !trigger.parentNode) return null;
    if (trigger.closest('.coar-hero-anchor')) return null; // already enhanced

    if (!trigger.id) trigger.id = slot + '-learn-more';
    var overlay = trigger.parentNode;
    var panelId = 'coar-hero-panel-' + slot;

    // Label keeps the original children (data-i18n span + arrow) in place.
    var label = el('span', 'coar-hero-label');
    while (trigger.firstChild) label.appendChild(trigger.firstChild);
    trigger.appendChild(label);

    var wrapper = el('div', 'coar-hero-anchor');
    wrapper.setAttribute('data-hero-slot', slot);
    wrapper.setAttribute('data-align', 'right');
    wrapper.setAttribute('data-direction', 'down');
    wrapper.style.setProperty('--coar-closed-width', LAYOUT.closedWidth + 'px');
    wrapper.style.setProperty('--coar-closed-height', LAYOUT.closedHeight + 'px');
    wrapper.style.setProperty('--coar-open-width', LAYOUT.desktopWidth + 'px');
    wrapper.style.setProperty('--coar-open-height', LAYOUT.desktopHeight + 'px');

    var surface = el('div', 'coar-hero-surface');
    var panel = el('div', 'coar-hero-panel');
    panel.id = panelId;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', trigger.id);
    setInert(panel, true);
    panel.hidden = true;

    overlay.insertBefore(wrapper, trigger);
    surface.appendChild(trigger);
    surface.appendChild(panel);
    wrapper.appendChild(surface);

    trigger.classList.add('coar-hero-trigger');
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panelId);
    // href="#catalog" is kept as the no-JS fallback; JS prevents navigation.

    var edit = el('button', 'coar-hero-edit', '상품 편집');
    edit.type = 'button';
    edit.setAttribute('aria-label', SLOT_LABELS[slot] + ' Learn more 상품 편집');
    edit.setAttribute('data-hero-slot', slot);
    edit.hidden = true;
    overlay.insertBefore(edit, wrapper.nextSibling);

    wrapper.setAttribute('data-phase', 'closed');
    var refs = { slot: slot, overlay: overlay, wrapper: wrapper, surface: surface, trigger: trigger, label: label, panel: panel, edit: edit, decodeHandle: null, lifecycle: null };
    refs.lifecycle = makeLifecycle(refs);

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle(slot);
      // Pointer activation: drop focus so no stale UA focus decoration remains.
      // Keyboard activation never reaches here (Enter/Space handled on keydown).
      if (e.detail > 0 || inputMode === 'pointer') {
        try { trigger.blur(); } catch (err) { /* ignore */ }
      }
    });
    trigger.addEventListener('keydown', function (e) {
      var k = e.key;
      if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      if (k === 'Enter' || k === ' ' || k === 'Spacebar' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        toggle(slot);
      }
    });
    // Contain events so ancestors (e.g. section2 onclick=toggleSound) never fire.
    wrapper.addEventListener('click', stopBubble);
    wrapper.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (state.open === slot) {
          e.preventDefault();
          close(slot, true);
        }
      }
      e.stopPropagation();
    });
    wrapper.addEventListener('keyup', stopBubble);
    wrapper.addEventListener('pointerdown', stopBubble);

    edit.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openEditor(slot);
    });
    edit.addEventListener('keydown', stopBubble);
    edit.addEventListener('keyup', stopBubble);
    edit.addEventListener('pointerdown', stopBubble);

    anchors[slot] = refs;
    updateAlign(slot);
    renderSlot(slot);
    return refs;
  }

  function updateAlign(slot) {
    var r = anchors[slot];
    if (!r) return;
    var cs = root.getComputedStyle ? root.getComputedStyle(r.overlay) : null;
    var align = alignFromTextAlign(cs ? cs.textAlign : 'right', cs ? cs.direction : 'ltr');
    r.wrapper.setAttribute('data-align', align);
  }

  function viewportSize() {
    var de = document.documentElement;
    var vv = root.visualViewport;
    var w = (de && de.clientWidth) || root.innerWidth || 0;
    var h = root.innerHeight || (de && de.clientHeight) || 0;
    if (vv && vv.height) h = Math.min(h || vv.height, vv.height);
    return { w: w, h: h };
  }

  function syncMobileCaption(r, expanded) {
    if (!r.mobileLayout) {
      r.overlay.removeAttribute('data-coar-mobile-layout');
      r.overlay.style.removeProperty('--coar-caption-offset');
      return;
    }
    r.overlay.setAttribute('data-coar-mobile-layout', expanded ? 'open' : 'closed');
    r.overlay.style.setProperty('--coar-caption-offset', (expanded ? r.captionOffset : 0) + 'px');
  }

  function applyLayout(slot) {
    var r = anchors[slot];
    if (!r) return;
    updateAlign(slot);
    var rect = r.wrapper.getBoundingClientRect();
    var vp = viewportSize();
    var lay = computeLayout({
      rect: rect,
      viewportWidth: vp.w,
      viewportHeight: vp.h,
      align: r.wrapper.getAttribute('data-align'),
      assigned: !!(state.slots[slot] && state.slots[slot].status === 'assigned')
    });
    r.mobileLayout = lay.mobile;
    r.captionOffset = lay.captionOffset;
    r.wrapper.setAttribute('data-direction', lay.direction);
    r.wrapper.style.setProperty('--coar-open-width', lay.width + 'px');
    r.wrapper.style.setProperty('--coar-open-height', lay.height + 'px');
    syncMobileCaption(r, r.wrapper.classList.contains('is-open'));
  }

  /* ---------- rendering ---------- */

  function renderSlot(slot) {
    var r = anchors[slot];
    if (!r) return;
    var s = state.slots[slot];
    var panel = r.panel;
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    r.wrapper.setAttribute('data-state', s && s.status === 'assigned' ? 'assigned' : 'unassigned');

    if (s && s.status === 'assigned' && s.product) {
      var p = s.product;
      var link = el('a', 'coar-hero-product');
      link.href = p.url;
      link.target = '_self';
      if (p.image) {
        var img = el('img', 'coar-hero-image');
        img.alt = p.name;
        img.decoding = 'async';
        img.addEventListener('error', function () { img.hidden = true; });
        img.src = p.image;
        link.appendChild(img);
        scheduleDecode(r, img);
      } else {
        cancelDecode(r);
      }
      link.appendChild(el('span', 'coar-hero-name', p.name));
      link.appendChild(el('span', 'coar-hero-cta', p.cta || DEFAULT_CTA));
      panel.appendChild(link);
    } else {
      cancelDecode(r);
      var empty = el('p', 'coar-hero-empty', EMPTY_MESSAGE);
      panel.appendChild(empty);
    }
    if (r.lifecycle && r.lifecycle.isOpen()) applyLayout(slot);
  }

  // Pre-decode the product image off the interaction path (idle time), so the
  // first open does not pay decode cost. One pending handle per slot max.
  function cancelDecode(r) {
    if (!r.decodeHandle) return;
    if (r.decodeHandle.idle && root.cancelIdleCallback) root.cancelIdleCallback(r.decodeHandle.id);
    else clearTimeout(r.decodeHandle.id);
    r.decodeHandle = null;
  }

  function scheduleDecode(r, img) {
    cancelDecode(r);
    var run = function () {
      r.decodeHandle = null;
      if (!img.isConnected || img.hidden || typeof img.decode !== 'function') return;
      img.decode().then(function () {
        if (img.isConnected) img.setAttribute('data-decoded', 'true');
      }, function () { /* broken/unsupported image: error handler hides it */ });
    };
    if (typeof root.requestIdleCallback === 'function') {
      r.decodeHandle = { idle: true, id: root.requestIdleCallback(run, { timeout: 1500 }) };
    } else {
      r.decodeHandle = { idle: false, id: setTimeout(run, 200) };
    }
  }

  function renderAll() { SLOTS.forEach(renderSlot); }

  /* ---------- open / close ---------- */

  function makeLifecycle(r) {
    return createDisclosure({
      show: function () {
        // Layout attrs first, so the closed clip state is correct before paint.
        applyLayout(r.slot);
        r.panel.hidden = false;
        setInert(r.panel, false);
        r.trigger.setAttribute('aria-expanded', 'true');
        r.wrapper.setAttribute('data-phase', 'opening');
      },
      commitOpen: function () {
        void r.wrapper.offsetWidth; // flush closed styles so the transition runs
        r.wrapper.classList.add('is-open');
        syncMobileCaption(r, true);
        r.wrapper.setAttribute('data-phase', 'open');
      },
      startClose: function (opts) {
        var restoreFocus = !!(opts && opts.restoreFocus);
        var active = document.activeElement;
        var focusInside = !!(active && r.panel.contains(active));
        r.wrapper.classList.remove('is-open');
        syncMobileCaption(r, false);
        r.trigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus || focusInside) {
          try { r.trigger.focus({ preventScroll: true }); } catch (e) { r.trigger.focus(); }
        }
        setInert(r.panel, true); // panel stays rendered (not hidden) for the fade
        r.wrapper.setAttribute('data-phase', 'closing');
      },
      hide: function () {
        r.panel.hidden = true;
        r.overlay.removeAttribute('data-coar-mobile-layout');
        r.overlay.style.removeProperty('--coar-caption-offset');
        r.wrapper.setAttribute('data-phase', 'closed');
      }
    }, {
      requestAnimationFrame: root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : null,
      cancelAnimationFrame: root.cancelAnimationFrame ? root.cancelAnimationFrame.bind(root) : null,
      closeMs: CLOSE_MS
    });
  }

  function open(slot) {
    var r = anchors[slot];
    if (!r) return;
    SLOTS.forEach(function (other) { if (other !== slot && state.open === other) close(other, false); });
    if (r.lifecycle.open()) state.open = slot;
  }

  function close(slot, restoreFocus) {
    var r = anchors[slot];
    if (!r) return;
    r.lifecycle.close({ restoreFocus: !!restoreFocus });
    if (state.open === slot) state.open = null;
  }

  function toggle(slot) {
    if (state.open === slot) close(slot, false);
    else open(slot);
  }

  function onDocumentPointer(e) {
    if (!state.open) return;
    var r = anchors[state.open];
    if (!r) return;
    var t = e.target;
    if (r.wrapper.contains(t)) return;
    if (r.edit && r.edit.contains(t)) return;
    if (editor && editor.dialog.contains(t)) return;
    close(state.open, false);
  }

  function onDocumentKeydown(e) {
    if (!state.open) return;
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (editor && editor.dialog.open) return;
    close(state.open, true);
  }

  function onResize() {
    if (resizeRaf) return;
    var raf = root.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    resizeRaf = raf(function () {
      resizeRaf = 0;
      SLOTS.forEach(function (slot) {
        if (state.open === slot) applyLayout(slot);
        else updateAlign(slot);
      });
    });
  }

  /* ---------- admin ---------- */

  function syncAdminUI(on) {
    var admin = !!on && currentIsAdmin();
    // Respect an explicit "on" only if the existing gate agrees; "off" always wins.
    state.admin = admin;
    SLOTS.forEach(function (slot) {
      var r = anchors[slot];
      if (r && r.edit) r.edit.hidden = !admin;
    });
    if (!admin && editor && editor.dialog.open) {
      try { editor.dialog.close(); } catch (e) { /* ignore */ }
    }
    return admin;
  }

  function field(id, labelText, input, hint) {
    var wrap = el('div', 'coar-hero-editor-field');
    var lab = el('label', null, labelText);
    lab.htmlFor = id;
    input.id = id;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    if (hint) {
      var h = el('small', 'coar-hero-editor-hint', hint);
      h.id = id + '-hint';
      input.setAttribute('aria-describedby', h.id);
      wrap.appendChild(h);
    }
    return wrap;
  }

  function buildEditor() {
    var dialog = el('dialog', 'coar-hero-editor');
    dialog.id = 'coar-hero-editor';
    dialog.setAttribute('aria-labelledby', 'coar-hero-editor-title');

    var form = el('form', 'coar-hero-editor-form');
    form.id = 'coar-hero-editor-form';
    form.noValidate = true;

    var title = el('h2', 'coar-hero-editor-title', 'Learn more 상품');
    title.id = 'coar-hero-editor-title';
    form.appendChild(title);

    var fields = el('fieldset', 'coar-hero-editor-fields');
    fields.id = 'coar-hero-editor-fields';

    var name = el('input');
    name.type = 'text';
    name.maxLength = LIMITS.name;
    name.autocomplete = 'off';
    fields.appendChild(field('coar-hero-editor-name', '상품명', name, '최대 ' + LIMITS.name + '자'));

    var image = el('input');
    image.type = 'text';
    image.inputMode = 'url';
    image.autocomplete = 'off';
    image.placeholder = 'images/product1.webp 또는 https://…';
    fields.appendChild(field('coar-hero-editor-image', '이미지 주소', image, '저장소 상대 경로 또는 https 주소'));

    var upload = el('input');
    upload.type = 'file';
    upload.accept = UPLOAD.types.join(',');
    fields.appendChild(field('coar-hero-editor-upload', '이미지 업로드', upload, '선택 사항 · JPEG/PNG/WebP/GIF · 최대 ' + UPLOAD.maxSide + 'px JPEG로 변환'));

    var url = el('input');
    url.type = 'url';
    url.inputMode = 'url';
    url.autocomplete = 'off';
    url.placeholder = 'https://your-store.myshopify.com/products/…';
    fields.appendChild(field('coar-hero-editor-url', 'Shopify 상품 주소', url, 'myshopify.com 또는 shopifypreview.com https 주소'));

    var cta = el('input');
    cta.type = 'text';
    cta.maxLength = LIMITS.cta;
    cta.autocomplete = 'off';
    cta.placeholder = DEFAULT_CTA;
    fields.appendChild(field('coar-hero-editor-cta', '버튼 문구', cta, '비우면 기본 문구: ' + DEFAULT_CTA));

    form.appendChild(fields);

    var clearWrap = el('div', 'coar-hero-editor-field coar-hero-editor-clear-field');
    var clear = el('input');
    clear.type = 'checkbox';
    clear.id = 'coar-hero-editor-clear';
    var clearLabel = el('label', null, '선택 해제 (이 섹션 상품 비우기)');
    clearLabel.htmlFor = clear.id;
    clearWrap.appendChild(clear);
    clearWrap.appendChild(clearLabel);
    form.appendChild(clearWrap);

    var preview = el('div', 'coar-hero-editor-preview');
    preview.id = 'coar-hero-editor-preview';
    preview.setAttribute('aria-label', '미리보기');
    form.appendChild(preview);

    var status = el('p', 'coar-hero-editor-status');
    status.id = 'coar-hero-editor-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.appendChild(status);

    var actions = el('div', 'coar-hero-editor-actions');
    var cancel = el('button', 'coar-hero-editor-cancel', '취소');
    cancel.type = 'button';
    cancel.id = 'coar-hero-editor-cancel';
    var save = el('button', 'coar-hero-editor-save', '저장');
    save.type = 'submit';
    save.id = 'coar-hero-editor-save';
    actions.appendChild(cancel);
    actions.appendChild(save);
    form.appendChild(actions);

    dialog.appendChild(form);
    document.body.appendChild(dialog);

    var ed = {
      dialog: dialog, form: form, title: title, fields: fields,
      name: name, image: image, upload: upload, url: url, cta: cta, clear: clear,
      preview: preview, status: status, save: save, cancel: cancel,
      slot: null, uploadData: '', saving: false, returnFocus: null, uploadToken: 0
    };

    function refreshPreview() { renderPreview(ed); }
    name.addEventListener('input', refreshPreview);
    cta.addEventListener('input', refreshPreview);
    url.addEventListener('input', refreshPreview);
    image.addEventListener('input', function () {
      if (image.value.trim()) ed.uploadData = '';
      image.placeholder = 'images/product1.webp 또는 https://…';
      refreshPreview();
    });
    clear.addEventListener('change', function () {
      fields.disabled = clear.checked;
      refreshPreview();
    });
    upload.addEventListener('change', function () { handleUpload(ed); });
    cancel.addEventListener('click', function () { if (!ed.saving) dialog.close(); });
    dialog.addEventListener('cancel', function (e) { if (ed.saving) e.preventDefault(); });
    dialog.addEventListener('close', function () {
      var f = ed.returnFocus;
      ed.returnFocus = null;
      if (f && document.contains(f) && !f.hidden) {
        try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitEditor(ed);
    });
    return ed;
  }

  function setStatus(ed, text, kind) {
    ed.status.textContent = text || '';
    if (kind) ed.status.setAttribute('data-kind', kind);
    else ed.status.removeAttribute('data-kind');
  }

  function editorInput(ed) {
    return {
      name: ed.name.value,
      image: ed.uploadData || ed.image.value,
      url: ed.url.value,
      cta: ed.cta.value,
      clear: ed.clear.checked
    };
  }

  function renderPreview(ed) {
    var box = ed.preview;
    while (box.firstChild) box.removeChild(box.firstChild);
    var input = editorInput(ed);
    if (input.clear) {
      box.appendChild(el('p', 'coar-hero-empty', EMPTY_MESSAGE));
      return;
    }
    var src = input.image ? normalizeImageSrc(input.image) : '';
    if (src) {
      var img = el('img', 'coar-hero-image');
      img.alt = '';
      img.addEventListener('error', function () { img.hidden = true; });
      img.src = src;
      box.appendChild(img);
    }
    var nm = normalizeName(input.name);
    box.appendChild(el('span', 'coar-hero-name', nm || '(상품명)'));
    box.appendChild(el('span', 'coar-hero-cta', normalizeCta(input.cta)));
  }

  function handleUpload(ed) {
    var file = ed.upload.files && ed.upload.files[0];
    if (!file) return;
    var token = ++ed.uploadToken;
    if (UPLOAD.types.indexOf(String(file.type).toLowerCase()) === -1) {
      ed.upload.value = '';
      setStatus(ed, '이미지 파일(JPEG/PNG/WebP/GIF)만 업로드할 수 있습니다.', 'error');
      return;
    }
    setStatus(ed, '이미지 처리 중…', 'info');
    var objectUrl = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(objectUrl);
      if (token !== ed.uploadToken) return;
      try {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) throw new Error('empty image');
        var scale = Math.min(1, UPLOAD.maxSide / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // flatten transparency for JPEG
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        var data = canvas.toDataURL('image/jpeg', UPLOAD.quality);
        if (!normalizeImageSrc(data)) throw new Error('encoded image rejected');
        ed.uploadData = data;
        ed.image.value = '';
        ed.image.placeholder = '(업로드한 이미지 사용 · ' + cw + '×' + ch + ')';
        setStatus(ed, '업로드 이미지가 준비되었습니다 (' + cw + '×' + ch + ' JPEG). 저장을 눌러야 반영됩니다.', 'info');
        renderPreview(ed);
      } catch (err) {
        ed.upload.value = '';
        setStatus(ed, '이미지를 처리할 수 없습니다: ' + (err && err.message ? err.message : err), 'error');
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      if (token !== ed.uploadToken) return;
      ed.upload.value = '';
      setStatus(ed, '이미지 파일을 읽을 수 없습니다.', 'error');
    };
    img.src = objectUrl;
  }

  function openEditor(slot) {
    if (!isKnownSlot(slot)) return;
    if (!currentIsAdmin()) { syncAdminUI(false); return; }
    if (!editor) editor = buildEditor();
    var ed = editor;
    if (ed.dialog.open) return;
    if (state.open) close(state.open, false);
    ed.slot = slot;
    ed.returnFocus = anchors[slot] ? anchors[slot].edit : null;
    ed.title.textContent = SLOT_LABELS[slot] + ' Learn more 상품';
    ed.uploadData = '';
    ed.uploadToken++;
    ed.upload.value = '';
    ed.clear.checked = false;
    ed.fields.disabled = false;
    ed.image.placeholder = 'images/product1.webp 또는 https://…';
    var s = state.slots[slot];
    var p = s && s.status === 'assigned' ? s.product : null;
    ed.name.value = p ? p.name : '';
    ed.url.value = p ? p.url : '';
    ed.cta.value = p && p.cta !== DEFAULT_CTA ? p.cta : '';
    if (p && /^data:/i.test(p.image)) {
      ed.uploadData = p.image;
      ed.image.value = '';
      ed.image.placeholder = '(현재 업로드 이미지 사용 중)';
    } else {
      ed.image.value = p ? p.image : '';
    }
    setStatus(ed, s && s.status !== 'assigned' ? '현재 이 섹션은 비어 있습니다.' : '', null);
    setSaving(ed, false);
    renderPreview(ed);
    try { ed.dialog.showModal(); } catch (e) { ed.dialog.setAttribute('open', ''); }
    try { ed.name.focus(); } catch (e) { /* ignore */ }
  }

  function setSaving(ed, on) {
    ed.saving = on;
    ed.save.disabled = on;
    ed.cancel.disabled = on;
    ed.clear.disabled = on;
    ed.fields.disabled = on || ed.clear.checked;
    ed.form.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function submitEditor(ed) {
    if (ed.saving) return;
    var slot = ed.slot;
    if (!isKnownSlot(slot)) return;
    if (!currentIsAdmin()) {
      setStatus(ed, '관리자 로그인 상태가 아닙니다. 다시 로그인한 뒤 저장하세요.', 'error');
      syncAdminUI(false);
      return;
    }
    var built = buildSavePayload(editorInput(ed));
    if (!built.ok) {
      setStatus(ed, built.errors.map(function (x) { return x.message; }).join(' '), 'error');
      var first = ed[built.errors[0].field];
      if (first && first.focus) first.focus();
      return;
    }
    saveSlot(slot, built.payload, ed);
  }

  function saveSlot(slot, payload, ed) {
    if (!isKnownSlot(slot)) return Promise.reject(new Error('unknown slot'));
    if (ed) { setSaving(ed, true); setStatus(ed, '저장 중…', 'info'); }
    var target = slotUrl(firebaseBase(), slot);
    return root.fetch(target, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store'
    }).then(function (res) {
      return res.text().then(function (text) {
        if (!res.ok) throw new Error(describeHttpError(res.status, text));
        var accepted;
        try { accepted = JSON.parse(text); } catch (e) { throw new Error('서버 응답을 해석할 수 없어 저장 여부를 확인하지 못했습니다.'); }
        var norm = normalizeRecord(accepted);
        if (norm.status === 'assigned') {
          state.slots[slot] = { status: 'assigned', source: 'saved', product: norm.product };
        } else if (norm.status === 'empty') {
          state.slots[slot] = unassignedSlot('saved');
        } else {
          throw new Error('서버가 반환한 데이터가 올바르지 않아 반영하지 않았습니다.');
        }
        renderSlot(slot);
        return cloneState().slots[slot];
      });
    }, function (netErr) {
      throw new Error('네트워크 오류로 저장하지 못했습니다' + (netErr && netErr.message ? ': ' + netErr.message : '.'));
    }).then(function (result) {
      if (ed) {
        setSaving(ed, false);
        setStatus(ed, '저장되었습니다. (' + SLOT_LABELS[slot] + ')', 'success');
        renderPreview(ed);
      }
      return result;
    }, function (err) {
      if (ed) {
        setSaving(ed, false);
        setStatus(ed, err && err.message ? err.message : '저장에 실패했습니다.', 'error');
      }
      throw err;
    });
  }

  /* ---------- data loading ---------- */

  function fetchJson(url) {
    return root.fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function loadData() {
    var defaultsP = fetchJson(DEFAULTS_URL).then(function (d) {
      if (d && typeof d === 'object' && d.version !== undefined && d.version !== 1) {
        state.warnings.push('defaults-version:' + d.version);
      }
      return d;
    }, function (err) {
      state.defaultsError = String(err && err.message || err);
      return null;
    });
    var remoteP = fetchJson(collectionUrl(firebaseBase())).then(null, function (err) {
      state.remoteError = String(err && err.message || err);
      return null;
    });
    return Promise.all([defaultsP, remoteP]).then(function (res) {
      var resolved = resolveSlots(res[0], res[1]);
      state.slots = resolved.slots;
      state.warnings = state.warnings.concat(resolved.warnings);
      state.loaded = true;
      renderAll();
    });
  }

  function cloneState() {
    var copy = JSON.parse(JSON.stringify(state));
    copy.inputMode = inputMode;
    copy.phases = {};
    SLOTS.forEach(function (slot) {
      copy.phases[slot] = anchors[slot] ? anchors[slot].lifecycle.phase() : 'absent';
    });
    return copy;
  }

  /* ---------- init ---------- */

  var readyResolve;
  var ready = new Promise(function (resolve) { readyResolve = resolve; });

  var api = {
    version: VERSION,
    ready: ready,
    syncAdminUI: syncAdminUI,
    getState: cloneState,
    open: function (slot) { if (isKnownSlot(slot)) open(slot); },
    close: function (slot) { if (isKnownSlot(slot)) close(slot, false); },
    helpers: helpers
  };
  root.CoarHeroProducts = api;

  function init() {
    setInputMode('pointer');
    // Capture phase: runs before the capsule's own stopPropagation.
    document.addEventListener('keydown', onInputKeydown, true);
    document.addEventListener('pointerdown', onInputPointer, true);
    document.addEventListener('mousedown', onInputPointer, true);
    document.addEventListener('touchstart', onInputPointer, { capture: true, passive: true });
    SLOTS.forEach(enhanceSlot);
    document.addEventListener('click', onDocumentPointer, true);
    document.addEventListener('keydown', onDocumentKeydown);
    root.addEventListener('resize', onResize);
    if (root.visualViewport) root.visualViewport.addEventListener('resize', onResize);
    syncAdminUI(currentIsAdmin());
    loadData().then(null, function () { /* state already holds errors */ }).then(function () {
      syncAdminUI(currentIsAdmin());
      readyResolve(api);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
