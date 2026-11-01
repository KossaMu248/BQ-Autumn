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


Revision 12 checks (2026-10-31):

- Both Node suites, all JavaScript syntax and all fifteen HTML entry/cache/local-link/script-order checks pass. V12 loads the continuous passenger module before the hero rig. The original cycling update, combat/quest/locomotion/terrain/crew models and existing source artwork compare unchanged with V11.2.
- The baby extraction keeps the unchanged original head, chin, neck, collar and upper torso together. All ten original source hashes are pinned. Forty native cases cover ten moods, two headings and two scales; protected original face/chin/neck/collar/torso colors and chair exclusion pass. Actual bike draw calls confirm the same source selection and common physical scale across moods, including the excited/sick overrides.
- Eighty-four integrated cases cover on-foot and authored boat/transfer poses at normal/small sizes in both headings. Source pixels are checked after every body/pouch layer; focused 8× checks require the original neck and collar to remain visible and the native lower clothing cut to be hidden behind authored carrier fabric. Deliberately covering or separating the neck/collar, or exposing the waist, makes the three negative controls fail as intended. Seven timing/priority assertions cover recent throws/impacts and exact expiry boundaries.
- Actual keyboard/touch source checks pass in fresh desktop and both phone-orientation runs, including walking/jumping, maul/grab/throw, genuine shop talk and expiry, hostile projectile recoil and defeat. Evidence separates the completed source/renderer phase from the fresh controls phase. The earlier renderer phase did not checkpoint its per-case JSON before a later controls-fixture failure; its explicit summary and saved boards are retained. The runner now checkpoints renderer data before gameplay checks, and supports `--controls-only` for independent control verification.
- Independent visual review checks gameplay-sized and enlarged front/back, walking, grab, maul, hurt/KO, boat and transfer poses. It caught a tilted maul chin overlap, dark boat neckline, shifted boat knee and transparent KO foreground during development. Final blue-fabric foregrounds preserve the original neck/collar and hide the waist cut. Enlarged boat/KO fabric is flatter than neighboring painted folds; the original photographic facial style remains unchanged.
- `browser_hero.py` passes actual desktop and both phone-orientation controls: alternating foot leads, jump/landing, shop talk, front/back carriers, maul/grab, hostile projectile recoil, collapse/defeat/recovery, five hearts and visible controls. No page or HTTP errors and no loose bicycle-seat cutout on foot.
- `browser_full_body.py` independently analyzes opaque connected body components and observed source clip paths. All 1,008 resident/crew framing cases retain 100% of the intended opaque body and zero neighboring-body pixels. The new streetwear art keeps matching clothes through standing, recoil, fall, defeat and healthy/damaged screen throws. `browser_impact.py` confirms actual contact/damage and complete-body screen framing on desktop and both phone orientations.
- Persistent NPC/witness aggression, movement/boat, fullscreen/debug and complete adventure/save/entry-alias suites pass against V12. Boat and garden quests remain completable; cycling and on-foot populations persist. These broad checks preceded the last baby-only composition refinements; the final hero and continuous-passenger checks cover those refinements.
- Fresh actual-game captures and original-source comparison evidence are curated under `screenshots/revision12/`. Browser checks use headless Chromium and phone viewport/touch emulation; physical iPhone/Safari animation feel and performance remain untested.
- `passenger-gameplay.mp4` is a 7.8-second real-time 1280×720 H.264 recording with debug hidden and no virtual-clock stepping. Decoded frame review confirms walking/laugh, airborne/startled, grab/brace and full-body damaged screen contact. The target loses 32 health (60→28), and the baby returns to idle afterward. No page errors occurred during capture.


Revision 13 checks (2026-11-01):

