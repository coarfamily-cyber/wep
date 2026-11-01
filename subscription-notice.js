/* Prepared notice only: no email form, storage, service URL or network calls. */
(function () {
  'use strict';
  var dialog = document.getElementById('subscription-notice');
  if (!dialog) return;
  var text = {
    en: { subscribe: 'Subscribe', contact: 'New product updates', eyebrow: 'New product updates', title: 'Subscriptions coming soon', body: 'Email subscriptions are being prepared. Sign-up is not available yet.', status: 'We are not collecting email addresses or sending subscription messages.', close: 'Close' },
    kr: { subscribe: '구독', contact: '신상품 소식 구독', eyebrow: '신상품 소식', title: '이메일 구독 준비 중', body: '새 상품 소식을 이메일로 받아보는 기능을 준비하고 있습니다. 아직 구독을 신청할 수 없습니다.', status: '현재 이메일을 수집하거나 구독 알림을 발송하지 않습니다.', close: '닫기' },
    ja: { subscribe: '購読', contact: '新商品のメール配信', eyebrow: '新商品のお知らせ', title: 'メール購読は準備中です', body: '新商品の情報をメールでお届けする機能を準備しています。現在はお申し込みいただけません。', status: '現在、メールアドレスの収集や購読通知の送信は行っていません。', close: '閉じる' },
    zh: { subscribe: '订阅', contact: '订阅新品消息', eyebrow: '新品消息', title: '邮件订阅正在准备中', body: '我们正在准备新品邮件通知功能。目前暂不接受订阅。', status: '目前不会收集邮箱地址或发送订阅通知。', close: '关闭' },
    es: { subscribe: 'Suscribirse', contact: 'Novedades por correo', eyebrow: 'Nuevos productos', title: 'Suscripciones próximamente', body: 'Estamos preparando los avisos de nuevos productos por correo. Aún no se admiten suscripciones.', status: 'Actualmente no recopilamos direcciones de correo ni enviamos avisos de suscripción.', close: 'Cerrar' }
  };
  var opener = null;
  var historyKey = 'coarSubscriptionNotice';
  var historyPending = false;
  var reopenAfterHistory = false;
  var previousOverflow = '';
  function setLanguage(lang) {
    if (lang === 'ko') lang = 'kr';
    var dict = text[lang] || text.en;
    document.querySelectorAll('[data-subscription-text]').forEach(function (node) {
      node.textContent = dict[node.getAttribute('data-subscription-text')];
    });
    document.querySelector('.subscription-nav').setAttribute('aria-label', dict.subscribe);
    document.querySelector('.subscription-nav').title = dict.subscribe;
    dialog.querySelector('.subscription-close').setAttribute('aria-label', dict.close);
  }
  function openNotice(trigger, addHistory) {
    if (historyPending) { opener = trigger; reopenAfterHistory = true; return; }
    if (dialog.open) return;
    opener = trigger || opener;
    previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    if (addHistory) {
      var state = Object.assign({}, history.state);
      state[historyKey] = true;
      history.pushState(state, '');
    }
  }
  function closeNotice(useHistory) {
    if (!dialog.open) return;
    dialog.close();
    document.body.style.overflow = previousOverflow;
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    if (useHistory && history.state && history.state[historyKey]) {
      historyPending = true;
      history.back();
    }
  }
  document.querySelectorAll('[data-subscription-open]').forEach(function (button) {
    button.addEventListener('click', function () { openNotice(button, true); });
  });
  dialog.querySelectorAll('[data-subscription-close]').forEach(function (button) {
    button.addEventListener('click', function () { closeNotice(true); });
  });
  dialog.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeNotice(true); return; }
    if (event.key !== 'Tab') return;
    var buttons = dialog.querySelectorAll('button');
    var first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeNotice(true); });
  dialog.addEventListener('click', function (event) {
    var rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeNotice(true);
  });
  window.addEventListener('popstate', function (event) {
    historyPending = false;
    if (event.state && event.state[historyKey]) openNotice(opener, false);
    else closeNotice(false);
    if (reopenAfterHistory) { reopenAfterHistory = false; openNotice(opener, true); }
  });
  new MutationObserver(function () {
    setLanguage(window._currentLang || document.documentElement.lang || 'en');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  setLanguage(window._currentLang || 'en');
})();
