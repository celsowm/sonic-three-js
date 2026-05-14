import { statSync } from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';

const GREEN_HILL_ENVIRONMENT_DIR = 'assets/models/elements/green-hill-environment';

const ASSETS = [
  { file: 'green-hill-terrain-set.glb', textures: true },
  { file: 'green-hill-loop.glb', textures: true },
  { file: 'green-hill-props.glb', textures: false },
  { file: 'green-hill-background.glb', textures: false },
];

describe('Green Hill environment assets', () => {
  it.each(ASSETS)('creates $file with runtime mesh data', async ({ file, textures }) => {
    const assetPath = path.join(GREEN_HILL_ENVIRONMENT_DIR, file);
    expect(statSync(assetPath).size).toBeGreaterThan(0);

    const document = await new NodeIO().read(assetPath);
    const root = document.getRoot();

    expect(root.listMeshes().length).toBeGreaterThan(0);
    expect(root.listMaterials().length).toBeGreaterThan(0);
    expect(root.listMeshes()[0].listPrimitives().length).toBeGreaterThan(0);

    if (textures) {
      expect(root.listTextures().length).toBeGreaterThan(0);
    }
  });
});
