# Autumn Ride — standalone updates

## Revision 12 — continuous original baby and Stockholm streetwear

- Replaced the separate head/neck/collar assembly with the original bike baby’s continuous head, chin, neck, shirt collar and upper torso. Only the lower clothing edge is hidden inside the carrier. Keep the original likeness and one common native scale across expressions.
- Added contextual expressions off the bike: laughing walks, startled jumps/attacks/throws, braced grabs/transfers, curious shop conversations and excited boating. Render the passenger once while the standing/walking body blends, avoiding duplicate faces.
- Fit the carrier foreground to the native shirt edge in front/back, action, hurt/defeat, transfer and boat poses. Preserve the original chin and collar above the pouch; reuse original opaque blue fabric where a background plate has a gap.
- Dressed reactive adult NPCs in black puffers, navy tracksuits or olive vests/cargo trousers, with caps/beanies, trainers and crossbody bags. Retain matching clothes in recoil, fall, defeat and full-body healthy/damaged screen-impact art. Existing hostile crew streetwear and behavior remain.
- Added V12 entry/cache keys and baby-mood/NPC-style debug readouts. Expanded source-feature, final-layer collar/pouch, real-control expression and independent full-body framing regressions. Original BQ, cycling physics, quests and combat rules remain unchanged.

## Revision 11.2 — complete chin and a joined collar

- Replaced the cropped smile/happy portraits with the complete original in-game head from baby_pose_idle.webp. The earlier portraits ended through the lower jaw; the extra alpha fade made that cutoff more visible.
- Preserve the original eyes, nose, smile, rounded lower jaw and natural chin alpha. Extract the head and short neck without bicycle-seat or source-shirt pixels; no chin fade is applied.
- Added painted backing plates beneath the old head footprint and a curved, shaded front collar to cover the neck base. The original carrier bodies and baby clothing remain in place, while the complete jaw sits above the neckline in front/back, boat and transfer poses.
- Added strict source-feature and final-layer chin checks, including negative controls for cropped/covered jaws, plus fresh actual-game and close-up screenshots. Original BQ, cycling physics, quests, NPCs, health and gameplay controls are unchanged.

## Revision 11.1 — restore the original baby likeness

- Restored the original facial artwork directly in front/back carriers, walking, grabbing, mauling, recoil, collapse and defeat. The new paintings had changed the distinctive eyes, nose, jaw and smile into a generic infant face.
- Reuse the original head textures at a uniform scale with pose-specific collar anchors and a small jaw-to-collar alpha blend. Replace the painted head silhouette while retaining the carrier, supporting arms, neck and clothing.
- Applied the same head-only treatment to the baby transfer frames and seated boat passenger. Mirrored head direction follows the baby looking toward the bear during transfer. Riding artwork, legs, carrier bodies and boat seat geometry remain unchanged.
- Added a BABY FACE debug readout, V11.1 cache/entry keys, original facial pixel regressions and new game screenshots/throw footage.

## Revision 11 — on-foot anatomy and baby carriers

- Replaced the mixed torso/leg assembly with separate front- and back-carrier profiles measured from their own source artwork. Shorts, exposed fur, cuffs and boots use matching proportions; the pants panels move with the thighs.
- Eased the painted standing stance into a centered walking track so both feet take a visible turn leading, while the hips keep their authored positions.
- Replaced the pasted bicycle-seat baby layer with complete painted carriers. The baby, pouch, shoulder straps, waist belt, supporting arms and torso stay together in idle/walking, grab, maul, recoil, collapse and defeated poses.
- Preserved the original cycling rider and boat passenger art, NPC combat behavior, full-body screen impacts, terrain, quests, heart HUD and fullscreen controls.
- Added the V11 entry/cache keys, a hero/carrier readout in settings and dedicated real-control character regression captures.

## Revision 10.1 — full-body screen impacts

- Replaced the cropped face portraits with full-length screen-impact cels for all three residents and all three gang outfits. The torso, trouser legs, palms and both shoes stay visible through flight and contact.
- Added bruised cheeks, scratches, lip marks, frayed sleeves and knee scuffs after collision, plus the actual health lost as a damage number. Knockout throws display KO.
- Fit the rotated/squashed whole sprite to the visible phone or desktop camera crop, retaining the later slide away. Authored source rectangles include complete caps, hands and boot soles.
- Removed a neighboring-cell fragment from the prone resident cel, refreshed cache keys and added autumn-v10-1.html.
- Added fresh screenshots of the impact, cozy shop, seated boat/hearts, jumping/shadow, bear damage and NPC defeat/witness reactions.

## Revision 10 — persistent NPCs and character animation

