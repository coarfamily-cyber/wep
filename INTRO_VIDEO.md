# Intro background video

Only the first hero now layers `videos/hero-intro.mp4` above the original
`images/hero-new.jpg`. The original image is preserved as the actual underlying
fallback and the video poster. Section 2's MP4 and section 3's PNG, their layout,
the MD/butterfly assets, product controls, subscription notice and catalog data
are unchanged.

Approved supplied asset, unchanged bytes:
- SHA-256: f1843e1a937e102351a8e3e38dd984bf1a0588c9d4b2ff94114bb16ea2bbfc29
- 6,927,606 bytes, H.264 1280x720, approximately 5.04 seconds, no audio stream.

The background keeps the existing cover/center framing. A portrait viewport
necessarily crops the sides of the supplied landscape video; it is not reframed
or regenerated. The original dark overlay remains above the video.

There is no autoplay attribute or initial video src. JS assigns the source only
when the hero is visible, the document is active, reduced motion is off and
navigator.connection.saveData is not true. The last check depends on browser API
availability. A muted inline loop begins only then. Poster remains visible until
actual playback, and there is a visible keyboard/touch pause/play button with
labels following all five existing languages. Explicit user pause persists
through scrolling. Offscreen/document-hidden playback pauses automatically.

Reduced-motion or exposed saveData changes stop and release the source and show
the original image. Network/decoder errors fall back to the image without an
automatic retry loop. An autoplay-policy rejection leaves the image and a manual
play button. With JS unavailable the original image remains intact.

Local tests:

```sh
node --test *.test.cjs hero-products.test.js
python3 -m http.server 8774 --bind 127.0.0.1
# Separate shell, with Playwright and Chromium available:
node intro-video.browser.cjs
SUBSCRIPTION_TEST_ORIGIN=http://127.0.0.1:8774 node subscription-notice.browser.cjs
```

The new 13-case browser test plays the actual local MP4, covers 320/390/700/768/
820/1024/1440 widths, poster geometry, five control languages, pause/resume,
offscreen, runtime/startup reduced-motion, simulated saveData, missing media,
autoplay rejection/recovery and no-IntersectionObserver fallback. External data
and all writes are blocked; browser service workers are disabled in local tests.
Existing 50 source tests and 18 subscription cases also run. Existing panel touch,
internal scrolling and rotation checks use local fixtures. These checks are
Chromium emulation rather than a physical-device or deployed Pages inspection.
