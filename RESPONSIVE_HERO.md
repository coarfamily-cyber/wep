# Original media sizes and captions above Learn more

The media geometry restored to b5251cf is retained. No image/video bytes,
hero dimensions, crop, transforms or media positioning change in this update.
Both section 2 and section 3 captions now occupy the row immediately above their
own Learn more capsule at every viewport. Existing left/right alignment and
absolute hero overlays remain. There is no media/copy page-flow stack.

Section 2 copy has no internal overflow scrolling or height cap. Its complete
current five-language text remains visible. Section 3's existing long-copy scroll
and the product detail panels' independent scrolling are preserved. Text is not
removed, truncated or globally shrunk to force it to fit.

The existing disclosure layout still computes available panel size, expansion
direction, clipping bounds and rotation adjustments. Its caption synchronizer
also exports an upward lift for the stacked copy on all viewport widths. When
an island opens upward, the caption clears the actual expanded surface. When
it closes, copy returns to 10px above its button.

Tests compare unchanged media rectangles and cover actual five-language copy,
closed text/button gaps, fully expanded section 2 copy, opened surface/copy
separation and hero/viewport bounds. They use local fixture products, direct
touch coordinates, blocked network writes and disabled service workers.

Run a baseline checkout at 8778 and candidate at 8777, then execute
`node responsive-hero.browser.cjs`. Override `HERO_BASELINE_ORIGIN`,
`HERO_TEST_ORIGIN` and `HERO_TEST_EVIDENCE` when needed. The baseline for this
revision is 17afa27; its media was previously measured equal to b5251cf across
16 viewport shapes. This is Chromium emulation, not a physical foldable test.

An arbitrarily long future caption or extreme text enlargement cannot be
promised to fit inside an unchanged finite hero together with an open product
panel. Section 2 does not silently truncate that content or restore an internal
scrollbar; future copy changes require checking available space. Pinch zoom
can pan the normal page. No backend/Firebase writes are needed by this change.
