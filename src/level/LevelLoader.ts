import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Terrain } from '../core/Terrain';
import { Stage } from '../entities/Stage';
import { Player } from '../entities/Player';
import { Ring } from '../entities/Ring';
import { Badnik } from '../entities/Badnik';
import { Monitor } from '../entities/Monitor';
import { FinishSign } from '../entities/FinishSign';
import { Spring } from '../entities/Spring';
import { Checkpoint } from '../entities/Checkpoint';
import { SceneryElement } from '../entities/SceneryElement';
import {
  GREEN_HILL_TERRAIN_TEXTURE_KEYS,
  createGreenHill3DTerrain,
} from './greenHillTerrain3D';
import type { GreenHillTerrainTextures } from './greenHillTerrain3D';
import type {
  AssetReferenceDefinition,
  BackgroundLayerDefinition,
  CloudFieldBackgroundDefinition,
  DecorationDefinition,
  GameplayEntityDefinition,
  GradientBandBackgroundDefinition,
  LevelDefinition,
  ModelDecorationDefinition,
  ModelScatterDecorationDefinition,
  PathTerrainDefinition,
  RidgeBandBackgroundDefinition,
  TerrainDefinition,
} from './LevelDefinition';

export interface LevelLoadResult {
  player: Player;
}

export interface LevelLoaderOptions {
  /**
   * Base URL that hosts the engine's `assets/` directory, for consumers that
   * bundle assets separately (e.g. `https://cdn.example.com/sonic-assets`).
   * Defaults to the assets bundled next to the library.
   */
  assetBase?: string;
  /** Reports incremental loading progress of all async assets of a level. */
  onProgress?: (loaded: number, total: number) => void;
  /** Injected texture loader, e.g. a mock in tests. */
  textureLoader?: THREE.TextureLoader;
}

interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

const isGltfLoader = (value: unknown): value is GLTFLoader =>
  typeof value === 'object' && value !== null && 'load' in value;

const seededUnit = (seed: number, index: number): number => {
  const value = Math.sin(seed * 91.345 + index * 12.9898) * 43758.5453123;
  return value - Math.floor(value);
};

/** Swaps PBR materials for unlit ones so baked/color-authored props stay exact. */
const makeModelUnlit = (root: THREE.Object3D): void => {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }

    const convert = (value: THREE.Material): THREE.MeshBasicMaterial => {
      const source = value as THREE.MeshStandardMaterial;
      return new THREE.MeshBasicMaterial({
        map: source.map ?? null,
        color: source.color?.clone() ?? new THREE.Color(0xffffff),
        side: source.side,
        transparent: source.transparent,
        opacity: source.opacity,
        alphaTest: source.alphaTest,
      });
    };

    const material = node.material as THREE.Material | THREE.Material[];
    node.material = Array.isArray(material)
      ? material.map(convert)
      : convert(material);
  });
};

const configureShadowing = (
  root: THREE.Object3D,
  castShadow: boolean,
  receiveShadow: boolean,
): void => {
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = castShadow;
    node.receiveShadow = receiveShadow;
  });
};

export class LevelLoader {
  private readonly gltfLoader: GLTFLoader;
  private readonly options: LevelLoaderOptions;
  private readonly textureLoader: THREE.TextureLoader;
  private readonly modelCache = new Map<string, Promise<LoadedModel>>();
  private readonly textureCache = new Map<string, Promise<THREE.Texture>>();

  constructor(
    optionsOrLoader: LevelLoaderOptions | GLTFLoader = {},
    maybeOptions: LevelLoaderOptions = {},
  ) {
    if (isGltfLoader(optionsOrLoader)) {
      this.gltfLoader = optionsOrLoader;
      this.options = maybeOptions;
    } else {
      this.gltfLoader = new GLTFLoader();
      this.options = optionsOrLoader;
    }
    this.textureLoader = this.options.textureLoader ?? new THREE.TextureLoader();
  }

