# Autumn Ride — standalone updates

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
