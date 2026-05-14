import * as THREE from 'three';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor() {
      this.domElement = document.createElement('canvas');
    }
    setSize() {}
    render() {}
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

import { Stage } from '../src/entities/Stage';
import { LevelLoader } from '../src/level/LevelLoader';
import type { LevelDefinition } from '../src/level/LevelDefinition';
import { Player } from '../src/entities/Player';
import { Ring } from '../src/entities/Ring';
import { SceneryElement } from '../src/entities/SceneryElement';

class MockGLTFLoader {
  load(url: string, onLoad: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void): void {
    const scene = new THREE.Group();
    scene.name = url;
    onLoad({ scene, animations: [] });
  }
}

const testLevel: LevelDefinition = {
  id: 'test-level',
  theme: {
    id: 'test-theme',
    skyColor: 0x123456,
    terrainMaterials: {
      grass: { color: 0x00ff00 },
    },
    decorations: {
      palm: { url: 'palm.glb' },
    },
  },
  camera: {
    visibleHeight: 88,
    followOffsetX: 12,
    followOffsetY: 18,
  },
  player: {
    x: 1,
    y: 2,
  },
  background: [
    { type: 'color-band', x: 0, y: -20, z: -80, width: 200, height: 30, color: 0x0000ff },
  ],
  terrain: [
    { type: 'solid-platform', x: 0, y: -30, z: -20, width: 200, height: 40, material: 'grass' },
  ],
  entities: [
    { type: 'ring', x: 20, y: 10 },
  ],
  decorations: [
    { type: 'model', asset: 'palm', x: 30, y: -5, z: -24, scale: 0.5, rotation: { y: Math.PI } },
    { type: 'runtime-art', art: 'green-hill-rock', x: 44, y: 0, z: -12, scale: 0.8 },
  ],
};

describe('LevelLoader', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'game-container';
    Object.defineProperty(container, 'clientWidth', { value: 1280, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 720, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it('builds a level from data instead of hard-coded example setup', async () => {
    const stage = new Stage('game-container');
    const loader = new LevelLoader(new MockGLTFLoader() as never);
    const result = await loader.load(stage, testLevel);

    expect(result.player).toBeInstanceOf(Player);
    expect(stage.player).toBe(result.player);
    expect(stage.engine.entities.some(entity => entity instanceof Ring)).toBe(true);
    expect(stage.engine.entities.filter(entity => entity instanceof SceneryElement)).toHaveLength(2);
    expect(stage.engine.renderer.scene.children.length).toBeGreaterThan(2);

    const decoration = stage.engine.entities
      .filter(entity => entity instanceof SceneryElement)
      .map(entity => entity.mesh as THREE.Group)
      .find(mesh => mesh.children[0]?.name === 'palm.glb') as THREE.Group;
    const model = decoration.children[0];
    expect(model.rotation.y).toBe(Math.PI);

    stage.updateCamera();
    expect(stage.engine.renderer.camera.position.x).toBe(13);
    expect(stage.engine.renderer.camera.position.y).toBe(20);
  });
});
