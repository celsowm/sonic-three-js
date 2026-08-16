import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GREEN_HILL_PIXEL,
  GREEN_HILL_TERRAIN_DEPTH,
  GREEN_HILL_TERRAIN_FRONT_Z,
  createGreenHill3DTerrain,
} from '../src/level/greenHillTerrain3D';
import type { PathTerrainDefinition, TerrainDefinition } from '../src/level/LevelDefinition';

const textures = {
  dirtChecker: new THREE.Texture(),
  dirtBand: new THREE.Texture(),
  grassTop: new THREE.Texture(),
  grassFront: new THREE.Texture(),
};

const flatPath: PathTerrainDefinition = {
  type: 'path',
  material: 'green-hill-grass',
  thickness: 40,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};

const slopedPath: PathTerrainDefinition = {
  type: 'path',
  material: 'green-hill-grass',
  thickness: 30,
  points: [
    { x: 0, y: 0 },
    { x: 40, y: 20 },
  ],
};

const closedPath: PathTerrainDefinition = {
  type: 'path',
  material: 'green-hill-grass',
  closed: true,
  thickness: 8,
  points: Array.from({ length: 12 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 12;
    return { x: 100 + Math.cos(angle) * 20, y: Math.sin(angle) * 20 };
  }),
};

const platform: TerrainDefinition = {
  type: 'solid-platform',
  x: 920,
  y: 20,
  width: 180,
  height: 90,
  material: 'green-hill-grass',
};

const meshesOf = (root: THREE.Object3D): THREE.Mesh[] =>
  root.children.filter((child): child is THREE.Mesh => (child as THREE.Mesh).isMesh);

describe('createGreenHill3DTerrain (open path)', () => {
  it('builds the full 3D slab: rim, band, checker body, caps, bottom and grass top', () => {
    const visual = createGreenHill3DTerrain(flatPath, textures) as THREE.Group;
    const meshes = meshesOf(visual);

    expect(visual).toBeInstanceOf(THREE.Group);
    // rim + band + dirt + caps + bottom + grass + instanced blades
    expect(meshes).toHaveLength(7);
    expect(meshes.at(-1)).toBeInstanceOf(THREE.InstancedMesh);

    const byMap = (map: THREE.Texture) =>
      meshes.filter(mesh => (mesh.material as THREE.MeshBasicMaterial).map === map);
    expect(byMap(textures.grassFront)).toHaveLength(1);
    expect(byMap(textures.dirtBand)).toHaveLength(1);
    expect(byMap(textures.dirtChecker)).toHaveLength(2); // body + end caps
    expect(byMap(textures.grassTop)).toHaveLength(1);
  });

  it('uses world-scale texture repeats calibrated to Genesis pixels', () => {
    createGreenHill3DTerrain(flatPath, textures);

    // 64px canvas = 8 checker squares of 8 Genesis pixels
    expect(textures.dirtChecker.wrapS).toBe(THREE.RepeatWrapping);
    expect(textures.dirtChecker.wrapT).toBe(THREE.RepeatWrapping);
    expect(textures.dirtChecker.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(textures.dirtChecker.repeat.x).toBeCloseTo(1 / (64 * GREEN_HILL_PIXEL), 6);
  });

  it('places the grass top on the gameplay surface receding to the back', () => {
    const visual = createGreenHill3DTerrain(flatPath, textures) as THREE.Group;
    const grass = meshesOf(visual).find(
      mesh => (mesh.material as THREE.MeshBasicMaterial).map === textures.grassTop,
    )!;
    const positions = grass.geometry.getAttribute('position');

    const zs = Array.from({ length: positions.count }, (_, i) => positions.getZ(i));
    expect(Math.max(...zs)).toBeCloseTo(GREEN_HILL_TERRAIN_FRONT_Z, 6);
    expect(Math.min(...zs)).toBeCloseTo(GREEN_HILL_TERRAIN_FRONT_Z - GREEN_HILL_TERRAIN_DEPTH, 6);
  });

  it('bakes depth shading into vertex colors', () => {
    const visual = createGreenHill3DTerrain(flatPath, textures) as THREE.Group;
    const grass = meshesOf(visual).find(
      mesh => (mesh.material as THREE.MeshBasicMaterial).map === textures.grassTop,
    )!;
    expect(grass.geometry.getAttribute('color')).toBeDefined();

    const colors = grass.geometry.getAttribute('color');
    const shades = Array.from({ length: colors.count }, (_, i) => colors.getX(i));
    expect(Math.max(...shades)).toBeCloseTo(1, 6);
    expect(Math.min(...shades)).toBeLessThan(0.8);
  });

  it('anchors the wall cross-section to the surface normal on slopes', () => {
    const visual = createGreenHill3DTerrain(slopedPath, textures) as THREE.Group;
    const rim = meshesOf(visual).find(
      mesh => (mesh.material as THREE.MeshBasicMaterial).map === textures.grassFront,
    )!;
    const positions = rim.geometry.getAttribute('position');

    // bottom of the rim hangs perpendicular to the 26.57° slope, not straight down
    const topX = positions.getX(0);
    const topY = positions.getY(0);
    const bottomX = positions.getX(3);
    const bottomY = positions.getY(3);
    const angle = Math.atan2(bottomY - topY, bottomX - topX);
    expect(angle).toBeCloseTo(-Math.PI / 2 + Math.atan2(20, 40), 4);
  });
});

describe('createGreenHill3DTerrain (closed path)', () => {
  it('extrudes the ring with the checker texture', () => {
    const visual = createGreenHill3DTerrain(closedPath, textures) as THREE.Group;
    const meshes = meshesOf(visual);

    expect(meshes).toHaveLength(1);
    expect(meshes[0].geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect((meshes[0].material as THREE.MeshBasicMaterial).map).toBe(textures.dirtChecker);
  });
});

describe('createGreenHill3DTerrain (solid platform)', () => {
  it('renders the platform as a two-point slab with caps and underside', () => {
    const visual = createGreenHill3DTerrain(platform, textures) as THREE.Group;
    const meshes = meshesOf(visual);

    expect(meshes.length).toBe(7);
    const positions = meshes
      .find(mesh => (mesh.material as THREE.MeshBasicMaterial).map === textures.grassTop)!
      .geometry.getAttribute('position');
    const xs = Array.from({ length: positions.count }, (_, i) => positions.getX(i));
    expect(Math.min(...xs)).toBeCloseTo(830, 6);
    expect(Math.max(...xs)).toBeCloseTo(1010, 6);
  });
});