- Six new streetwear outfits and three original casual outfits form a nine-entry adult wardrobe, separate from the three existing crew outfits. Each entry has measured standing, recoil/fall/prone and healthy/damaged full-body screen sources. Existing artwork files, the original bear/baby renderer and expressions, cycling update, crew art, terrain and quest models compare unchanged with V12.
- Both Node suites pass, including a new patrol parity check for all nine appearances and an explicit patrol timing independent of clothes. Patrol speed and endpoint pauses retain their original three timing patterns. JavaScript syntax and all sixteen HTML entry/cache/local-link checks pass; metadata points to `autumn-v13.html`.
- `browser_wardrobe.py` independently checks opaque connected source components and observed crop/clip paths in 324 standing/walking/held/recoil/fall/defeat/recovery cases, across nine outfits, two headings and two sizes. Final source coverage is 100%, with zero neighboring-body pixels.
- An additional 288 transparent-canvas walking checks cover nine outfits, eight gait phases, both headings and both sizes. Every final render retains one complete connected body with main-body ratio 1.0. Both deliberately detached-leg negative controls fail as intended. These checks were rerun after the walking pivot/overlap correction.
- `browser_full_body.py` passes all 2,016 flight/contact/damage cases across nine adults and three crews, including reduced motion and desktop/phone edge positions. Independent source components retain 100% of intended opaque bodies and zero neighboring-body pixels. The screen-overlay geometry was unchanged by the later walking-only correction.
- Actual wardrobe controls pass on desktop 1440×1000 and phone 390×844 / 844×390. All nine variants appear in the 54-adult street population; observed desktop draw calls verify every outfit’s real source. Stable IDs/outfits survive bike → foot → remount → room, and the room host uses casual clothes. Actual keyboard/touch throws preserve the matching full-body outfit and apply 32 damage (60→28), with five hearts and no page/HTTP failures. Fresh gameplay screenshots use the final walking renderer.
- `browser_npcs.py` passes against the final renderer with explicit exit 0: persistent residents, witness aggression, hostile crews, damage/defeat/recovery and both phone orientations. `browser_impact.py` passes actual contact/damage, full-body framing and desktop/phone controls; its screen renderer and combat model were unchanged by the subsequent walking-only refinement.
- Independent visual review passes all nine production-rendered outfits through standing, walking, recoil, fall, prone and healthy/damaged screen impact. It caught walking attachment gaps; corrected source-aligned pivots and overlapping clothing keep the fleece hips and long-parka legs attached. Final parka review covers four phases, both headings and h130/h190. No material colour fringe appears at game sizes.
- The curated `screenshots/revision13/` gallery contains a nine-outfit lineup, all-state review, parka walking phases and actual desktop/phone gameplay. Browser checks use headless Chromium with phone viewport/touch emulation; physical iPhone/Safari animation feel and performance remain untested.


Revision 14 checks (2026-11-01):

- Nine new cast sheets replace the repeated middle-aged identities while retaining the nine V13 clothing styles. The six streetwear designs have fictional ages 20/21/22/21/20/20; the three older neighbours have ages 52/42/55. Independent visual review confirms youthful faces, varied complexions/hair/features and two distinct naturally older dad characters, with consistent identities across every state.
- Both Node suites, JavaScript/Python syntax and all seventeen HTML entry/cache/local-link checks pass. AI, patrols, combat, seeding, quests, terrain, the original bear/baby renderer and existing artwork compare unchanged with V13. The cycling update and NPC walking/reaction/gang/projectile/impact/overlay algorithms also compare unchanged; the NPC source images and measured geometry are new.
- `browser_wardrobe.py --renderer-only` passes all 324 standing/reaction source cases across nine characters, both headings and both sizes: 100% intended opaque bodies and zero neighboring-body pixels. The metadata checks require six young adults aged 18–24 and three older adults aged 35+.
- All 288 walking-connectivity cases pass across eight phases, two headings and two sizes. Every render retains one major connected body; minimum main-body mass ratio is 0.999816, with only tiny antialias fragments. Both detached-leg negative controls are detected, using unchanged thresholds.
- `browser_full_body.py` passes all 2,016 flight/contact/damage cases across nine new cast members and three original crews, retaining 100% of intended opaque bodies and zero neighboring-body pixels. Durable source/full-body JSON includes exact renderer and asset hashes.
- Final production-renderer visual review passes the lineup, face/shoulder portraits, all-state board and parka walking phases. Hats, hands and both shoes remain complete; no material fringe or neighboring fragments. The parka and fleece joints stay attached, and the older olive-jacket character’s new source-facing direction is corrected.
- Both `browser_npcs.py` and `browser_impact.py` pass against the final V14 renderer with durable exit 0. They cover persistent NPCs, witness aggression, hostile crews, damage/defeat/recovery, the attached baby carrier, hearts, actual 32 HP screen-throw damage and desktop/portrait/landscape phone controls.
- Actual cast continuity checks pass at desktop 1440×1000 and phone 390×844 / 844×390. Desktop draw calls visibly exercise all nine new source variants; stable NPC IDs and faces/outfits persist bike → foot → remount → room. The host uses the older casual cast, and keyboard/touch throws apply 32 damage (60→28) with the matching new full-body source. No JavaScript or HTTP failures occur. Final gameplay screenshots and consolidated evidence contain exact stable source hashes.
- The curated gallery is under `screenshots/revision14/`. Phone checks use Chromium viewport/touch emulation; physical iPhone/Safari animation feel and performance remain untested.


