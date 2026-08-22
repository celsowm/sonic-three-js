# AGENTS.md

## Project direction

`sonic-three-js` is a reusable TypeScript/Three.js 2.5D platform-game engine with a Sonic-style reference demo. The library and the demo are both first-class: engine work must stay reusable, while the Green Hill demo is the visual and gameplay proving ground.

The current visual target is a modern, dense 2.5D presentation comparable in readability and richness to contemporary Sonic side-scrolling stages. Do not copy proprietary game assets. Prefer original procedural art, repository-owned generated assets, or assets with documented provenance/licenses.

## Architecture rules

- Keep gameplay/collision deterministic on the 2D X/Y plane. Z is primarily visual depth.
- Keep levels data-driven through `LevelDefinition`; avoid hard-coding Green Hill behavior into generic engine systems unless it is genuinely theme-specific.
- Visual quality belongs in renderer profiles and theme/environment data, not scattered magic globals.
- Favor instancing, batching, shared geometry/materials, and bounded post-processing over thousands of independent draw calls.
- Keep the `classic` renderer path lightweight and compatible with unit tests/headless environments. Rich effects should be opt-in via `balanced`/`cinematic` profiles.
- New demo-only visual tricks should still expose reusable primitives when practical (background layers, model scattering, render profiles, environment configuration, etc.).
- Preserve the public API unless a deliberate versioned change is justified.

## Rendering priorities

For visual work, prioritize in this order:

1. readable silhouette/gameplay plane;
2. lighting, shadows and contact depth;
3. terrain material quality;
4. dense instanced foliage/props;
5. layered parallax backgrounds and atmosphere;
6. restrained post-processing and color grading;
7. particles/speed polish.

Do not trade stable 60 FPS gameplay for small cosmetic gains. The camera is constrained 2.5D, so exploit that aggressively.

## Assets

- Keep provenance/license metadata for third-party assets.
- Prefer generated/procedural assets for Green Hill-like scenery.
- Do not add ripped assets from commercial games.
- Asset paths in level/theme data are relative to the packaged `assets/` root and must continue to work with `LevelLoader.assetBase` and GitHub Pages.

## Validation

Before considering a change complete, run or ensure CI runs:

```bash
npm test
npm run typecheck
npm run build
npm run build:pages
```

For page/deployment changes, also run the Pages smoke test when available.

Add regression tests for engine behavior and for data-driven visual APIs where possible. Avoid brittle screenshot tests for minor artistic tuning.

## Workflow

The active integration branch for current project work is `main`. Keep commits cohesive and descriptive. When a change spans engine API + demo adoption, land them together so `main` remains usable.