- Restored on-foot heart health and retained the cycling heart/portrait artwork. Dialogue/info remains white; HUD panels, message backgrounds, the full-screen frenzy frame and opaque result boxes no longer hide the scene.
- Matched the walking torso, hip anchors, thigh/calf widths, boots and stride to one bear model, keeping both legs articulated at a consistent scale.
- Kept the original baby likeness attached to the bear, using a front carrier normally and authored back anchors for mauling, grappling, throws and defeat poses. Removed the ground seat.
- Added a shared street population visible on the bike, during transfers and on foot. Residents retain positions, health and aggression across visits; nearby witnesses react to attacks. Long patrols have endpoint pauses.
- Kept suburb crews hostile, including aimed on-foot projectiles. Original cycling encounters remain in charge while mounted; defeated members stop throwing until recovery.
- Added painted resident and gang hit/defeat/face-impact art and bear recoil/collapse/KO cels. NPC health drives stagger, fall, dead and recovery states; bear defeat animates before the return to the parked bike/entrance.
- Reworked screen throws into flight, frontal face/palms impact, squash and hold, short cracks and a slide off the screen, including portrait framing.
- Added autumn-v10.html, refreshed entry URLs and expanded model/browser regressions. Original BQ remains untouched.

## Revision 9.1 — corrected states and an in-game HUD

- Corrected the names to **Apex Primal** and **Madness Mauling Bear**. Replaced the rolling ball with an upright, player-controlled mauling frenzy, faster claws and automatic nearby mauls. Its eight-second invulnerability and return to cute remain.
- Moved location, dialogue, quests, HP, state meter and touch actions inside the scene. Minimal white Arial text, thin meters and light corner controls replace the large panel under the game.
- On-foot phone play fills the viewport. Portrait follows the player through an undistorted cropped view; landscape keeps the full scene visible. Dialogue fades after reading time, and cycling dismount/entry prompts remain inside the frame.
- Preserved fullscreen, readable debug controls, quests, boat seating and the original cycling simulation. Added autumn-v9-1.html with refreshed cache keys.

## Revision 9 — ground-depth movement and Primal brawling

- Separated the walking hips, knees and boots, narrowed the leg silhouettes and lengthened the alternating stride to reduce crowded legs. Both movement axes advance the gait, and jump shadows remain on the ground.
- Added on-foot up/down ground-depth movement and Space jumping, with matching four-direction and jump touch controls. E remains interaction; cycling controls and physics retain their existing behavior.
- Added adult NPC grabs and screen-directed throws, with scaling, rotation and camera-impact accents. J mauls with painted claw poses, scratches, dark red flecks, dust, brief hit-stop and stagger reactions. Provoked NPCs counterattack and knocked-down NPCs recover.
- Added Primal buildup and a timed eight-second invulnerable bowling-bear transformation, then a return to the cute bear. The baby has a protected seat during combat and returns to the carrier after the action settles.
- Added dedicated painted bear action and adult NPC sheets, a Primal/HP status strip, phone combat buttons, a debug practice area and depth/jump/combat readouts.
- Preserved shop and garden quests, boat seating, free dismount/remount, fullscreen, cozy scenery and the original mounted bear/baby artwork. Added autumn-v9.html and refreshed existing entry URLs/cache keys.

## Revision 8 — locomotion and seating fixes

- Replaced the repeated-leading-leg sprite cycle with a continuous two-leg rig. Opposing phases alternate support and swing; stance soles stay grounded, with knee articulation, subtle body motion and eased acceleration/deceleration. New painted fur/boot parts preserve the cozy materials and the existing upper body/baby likeness.
- Added Q and a touch Dismount button throughout the cycling route. The bicycle coasts to a stop (and lands first if needed), then stays parked while the player walks along the original terrain. The camera follows the walker; Back to bike returns to that same bicycle.
- On-foot entry/exit now preserves the parked bike and returns outside on foot. The bicycle is not teleported to each building.
- Shortened transfer timings and added aligned pose/ride blends, baby-seat blending and a final carrier-to-walking-rig settle. Direction and terrain height remain continuous at scene boundaries.
- Added a proper bench-seated boat pose with lowered legs. Draw order is rear hull/bench, passenger, clipped near hull. Boarding/landing share the same seat hip anchor; sailing works in both headings.
- Kept the V7 fullscreen/settings improvements and the original cycling update/terrain. Added autumn-v8.html and refreshed cache keys.

## Revision 7 — playable side areas

Release polish:

- Added six dismount/transfer poses and a separate eight-frame walk cycle, with authored boot anchors. The original bike stays parked at its native wheel position while the bear settles the baby in the front carrier and walks to the door. Return reverses the sequence.
- Added stepping aboard/ashore animations. Cycling simulation stays frozen for all transitions, and settings holds transition progress.
- Added fullscreen controls to the top bar, area panel and settings, with visible exit/settings controls in fullscreen and a viewport fallback for unsupported browsers.
- Unified debug text, metrics, buttons and toggle contrast; added V7 building warps, transition/quest readouts, dismount preview and an explicitly labelled boat-quest test shortcut.


