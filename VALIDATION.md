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
