import * as THREE from 'three';
import type { TerrainDefinition } from './LevelDefinition';

/**
 * Real-3D Green Hill terrain: every walkable path becomes an extruded slab
 * with a textured dirt face, a dark checker band, a grass rim and — the part
 * that sells the depth — a grass top surface extending away from the camera.
 * UVs are expressed in world units so the shared textures tile continuously
 * across every segment, and the classic checker square stays at 8 Genesis
 * pixels (see GREEN_HILL_PIXEL).
 */

/** World units per Genesis pixel: the 224px-tall viewport maps to visibleHeight 96. */
export const GREEN_HILL_PIXEL = 96 / 224;

/** Depth of the terrain slab, from the front face towards the back. */
export const GREEN_HILL_TERRAIN_DEPTH = 54;
/** Front face z: keeps clear of gameplay entities (which span roughly z -4..4). */
export const GREEN_HILL_TERRAIN_FRONT_Z = -6;

const CHECKER_WORLD_SIZE = 64 * GREEN_HILL_PIXEL;
const RIM_HEIGHT = 5;
const BAND_HEIGHT = 2 * 8 * GREEN_HILL_PIXEL;

export interface GreenHillTerrainTextures {
  dirtChecker: THREE.Texture;
  dirtBand: THREE.Texture;
  grassTop: THREE.Texture;
  grassFront: THREE.Texture;
}

/** Texture keys the green-hill theme must provide for the 3D terrain. */
export const GREEN_HILL_TERRAIN_TEXTURE_KEYS = {
  dirtChecker: 'dirt-checker',
  dirtBand: 'dirt-band',
  grassTop: 'grass-top',
  grassFront: 'grass-front',
} as const;

const worldTexture = (texture: THREE.Texture, worldWidth: number, worldHeight: number): THREE.Texture => {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(1 / worldWidth, 1 / worldHeight);
  return texture;
};

const textured = (map: THREE.Texture, color = 0xffffff): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ map, color, vertexColors: true, side: THREE.DoubleSide });

interface Quad {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  d: THREE.Vector3;
  normal: THREE.Vector3;
  uvA: THREE.Vector2;
  uvB: THREE.Vector2;
  uvC: THREE.Vector2;
  uvD: THREE.Vector2;
  /** Baked shading per vertex (1 = full brightness); sells depth without scene lights. */
  shadeA?: number;
  shadeB?: number;
  shadeC?: number;
  shadeD?: number;
}

/**
 * Accumulates textured quads into a single indexed BufferGeometry.
 */
class QuadBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];

  public add(quad: Quad): void {
    const base = this.positions.length / 3;
    for (const vertex of [quad.a, quad.b, quad.c, quad.d]) {
      this.positions.push(vertex.x, vertex.y, vertex.z);
      this.normals.push(quad.normal.x, quad.normal.y, quad.normal.z);
    }
    for (const uv of [quad.uvA, quad.uvB, quad.uvC, quad.uvD]) {
      this.uvs.push(uv.x, uv.y);
    }
    for (const shade of [quad.shadeA ?? 1, quad.shadeB ?? 1, quad.shadeC ?? 1, quad.shadeD ?? 1]) {
      this.colors.push(shade, shade, shade);
    }
    // a-b-c-d quad: triangles a,b,c and a,c,d (counter-clockwise from front)
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  public build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    return geometry;
  }
}

/**
 * One terrain slice segment. The cross-section hangs along the surface
 * normal (like the original game's terrain slices), and UVs are anchored to
 * arclength/depth-below-surface so the checker follows the hill instead of
 * shearing diagonally on slopes.
 */
interface Slice {
  start: THREE.Vector2;
  end: THREE.Vector2;
  /** Unit surface normal (points away from the dirt). */
  normal: THREE.Vector2;
  /** Arclength of `start` along the path. */
  startLength: number;
  length: number;
}

const sliceNormal = (start: THREE.Vector2, end: THREE.Vector2): THREE.Vector2 => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  return new THREE.Vector2(-Math.sin(angle), Math.cos(angle));
};

const buildSlices = (points: THREE.Vector2[]): Slice[] => {
  const slices: Slice[] = [];
  let startLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = start.distanceTo(end);
    slices.push({ start, end, normal: sliceNormal(start, end), startLength, length });
    startLength += length;
  }
  return slices;
};

const below = (point: THREE.Vector2, normal: THREE.Vector2, depth: number): THREE.Vector2 =>
  new THREE.Vector2(point.x - normal.x * depth, point.y - normal.y * depth);

