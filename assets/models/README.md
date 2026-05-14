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
