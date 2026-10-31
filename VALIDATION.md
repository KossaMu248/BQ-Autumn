# Validation — Autumn Ride standalone

Validated in headless Chromium against the Python static HTTP server. These are browser smoke checks, not a claim of a complete manual playthrough.

Passed:

- Title screen starts the game; both recognizable characters and the bicycle render.
- Keyboard pedal input advances the rider; hop enters airborne state; braking and reverse work.
- F3 opens settings, freezes simulation, and all six location buttons work (start, metro, market, forest, waterfront, finish).
- Midpoint checkpoint retry resumes at the checkpoint.
- Crash ejects the characters, settles into the game-over screen, and its retry button resumes play.
- Restart restores the initial state and full health.
- The stunt demo starts and animates.
- The existing finish sequence reaches its completion screen.
- Touch pedal and hop work on a 390px phone viewport; pause and resume work.
- No horizontal overflow at 390px; portrait hint is nonblocking and hidden in landscape.
- All ten new illustrated art assets load successfully, including the painted bin and three character sheets.
- No uncaught JavaScript errors or HTTP failures occurred in the final district smoke check.
- JavaScript syntax checks pass for the existing registry, adapted game, world renderer, and prop renderer.

The source repository `/workspace/BQ` remains clean and unchanged. No npm installation or build is used. Only the standalone copy has been edited.

Revision 2 checks: painted bin loads before gameplay starts; ordinary and burning bins share the new art; source aspect ratio is preserved; flame pixels change between animation frames; pedal input advances the rider; no JavaScript errors or HTTP failures. Updated screenshots show the new bin.


Revision 3 checks:

- All 18 painted poses render distinct pixels; no neighboring frames are clipped into them, and release/recovery hands are empty.
- A natural mixed encounter exercises all three outfits, all pose indices, and all three projectile types.
- Six real collision probes: each projectile type hits both ground and rider once, with the correct effect and contact location.
- Ground impacts preserve full health; rider hits retain the existing 53/55/57 damage. Further simulation causes no second impact damage.
- Effects expire after their visual lifetime and leave no damaging secondary hazards. Particle suppression and cleanup were checked.
- Original and reduced projectile sizes were verified against the render configuration: Molotov 21×12, stone 16×10, dynamite 19×9 world pixels.
- Pause/resume, F3 freeze, restart and desktop controls pass.
- Portrait 390×844 and landscape 844×390 mobile checks pass, with no horizontal overflow and touch controls in view.
- No uncaught page errors, failed HTTP responses, failed requests or missing new art in the integrated browser checks.


Revision 4 checks:

- All 18 streetwear poses render nonempty, distinct images, including fingers/flames extending beyond the nominal sheet grid. Every pose has a fresh foot anchor.
- Original bear pose set executes with the new cached ink/light treatment, without changing rig geometry.
- New projectile render sizes are 32×18 (Molotov), 29×16 (dynamite), 16×10 (stone). Molotov cloth/fire and dynamite fuse remain attached while rotating.
- All six ground/rider collision cases create exactly one corresponding impact. Ground cases preserve health100; rider damage remains53/55/57. No second damage pulse; effects expire.
- Landscape mobile touch pedal advances the rider and the layout has no horizontal overflow.
- The dedicated V4 page loads all assets and starts gameplay with no uncaught JavaScript errors or failed HTTP requests.
- Local validation only: live GitHub Pages verification remains dependent on network access to the Pages hostname.


Revision 5 checks:

