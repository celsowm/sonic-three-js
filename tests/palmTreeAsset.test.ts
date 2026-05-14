import { statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';

const PALM_TREE_GLB = 'assets/models/elements/green-hill-palm-tree/green-hill-palm-tree.glb';

describe('Green Hill palm tree asset', () => {
  it('creates a runtime GLB with mesh data and texture image', async () => {
    expect(statSync(PALM_TREE_GLB).size).toBeGreaterThan(0);

    const document = await new NodeIO().read(PALM_TREE_GLB);
    const root = document.getRoot();

    expect(root.listMeshes().length).toBeGreaterThan(0);
    expect(root.listMaterials().length).toBeGreaterThan(0);
    expect(root.listTextures().length).toBeGreaterThan(0);
    expect(root.listMeshes()[0].listPrimitives().length).toBeGreaterThan(0);
  });
});
