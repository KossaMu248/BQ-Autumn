# V19 startup regression and coverage evidence

The startup test opens a fresh page and uses the real title button immediately. It does **not** wait for artwork preparation, call the full-art fixture, record video, or advance a virtual clock. Each case uses a separate browser context. The final ledger records frozen/loaded resource hashes, long tasks, heartbeat delay, actual cycling/walking input and cache limits.

| Profile | First game loop | Start click | Early riding FPS | Longest task |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 1.57s | 0.45s | 45.93 | 116ms |
| Phone portrait, 4× CPU | 3.57s | 0.71s | 14.21 | 365ms |
| Phone landscape, 4× CPU, no Worker/OffscreenCanvas | 3.46s | 0.73s | 16.49 | 370ms |

`startup-performance-evidence.json` is the final three-profile pass. The similarly named screenshots capture the resulting cold-start on-foot scene. Slow touch devices use a smaller backing buffer; their logical world and input coordinates remain unchanged.

`startup-baseline-evidence.json` and `startup-baseline-phone-fallback.png` deliberately reproduce the regression in unchanged V18 (commit `67831ae`). The same no-worker phone profile took 14.83s to its first loop, blocked the click for 2.51s and ran early riding at 7.56 FPS. Its ledger is marked `expected-regression`; it is not a V19 failure.

`sustained-performance-evidence.json` covers the existing native portrait walking check after explicit full-art preparation: 41.16 FPS, 710.79px actual touch travel, 93.44% normalized wall progress, complete hero rendering, bounded caches and no JavaScript/HTTP errors. The original 90% movement guard remains in place. This test measures a different phase from cold startup.

`actor-render-cache-evidence.json` checks all 144 source and 576 walking frames against the original rendered RGBA hashes. `actor-legacy-prepare-evidence.json` also checks their cooperative missing-cache path. `scene-cache-verification.json` verifies all thirteen derived textures; `world-chunk-functional-evidence.json` checks eighteen cached/direct layer comparisons, including gaps and seams. The fifteen cycling material comparisons and source/cache hashes are recorded in `assets/cache/hero-cycling-v19/manifest.json`.

`cast-full-body-evidence.json` covers all 2,520 complete-body throw cases. The other stills document actual combat, original baby carriers, free walking, shop entry and boat composition under the lazy-art setup. Existing full-art labs explicitly use `tests/browser_fixture.py`; the startup regression must never use that helper.

Run the startup test with `python3 tests/browser_startup.py`; use `--baseline --case phone-fallback --no-walk` for the isolated original failure. The test serves the repository itself. The source-art cache compilers/checkers are in `tools/`; Playwright with Chromium is required for browser checks.

These are headless Chromium measurements and emulated touch layouts, including deliberate CPU throttling. They do not establish performance on a physical iPhone, and a 4× CPU profile is not a claim of 60 FPS gameplay.
