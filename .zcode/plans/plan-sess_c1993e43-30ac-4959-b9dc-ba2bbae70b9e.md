# Considerable improvement of sonic-three-js library + demos

## Phase 1 — Engine core & API foundation

**`src/core/Engine.ts`**
- Add lightweight typed event system (`on`/`off`/`emit`) and public `onUpdate(cb)` hook; `Stage` and demos stop touching private `engine['update']`.
- Engine garbage-collects `destroyFlag` entities itself each step (removes that duty from `Stage`).
- Fixed-timestep accumulator: logic runs in 1/60 steps calling `entity.update(1, engine)` (keeps the existing "timeScale in 60fps-frames" convention); render once per rAF. Cache the bound loop handler.
- Add `destroy()`: stop loop, destroy input/renderer, clear entities. Skip non-collidable entities (scenery) in the O(n²) pass.

**`src/core/Input.ts`**
- Fix `destroy()` no-op bug (store bound handler references).
- Add edge detection (`justPressed(code)`) for jump/pause/restart; `preventDefault` on arrows/space so the page doesn't scroll.

**`src/core/Renderer.ts`**
- Add `destroy()` (remove resize listener, dispose WebGL context, remove canvas); drop the `options | boolean` legacy hack; store bound resize handler.

**`src/core/Physics.ts`**
- Replace `any` params with a `PhysicsBody` interface; remove dead `applyFriction`; keep behavior otherwise.

**`src/entities/Stage.ts`**
- Rewrite `start()` to use public hooks (no monkey-patching); delete the dead `load()` stub; add `pause()`, `resume()`, `restart()` support hooks, `unload()` (clear entities + scene children for level reload), `destroy()`.

**Package/config hygiene**
- `package.json`: fix `main`/`types` to `dist/src/*` (or `exports` map), add `files`, move `adm-zip` to devDependencies, remove unused `@vitest/browser`, add `typecheck` script (`tsc --noEmit`).
- `tsconfig.json`: build only `src/` (separate include for tests/examples via vitest/vite, not the npm build).
- `LevelLoader`: accept `LevelLoaderOptions { assetBase?, onProgress? }` so asset URLs are no longer import.meta.url-hardcoded (npm-consumable); throw on unknown entity `type` (exhaustive switch).
- Tests: Input destroy actually removes listeners, engine hooks fire, GC works, fixed-step determinism.

## Phase 2 — Terrain collision & 360° player physics (the heart)

**New `src/core/Terrain.ts`** (collision world)
- `TerrainPath`: polyline (open or closed) of 2D points → precomputed segments with angle/normal; `solid-platform` boxes contribute a top path + side wall segments.
- `Terrain` world: x-bucket spatial index; queries: `groundAt(x, fromY, dir)` for foot sensors, `wallsBetween(...)` for side collision, `groundHeightAt(x)` for scattered-ring bouncing.
- Built by `LevelLoader` from level data, held on `Engine`/`Stage`.

**`src/entities/Player.ts` rework**
- Grounded mode: `groundSpeed` + `groundAngle` + active path/segment; movement along tangent; slope factor (walk vs roll) accelerating downhill; slip/detach when slow on steep angles; detach at path end (ramp launch converts to world velocity); segment-transition smoothing around joints.
- Airborne mode: gravity, landing via sensors with snap tolerance; on landing project velocity onto tangent → groundSpeed; jump impulse normal to surface.
- Control mode floor/wall/ceiling derived from accumulated angle (loops); fall off when |groundSpeed| below threshold while beyond ~45°.
- Visuals: dedicated orientation group so model rotation composes cleanly with the `scale.x` facing flip; keep the existing animation state machine (add spring/hurt states).
- Keep public constants style; add `slopeFactor`, `slopeRollFactor`, `slip`, `fallTolerance` tunables.

**Level schema (`src/level/LevelDefinition.ts`)**
- New `TerrainDefinition` variant `path` (points array, `closed` flag for loops, material); `solid-platform` gains real collision.
- Level data gains optional `deathY` (kill plane) and `spawn` (respawn point).

**`src/level/greenHillRuntimeArt.ts`**: extend terrain visual builder to fill the checker body under an arbitrary path (hills); loops keep their existing GLB decoration aligned to the closed path.

