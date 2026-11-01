# Original media sizes; responsive text only

The 4b2c838 tablet stack was withdrawn: it assigned 58svh to media and put copy
in a separate flow row, reducing the image/video region. This change restores
the section/media box geometry, crop, transforms and position to b5251cf across
viewport sizes. The later approved first-hero video remains intact.

`responsive-hero.css` now targets only text wrappers and hero controls. It has
no rules for hero height, media width/height, object-fit, image/video transform,
media rows or media positioning. Sections 2 and 3 retain their original inline
and responsive media rules. Text is an absolute overlay in the existing hero.

Copy sits in the lower edge region for phones/intermediate/square screens.
Long copy, including the original mobile body text, remains in an accessible
focusable scroll region rather than being removed or forcing the media smaller.
At 769..1199px, large square screens, and short landscape widths >=500px, the
copy and expanded capsule reserve separate side columns; narrow phones keep a
stacked lower-edge overlay and the original mobile expansion caption offset.
Wide desktop copy keeps its original placement; excessive copy can scroll.

The central focal guard in tests is geometric (middle 50% of width, 20..67% of
hero height), not face/product detection. Default responsive copy avoids it.
When the user opens the narrow-phone capsule, existing caption translation can
move the copy upward to make room for the interactive panel. This is not a
promise that no possible subject position or future media can ever intersect
text; original frames and tested screenshots must be reviewed visually.

No product strings, media bytes, MD/butterfly, subscription notice, first-video
pause/poster/SaveData/reduced-motion logic, or Firebase behavior are changed.
Only two copy wrappers/headline IDs and text-layout CSS are added/adjusted.

Local comparison setup (baseline and candidate in separate local checkouts):

```sh
# b5251cf baseline, loopback only:
python3 -m http.server 8775 --bind 127.0.0.1
# candidate, separate shell:
python3 -m http.server 8776 --bind 127.0.0.1
# from candidate, with Playwright and Chromium installed:
HERO_TEST_EVIDENCE=/tmp/coar-text-only-layout node responsive-hero.browser.cjs
node --test *.test.cjs hero-products.test.js
```

The comparison test covers 16 viewport shapes including 320/390 phones,
600..1199px, square, portrait/landscape, 1440/1920 desktop and a 200% layout-zoom
equivalent. It records baseline/current media rectangles and fit/position/
transform, five languages and long copy, scrollable copy and no copy/capsule
overlap. It uses direct coordinates for touch; locator auto-scroll must not
mask clipped or shifted ancestors. Data is mocked, all writes blocked, service
workers disabled and reduced motion used for deterministic layout measurement.
Actual first-video behavior and subscription are tested separately. This does
not constitute physical foldable/tablet or native Android app verification.
