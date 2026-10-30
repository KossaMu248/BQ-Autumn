# Autumn Ride — standalone updates

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