- All 16 authored stops visited through the existing warp controls; each renders a scene and remains playable. 11 distinct building keys, with the café placed once.
- All 21 atlas entries registered with source crops and terrain foot anchors. All new art loads successfully.
- Seven hazard types render visible sprites: scooter, cart, barricade, roadwork cones, glass, pothole, burning bin. The finish barricade also uses the painted art.
- Waving/walking residents appear; approaching the library flock triggers bird flight. Reduced-motion context records no scattering.
- Portrait 390×844 and landscape 844×390: touch pedal advances the rider, no horizontal overflow, art ready.
- All six projectile ground/rider cases still pass with one effect and unchanged damage; effects expire.
- Terrain definitions, hazard definitions, collision functions and encounter simulation compared directly with V4 and remain unchanged.
- Approximately 1.9 ms draw time observed in desktop headless Chromium at the library; this is not a guarantee of frame rate on every device.
- No uncaught page errors, HTTP failures or missing art during the checks.
- Validation is local. Live Pages deployment is not independently verified from this restricted environment.


Revision 6 checks (2026-10-31):

- All JavaScript syntax checks pass. `node tests/building-visits.cjs` checks public/private access, stop and grounded restrictions, entrance proximity, entry/exit input clearing, single landmark counts, unique building designs, slope foundations, absent terrain and walking endpoint pauses/direction changes.
- `python3 tests/browser_v6.py` passes in headless Chromium. All twelve authored stops and all five HTML entry points load. No uncaught page errors or failed HTTP responses occur during the checks.
- Pizza shop entry by E and touch opens its painted interior. Ride position, velocity and NPC clock stay unchanged indoors; R does not leak through to restart. Escape and the exit button close the room, and pedaling advances the rider afterwards. Keyboard hop and restart still work.
- Portrait 390×844 and landscape 844×390: entrance and exit buttons work, real touch pedal events advance the rider, and there is no horizontal overflow. These are Chromium mobile emulations, not physical iPhone/Safari testing.
- Reduced-motion mode keeps residents stationary and birds do not scatter.
- Terrain definitions and the complete cycling update function were compared with V5 and are unchanged. Bear/baby source assets, hero renderer and animation registry are unchanged.
- Screenshots in screenshots/revision6/ cover buildings, restaurant interior and both mobile orientations. Visual checks include slope foundations, root anchoring, and the continuing waterfront backdrop.
- This is browser smoke validation, not a full manual playthrough or a performance guarantee on every device.


Revision 7 checks (2026-10-31):

- `node tests/building-visits.cjs` passes placement and adventure model checks: private/public access, foundations, route pauses, required inventory before boat unlock, one-time consumption, buoy and seed counts, returning to complete the voyage, local persistence, and denied-storage fallback.
- `python3 tests/browser_v7.py` exercises playable canvas scenes using real keyboard events and Chromium touch events with a controlled animation clock. It checks on-foot movement and changing walk frames, proximity actions, front-carrier mode, pause, blocked cycling shortcuts indoors, and the frozen bicycle position.
- Full quest sequence passes through controls: collect lunch, deliver it, verify the unrepaired boat stays locked, borrow the patch kit, read the optional library chart, repair/board, pass all three buoys, physically steer back and moor. Completion requires returning.
- Greenhouse sequence passes: collect three distinct seed packets and return them to the gardener. Adventure state reloads independently of cycling state.
- All six entry URLs load V7. Portrait 390×844 and landscape 844×390 checks exercise walking, the shop interaction button and exit with touch; there is no horizontal overflow. These are Chromium emulations, not physical iPhone/Safari checks.
- No uncaught page errors or failed HTTP responses during the sequence. JavaScript syntax checks pass.
- Screenshots in screenshots/revision7/ cover the playable pizza room, workshop, dock, garden, lake and both phone orientations. The new sheet has eight authored crops/foot anchors; the boat uses its visible hull crop and a seated passenger pose.
- Cycling terrain, update function, collision/encounter definitions and original mounted bear/baby assets remain unchanged. Side-area controls and simulation are separate.
- Limits: this is a first playable pass with horizontal walking strips and a calm boat objective trail. Initial scene-fade-only entry was superseded by the release polish below. Shopkeepers currently reuse existing resident art; they do not yet have dedicated profession animations. No combat, swimming, platforming or performance guarantee on every device is included.


