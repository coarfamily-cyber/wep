/* Intro playback only; no account, storage, analytics or changes to other media. */
(function () {
  'use strict';
  var section = document.getElementById('intro-hero');
  var video = document.getElementById('intro-video');
  var button = document.getElementById('intro-video-control');
  if (!section || !video || !button) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var connection = navigator.connection;
  var inView = false, userPaused = false, failed = false, hasSource = false, attempt = 0;
  video.muted = true;
  video.defaultMuted = true;
  function restricted() { return reduced.matches || !!(connection && connection.saveData); }
  function allowed() { return !restricted() && !failed && inView && !document.hidden && !userPaused; }
  function label() {
    var lang = (window._currentLang || document.documentElement.lang || 'en').toLowerCase().split('-')[0];
    if (lang === 'ko') lang = 'kr';
    var copy = { en: ['Play background video', 'Pause background video'], kr: ['배경 영상 재생', '배경 영상 정지'], ja: ['背景動画を再生', '背景動画を一時停止'], zh: ['播放背景视频', '暂停背景视频'], es: ['Reproducir vídeo de fondo', 'Pausar vídeo de fondo'] };
    var words = copy[lang] || copy.en;
    button.textContent = words[video.paused || userPaused || video.hidden ? 0 : 1];
    button.setAttribute('aria-label', button.textContent);
  }
  function releaseSource() {
    attempt++;
    video.pause();
    video.hidden = true;
    if (hasSource) { hasSource = false; video.removeAttribute('src'); video.load(); }
  }
  function fallback() {
    failed = true;
    releaseSource();
    button.hidden = true;
    section.dataset.introMedia = 'fallback';
  }
  function sync() {
    if (restricted() || failed) {
      releaseSource();
      button.hidden = true;
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
        video.hidden = true;
        button.hidden = false;
        section.dataset.introMedia = 'poster';
        label();
      });
    } catch (_) { fallback(); }
  }
  video.addEventListener('playing', function () {
    if (!allowed()) { video.pause(); return; }
    video.hidden = false;
    button.hidden = false;
    section.dataset.introMedia = 'video';
    label();
  });
  video.addEventListener('pause', label);
  video.addEventListener('error', fallback);
  button.addEventListener('click', function () {
    userPaused = !(video.paused || userPaused || video.hidden);
    sync();
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
})();