  public async load(stage: Stage, level: LevelDefinition): Promise<LevelLoadResult> {
    const textureEntries = Object.entries(level.theme.textures ?? {});
    // Every decoration definition is asset-backed. model-scatter may create many
    // copies, but the cache still fetches its source GLB only once.
    const totalLoads = level.decorations.length + textureEntries.length + (level.player.model ? 1 : 0);
    let completedLoads = 0;
    const track = <T>(promise: Promise<T>): Promise<T> => promise.finally(() => {
      completedLoads += 1;
      this.options.onProgress?.(completedLoads, totalLoads);
    });

    this.options.onProgress?.(0, totalLoads);

    stage.configureCamera({
      followOffsetX: level.camera.followOffsetX,
      followOffsetY: level.camera.followOffsetY,
    });
    stage.engine.renderer.setVisibleHeight(level.camera.visibleHeight);
    stage.engine.renderer.configureEnvironment(level.theme.environment);
    stage.engine.renderer.scene.background = new THREE.Color(level.theme.skyColor);

    for (const layer of level.background) {
      stage.engine.renderer.scene.add(this.createBackgroundLayer(layer));
    }

    const themeTextures = new Map<string, THREE.Texture>();
    if (textureEntries.length > 0) {
      const loaded = await Promise.all(textureEntries.map(([name, definition]) =>
        track(this.loadTexture(this.assetUrl(definition))).then(texture => [name, texture] as const),
      ));
      for (const [name, texture] of loaded) {
        themeTextures.set(name, texture);
      }
    }

    const terrain = stage.engine.terrain;
    terrain.clear();
    for (const terrainDefinition of level.terrain) {
      const visual = this.createTerrain(terrainDefinition, level, themeTextures);
      if (visual) {
        configureShadowing(visual, true, true);
        stage.engine.renderer.scene.add(visual);
      }
      if (!(terrainDefinition.type === 'path' && terrainDefinition.visualOnly)) {
        this.addTerrainCollision(terrain, terrainDefinition);
      }
    }

    const player = new Player(level.player.x, level.player.y);
    if (level.spawn) {
      player.spawnX = level.spawn.x;
      player.spawnY = level.spawn.y;
    }
    player.deathY = level.deathY ?? this.defaultDeathY(level);
    stage.addEntity(player);

    if (level.player.model === 'classic-sonic-runners') {
      await track(this.loadClassicSonicModel(player));
    }

    for (const entity of level.entities) {
      stage.addEntity(this.createGameplayEntity(entity));
    }

    await Promise.all(level.decorations.map(decoration =>
      track(this.addDecoration(stage, level, decoration)),
    ));

    return { player };
  }

  private createGameplayEntity(definition: GameplayEntityDefinition) {
    switch (definition.type) {
      case 'ring':
        return new Ring(definition.x, definition.y);
      case 'badnik':
        return new Badnik(definition.x, definition.y, definition.patrolDistance ?? 50);
      case 'monitor':
        return new Monitor(definition.x, definition.y, definition.monitorType ?? 'rings');
      case 'finish-sign':
        return new FinishSign(definition.x, definition.y);
      case 'spring':
        return new Spring(definition.x, definition.y, {
          direction: definition.direction,
          force: definition.force,
        });
      case 'checkpoint':
        return new Checkpoint(definition.x, definition.y);
      default: {
        const unknown = definition as { type: string };
        throw new Error(`Unknown gameplay entity type "${unknown.type}" in level data.`);
      }
    }
  }