V7 release polish checks:

- `python3 tests/browser_polish.py` checks native fullscreen, visible exit/settings controls, settings inside fullscreen and phone viewport fallback when the native API is absent. It tests returning to windowed play without horizontal overflow.
- Calculated text/background contrast is at least 4.5:1 for debug section headings, toggle labels, readout, buttons and help text. Phone and fullscreen menu screenshots are included.
- Real dismount/remount phases are exercised, including settings pausing a transfer midway and preserving the exact cycling position. The original mounted baby stays in the rear seat until the transfer cels contain the baby; the seat is empty thereafter.
- Six transfer crops avoid neighbouring-sheet bleed. The dedicated eight-frame walk cycle uses a fixed drawing scale and foot anchors; transition walking scales with scene depth toward the actual doorway.
- The complete quest/browser suite passes with the longer entry/exit and boarding sequences. Cycling terrain/update definitions remain unchanged.
- Native fullscreen and the fallback were tested in desktop Chromium and phone emulation. Actual iPhone/Safari behaviour and the subjective smoothness of animations still need device playtesting.


Revision 8 checks:

- Unit checks in `node tests/building-visits.cjs` cover the continuous gait: leading legs exchange every half cycle, each leg has a swing phase while the other plants, stance-foot world x stays fixed, and the two-bone joint lengths remain consistent. Placement and inventory/quest checks still pass.
- `python3 tests/browser_movement.py` exercises Q away from buildings and while riding at speed, gradual stopping, two alternating legs, terrain walking, camera following, returning to the same parked bicycle, entering/leaving a shop on foot, boarding, both sailing headings, and touch dismount/walking/return in 390×844 and 844×390 layouts. No page errors or failed HTTP responses.
- `python3 tests/browser_v8.py` covers the full boat and garden quests and versioned entry URLs after the movement changes. `tests/browser_v7.py` and `tests/browser_v6.py` remain compatibility wrappers for current checks.
- `python3 tests/browser_polish.py` covers fullscreen, readable settings and transfer holds with the current release.
- Screenshots under screenshots/revision8/ include alternating walking poses, on-foot shop entry, boarding, both boat headings, and phone layouts. The seated pose is anchored by the hip to the painted bench, with the near hull masking lower legs rather than repainting the entire boat in front of the rider.
- Terrain and the complete cycling update function compare unchanged with V7. Dismount requests apply braking through an explicit control callback; on-foot traversal is separate from the cycling simulation.
- These remain headless Chromium and phone emulation checks. Physical iPhone/Safari playtesting and subjective animation review on the target phone remain useful.

- A real-time rendered walking clip (both headings) is saved as screenshots/revision8/walking-preview.mp4. Frame-sequence inspection shows alternating support/swing, with the upper body and front carrier remaining stable.


Revision 9 checks (2026-10-31):

- `node tests/building-visits.cjs` checks terrain-supported placement, inventory/quests and the longer continuous two-leg gait, including alternating swing/support, planted soles and consistent joint lengths.
- `node tests/brawler.cjs` checks lane/jump reach restrictions, grabs, screen throws, maul cooldown, adult NPC recovery, Primal buildup, eight-second invulnerability, its expiry, return to cute and baby/carrier recovery.
- `python3 tests/browser_brawler.py` exercises the actual keyboard and touch controls for depth movement, jumping/landing, maul/grab/throw, protected baby placement, the complete Primal transformation and return. It checks HP stays unchanged during the rolling burst and immunity ends afterward.
- `python3 tests/browser_v9.py` passes the full shop, boat and garden quest flows, save persistence, cycling freeze/resume, eight HTML entry points, and 390×844 / 844×390 layouts. V6–V8 browser scripts remain compatibility wrappers.
- `python3 tests/browser_movement.py` and `python3 tests/browser_polish.py` retain coverage for free dismount/remount, terrain walking and camera following, on-foot doors, same-bike return, boat boarding/both headings, fullscreen, debug contrast, transfer pausing and phone fallback.
- V9 screenshots show jumping, mauling, grappling, foreground throws, bowling, the cute recovery, quests, boat placement, settings and both phone layouts. No uncaught browser errors or failed HTTP responses occurred in these runs.
- Original cycling update and terrain definitions compare unchanged with deployed V8. The brawler model and on-foot health remain separate from cycling; adult NPCs recover and the boat has no combat controls.
- Tests use headless Chromium and phone touch emulation. Physical iPhone/Safari performance and animation feel still need device playtesting. New combat effects are comic scratches, flecks and knockdowns rather than detailed injuries.