/** Grass top surface: strip along the segment receding into depth. */
const surfaceQuad = (slice: Slice, frontZ: number, backZ: number): Quad => {
  const u0 = slice.startLength;
  const u1 = slice.startLength + slice.length;
  return {
    a: new THREE.Vector3(slice.start.x, slice.start.y, frontZ),
    b: new THREE.Vector3(slice.end.x, slice.end.y, frontZ),
    c: new THREE.Vector3(slice.end.x, slice.end.y, backZ),
    d: new THREE.Vector3(slice.start.x, slice.start.y, backZ),
    normal: new THREE.Vector3(slice.normal.x, slice.normal.y, 0),
    uvA: new THREE.Vector2(u0, frontZ),
    uvB: new THREE.Vector2(u1, frontZ),
    uvC: new THREE.Vector2(u1, backZ),
    uvD: new THREE.Vector2(u0, backZ),
    // the top surface darkens as it recedes, faking light falloff into depth
    shadeA: 1,
    shadeB: 1,
    shadeC: 0.72,
    shadeD: 0.72,
  };
};

/** Dirt face quad hanging below the surface between `offset` and `offset + height`. */
const faceQuad = (slice: Slice, offset: number, height: number, z: number): Quad => {
  const topA = below(slice.start, slice.normal, offset);
  const topB = below(slice.end, slice.normal, offset);
  const u0 = slice.startLength;
  const u1 = slice.startLength + slice.length;
  return {
    a: new THREE.Vector3(topA.x, topA.y, z),
    b: new THREE.Vector3(topB.x, topB.y, z),
    c: new THREE.Vector3(topB.x - slice.normal.x * height, topB.y - slice.normal.y * height, z),
    d: new THREE.Vector3(topA.x - slice.normal.x * height, topA.y - slice.normal.y * height, z),
    normal: new THREE.Vector3(0, 0, 1),
    uvA: new THREE.Vector2(u0, offset),
    uvB: new THREE.Vector2(u1, offset),
    uvC: new THREE.Vector2(u1, offset + height),
    uvD: new THREE.Vector2(u0, offset + height),
  };
};

/** Side cap closing the slab at a path extremity. */
const capQuad = (
  point: THREE.Vector2,
  normal: THREE.Vector2,
  thickness: number,
  frontZ: number,
  backZ: number,
  facing: 1 | -1,
): Quad => {
  const bottom = below(point, normal, thickness);
  return {
    a: new THREE.Vector3(point.x, point.y, frontZ),
    b: new THREE.Vector3(bottom.x, bottom.y, frontZ),
    c: new THREE.Vector3(bottom.x, bottom.y, backZ),
    d: new THREE.Vector3(point.x, point.y, backZ),
    normal: new THREE.Vector3(facing, 0, 0),
    uvA: new THREE.Vector2(point.x, 0),
    uvB: new THREE.Vector2(point.x, thickness),
    uvC: new THREE.Vector2(backZ, thickness),
    uvD: new THREE.Vector2(backZ, 0),
    shadeA: 1,
    shadeB: 0.85,
    shadeC: 0.66,
    shadeD: 0.82,
  };
};

/** Underside quad so the slab is closed when seen from below (pits, falls). */
const bottomQuad = (slice: Slice, thickness: number, frontZ: number, backZ: number): Quad => {
  const bottomA = below(slice.start, slice.normal, thickness);
  const bottomB = below(slice.end, slice.normal, thickness);
  return {
    a: new THREE.Vector3(bottomA.x, bottomA.y, frontZ),
    b: new THREE.Vector3(bottomA.x, bottomA.y, backZ),
    c: new THREE.Vector3(bottomB.x, bottomB.y, backZ),
    d: new THREE.Vector3(bottomB.x, bottomB.y, frontZ),
    normal: new THREE.Vector3(-slice.normal.x, -slice.normal.y, 0),
    uvA: new THREE.Vector2(slice.startLength, frontZ),
    uvB: new THREE.Vector2(slice.startLength, backZ),
    uvC: new THREE.Vector2(slice.startLength + slice.length, backZ),
    uvD: new THREE.Vector2(slice.startLength + slice.length, frontZ),
  };
};

/** One instanced cone mesh for all grass blades along the rim. */
const buildBlades = (points: THREE.Vector2[], frontZ: number): THREE.InstancedMesh | null => {
  const matrices: THREE.Matrix4[] = [];
  const spacing = 7;
  let carried = spacing / 2;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = start.distanceTo(end);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    let travelled = carried;
    while (travelled < length) {
      const t = travelled / length;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const wobble = Math.sin(x * 12.9898) * 43758.5453;
      const random = wobble - Math.floor(wobble);
      const depth = frontZ + 1.2 + random * 2.4;
      const matrix = new THREE.Matrix4()
        .makeRotationZ((random - 0.5) * 0.5)
        .setPosition(x, y + 1.4 + random * 0.8, depth);
      matrices.push(matrix);
      travelled += spacing;
    }
    carried = travelled - length;
  }

  if (matrices.length === 0) {
    return null;
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.55, 3.2, 5),
    new THREE.MeshBasicMaterial({ color: 0x0e7a14 }),
    matrices.length,
  );
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
};