  private createBackgroundLayer(definition: BackgroundLayerDefinition): THREE.Object3D {
    switch (definition.type) {
      case 'color-band': {
        const geometry = new THREE.PlaneGeometry(definition.width, definition.height);
        const material = new THREE.MeshBasicMaterial({ color: definition.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(definition.x, definition.y, definition.z);
        return mesh;
      }
      case 'gradient-band':
        return this.createGradientBand(definition);
      case 'ridge-band':
        return this.createRidgeBand(definition);
      case 'cloud-field':
        return this.createCloudField(definition);
      default: {
        const unknown = definition as { type: string };
        throw new Error(`Unknown background layer type "${unknown.type}".`);
      }
    }
  }

  private createGradientBand(definition: GradientBandBackgroundDefinition): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(definition.width, definition.height);
    const positions = geometry.getAttribute('position');
    const top = new THREE.Color(definition.topColor);
    const bottom = new THREE.Color(definition.bottomColor);
    const colors: number[] = [];

    for (let index = 0; index < positions.count; index += 1) {
      const normalized = THREE.MathUtils.clamp(positions.getY(index) / definition.height + 0.5, 0, 1);
      const color = bottom.clone().lerp(top, normalized);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
    );
    mesh.position.set(definition.x, definition.y, definition.z);
    mesh.renderOrder = -1000;
    return mesh;
  }

  private createRidgeBand(definition: RidgeBandBackgroundDefinition): THREE.Mesh {
    const segments = Math.max(4, definition.segments ?? 32);
    const roughness = THREE.MathUtils.clamp(definition.roughness ?? 0.45, 0, 1);
    const seed = definition.seed ?? 1;
    const shape = new THREE.Shape();
    const left = -definition.width / 2;
    const bottom = -definition.height / 2;

    shape.moveTo(left, bottom);
    for (let index = 0; index <= segments; index += 1) {
      const t = index / segments;
      const x = left + definition.width * t;
      const wave = 0.5 + 0.22 * Math.sin(t * Math.PI * 5 + seed);
      const detail = (seededUnit(seed, index) - 0.5) * roughness * 0.42;
      const normalizedHeight = THREE.MathUtils.clamp(wave + detail, 0.18, 0.95);
      shape.lineTo(x, bottom + definition.height * normalizedHeight);
    }
    shape.lineTo(definition.width / 2, bottom);
    shape.closePath();

    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: definition.color }),
    );
    mesh.position.set(definition.x, definition.y, definition.z);
    mesh.renderOrder = -500;
    return mesh;
  }

  private createCloudField(definition: CloudFieldBackgroundDefinition): THREE.InstancedMesh {
    const lobesPerCloud = 4;
    const geometry = new THREE.SphereGeometry(1, 10, 7);
    const material = new THREE.MeshBasicMaterial({
      color: definition.color ?? 0xf8fcff,
      fog: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, definition.count * lobesPerCloud);
    const seed = definition.seed ?? 1;
    const minScale = definition.minScale ?? 8;
    const maxScale = Math.max(minScale, definition.maxScale ?? 18);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();

    let instanceIndex = 0;
    for (let cloudIndex = 0; cloudIndex < definition.count; cloudIndex += 1) {
      const rx = seededUnit(seed, cloudIndex * 5 + 1);
      const ry = seededUnit(seed, cloudIndex * 5 + 2);
      const rs = seededUnit(seed, cloudIndex * 5 + 3);
      const baseX = definition.x + (rx - 0.5) * definition.width;
      const baseY = definition.y + (ry - 0.5) * definition.height;
      const baseScale = THREE.MathUtils.lerp(minScale, maxScale, rs);
      const lobeOffsets = [
        [-0.55, -0.05, 0.95, 0.55],
        [0, 0.18, 1.18, 0.72],
        [0.58, 0.02, 0.92, 0.58],
        [0.12, -0.18, 1.35, 0.48],
      ] as const;

      for (const [offsetX, offsetY, scaleX, scaleY] of lobeOffsets) {
        position.set(
          baseX + offsetX * baseScale,
          baseY + offsetY * baseScale,
          definition.z + seededUnit(seed, instanceIndex + 99) * 8,
        );
        scale.set(baseScale * scaleX, baseScale * scaleY, baseScale * 0.28);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(instanceIndex, matrix);
        instanceIndex += 1;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = -200;
    return mesh;
  }

  private defaultDeathY(level: LevelDefinition): number {
    let lowest = 0;
    for (const terrain of level.terrain) {
      if (terrain.type === 'solid-platform') {
        lowest = Math.min(lowest, terrain.y - terrain.height);
      } else {
        for (const point of terrain.points) {
          lowest = Math.min(lowest, point.y);
        }
      }
    }
    return lowest - 250;
  }

  private addTerrainCollision(terrain: Terrain, definition: TerrainDefinition): void {
    if (definition.type === 'solid-platform') {
      terrain.addSolidPlatform(definition.x, definition.y, definition.width, definition.height);
      return;
    }

    terrain.addPath(
      definition.points.map(point => ({ x: point.x, y: point.y })),
      definition.closed ?? false,
    );
  }

  private createTerrain(
    definition: TerrainDefinition,
    level: LevelDefinition,
    themeTextures: Map<string, THREE.Texture>,
  ): THREE.Object3D | null {
    const materialDefinition = level.theme.terrainMaterials[definition.material];
    if (!materialDefinition) {
      throw new Error(`Terrain material "${definition.material}" is not defined by theme "${level.theme.id}".`);
    }

    if (definition.type === 'path') {
      if (definition.collisionOnly) {
        return null;
      }
      if (level.theme.id === 'green-hill') {
        return createGreenHill3DTerrain(definition, this.greenHillTextures(level, themeTextures));
      }
      return this.createGenericPathVisual(definition, materialDefinition.color);
    }

    if (level.theme.id === 'green-hill' && definition.material === 'green-hill-grass') {
      return createGreenHill3DTerrain(definition, this.greenHillTextures(level, themeTextures));
    }

    const geometry = new THREE.PlaneGeometry(definition.width, definition.height);
    const material = new THREE.MeshStandardMaterial({
      color: materialDefinition.color,
      roughness: 0.88,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(definition.x, definition.y, definition.z ?? -20);
    return mesh;
  }

  private createGenericPathVisual(definition: PathTerrainDefinition, color: number): THREE.Object3D {
    const points = definition.points.map(point => new THREE.Vector2(point.x, point.y));
    const thickness = definition.thickness ?? 40;
    const material = new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
    });

    if (definition.closed) {
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
      return new THREE.Mesh(new THREE.ShapeGeometry(ring), material);
    }

    const shape = new THREE.Shape(points);
    for (let index = points.length - 1; index >= 0; index -= 1) {
      shape.lineTo(points[index].x, points[index].y - thickness);
    }
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    mesh.position.z = definition.z ?? -20;
    return mesh;
  }

  private async addDecoration(
    stage: Stage,
    level: LevelDefinition,
    definition: DecorationDefinition,
  ): Promise<void> {
    if (definition.type === 'model-scatter') {
      await this.addModelScatterDecoration(stage, level, definition);
      return;
    }
    await this.addModelDecoration(stage, level, definition);
  }

  private async addModelDecoration(
    stage: Stage,
    level: LevelDefinition,
    definition: ModelDecorationDefinition,
  ): Promise<void> {
    const source = await this.loadDecorationSource(level, definition.asset, definition.node);
    const mesh = source.clone(true);
    this.prepareDecorationMesh(mesh, definition);

    stage.addEntity(new SceneryElement(definition.x, definition.y, {
      mesh,
      scale: definition.scale ?? 1,
      offset: { x: 0, y: 0, z: definition.z ?? -20 },
      rotation: definition.rotation,
      width: 0,
      height: 0,
    }));
  }

  private async addModelScatterDecoration(
    stage: Stage,
    level: LevelDefinition,
    definition: ModelScatterDecorationDefinition,
  ): Promise<void> {
    const source = await this.loadDecorationSource(level, definition.asset, definition.node);
    const group = new THREE.Group();

    for (const instance of definition.instances) {
      const mesh = source.clone(true);
      this.prepareDecorationMesh(mesh, definition);
      mesh.position.set(instance.x, instance.y, instance.z ?? -20);
      mesh.scale.setScalar(instance.scale ?? 1);
      mesh.rotation.set(
        instance.rotation?.x ?? 0,
        instance.rotation?.y ?? 0,
        instance.rotation?.z ?? 0,
      );
      group.add(mesh);
    }

    stage.addEntity(new SceneryElement(0, 0, {
      mesh: group,
      width: 0,
      height: 0,
    }));
  }

  private prepareDecorationMesh(
    mesh: THREE.Object3D,
    definition: Pick<ModelDecorationDefinition, 'unlit' | 'castShadow' | 'receiveShadow'>,
  ): void {
    if (definition.unlit) {
      makeModelUnlit(mesh);
    }
    const lit = !definition.unlit;
    configureShadowing(
      mesh,
      definition.castShadow ?? lit,
      definition.receiveShadow ?? lit,
    );
  }

  private async loadDecorationSource(
    level: LevelDefinition,
    assetName: string,
    nodeName?: string,
  ): Promise<THREE.Object3D> {
    const asset = level.theme.decorations[assetName];
    if (!asset) {
      throw new Error(`Decoration asset "${assetName}" is not defined by theme "${level.theme.id}".`);
    }

    const model = await this.loadModel(this.assetUrl(asset));
    const source = nodeName ? model.scene.getObjectByName(nodeName) : model.scene;
    if (!source) {
      throw new Error(`Decoration asset "${assetName}" has no node named "${nodeName}".`);
    }
    return source;
  }

  private async loadClassicSonicModel(player: Player): Promise<void> {
    const url = this.assetUrl({
      path: 'models/sonic/classic-sonic-runners/classic-sonic-runners.glb',
      url: new URL('../../assets/models/sonic/classic-sonic-runners/classic-sonic-runners.glb', import.meta.url).href,
    });

    try {
      const model = await this.loadModel(url);
      configureShadowing(model.scene, true, true);
      player.setAnimatedModel(model.scene, model.animations, {
        scale: 8,
        offset: { x: 0, y: -5, z: 0 },
      });
    } catch (error) {
      console.warn('Failed to load Sonic Runners model, using placeholder player.', error);
    }
  }

  private greenHillTextures(
    level: LevelDefinition,
    themeTextures: Map<string, THREE.Texture>,
  ): GreenHillTerrainTextures {
    const pick = (key: string): THREE.Texture => {
      const texture = themeTextures.get(key);
      if (!texture) {
        throw new Error(`Theme "${level.theme.id}" is missing the "${key}" texture required by 3D terrain.`);
      }
      return texture;
    };
    return {
      dirtChecker: pick(GREEN_HILL_TERRAIN_TEXTURE_KEYS.dirtChecker),
      dirtBand: pick(GREEN_HILL_TERRAIN_TEXTURE_KEYS.dirtBand),
      grassTop: pick(GREEN_HILL_TERRAIN_TEXTURE_KEYS.grassTop),
      grassFront: pick(GREEN_HILL_TERRAIN_TEXTURE_KEYS.grassFront),
    };
  }

  private loadTexture(url: string): Promise<THREE.Texture> {
    if (!this.textureCache.has(url)) {
      this.textureCache.set(url, new Promise((resolve, reject) => {
        this.textureLoader.load(url, resolve, undefined, reject);
      }));
    }
    return this.textureCache.get(url)!;
  }

  /**
   * Resolves a theme asset reference. `path` entries are anchored at the
   * engine's bundled `assets/` directory (or `assetBase` when set), so they
   * keep working in any deployment layout; `url` entries are used verbatim.
   */
  private assetUrl(reference: AssetReferenceDefinition): string {
    if (reference.url !== undefined && reference.path === undefined) {
      return reference.url;
    }
    if (reference.path === undefined) {
      throw new Error('Asset reference must define either "path" or "url".');
    }
    if (this.options.assetBase) {
      return `${this.options.assetBase.replace(/\/+$/, '')}/${reference.path}`;
    }
    return new URL(`../../assets/${reference.path}`, import.meta.url).href;
  }

  private loadModel(url: string): Promise<LoadedModel> {
    if (!this.modelCache.has(url)) {
      this.modelCache.set(url, new Promise((resolve, reject) => {
        this.gltfLoader.load(url, gltf => {
          resolve({ scene: gltf.scene, animations: gltf.animations });
        }, undefined, reject);
      }));
    }

    return this.modelCache.get(url)!;
  }
}