Revision 15 checks (2026-11-01):

- Nine fresh cast sheets use black/charcoal/dark urban garments and richer medium/deep complexions. Two characters (variants 2/5) retain balaclavas through every pose and healthy/damaged impact; the other seven stay unmasked. Existing ages and variant IDs are retained, with `faceCovered` metadata true only for those two looks.
- Both Node model suites, JavaScript/Python syntax and all eighteen HTML entry/cache/local-link checks pass. AI, patrols, combat, seeding, health, quests, terrain, the original bear/baby renderer and existing artwork compare unchanged with V14. Cycling and NPC walking/reaction/gang/projectile/impact/overlay algorithms also compare unchanged; source images and measured crop/anchor geometry are new.
- The strict cast source phase passes all 324 cases with 100% intended opaque bodies and zero neighboring-body pixels. All 288 walking cases keep one major connected body (minimum mass ratio 0.999824), and both detached-leg negative controls reject using unchanged thresholds. Age-group and two-mask metadata checks pass.
- All 2,016 full-body flight/contact/damage cases pass across nine cast members and three original crews: 100% intended opaque bodies and zero neighboring-body pixels. Tight row overlaps use measured source outlines; independent alpha-1 checks also preserve soft silhouettes without foreign fragments or hard toe cuts.
- Independent visual review of the final lineup, face/hood portraits, all-state board and parka walking phases passes at game size. Dark quilting, fleece, nylon, utility pockets and coat seams remain legible. No pale garments/shoes return, both masks remain on, healthy rows stay intact, and faces/hands/eye areas remain coherent. Hats, hoods, hands and both shoes are complete; walking attachments stay closed in both directions at h130/h190.
- Actual cast controls pass at 1440×1000, 390×844 and 844×390. All nine IDs/source variants persist bike → foot → remount → room. Each layout approaches the existing masked resident `walker-3` (variant 5) with ordinary movement, then uses real keyboard/touch grab/throw controls: the balaclava stays on, the complete new B-source body is rendered, and actual damage is 32 (60→28). No JavaScript/HTTP failures occur. Fresh street/phone/impact captures and consolidated evidence use the final stable renderer and exact asset hashes.
- `browser_npcs.py` and `browser_impact.py` each pass once against the final V15 renderer with durable exit 0, covering persistent residents, witnesses/aggression, hostile crews, bear/NPC defeat/recovery, hearts, full-body screen contact/damage and both phone orientations.
- Curated evidence and actual-game captures are under `screenshots/revision15/`. Phone checks use Chromium viewport/touch emulation; physical iPhone/Safari animation feel and performance remain untested.


Revision 16 checks (2026-11-01):