Revision 9.1 checks (2026-10-31):

- Both Node suites and all JavaScript syntax checks pass. Brawler checks now cover Apex Primal, the eight-second Madness Mauling Bear, automatic mauls, immunity expiry, NPC recovery and the return to cute.
- Browser brawler checks verify the corrected labels, player-controlled upright frenzy, keyboard/touch combat, and that all phone controls remain inside the viewport while the scene uses its full height. Screenshots in screenshots/revision9-1/ show desktop and both phone orientations.
- Full adventure, movement/boat and fullscreen/debug regression scripts target V9.1. The fullscreen transition test pauses its virtual clock before timed assertions, keeping screenshot time from advancing a transfer.
- The HUD and controls are absolute overlays inside the canvas wrapper and consume no layout height. Portrait artwork keeps its aspect ratio and follows the character; dialogue is white, remains accessible in the DOM and fades after reading time. Debug contrast retains its existing palette.
- Cycling update and terrain definitions compare unchanged with deployed V9. Physical iPhone/Safari playtesting remains outside these Chromium touch-emulation checks.


Revision 10 checks (2026-10-31):

- Model checks cover persistent arena residents, nearby witness aggression with calm distant NPCs, hostile projectile attacks without provocation, original cycling attack ownership, staged screen impacts, NPC damage/fall/dead/recovery, bear KO duration, attached back carrier, and the timed Apex/Madness loop.
- Browser NPC checks use actual controls and unprovoked gang projectiles to exercise bike-to-foot population continuity, back-carrier mauling, face-first screen impacts, resident defeats, bear damage/collapse/KO/respawn, five-heart health, transparent HUD and 390×844 / 844×390 layouts.
- The existing adventure, continuous movement/boat and fullscreen/debug regression scripts target V10. Placement/quest/gait checks and all JavaScript syntax checks pass. The shortened gait still alternates planted and swinging legs and keeps fixed stance-foot world positions.
- Three generated transparent sheets have authored crops for resident reactions, gang face/KO reactions and bear damage/defeat. Screenshot review includes both walking phases, carrier alignment, foreground face impact and damage/defeat frames under screenshots/revision10/.
- Terrain and the cycling update remain unchanged from V9.1. The cycling encounter has a targeted guard for members defeated on foot; active crews retain their original timing, projectile damage and collision behavior. NPCs recover after temporary defeat, retaining access to quests.
- Checks use headless Chromium and touch emulation. Physical iPhone/Safari performance and subjective animation feel still need device playtesting.


Revision 10.1 checks:

- `python3 tests/browser_full_body.py` independently observes real canvas drawImage transforms for 1,008 cases: six actors, normal/reduced motion, desktop and narrow portrait crops, edge/center launches, flight and held impact. Whole destination figures fit the visible view and source crops retain at least 99% of each character’s opaque pixels. Damaged cels and exact damage text are checked without changing game state.
- `python3 tests/browser_impact.py` uses keyboard and actual phone taps to grab/throw a healthy NPC, verifies 32 health lost, captures the flight/contact/damaged full body, and confirms impact timing and recovery in 1440×1000, 390×844 and 844×390 layouts. No page errors or HTTP failures.
- Both Node suites pass. Combat model checks now include a low-health throw reporting only the six remaining health points lost. JavaScript syntax and whitespace checks pass.
- Fresh browser screenshots under screenshots/revision10-1/ also show the shop/front carrier, boat seating with hearts, jumping with a grounded shadow, bear damage/lost hearts, and NPC defeat with witnesses. They are actual game captures; generated full-body art is used by the renderer.
- Scope is the screen-impact presentation, damage feedback, one reaction-cel crop and release cache keys. Terrain, cycling physics, quests, controls, NPC aggression, carrier and defeat timing remain unchanged from V10. Physical iPhone/Safari remains untested.


