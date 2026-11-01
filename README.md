# Bearly Qualified — The Autumn Ride

An independent, playable illustrated edition of **KossaMu248/BQ**. The original checkout is untouched. This folder contains its own HTML, CSS, JavaScript, and every asset it needs; it does not reference or require the original folder.

## Play from GitHub

This repository contains the complete standalone game at its root. To enable browser play, open repository Settings → Pages, choose **Deploy from a branch**, **main**, **/ (root)**, and Save. Once GitHub's deployment succeeds, the game is served at:

https://kossamu248.github.io/BQ-Autumn/

The current version-specific entry is `autumn-v16.html`. There is no npm build step; `.nojekyll` keeps deployment static.

## Play locally

You need Python 3 and a modern browser. From this folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser and choose **LET’S RIDE**. If another server uses port 8000, stop that server or use `python3 -m http.server 8001` and open port 8001 instead. No npm, build, account, or external service is needed. Everything loads locally.

## Controls

| Action | Keyboard |
| --- | --- |
| Pedal | Up / W |
| Brake / reverse | Down / S |
| Lean | Left / Right, A / D |
| Hop | Space |
| Enter a nearby public building (stop first) | E or the on-screen Enter button |
| Walk on foot (left/right and ground depth) | Arrows / WASD |
| Jump on foot | Space |
| Grab an adult NPC / throw toward the screen | G / G again |
| Maul nearby adult NPCs (hold to repeat) | J |
| Interact on foot | E / Enter |
| Leave a building | Escape or Back to bike |
| Fullscreen | F or the ⛶ button |
| Dismount anywhere / return to the bike | Q or Dismount / Back to bike |
| Restart | R |
| Retry checkpoint | C |
| Settings and district selection | F3 |
| Close settings | Escape |

On a phone or tablet, use the touch buttons beneath the game. Landscape gives the largest play area. Sound starts after the first interaction; toggle it in the toolbar. The demo button previews the existing stunt animations. F3 opens the original developer controls, including district selection and a no-damage option.

## The neighbourhood

The ride has twelve authored stops with twelve distinct building designs. There is one metro, one library and one bakery. A bicycle workshop and a Pizza & Kebab restaurant join the centre arcade, community hall, homes, manor, greenhouse and boathouse. Wider green stretches replace repeated buildings.

Buildings stand on level stone foundations that follow the terrain across their full width. Trees and plantings use their visible root anchors, and fallen leaves follow the terrain at each leaf's position.

Stop beside a public entrance and press **E** or tap **Enter**. This now changes to a playable area, rather than an image dialog. The bear leaves the bicycle outside, walks on foot and carries the baby in a blue front carrier. Arrow keys or **WASD** move left/right and up/down the ground plane. **Space** jumps, and **E**, **Enter** or the on-screen action button interact. **P** pauses; **Escape** or **Back to bike** leaves. The original cycling simulation is held while you explore. You can also press **Q** or tap **Dismount** anywhere along the route: the bike slows to a stop before you step off. Walk along the terrain and into nearby public buildings with **E**. Walking out leaves you on foot, with the bike still at its parking spot. **Q** or **Back to bike** walks you back and remounts; direction input cancels the automatic return.

Small shops are single-screen interaction rooms. Pizza & Kebab and the bike workshop have painted rooms with clear walking floors and counters. The boathouse leads to a scrolling dock; the greenhouse and manor lead to larger gardens.

### The boatkeeper’s favour

- Collect the boatkeeper’s lunch from the cook at Pizza & Kebab.
- Borrow a patch kit from the mechanic in the bicycle workshop.
- Deliver lunch to the boatkeeper on the dock and use the patch kit beside the dinghy at the far end.
- Board the repaired boat, steer with **A/D** or the left/right touch buttons, pass the three golden buoys and return left to the dock. The library has an optional route chart.

The greenhouse gardener also asks you to find three seed packets along the garden path and return them. Quest items and completed tasks save locally, separately from cycling scores. This is a first playable adventure pass: the lake is a calm buoy trail, with no combat or swimming on the water. Land areas now allow ground-depth movement and jumping. Entry now parks the original bicycle, plays a six-pose dismount and baby-to-carrier sequence, then walks toward the doorway. Returning reverses it. Boarding and stepping ashore are animated too, with a short fade between areas. Walking uses source-measured pelvis, shorts, cuffs and boot dimensions for the front- and back-carrier bear. The shorts swing with the thighs; the two boots alternate their lead on a shared walking track. Fur and boots are sized separately to retain the short legs and broad feet of the painted model. Starts and stops ease between the intact standing pose and articulated walking pose. The pouch, straps, supporting arms and bear torso are painted together, including grab, maul, recoil and defeat poses.