- `building-visits.cjs`, `brawler.cjs`, `npc-life.cjs` and `hero-gait.cjs` pass. New model cases cover peaceful civilians, fight witnesses, screams, fleeing/hiding and calming, sidewalk routes and prop rests, faster pursuit, staggered schedules and stable IDs/health. The bear gait measures 2,048 source-sized limb cases; its normal 145-high walk at 155 world pixels/second uses a 112.26-pixel cycle (1.38 cycles/second), with fixed thigh/shin lengths and at most 0.0177h of hidden hip correction.
- The bear's 64 production-rendered phase/heading/carrier cases retain one major connected figure, minimum main-body mass ratio 0.999965. Independent visual review accepts the slower actual walking clip, alternating foot contact/lift, coordinated torso/carrier and original baby likeness. The enlarged pose board still exposes a small angular upper-fur edge in some contact poses; at ordinary game size it is concealed by the moving shorts and is not a material attachment gap.
- Original baby checks pass 40 native-source cases, 64 articulated renderer cases and 20 authored poses. Original source hashes, visible face/chin/collar pixels and negative controls remain intact. `browser_hero.py` passes actual movement, jump/combat, front/back carriers, shop interaction, damage/defeat/recovery and both phone orientations, with no separate bicycle-chair cutout, JavaScript or HTTP failures. Indoor traversal duration was adjusted for the intentionally slower walking speed without weakening interaction assertions.
- `browser_movement.py` passes free and moving-bike dismount, opposing swing/planted feet, the following camera, the same parked bicycle, walking through shop doors, boat boarding/composition in both headings, and phone touch/overflow checks.
- Complete screen-throw coverage passes all 2,520 samples across twelve adults and three original crews, both motion preferences, portrait edges and healthy/damaged states: 100% original opaque body coverage and zero neighboring-body pixels. Authored source coverage passes 492 cases across 87 complete new motion/activity/reaction frames and existing reactions; prepared tile alpha preserves the original source components. Evidence keeps the exact hashes of each tested stage.
- JavaScript syntax and all nineteen HTML entries pass V16 lab/cache, local-link and script-order checks. The cycling `update(dt)` is byte-for-byte unchanged from V15. Existing scenery, quests, original bear/baby source files and the original BQ repository are untouched.
- Actual street-life keyboard/touch controls pass at 1440×1000, 390×844 and 844×390. All 27 local routes span at least 800 world pixels, with active/offstage schedules and stable bike/foot identities. Passive walking stays on the sidewalk with opposing rendered foot leads and the relaxed source. Benches support seated hips at their actual 38-pixel seat anchor; sit/read breathing and smoke wisps animate in place.
- In each layout a real provoked adult runs at 270 pixels/second and closes the moving bear's gap from 81.77 to 49 pixels. Nearby peaceful reader/elder NPCs scream, flee and hide; the real east bush covers 63.82% of the reader's 6,308 rendered body pixels. Civilians remain nonhostile with no punches or shots, and calm down after the bear leaves. A direct hit deals the expected 22 damage and triggers fear/flight rather than retaliation. Hearts, white in-scene information, transparent HUD and touch overflow checks pass without JavaScript/HTTP failures.
- The final neutral renderer uses one connected upper/leg deformation surface and source-measured foot separation with rigid shoes. Independent review confirms the early sleeve slivers, duplicate hands, trouser flaps and flattened civilian shoes are resolved. The calm walk, authored bent-arm running poses, seated support and actual bush hiding pass game-size visual review. Source extraction and full-body overlay APIs remain unchanged by the final sole correction.
- The focused final-shoe runtime rerun passes 1,536 phase/heading/size/activity cases, one major connected body throughout, minimum main-body mass ratio 0.998582 and both detached-leg negative controls rejected. The final renderer hashes are recorded separately in `street-life-runtime-final-evidence.json`; controls evidence distinguishes unchanged gameplay sources from the renderer stages used during its run.
- Isolated actual fullscreen timing checks without screencast recording advance the normal bear 614.55 pixels in 4.05 seconds (35 RAF frames/second in headless software rendering); a separate detailed probe observes 613.8 pixels in 4.18 seconds. Simulation updates average about 0.37 ms/frame. Omitting NPC paint diagnostically produces only a small FPS change in this initial mixed-activity scene. These checks confirm normal walking speed; software video capture adds overhead, and these measurements do not establish physical-device performance.
- Final real-time capture passes the unchanged 4-second movement guard, advancing 546.39 pixels while recording. It shows passive walking, a real attack, two civilian screams and two hides, with no page/HTTP failures and the frozen renderer hash. The published 720×540 clip is explicitly a cropped animation preview because headless fullscreen screencasting adds gray padding/crops the scene; complete game/UI framing is documented separately in desktop/phone stills. Final resting and opposing walking stills were refreshed with the frozen rigid-shoe renderer.