Revision 11 checks (2026-10-31):

- Both Node suites and all JavaScript syntax checks pass. All twelve HTML entries include the V11 rig in dependency order and resolve their local links; V11 metadata points to autumn-v11.html. The original cycling update compares unchanged with V10.1. Terrain, quest and combat model files are unchanged.
- `python3 tests/browser_hero.py` passes using actual desktop keys and phone touch controls at 390×844 and 844×390. It checks visible foot-lead exchange in both headings, jumping/landing, the larger indoor front carrier and shop interaction, distinct back-carrier maul/grab poses, hostile projectile recoil, collapse, defeated and neutral recovery, five hearts and controls inside the viewport. No page errors, HTTP failures or loose bicycle-seat baby draw calls occur on foot.
- Independent visual review of the current renderer's twelve-pose board and actual gameplay captures finds connected upper shorts/crotch, proportionate cuffs/boots and integrated baby/pouch/straps across front/back idle and walking, grabs, mauls, hurt and defeat. The review caught and corrected both an unequal lead distance and rotating shorts wedges before release. A neighboring boot tip is excluded from the back-hurt cel without clipping that pose.
- `browser_full_body.py` retains all 1,008 six-actor framing/source-pixel checks. `browser_impact.py` passes actual keyboard/touch impacts and damage on desktop and both phone orientations. `browser_npcs.py` passes persistent bike/foot population, witnesses, hostile crews, health/defeat/recovery and phone layouts.
- `browser_movement.py` and `browser_polish.py` pass free dismount/return to the same bicycle, camera following, shop doors, boat boarding/seating in both headings, phone movement, native/fallback fullscreen, debug contrast and paused transfers.
- Browser captures are generated under screenshots/revision11/. A curated release gallery is committed there; regression output not in the gallery stays local. These are headless Chromium and phone emulation checks. Physical iPhone/Safari animation feel and performance remain untested.

- `python3 tests/browser_v10.py` passes the complete boat/garden quests, save persistence, eight entry aliases and both phone orientations, with no JavaScript or HTTP failures. The additional V11 static-link check covers all twelve HTML entries.
- `screenshots/revision11/walking-carriers.mp4` is a 14-second real-time 1280×720 recording of ordinary front/back-carrier walking in both directions, pausing, jumping and mauling. It uses the supported viewport-fullscreen fallback, keeps the debug panel hidden and has no virtual-clock stepping. Decoded frame review confirms the complete game fills the recording.


Revision 11.1 checks (2026-10-31):

