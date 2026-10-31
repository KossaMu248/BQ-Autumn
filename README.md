# Bearly Qualified — The Autumn Ride

An independent, playable illustrated edition of **KossaMu248/BQ**. The original checkout is untouched. This folder contains its own HTML, CSS, JavaScript, and every asset it needs; it does not reference or require the original folder.

## Play from GitHub

This repository contains the complete standalone game at its root. To enable browser play, open repository Settings → Pages, choose **Deploy from a branch**, **main**, **/ (root)**, and Save. Once GitHub's deployment succeeds, the game is served at:

https://kossamu248.github.io/BQ-Autumn/

The current version-specific entry is `autumn-v6.html`. There is no npm build step; `.nojekyll` keeps deployment static.

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
| Leave a building | Escape or Back to the ride |
| Restart | R |
| Retry checkpoint | C |
| Settings and district selection | F3 |
| Close settings | Escape |

On a phone or tablet, use the touch buttons beneath the game. Landscape gives the largest play area. Sound starts after the first interaction; toggle it in the toolbar. The demo button previews the existing stunt animations. F3 opens the original developer controls, including district selection and a no-damage option.

## The neighbourhood

The ride has twelve authored stops with twelve distinct building designs. There is one metro, one library and one bakery. A bicycle workshop and a Pizza & Kebab restaurant join the centre arcade, community hall, homes, manor, greenhouse and boathouse. Wider green stretches replace repeated buildings.

Buildings stand on level stone foundations that follow the terrain across their full width. Trees and plantings use their visible root anchors, and fallen leaves follow the terrain at each leaf's position.

Stop beside a public entrance and press **E** or tap **Enter**. Pizza & Kebab has a cozy painted interior with warm lamps, wooden tables, a pizza oven and a kebab counter. Visits freeze the ride; **Escape** or **Back to the ride** returns you outside. Other public stops have simple illustrated rooms; homes and the metro are scenery. Visits do not buy items, heal the rider or change scores.
Architecture is a stylized Hässelby-inspired interpretation. The manor uses the existing castle artwork as its silhouette reference. These are not measured replicas of real centre buildings; reference websites were inaccessible during this pass.

Friendly shoppers, a stroller walker and a dog walker follow longer routes, pausing for 3–6 seconds at each end. Routes shorten near enemy crews. Scattering birds, bakery steam and waterside ripples add quiet life behind the road. They are decorative and do not collide with the bike. Reduced-motion preferences suppress the extra animation.

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
js/illustrated-visits.js    Public entrance prompts and indoor visits
assets/                    Independent copies of the existing animation assets
assets/art/                New illustrated environment artwork
screenshots/               Screenshots of this edition
VALIDATION.md              Browser checks performed
```

## Development

Edit only this folder to iterate on the illustrated version. The original repository is at `/workspace/BQ` in the cloud workspace; this standalone is at `/workspace/BQ-illustrated`. These paths are informational, not runtime dependencies. This repository is the independent GitHub copy of the standalone. It contains no copied credentials or original repository Git metadata.

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

Run `node tests/building-visits.cjs` for placement and interaction logic checks. Run `python3 tests/browser_v6.py` for desktop and mobile browser checks; it needs Python Playwright and Chromium (`python3 -m playwright install chromium`). The browser test starts its own local server and writes screenshots under `screenshots/revision6/`. See VALIDATION.md for results and limits.