**Tests**: slope acceleration/deceleration both directions, ramp launch, loop attach at speed / detach when slow, platform landing + side bump, path-end detach.

## Phase 3 — Gameplay mechanics

- **`src/entities/Spring.ts`** (new): red spring, directional bounce (`force`, `direction` up/diagonal), squash animation; schema `spring` entity type.
- **Hurt/death system on Player**: `hurt()` → knockback + invulnerability timer (mesh blink); ring-loss scatter (spawn physics rings that bounce on terrain, collectible after delay, despawn timer); death (0 rings or kill plane) → death state → respawn at `spawn`/checkpoint, `lives--`, game-over event.
- **`src/entities/Checkpoint.ts`** (new): lamp post, spins when passed, sets respawn.
- **Monitor effects**: `shield` (absorbs one hit, translucent bubble visual), `invincibility` (timed i-frames + star sparkles + kill badniks on touch); better monitor visual (TV box with icon color).
- **Badnik**: real death (pop + score), Motobug-style body from primitives, walking bob animation.
- **FinishSign**: emits `stageCleared` event (no more console.log); Stage exposes typed events (`playerHurt`, `playerDied`, `ringCollected`, `stageCleared`).
- **HUD**: lives display; pause-aware timer.
- Tests: spring bounce, ring scatter collection, i-frames prevent repeat damage, shield absorbs hit, invincibility kills on touch, checkpoint respawn, stage-cleared event.

## Phase 4 — Art & level content (3D props + flat backdrop)

- Wire `green-hill-palm-tree.glb` + `green-hill-props.glb` sub-nodes into Green Hill foreground decorations (verify node names via the measure script/metadata during implementation); flat runtime art remains only for the far backdrop + fallback lightweight mode. Trim or repurpose unused GLBs.
- **Redesign `greenHillAct1`**: opening flat run → gentle hill → ramp jump → elevated platforms (now solid) → loop (path aligned to the loop GLB) → spring section up to a ring arc → valley with badniks/monitors (incl. shield, invincibility) → checkpoint → finish sign. Ring arcs along jumps, more enemies.
- **New `src/levels/physicsPlayground.ts`**: slopes of increasing steepness, half-pipe, loop, springs, test walls — minimal dressing, powers the sandbox demo.

## Phase 5 — Demo experience

- **`vite.config.ts`** (new): multi-page build. `examples/index.html` becomes a demo menu; pages: `green-hill.html` (main), `physics-sandbox.html` (debug overlay on).
- **`src/components/LoadingScreen.ts`** (new): progress from loader `onProgress` (GLB/model count); the Sonic model load is awaited instead of fire-and-forget placeholder race.
- **HUD/demo chrome**: pause overlay (P/Esc) with resume/restart, restart key (R), controls hint card.
- **`src/components/ResultsOverlay.ts`** (new): on `stageCleared` shows ACT CLEAR, time/ring bonus, total score, restart button.
- **`src/components/DebugOverlay.ts`** (new, F3 toggle): FPS, player x/y/groundSpeed/angle/grounded/state, hitbox BoxHelpers for collidable entities.
- `examples/main.ts` shrinks to Stage + LoadingScreen + LevelLoader + start, wired via public events only.

## Phase 6 — Docs, hygiene & verification

- Root **README.md**: intro, screenshot, quickstart (`npm install`, `npm run dev`), controls, demos list, library API overview with a ~15-line usage snippet, project structure, asset pipeline summary, testing.
- `assets/models/README.md`: document the 3 undocumented scripts (`assets:elements:palm-tree`, `assets:elements:green-hill`, `assets:measure`).
- Full `npm test` + `npm run typecheck` + `npm run build` pass; verify package output layout.
- Visual verification: run `npm run dev`, screenshot each demo page (menu, green hill incl. loop/spring run, sandbox with debug overlay) with the browser tooling.

## Out of scope (noted for later)
Audio, save system, mobile/touch input, wall-crawl arbitrary polygons beyond solid-box sides, new GLB generation (reusing existing assets only).

## Commit strategy
One commit per phase, tests green before each commit.