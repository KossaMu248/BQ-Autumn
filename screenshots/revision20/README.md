# V20 walking review and regression evidence

The V19 baseline reproduces changing bear boot/calf shapes, floating material fragments and sheared NPC trouser branches. Its anatomy ledger is deliberately marked `expected-regression`. Rejected intermediate candidates are retained outside the repository under `/workspace/artifacts/bq-autumn-v20/`; they are not release screenshots.

The final bear uses one original lower-body texture and connected thigh/knee/shin/ankle joints. Original boots remain rigid. Both feet visibly exchange the lead, the pelvis stays steady, and relaxed standing knees avoid a size jump into walking. Normal movement remains 120 world pixels/second, with an 83.65-pixel cycle (about 1.435 cycles/second).

Each of the twelve NPC identities has measured leg geometry, a clean trouser material and rigid original footwear. Step distance follows leg proportions and actual travel. Neutral standing uses a shared atlas of twelve frames derived from the same `walkA` materials as walking, keeping clothing and body size coherent when movement starts or stops. Faces, body types, clothes, peaceful/aggressive behavior and the original source frames are retained.

`anatomy-evidence.json` checks all sixteen bear/NPC families, actual mesh vertices, source ownership, fixed segment/shoe sizes, planted contacts, complete figures, visible stature and cycle addressing. It includes 96 negative controls. Bear walking/idle height stays within 0.929–0.966; NPC ratios are approximately 0.938–1.028.

`bear-weight-integrity-evidence.json` retains the original 432-pose opacity checks, known V16 fading failure and actual start/stop captures. Its additional 72-pose independent alpha-grid check prevents baked mesh seams from escaping a same-pose reference. The final edge-parallel raster overlap removes those seams without changing the anatomical motion or source artwork.

`npc-walk-cache-evidence.json` compares every cached walking frame against the current renderer: 576 exact RGBA matches and no ink touching the cache border. `actor-render-cache-evidence.json` separately retains all 144 original prepared source-frame hashes and checks all 576 distinct walking frame objects and landmarks. The original catalog of 144 `drawPose` frames remains untouched. Walking frames occupy 41,124,096 RGBA bytes; the shared atlas of twelve neutral idle frames adds 856,752 bytes, for a combined 41,980,848 bytes below the 48 MiB limit. Normal play loads visible identities’ walking packs on demand. The historical V19 source packs are unchanged.

`walk-fallback-evidence.json` and `walk-fallback-mixed-evidence.json` deliberately block all walking PNGs or just one while the rest load normally. With workers/OffscreenCanvas disabled and every idle callback reporting zero time, all 576 phases still finish and respect the memory limit.

Actual control screenshots cover free dismount, walking and camera following, doors, shops, boat boarding, both headings and portrait/landscape touch layouts. Hero/baby checks retain original native face/chin/neck/clothing pixels, continuous carriers and action states. Whole-cast source/runtime checks include both headings, sizes and every walking phase.

Run `python3 tests/browser_anatomy.py`, `python3 tests/browser_gait_integrity.py --legacy-regression`, and `python3 tests/browser_wardrobe.py --renderer-only` for the focused checks. Build current walking packs with `python3 tools/npc-walk-cache.py build` and verify with `python3 tools/npc-walk-cache.py verify`. The older actor compiler is guarded as a historical V19 tool.

Renderer probes and enlarged phase boards support anatomical/artwork review; they are not performance benchmarks. Emulated phone layouts and CPU throttling do not establish physical-iPhone performance. Normal-time preview capture is separate from timing measurements.

Final timing checks use native time, no recording/virtual clock, separate contexts and frozen loaded/source hashes. Native sustained walking passes the unchanged 90% movement guard; navigation tests tap immediately without the full-art fixture.

| Native walking profile | FPS | Normalized travel |
| --- | ---: | ---: |
| cold-foot-desktop | 44.13 | 97.9% |
| foot-desktop | 42.10 | 98.1% |
| foot-portrait | 51.34 | 96.3% |
| foot-landscape | 43.38 | 94.0% |

| First-tap profile | First loop | Longest task |
| --- | ---: | ---: |
| desktop | 1.40s | 88ms |
| phone-portrait | 3.98s | 397ms |
| phone-fallback | 5.12s | 468ms |

A slow synchronous setup on a coarse-pointer device selects the existing 0.75 backing scale before first paint, preventing deferred first-raster work from exceeding the unchanged 500ms limit. It uses setup CPU time, before asynchronous/network waiting. `fast-phone-delayed-network-evidence.json` verifies a native-CPU touch device keeps full-resolution rendering even with a delayed critical image. Logical coordinates remain unchanged.

Final neutral-standing follow-up: all twelve identities in both headings pass independent head-width/area and walking-source consistency checks (24 families, 28 negative controls, including the old standing-art mismatch). The shared atlas adds twelve exact renderer matches without altering the 576 walking frames or 144 original source frames. Both missing-pack fallback scenarios pass again with the combined memory accounting.

The final three-profile startup run passed desktop and portrait. Its worker-free landscape case produced one 548ms first-frame task and a 1,051ms cold-foot UI heartbeat gap, exceeding the unchanged 500/1,000ms guards. A focused fresh-browser repeat with identical source passed at a 468ms longest task and 732ms heartbeat gap. The final startup ledger identifies these separate attempts and retains the outlier summary; this is variable emulated stress performance, not a physical-device guarantee.

Watch [the normal-speed walking comparison](walking-comparison.mp4), with a [poster](walking-comparison-poster.png), [actual bear stride frames](actual-stride-phases.png) and [NPC start/stop review](npc-start-stop-review.png). The bear segment is actual keyboard-controlled gameplay; the NPC segment is a labeled renderer preview at physical character height and travel speed. Per-segment capture hashes and scope are recorded in motion-review-evidence.json.