The baby now uses the original bicycle artwork as one continuous head, chin, neck, collar and upper torso. The lower clothing edge sits inside the carrier pouch, so the join is below the original shirt instead of under the chin. All expressions share the bicycle renderer’s common native scale. The baby laughs while walking, looks startled during jumps, attacks and screen throws, braces during grabs and transfers, points during shop conversations and looks excited while the boat moves. The same source artwork is used in front/back carriers, action poses, transfers and the boat; the bicycle chair is excluded on foot.

### Everyday street life

V16 uses a slower bear walk with longer alternating steps, heel/toe movement and gentle pelvis, torso and carrier motion. The baby keeps the original continuous bicycle face and clothing; the whole carrier follows the bear together.

Residents follow long sidewalk routes, pause and come and go on staggered schedules. Three new peaceful neighbours—a student, a stocky middle-aged man and an older woman—wear ordinary clothes and have distinct faces and body proportions. Benches, newspapers, cigarettes and idle breathing give them activities between walks. Existing older neighbours and shopkeepers are peaceful too: they never retaliate. A nearby fight or a direct hit makes civilians scream, flee and sometimes crouch behind a real bush or street bin, then resume their routine after calming down. Streetwear alone does not make an NPC hostile; the existing hostile crews retain their behaviour.

Neutral NPCs use relaxed walking animation. Provoked residents run to close the gap before fighting; frightened civilians use a faster escape animation. The promenade starts with a small group rather than the entire cast at once. **F3 → Neighbourhood life** opens this ordinary street for testing. Debug shows active/offstage residents, peaceful civilians, resting, fleeing and hiding counts.

### On-foot brawling

Move into the same lane as an adult NPC. **G** grabs; press **G** again to fling them toward the screen. **J** mauls with a claw-swipe pose, scratch trails, dark red flecks, dust, hit-stop and stagger reactions. Adult NPCs have hit recoil, collapse, defeated and recovery animations. Repeated hits deplete their health; defeated characters recover after twelve seconds so quest areas remain usable. The baby stays attached to the bear: front carrier while exploring, back carrier for grabbing, throwing and mauling, then front again when things settle.

Successful grabs, throws and mauls fill **Apex Primal**. At 35 points the bear enters the Apex Primal state; a full meter triggers **eight seconds as the invulnerable Madness Mauling Bear**. The bear stays upright, moves under your control and automatically mauls nearby adult NPCs, with faster manual claw attacks too. It then returns to the cute bear and resets the meter. Outside that burst, provoked NPCs can counterattack. On-foot health uses five hearts. If it runs out, the bear plays a collapse and defeated animation before recovering by the entrance or parked bike. Cycling health and physics stay separate. Use **F3 → On-foot brawler practice** for three nearby practice NPCs; the debug readout shows depth, jump, Apex Primal and on-foot HP.

Architecture is a stylized Hässelby-inspired interpretation. The manor uses the existing castle artwork as its silhouette reference. These are not measured replicas of real centre buildings; reference websites were inaccessible during this pass.

A shared adult population stays visible while cycling, dismounting and walking. Adult NPCs have nine distinct dark outfits. The six young streetwear characters wear a black technical puffer, charcoal fleece set, hooded black tactical field jacket with a utility chest rig, charcoal utility vest over a hoodie, black/deep-forest technical shell, or long hooded black parka. Black nylon joggers, cargos or relaxed dark trousers, black/grey trainers and utility sling bags complete the looks. The field-jacket and long-parka characters wear black balaclavas; the other characters stay unmasked. Three older neighbours use a black work jacket, navy-black coat or black quilted bomber. Fabric texture, charcoal seams and warm highlights keep the black-on-black clothing readable against the autumn scenery. Adult outfits remain separate from the three existing gangster-kid outfits.

The six streetwear characters are drawn as young adults around 18–24, with distinct faces, a broader range of medium/deep complexions, hair textures and hairstyles. Three older neighbours include two Middle Eastern-inspired dad characters and a middle-aged woman. Their faces, skin tones, clothing and face coverings stay consistent through walking, reactions, defeat and full-body screen impacts. The cast keeps the cosy illustrated style; appearance and age do not change NPC behaviour.

