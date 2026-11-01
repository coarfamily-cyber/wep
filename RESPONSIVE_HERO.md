# Intermediate and near-square hero layout

The original sections 2 and 3 used absolutely positioned copy at top:120px and
right:200px above 768px. An 820px-wide screenshot reproduced the heading and
Learn more capsule over the model's face. Widths through 768px used a different
bottom overlay, which also assumed a tall, narrow phone composition.

`responsive-hero.css` gives these two sections separate media and copy rows for
600..1199 CSS pixels, and for larger near-square viewports up to a 6:5 aspect
ratio. It uses viewport geometry rather than device models or user-agent names.
Media occupies clamp(280px, 58svh, 720px). Copy below it grows naturally, including
long translated text, instead of being clipped by a fixed section height.
The original fixed-height first hero, compact phone and wide desktop layouts
remain intact. Caption translation is disabled only inside the separate copy
layout so a mobile capsule cannot move the copy back into the picture.
The sound control stays in the media area. Media files, product data, the
capsule's direction/clamping/internal scroll, language logic and subscription
notice are unchanged. The viewport meta no longer blocks user zoom.

Run the existing 50 tests and the offline browser regression:

```sh
node --test *.test.cjs hero-products.test.js
python3 -m http.server 8771 --bind 127.0.0.1
# Separate shell with Playwright and Chromium available
node responsive-hero.browser.cjs
SUBSCRIPTION_TEST_ORIGIN=http://127.0.0.1:8771 node subscription-notice.browser.cjs
```

The browser script uses local fixture products, blocks external services and
writes, and disables service workers. It checks five languages, stretched copy,
15 viewport shapes, touch open/close, reachable product CTA and stable page
scroll; the same document is folded/rotated/resized and reopened. Zoom coverage
uses Chromium page-scale emulation and the CSS viewport equivalent of 200%
desktop zoom. These are not physical-device, OS text scaling or real fold-hinge
checks. No Galaxy model's panel specifications are asserted. Live Pages/Firebase
responses are not part of these offline tests.