- `node tests/building-visits.cjs` and `node tests/brawler.cjs` pass. All JS syntax and thirteen HTML entry/link/cache-label checks pass; metadata points to autumn-v11-1.html. Original artwork files and the cycling update compare unchanged with V11.
- `python3 tests/browser_baby_face.py` pins the two original face-file hashes and observes actual image/canvas draws. It independently compares rendered opaque face pixels with the original textures, while checking uniform scale, heading/head mirroring and absence of filters or loose bicycle-seat cutouts. The only face texture treatment is a 13-source-pixel alpha fade at the bottom of the jaw; eye, nose and smile pixels are retained.
- All 86 face cases pass: 48 on-foot pose/heading/size cases, 20 boat/transfer cases and 18 actual desktop/phone gameplay captures. Of 35,870 compared opaque face pixels, none differ by more than 6/255 after interpolation. Desktop 1440 and phone 390×844 / 844×390 controls, walking in both headings, front/back carriers, maul and grab are exercised. No page/HTTP errors; hearts and phone controls stay visible.
- `browser_hero.py`, `browser_impact.py`, `browser_movement.py` and `browser_polish.py` pass against V11.1. Movement is rerun after the final boat/transfer anchors and confirms fresh dismounting, doors, same-bike return, boarding/seating in both headings and phone movement. Impact still reports 32 health lost and the entire NPC body through contact/damage. Quest, terrain, NPC and combat model files are unchanged, so the V11 full-adventure and 1,008-case NPC framing results remain applicable.
- Visual review corrected an exposed crescent at the jaw/ear by anchoring the original jaw to each collar, tightening the head mask and preserving the painted neck. Original faces use source aspect ratio, and transfer poses turn the baby's head toward the bear. The painted carrier bodies, arms and leg geometry remain intact. Transfer2/3 removal masks mirror with their heads and remove the old rear-skull/jaw outline; final enlarged review passes both headings.
- Evidence is under screenshots/revision11-1/, including original-face pixel results, pose/boat screenshots and a real-time full-body screen-throw preview. These checks use headless Chromium and phone emulation; physical iPhone/Safari remains untested.

- The V11.1 screen-throw preview is a 4.48-second real-time 1280×720 H.264 recording. Decoded review covers grab, full-body screen contact, the bruised/scuffed cel, the complete slide away and the NPC down on the road; rendered original baby face and 60→28 NPC health are checked. Fresh contact/damage stills use the final on-foot head placement.


Revision 11.2 checks (2026-10-31):

- The previous face_smile/face_happy images terminate through the jaw at their final row; fading that row range did not reconstruct the missing chin. This revision uses the original complete in-game head from baby_pose_idle.webp, preserves its warm expression and natural chin alpha, and excludes the bicycle chair, blue shirt pixels and one pale shirt/background fringe pixel from the head extraction.
- Both Node suites, all JavaScript syntax and fourteen HTML entry/cache/link checks pass. The original cycling update and tracked source artwork compare unchanged with V11.1. Five new painted background plates are used only behind the old head footprint; the original bear/carrier sprites remain elsewhere. A short shaded neck and curved front collar cover the neck base while keeping the complete jaw above the neckline.
- `python3 tests/browser_baby_face.py` passes strict source tests: 739 facial/neck and 120 complete-chin samples match original RGBA exactly, including the warm natural-alpha taper. Four bicycle-chair sample points and the pale cloth/background fringe are absent. These source tests caught and corrected actual jaw and far-eye clipping in the extraction contour during development; no eye/chin tolerances were relaxed.
- All 86 normal/game face comparisons pass (7,359 opaque pixels; none differ by more than 6/255 after viewport interpolation). An additional 68 focused 8× final-chin cases check all on-foot, boat and transfer poses at both headings and character sizes AFTER every collar/body layer. All 54,576 compared chin pixels pass, with maximum interpolation difference 1/255. Deliberately cropping the jaw or painting a collar across it makes the negative-control checks fail as intended.
- Hero, movement/boat and fullscreen/debug browser suites pass on desktop and 390×844 / 844×390 phone emulation. Source-face checks also exercise actual front/back walking, grabs and mauls; no JavaScript/HTTP failures or loose bicycle-seat layers. Gameplay, NPC, quest and terrain model files are unchanged, so prior full-adventure and NPC impact-framing results remain applicable.
- Final enlarged and normal-scale visual reviews confirm the rounded chin, a concealed flat neck base and a single curved collar, including boat and mirrored transfer poses. Fresh actual-game and production-renderer closeups were recaptured after the final source changes. The original photographic head texture remains visible in enlarged views. Physical iPhone/Safari remains untested.