Each NPC keeps the same clothes through walking, aggression, damage, defeat and full-body screen throws, as well as cycling/dismounting and return visits. Neighbouring spawn points cycle through the full wardrobe rather than repeating three styles. Residents retain their longer walking routes and original endpoint pauses; clothing does not change their patrol speed. Attacking a resident makes that person aggressive and alerts nearby witnesses; distant residents remain calm. Positions, health and reactions persist when returning to the street. Suburb crews stay hostile, with the original attacks while cycling and aimed thrown items while on foot. Defeated crew members stop attacking until they recover. Scattering birds, bakery steam and waterside ripples add quiet life behind the road.

Scooters, carts, barricades, cones, glass and potholes now use painted art, alongside the painted burning bins. Terrain, hazard positions and collision rules remain the V4 simulation.

## What changed

- A new illustrated autumn waterfront and forest, painted tree and planting art, bakery and metro scenery.
- New terrain-following wooden fences, pavements, kerbs, worn asphalt, and leaf litter throughout the route.
- A newly painted, weathered green bin sprite replaces the first edition’s flat bin in both roadside decoration and burning obstacles. The flame roots align to its open rim; smoke, embers, and fire animate separately.
- New illustrated street furniture and obstacles: benches, graffiti bins, cones, barriers, scooters, carts, glass, and animated burning bins.
- Painted street kids with Swedish suburb streetwear keyed to what they throw: black puffer gilets and tracksuits for Molotov throwers, olive technical shells for stone throwers, navy puffer tracksuits for dynamite throwers, all with caps, trainers and crossbody bags. Each has six grounded poses driven by the existing warning, release, and recovery states.
- Readable medium-sized projectiles (Molotov 32×18; dynamite 29×16 world pixels), with slower spin, a visible burning rag and fuse, with shattering glass and fire splash, rock chips and dust, or a dynamite flash, smoke, and fragments at the point of impact.
- A light bear ink/warm-light treatment and a refined blue bicycle with open spoke spaces, tyre tread, warmer metal and enamel shading.
- A closer camera presentation that scales the whole scene together, keeping the wheels, riders, shadows, and obstacles aligned.
- A complete cream, forest, and gold interface: title screen, heart health display, compact live HUD, touch controls, pause/settings, and retry/completion screens.
- A separate best-score storage key; this edition does not overwrite the original game's saved best score.

The bear's black-and-gold jersey, helmet, face, and bicycle, and the baby's face, expressions, blue seat, and animation are retained for their resemblance and personality. The original bicycle physics, full route, hazards, enemy attack timing, damage values, pickups, sound, checkpoint, crash animation, and finish conditions remain in place. Projectile collision radii match the smaller art, and swept collision checks place effects at the first surface contact. This is a visual edition of the existing game, not a new game engine.

The original loader's 22 known requests for nonexistent scenery/scooter frames are omitted in this edition. No missing source art has been invented for the original game.

## Files

```text
index.html                 Entry point and complete game interface
css/game.css               Original base styles
css/illustrated.css        Autumn Edition interface
js/assets.js               Original character and animation asset registry
js/game.js                 Original simulation with standalone rendering integration
js/illustrated-world.js    New scenery, street, texture, and parallax rendering
js/illustrated-props.js    Cached street-prop art and animated burning bins
js/illustrated-kids.js     Painted thrower outfits and six-pose sprite renderer
js/illustrated-hero.js     Cached bear material treatment
js/illustrated-atlas.js    Shared painted building/hazard/resident textures
js/illustrated-neighbourhood.js  Terrain-supported landmarks and resident routes
js/illustrated-visits.js    Walking rooms, docks/gardens and boating
js/autumn-quests.js         Separate adventure inventory and quest save
js/locomotion.js            Continuous two-leg gait and joint positions
js/brawler.js               Adult NPC reactions, Apex Primal and timed mauling frenzy
js/baby-passenger.js        Original continuous baby artwork and contextual expressions
js/hero-rig.js              Source-matched legs and integrated baby-carrier poses
js/brawler-art.js           Painted NPC reactions and screen-space throws
js/npc-motion.js            Relaxed walks, running and civilian activity poses
js/street-life.js           Sidewalk routes, schedules, street furniture and screams
assets/                    Independent copies of the existing animation assets
assets/art/                New illustrated environment artwork
screenshots/               Screenshots of this edition
VALIDATION.md              Browser checks performed
```

## Development

Edit only this repository to iterate on the illustrated version. The current cloud checkout is `/workspace/BQ-Autumn`; the original KossaMu248/BQ repository is independent and must remain untouched. There are no runtime dependencies on another checkout, copied credentials or original repository Git metadata.

