# Inactive subscription notice

The header bell and small link beneath Contact us open the same glass dialog.
At 480px and below the bell is compact and sits directly below the language row,
so existing flag sizes and the MD / butterfly logo keep their original space.
English, Korean, Japanese, Chinese and Spanish follow the site's existing language.

This UI only says that email subscriptions are being prepared. It contains no
email field, form, subscription endpoint, Apps Script editor URL, storage or
network action. There is no claim that a subscription succeeded. Connecting a
verified production service is a separate change.

A native modal dialog provides semantics and background inertness. Tab/Shift+Tab
stay on the two close buttons; Escape, either close button, backdrop click and
browser Back close it. Focus returns to the invoking header or Contact button.
Opening adds a same-URL history entry; closing consumes that entry. Body overflow
is restored without altering the existing page scroll position. The modal has
an opaque fallback when backdrop filtering is unavailable and no white border.

Local verification:

```sh
node --test *.test.cjs hero-products.test.js
python3 -m http.server 8769 --bind 127.0.0.1
# Separate shell, with Playwright and /usr/bin/chromium available:
node subscription-notice.browser.cjs
```

Browser tests use synthetic Firebase responses and block external traffic,
service workers, mail services and all writes. Flag artwork is replaced by a
fixture matching flag-icons' 4:3 geometry. Chromium touch emulation is not a
physical mobile-device test. Public Pages and actual Firebase responses are not
part of these local tests. Original hero logic/styles, inline scripts, product
records, service worker, logo assets, video and contact actions are unchanged.
