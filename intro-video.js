/* Shared box playback; no account, storage or analytics. */
(function () {
  'use strict';
  ['intro-hero', 'section2'].forEach(function (id) {
  var isIntro = id === 'intro-hero';
  var section = document.getElementById(id);
  var video = document.getElementById(isIntro ? 'intro-video' : 'section2-video');
  var instructions = document.getElementById(isIntro ? 'intro-video-instructions' : 'section2-video-instructions');
  if (!section || !video || !instructions) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var connection = navigator.connection;
  var inView = false, userPaused = false, failed = false, hasSource = !isIntro, attempt = 0;
  video.muted = true;
  video.defaultMuted = true;
  function restricted() { return reduced.matches || !!(connection && connection.saveData); }
  function allowed() { return !restricted() && !failed && inView && !document.hidden && !userPaused; }
  function label() {
    var lang = (window._currentLang || document.documentElement.lang || 'en').toLowerCase().split('-')[0];
    if (lang === 'ko') lang = 'kr';
    var copy = { en: ['Play background video', 'Pause background video', 'Click or tap this background to pause or play. Use Enter or Space with the keyboard.'], kr: ['배경 영상 재생', '배경 영상 정지', '배경을 누르면 재생 또는 정지합니다. 키보드 Enter 또는 Space로도 조작할 수 있습니다.'], ja: ['背景動画を再生', '背景動画を一時停止', '背景を押すと再生または一時停止します。キーボードのEnterまたはSpaceでも操作できます。'], zh: ['播放背景视频', '暂停背景视频', '点击背景可播放或暂停，也可使用键盘Enter或Space。'], es: ['Reproducir vídeo de fondo', 'Pausar vídeo de fondo', 'Toca o pulsa el fondo para reproducir o pausar. También puedes usar Enter o Espacio.'] };
    var words = copy[lang] || copy.en;
    var inactive = restricted() || failed;
    instructions.hidden = inactive;
    instructions.textContent = words[2];
    if (inactive) {
      section.removeAttribute('role');
      section.removeAttribute('tabindex');
      section.removeAttribute('aria-label');
      section.removeAttribute('aria-describedby');
      return;
    }
    section.setAttribute('role', 'button');
    section.tabIndex = 0;
    section.setAttribute('aria-label', words[video.paused || userPaused || video.hidden ? 0 : 1]);
    section.setAttribute('aria-describedby', instructions.id);
  }
  function releaseSource() {
    attempt++;
    video.pause();
    if (!isIntro) return;
    video.hidden = true;
    if (hasSource) { hasSource = false; video.removeAttribute('src'); video.load(); }
  }
  function fallback() {
    failed = true;
    releaseSource();
    label();
    section.dataset.introMedia = 'fallback';
  }
  function sync() {
    if (restricted() || failed) {
      releaseSource();
      label();
      section.dataset.introMedia = failed ? 'fallback' : 'poster';
      return;
    }
    if (!allowed()) { attempt++; video.pause(); label(); return; }
    if (!hasSource) { hasSource = true; video.src = video.dataset.src; video.load(); }
    if (!video.paused) { label(); return; }
    var current = ++attempt;
    try {
      var result = video.play();
      if (result && result.catch) result.catch(function () {
        if (current !== attempt || !allowed()) return;
        userPaused = true;
        if (isIntro) video.hidden = true;
        section.dataset.introMedia = 'poster';
        label();
      });
    } catch (_) { fallback(); }
  }
  video.addEventListener('playing', function () {
    if (!allowed()) { video.pause(); return; }
    video.hidden = false;
    section.dataset.introMedia = 'video';
    label();
  });
  video.addEventListener('pause', label);
  video.addEventListener('error', fallback);
  function interactiveChild(target) {
    var child = target && target.closest && target.closest('a,button,input,select,textarea,label,summary,details,[tabindex],[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"]');
    return !!(child && child !== section);
  }
  function toggle() {
    if (restricted() || failed) return;
    userPaused = !(video.paused || userPaused || video.hidden);
    sync();
  }
  var gesture = null, clickEligible = false;
  function point(event) { return event.changedTouches ? event.changedTouches[0] : event; }
  function gestureStart(event) {
    clickEligible = false;
    if (interactiveChild(event.target) || event.isPrimary === false || (event.touches && event.touches.length > 1) || (event.button !== undefined && event.button !== 0)) { gesture = null; return; }
    var p = point(event);
    gesture = { x: p.clientX, y: p.clientY, scrollX: window.scrollX, scrollY: window.scrollY, moved: false };
  }
  function gestureEnd(event) {
    if (!gesture) return;
    var p = point(event);
    clickEligible = !gesture.moved && Math.hypot(p.clientX - gesture.x, p.clientY - gesture.y) <= 8 &&
      Math.abs(window.scrollX - gesture.scrollX) <= 3 && Math.abs(window.scrollY - gesture.scrollY) <= 3;
    gesture = null;
  }
  function gestureMove(event) { if (gesture) { var p = point(event); if (Math.hypot(p.clientX - gesture.x, p.clientY - gesture.y) > 8) gesture.moved = true; } }
  if ('PointerEvent' in window) {
    section.addEventListener('pointerdown', gestureStart);
    section.addEventListener('pointerup', gestureEnd);
    section.addEventListener('pointermove', gestureMove, { passive: true });
    section.addEventListener('pointercancel', function () { gesture = null; clickEligible = false; });
  } else {
    section.addEventListener('mousedown', gestureStart);
    section.addEventListener('mouseup', gestureEnd);
    section.addEventListener('mousemove', gestureMove, { passive: true });
    section.addEventListener('touchstart', gestureStart, { passive: true });
    section.addEventListener('touchend', gestureEnd, { passive: true });
    section.addEventListener('touchmove', gestureMove, { passive: true });
    section.addEventListener('touchcancel', function () { gesture = null; clickEligible = false; });
  }
  section.addEventListener('click', function (event) {
    if (event.defaultPrevented || interactiveChild(event.target)) return;
    var eligible = clickEligible || event.detail === 0;
    clickEligible = false;
    if (eligible) toggle();
  });
  var spaceArmed = false;
  section.addEventListener('blur', function () { spaceArmed = false; });
  section.addEventListener('keydown', function (event) {
    if (event.target !== section || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (event.key === ' ') spaceArmed = true;
    if (!event.repeat && event.key === 'Enter') toggle();
  });
  section.addEventListener('keyup', function (event) {
    if (event.target === section && event.key === ' ') { event.preventDefault(); if (spaceArmed) toggle(); spaceArmed = false; }
  });
  document.addEventListener('visibilitychange', sync);
  if (reduced.addEventListener) reduced.addEventListener('change', sync);
  else reduced.addListener(sync);
  if (connection && connection.addEventListener) connection.addEventListener('change', sync);
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting && entries[0].intersectionRatio > .1;
      sync();
    }, { threshold: [0, .1] }).observe(section);
  } else {
    var assess = function () { var r = section.getBoundingClientRect(); inView = r.bottom > 0 && r.top < window.innerHeight; sync(); };
    window.addEventListener('scroll', assess, { passive: true });
    window.addEventListener('resize', assess);
    assess();
  }
  label();
  });
})();
