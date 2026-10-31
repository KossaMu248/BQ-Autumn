# Autumn Ride — standalone updates

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