To check JavaScript syntax:

```sh
node --check js/game.js
node --check js/illustrated-world.js
node --check js/illustrated-props.js
node --check js/illustrated-kids.js
node --check js/illustrated-hero.js
node --check js/illustrated-atlas.js
node --check js/illustrated-neighbourhood.js
```

Node is optional for playing. The new environment art was generated for this edition. Original project code and artwork retain their original ownership. Based on original commit `65313c9e708e420999cd10c209f1b6fda1d29f31`.

## Validation

Run `node tests/building-visits.cjs` for placement and interaction logic checks. Run `python3 tests/browser_v10.py` for desktop and mobile browser checks; it needs Python Playwright and Chromium (`python3 -m playwright install chromium`). The browser test starts its own local server and writes screenshots under `screenshots/revision11-2/`. See VALIDATION.md for results and limits.

Fullscreen is available from the top bar, inside each area, and from settings. Escape or **Exit fullscreen** leaves it. Browsers without native element fullscreen use a viewport-filling mode. Settings now includes readable V11.2 location/quest/transition/combat readouts, building shortcuts, dismount preview and a marked dinghy test shortcut; opening it holds walking and transitions as well as cycling.

Run `python3 tests/browser_polish.py` for dismount/remount, settings contrast, fullscreen and phone fallback checks.

The boat uses a dedicated bench-seated pose with lowered legs. Rear hull and bench draw behind the passengers; the clipped near gunwale draws in front. Boarding uses the same hip anchor as sailing in either direction. Run `python3 tests/browser_movement.py` for free dismounting, on-foot doors, return-to-bike and boat composition checks.

Current face and collar close-ups are `screenshots/revision11-2/complete-face-render-front-closeup.png` and `complete-face-render-back-closeup.png`. The full pose comparison is `screenshots/revision11-2/complete-head-poses.png`. The earlier screen-throw preview remains at `screenshots/revision11-1/screen-throw-preview.mp4`.

Run `node tests/brawler.cjs` and `python3 tests/browser_brawler.py` for grab/throw, mauling, depth/jumping, Apex Primal timing, immunity expiry, NPC recovery and keyboard/touch combat checks. V11.2 screenshots are under `screenshots/revision11-2/`.

Dialogue and information use minimal white text inside the scene. Health keeps illustrated hearts; portraits and game symbols keep their artwork. HUD backgrounds and message boxes are transparent so they leave the scene visible. Touch controls sit in the lower corners instead of in a panel below the canvas. On phones, on-foot play fills the viewport; portrait follows the player within an undistorted cropped view, while landscape shows the full world frame. Dialogue fades after reading time. Fullscreen and the readable debug menu remain available.

Screen throws keep the entire NPC visible from head to shoes during flight and screen contact. The full-body impact pose changes to a bruised, scratched and scuffed pose, with a damage number matching the health actually lost, then slides away. Camera framing fits the whole figure in desktop and phone views. Run `python3 tests/browser_npcs.py` for population continuity, witness reactions, gang aggression, carrier alignment, screen impacts and damage/defeat checks on desktop and both phone orientations.

Run `python3 tests/browser_full_body.py` for all twelve adult designs and the three original crews across desktop/portrait crops and motion preferences, and `python3 tests/browser_impact.py` for real keyboard/touch throw timing, damage and screenshots.

Run `python3 tests/browser_hero.py` to capture front/back carriers, both walking phases and headings, jumping, shop interaction, real hostile damage, defeat/recovery and phone touch controls. The test also checks that the rendered feet exchange their lead and that no loose bicycle-seat cutout is drawn on foot. Visual anatomy still needs screenshot review and device playtesting.

Run `python3 tests/browser_baby_face.py` for the original head-file hash, source eye/nose/mouth/chin pixels, removed chair/cloth pixels and final chin visibility after all collar/body layers. Focused 8× probes cover both headings and character sizes; negative controls reject an erased jaw or a collar drawn across it.

Run `node tests/npc-life.cjs` for civilian safety, routes, rests, pursuit and schedules; `node tests/hero-gait.cjs` measures the longer gait and source-sized limbs. `python3 tests/browser_street_life.py` exercises real street controls and furniture on desktop and both phone orientations. `python3 tests/browser_wardrobe.py --renderer-only` checks the complete cast and continuous neutral walking rig. V16 evidence is in `screenshots/revision16/`.