const buildExtrudedPath = (
  points: THREE.Vector2[],
  thickness: number,
  textures: GreenHillTerrainTextures,
): THREE.Group => {
  const group = new THREE.Group();
  const frontZ = GREEN_HILL_TERRAIN_FRONT_Z;
  const backZ = frontZ - GREEN_HILL_TERRAIN_DEPTH;
  const slices = buildSlices(points);

  const rimBuilder = new QuadBuilder();
  const bandBuilder = new QuadBuilder();
  const dirtBuilder = new QuadBuilder();
  const capBuilder = new QuadBuilder();
  const bottomBuilder = new QuadBuilder();
  const grassBuilder = new QuadBuilder();

  for (const slice of slices) {
    grassBuilder.add(surfaceQuad(slice, frontZ, backZ));
    rimBuilder.add(faceQuad(slice, 0, RIM_HEIGHT, frontZ));
    bandBuilder.add(faceQuad(slice, RIM_HEIGHT, BAND_HEIGHT, frontZ));
    dirtBuilder.add(faceQuad(slice, RIM_HEIGHT + BAND_HEIGHT, thickness - RIM_HEIGHT - BAND_HEIGHT, frontZ));
    bottomBuilder.add(bottomQuad(slice, thickness, frontZ, backZ));
  }

  const first = slices[0];
  const last = slices[slices.length - 1];
  capBuilder.add(capQuad(first.start, first.normal, thickness, frontZ, backZ, -1));
  capBuilder.add(capQuad(last.end, last.normal, thickness, frontZ, backZ, 1));

  const rim = new THREE.Mesh(rimBuilder.build(), textured(textures.grassFront));
  const band = new THREE.Mesh(bandBuilder.build(), textured(textures.dirtBand));
  const dirt = new THREE.Mesh(dirtBuilder.build(), textured(textures.dirtChecker));
  const caps = new THREE.Mesh(capBuilder.build(), textured(textures.dirtChecker));
  const bottom = new THREE.Mesh(bottomBuilder.build(), new THREE.MeshBasicMaterial({ color: 0x3a1a05, side: THREE.DoubleSide }));
  const grass = new THREE.Mesh(grassBuilder.build(), textured(textures.grassTop));
  group.add(rim, band, dirt, caps, bottom, grass);

  const blades = buildBlades(points, frontZ);
  if (blades) {
    group.add(blades);
  }

  return group;
};

const buildExtrudedRing = (
  points: THREE.Vector2[],
  thickness: number,
  textures: GreenHillTerrainTextures,
): THREE.Group => {
  const group = new THREE.Group();
  const frontZ = GREEN_HILL_TERRAIN_FRONT_Z;

  const centroid = points.reduce(
    (acc, point) => acc.add(point),
    new THREE.Vector2(0, 0),
  ).divideScalar(points.length);

  const outer = points.map(point => {
    const direction = point.clone().sub(centroid).normalize();
    return point.clone().add(direction.multiplyScalar(thickness));
  });

  const ring = new THREE.Shape(outer);
  ring.holes.push(new THREE.Path(points));
  const geometry = new THREE.ExtrudeGeometry(ring, {
    depth: GREEN_HILL_TERRAIN_DEPTH,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, frontZ);

  group.add(new THREE.Mesh(geometry, textured(textures.dirtChecker)));
  return group;
};

/**
 * Builds the real-3D terrain visual for a green-hill terrain definition.
 * Solid platforms are rendered as two-point paths so they get the same
 * textured faces, caps and underside.
 */
export const createGreenHill3DTerrain = (
  definition: TerrainDefinition,
  rawTextures: GreenHillTerrainTextures,
): THREE.Object3D => {
  const textures: GreenHillTerrainTextures = {
    dirtChecker: worldTexture(rawTextures.dirtChecker, CHECKER_WORLD_SIZE, CHECKER_WORLD_SIZE),
    dirtBand: worldTexture(rawTextures.dirtBand, CHECKER_WORLD_SIZE, 2 * 8 * GREEN_HILL_PIXEL),
    grassTop: worldTexture(rawTextures.grassTop, 32, 32),
    grassFront: worldTexture(rawTextures.grassFront, 32, RIM_HEIGHT),
  };

  if (definition.type === 'path') {
    const points = definition.points.map(point => new THREE.Vector2(point.x, point.y));
    const thickness = definition.thickness ?? 40;
    if (definition.closed) {
      return buildExtrudedRing(points, thickness, textures);
    }
    return buildExtrudedPath(points, thickness, textures);
  }

  const halfWidth = definition.width / 2;
  const points = [
    new THREE.Vector2(definition.x - halfWidth, definition.y),
    new THREE.Vector2(definition.x + halfWidth, definition.y),
  ];
  return buildExtrudedPath(points, definition.height, textures);
};
