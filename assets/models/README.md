# Assets

Place downloaded 3D models here.

Recommended layout:

- `assets/models/sonic/`
- `assets/models/sonic/textures/`
- `assets/models/sonic/animations/`

Preferred runtime formats for this project:

- `.glb`
- `.gltf`

Keep a small text file next to each asset with:

- source URL
- author
- license
- notes about rig/animations

The runtime Sonic model is a local derivative stored at:

- `assets/models/sonic/classic-sonic-runners/classic-sonic-runners.glb`

It is generated from the downloaded Sketchfab GLB and adds a local `idle` animation derived from `sc_landing.ma`. Regenerate it with:

- `npm run assets:sonic:add-idle`

To inspect Sketchfab metadata from the terminal, use:

- `npm run sketchfab:info -- <url-or-model-id>`

To download the public model archive and thumbnail for a Sketchfab model, use:

- `npm run sketchfab:download -- <url-or-model-id> [more-models...]`

If you set `SKETCHFAB_ACCESS_TOKEN`, `SKETCHFAB_API_TOKEN`, or `SKETCHFAB_TOKEN` in the environment, or pass `--token`, the downloader will use the official Sketchfab Download API and prefer `GLB`, then `glTF`, then `USDZ`. The token must be a valid Sketchfab user OAuth access token with download permission.

Without a token, use the browser downloader below so the project stores normal model archives such as `.glb`.

If you cannot get Sketchfab OAuth access, use the browser downloader:

- `npm run sketchfab:download:browser -- <url-or-model-id> [more-models...]`

It opens a persistent Playwright browser profile. Log in to Sketchfab in the opened browser, click the official download option on the model page, and the script saves the downloaded archive next to the model metadata.

If you already downloaded the archive manually, a watcher can file it into place:

- `npm run sketchfab:download:manual`

It watches your `~/Downloads` folder for model archives (`.zip`, `.glb`, `.fbx`, `.obj`, `.blend`, ...) and moves them into `assets/models/sketchfab/<slug>-<id>/` with a metadata stub.

## Asset generation scripts

- `npm run assets:sonic:add-idle` — rebuilds the runtime Sonic GLB (adds the
  hand-authored `idle` animation and root/forward fixes) from the downloaded Sketchfab
  archive.
- `npm run assets:elements:palm-tree` — converts the Sonic Adventure 2 Green Hill palm
  tree OBJ/MTL/PNG (expected in the author's `~/Downloads`) into
  `assets/models/elements/green-hill-palm-tree/green-hill-palm-tree.glb`. Machine
  specific: needs that source archive present locally.
- `npm run assets:elements:green-hill` — regenerates the Blender-built Green Hill
  environment set (`green-hill-terrain-set/loop/props/background.glb` plus procedural
  checker textures) via `scripts/generate-green-hill-environment.py`. Requires Blender
  on `PATH` or at `C:\Program Files\Blender Foundation\Blender *\blender.exe` (Windows).
- `npm run assets:textures:green-hill` — regenerates the Green Hill stage texture
  PNGs (dirt checker, band, grass) in `assets/textures/green-hill/` via
  `scripts/generate-green-hill-textures.mjs` (deterministic, no dependencies).
- `npm run assets:measure -- <path-to-glb> [--scale N] [--json]` — prints the bounding
  box, size and mesh inventory of a GLB, useful for placing models at the right scale.