- Replaced picture dialogs with controllable canvas scenes: compact shop rooms, a scrolling boathouse dock, gardens, and a separate lake trail.
- Added an eight-pose front-carrier bear/baby sprite sheet: idle, walking, carrier-rest, talking and seated poses. Authored crops and foot anchors keep the talk gesture separate from the seated frame. The cycling rig and its original assets remain unchanged.
- Added painted workshop and walkable pizza-shop room backgrounds and a painted wooden dinghy.
- Added keyboard/touch walking, proximity-based interaction, pause/resume, and safe exits back to the parked bicycle. Side areas have their own simulation while the cycling world is frozen.
- Added a boatkeeper quest: collect/deliver lunch, borrow/use a patch kit, unlock the dinghy, check three lake buoys and return. The library offers an optional chart.
- Added a greenhouse seed-packet quest and a separate local adventure save, plus a compact quest reminder during cycling.
- Existing entry URLs load V7; autumn-v7.html is the new versioned entry.
- First playable pass: horizontal room movement and a calm boat trail. Dismount/boarding use staged cels and movement, with brief fades between areas. No combat, swimming or new cycling physics.

## Revision 6

- Corrected tree-root, planting and bakery anchors to exclude transparent sprite padding. Rear terrain coverage supports scenery, and terrain fill extends below the transformed viewport throughout the descent.
- Added level stone foundations sampled across each full building footprint and door paths that connect to the sloping pavement. Ground leaves and birds use the terrain height at their individual x positions.
- Reduced sixteen stops to twelve distinct building designs: exactly one metro, one library and one bakery, with open green stretches between them.
- Added a painted bicycle workshop and Pizza & Kebab exterior, matching the existing autumn palette and materials.
- Stop at a public entrance, press E or use the touch-friendly Enter button, and visit. The pizzeria has a dedicated cozy painted interior. Other public stops have simple illustrated rooms; homes and metro remain scenery.
- Visits freeze simulation and clear held controls; Escape or Back to the ride returns to the same position.
- Residents walk routes of roughly 570–710 world units where space permits, shortened near enemy crews, with 3–6 second endpoint pauses and direction changes. Reduced-motion mode keeps them stationary.
- Original bear/baby assets and likeness, terrain definitions, cycling simulation, encounters, damage and finish behavior are retained.
- Added autumn-v6.html, updated cache versions and kept older entry URLs usable.

## Revision 5

- Replaced the repeated bakery strip with 16 authored neighbourhood stops using 11 building designs: centre arcade, library, clock/community hall, corner shop, apartment/courtyard blocks, manor, greenhouse, boathouses, and one café.
- Added eight distinct architecture sprites and a manor inspired by the project's existing castle reference. These are stylized Hässelby-inspired scenes, not measured reproductions; external local reference sites were unavailable in the environment.
- Painted scooter, shopping cart, road barricade, cones, broken glass and wet pothole art replaces the remaining active hazard illustrations. The finish uses the new barricade too.
- Added friendly residents: a waving shopper, stroller walker, and dog walker; pigeons scatter when the rider approaches. Café steam and shoreline ripples provide quiet motion.
- Centre openings, low forest stone walls and open waterfront railings create distinct neighbourhood edges.
- Decorative residents and birds have no collision or damage behavior. Reduced-motion mode suppresses their extra movement.
- All new sprites have authored source crops and foot anchors; render textures are prepared once.
- Added autumn-v5.html and fresh versioned scripts/styles.

## Revision 4

- Rebalanced Molotov and dynamite readability after play testing: 32×18 and 29×16 world pixels, between the original large art and V3's small sprites.
- Slower visual spin, a clear burning rag on the green bottle, and a more visible dynamite fuse. Collision radii remain compact and match their visible cores.
- New Swedish suburb streetwear: technical puffers/shells, matching dark tracksuits, crossbody bags and chunky running trainers. Faces, thrower identities and six-pose structure retained.
- Source crops isolate whole figures across sheet cell boundaries, with fresh foot anchors for every pose.
- A light cached ink/warm-light pass on the bear and legs preserves the familiar face, helmet, hockey jersey and rig.
- Open spoke spaces, shaded rims, tyre tread and warmer blue enamel on the same bicycle geometry.
- Added autumn-v4.html and versioned script/style URLs. Existing entry points also load V4.

## Revision 3

- Painted six-pose street kids with clothing tied to their actual throwable, including mixed crews.
- Hoodies, caps, loose trousers, and sneakers retained, with charcoal/burgundy, olive/cargo, and navy/red outfit families.
- Wind-up animation follows the real warning duration, including faster encounters.
- Molotov reduced from 37×24 to 21×12 world pixels; dynamite from 36×20 to 19×9. Stones use 16×10.
- Smaller collision radii match the new projectile art. Damage and attack timing are unchanged.
- Material-specific impacts on both terrain and the riders, placed at first swept contact. Effects expire without leaving damaging hazards.

## Revision 2

- Replaced the flat vector bin with a painted, textured green bin, including graffiti, rust, worn edges, and chunky wheels.
- Both ordinary roadside bins and burning bins use the new art.
- Preserved the sprite aspect ratio and aligned animated fire to the opening.
- The game waits for the new prop art before the first frame.

---

# Bearly Qualified – Hässelby v10.63

- Implemented the cleaned approved burning-bin sprite directly in-game.
- Burning bins now show only the bin and the fire, with no surrounding trash clutter.
- Simplified the fire-bin draw path so the game no longer adds extra ambient glow/embers on top of the sprite.
- Preserved hazard positions, hitboxes, intro screen, gameplay, and projectile upgrades from v10.62.
