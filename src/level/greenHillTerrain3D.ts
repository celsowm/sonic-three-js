import * as THREE from 'three';
import type { TerrainDefinition } from './LevelDefinition';

/**
 * Real-3D Green Hill terrain. Collision remains a 2D polyline, while the
 * renderer turns the same path into a deep PBR slab with tiled dirt, grass,
 * self-shadowing surfaces and a dense instanced grass canopy.
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
const GRASS_ROWS = 5;
const GRASS_SPACING = 2.35;

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

const pseudoRandom = (seed: number, index: number): number => {
  const value = Math.sin(seed * 71.193 + index * 12.9898) * 43758.5453123;
  return value - Math.floor(value);
};

/** Small deterministic grayscale detail map used as micro-bump on PBR terrain. */
const createDetailTexture = (seed: number, worldSize: number): THREE.DataTexture => {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    const coarse = pseudoRandom(seed, index);
    const fine = pseudoRandom(seed + 13, index * 7 + 3);
    const value = Math.round(75 + (coarse * 0.72 + fine * 0.28) * 150);
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / worldSize, 1 / worldSize);
  texture.needsUpdate = true;
  return texture;
};

const dirtDetail = createDetailTexture(17, 4.5);
const grassDetail = createDetailTexture(41, 2.4);

interface MaterialOptions {
  surface?: 'dirt' | 'grass' | 'band';
  color?: number;
}

const textured = (map: THREE.Texture, options: MaterialOptions = {}): THREE.MeshStandardMaterial => {
  const surface = options.surface ?? 'dirt';
  const grass = surface === 'grass';
  const band = surface === 'band';
  return new THREE.MeshStandardMaterial({
    map,
    color: options.color ?? 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: grass ? 0.93 : band ? 0.82 : 0.88,
    metalness: 0,
    bumpMap: grass ? grassDetail : dirtDetail,
    bumpScale: grass ? 0.42 : band ? 0.38 : 0.72,
  });
};

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
  /** Artistic base shading; real scene lights add the dynamic component. */
  shadeA?: number;
  shadeB?: number;
  shadeC?: number;
  shadeD?: number;
}

/** Accumulates textured quads into a single indexed BufferGeometry. */
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
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  public build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

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
    if (length <= 0.0001) continue;
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

const createBladeGeometry = (): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, 0, 0,
    0.5, 0, 0,
    0, 1, 0,
  ], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,
    1, 0,
    0.5, 1,
  ], 2));
  geometry.setIndex([0, 1, 2]);
  geometry.computeBoundingSphere();
  return geometry;
};

/**
 * Dense instanced grass. Thousands of blades remain one draw call per terrain
 * section, which is the key trick that lets the 2.5D demo look lush in WebGL.
 */
const buildBlades = (points: THREE.Vector2[], frontZ: number): THREE.InstancedMesh | null => {
  const slices = buildSlices(points);
  const estimated = Math.max(
    1,
    slices.reduce((sum, slice) => sum + Math.max(1, Math.ceil(slice.length / GRASS_SPACING)) * GRASS_ROWS, 0),
  );
  if (estimated <= 1) return null;

  const geometry = createBladeGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.96,
    metalness: 0,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, estimated);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const axis = new THREE.Vector3(0, 0, 1);

  let instance = 0;
  let globalSample = 0;
  for (const slice of slices) {
    const surfaceAngle = Math.atan2(slice.end.y - slice.start.y, slice.end.x - slice.start.x);
    const samples = Math.max(1, Math.ceil(slice.length / GRASS_SPACING));
    for (let sample = 0; sample < samples; sample += 1) {
      const baseT = (sample + 0.5) / samples;
      for (let row = 0; row < GRASS_ROWS; row += 1) {
        if (instance >= estimated) break;
        const seedIndex = globalSample * 17 + row * 31;
        const jitter = (pseudoRandom(103, seedIndex) - 0.5) / samples;
        const t = THREE.MathUtils.clamp(baseT + jitter, 0, 1);
        const randomA = pseudoRandom(211, seedIndex + 1);
        const randomB = pseudoRandom(307, seedIndex + 2);
        const randomC = pseudoRandom(419, seedIndex + 3);
        const x = THREE.MathUtils.lerp(slice.start.x, slice.end.x, t);
        const y = THREE.MathUtils.lerp(slice.start.y, slice.end.y, t);
        const depth = row === 0
          ? frontZ + 0.25 + randomA * 0.55
          : frontZ - row * 5.2 - randomA * 3.6;

        position.set(x, y + 0.08, depth);
        quaternion.setFromAxisAngle(axis, surfaceAngle + (randomB - 0.5) * 0.42);
        scale.set(
          0.7 + randomA * 0.85,
          2.5 + randomC * 3.7 - row * 0.16,
          1,
        );
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(instance, matrix);

        color.setHSL(
          0.285 + randomB * 0.045,
          0.72 + randomA * 0.18,
          0.22 + randomC * 0.13 - row * 0.008,
        );
        mesh.setColorAt(instance, color);
        instance += 1;
      }
      globalSample += 1;
    }
  }

  mesh.count = instance;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
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
  if (slices.length === 0) return group;

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

  const rim = new THREE.Mesh(rimBuilder.build(), textured(textures.grassFront, { surface: 'grass' }));
  const band = new THREE.Mesh(bandBuilder.build(), textured(textures.dirtBand, { surface: 'band' }));
  const dirt = new THREE.Mesh(dirtBuilder.build(), textured(textures.dirtChecker, { surface: 'dirt' }));
  const caps = new THREE.Mesh(capBuilder.build(), textured(textures.dirtChecker, { surface: 'dirt' }));
  const bottom = new THREE.Mesh(
    bottomBuilder.build(),
    new THREE.MeshStandardMaterial({ color: 0x321506, side: THREE.DoubleSide, roughness: 0.96, metalness: 0 }),
  );
  const grass = new THREE.Mesh(grassBuilder.build(), textured(textures.grassTop, { surface: 'grass' }));
  group.add(rim, band, dirt, caps, bottom, grass);

  const blades = buildBlades(points, frontZ);
  if (blades) group.add(blades);

  group.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });

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
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.55,
    bevelThickness: 0.55,
  });
  geometry.translate(0, 0, frontZ);

  const mesh = new THREE.Mesh(geometry, textured(textures.dirtChecker, { surface: 'dirt' }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
};

/**
 * Builds the real-3D Green Hill terrain visual for a terrain definition.
 * Solid platforms are rendered as two-point paths so they get the same
 * textured faces, caps, underside and vegetation system.
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
