import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TerrainDefinition } from './LevelDefinition';
import { Stage } from '../entities/Stage';
import { Player } from '../entities/Player';
import { Ring } from '../entities/Ring';
import { Badnik } from '../entities/Badnik';
import { Monitor } from '../entities/Monitor';
import { FinishSign } from '../entities/FinishSign';
import { Spring } from '../entities/Spring';
import { Checkpoint } from '../entities/Checkpoint';
import { SceneryElement } from '../entities/SceneryElement';
import type { Terrain } from '../core/Terrain';
import { createGreenHillRuntimeArt, createGreenHillTerrainVisual } from './greenHillRuntimeArt';
import type {
  BackgroundLayerDefinition,
  DecorationDefinition,
  GameplayEntityDefinition,
  LevelDefinition,
  ModelDecorationDefinition,
  PathTerrainDefinition,
  RuntimeDecorationDefinition,
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
}

interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export class LevelLoader {
  private readonly gltfLoader: GLTFLoader;
  private readonly options: LevelLoaderOptions;
  private readonly modelCache = new Map<string, Promise<LoadedModel>>();

  constructor(gltfLoader = new GLTFLoader(), options: LevelLoaderOptions = {}) {
    this.gltfLoader = gltfLoader;
    this.options = options;
  }

  public async load(stage: Stage, level: LevelDefinition): Promise<LevelLoadResult> {
    const modelDecorationCount = level.decorations.filter(
      decoration => decoration.type === 'model',
    ).length;
    const totalLoads = modelDecorationCount + (level.player.model ? 1 : 0);
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
    stage.engine.renderer.scene.background = new THREE.Color(level.theme.skyColor);

    for (const layer of level.background) {
      stage.engine.renderer.scene.add(this.createBackgroundLayer(layer));
    }

    const terrain = stage.engine.terrain;
    terrain.clear();
    for (const terrainDefinition of level.terrain) {
      stage.engine.renderer.scene.add(this.createTerrain(terrainDefinition, level));
      this.addTerrainCollision(terrain, terrainDefinition);
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

    await Promise.all(level.decorations.map(decoration => {
      const loaded = this.addDecoration(stage, level, decoration);
      return decoration.type === 'model' ? track(loaded) : loaded;
    }));

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

  private createBackgroundLayer(definition: BackgroundLayerDefinition): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(definition.width, definition.height);
    const material = new THREE.MeshBasicMaterial({ color: definition.color });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(definition.x, definition.y, definition.z);
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

  private createTerrain(definition: TerrainDefinition, level: LevelDefinition): THREE.Object3D {
    const materialDefinition = level.theme.terrainMaterials[definition.material];
    if (!materialDefinition) {
      throw new Error(`Terrain material "${definition.material}" is not defined by theme "${level.theme.id}".`);
    }

    if (definition.type === 'path') {
      if (level.theme.id === 'green-hill') {
        const visual = createGreenHillTerrainVisual(definition);
        visual.position.z = definition.z ?? -20;
        return visual;
      }
      return this.createGenericPathVisual(definition, materialDefinition.color);
    }

    if (level.theme.id === 'green-hill' && definition.material === 'green-hill-grass') {
      const terrain = createGreenHillTerrainVisual(definition);
      terrain.position.set(definition.x, definition.y, definition.z ?? -20);
      return terrain;
    }

    const geometry = new THREE.PlaneGeometry(definition.width, definition.height);
    const material = new THREE.MeshLambertMaterial({ color: materialDefinition.color });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(definition.x, definition.y, definition.z ?? -20);
    return mesh;
  }

  private createGenericPathVisual(definition: PathTerrainDefinition, color: number): THREE.Object3D {
    const points = definition.points.map(point => new THREE.Vector2(point.x, point.y));
    const thickness = definition.thickness ?? 40;

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
      return new THREE.Mesh(
        new THREE.ShapeGeometry(ring),
        new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
      );
    }

    const shape = new THREE.Shape(points);
    for (let index = points.length - 1; index >= 0; index -= 1) {
      shape.lineTo(points[index].x, points[index].y - thickness);
    }
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }),
    );
    mesh.position.z = definition.z ?? -20;
    return mesh;
  }

  private async addDecoration(
    stage: Stage,
    level: LevelDefinition,
    definition: DecorationDefinition,
  ): Promise<void> {
    if (definition.type === 'runtime-art') {
      this.addRuntimeDecoration(stage, definition);
      return;
    }

    await this.addModelDecoration(stage, level, definition);
  }

  private async addModelDecoration(
    stage: Stage,
    level: LevelDefinition,
    definition: ModelDecorationDefinition,
  ): Promise<void> {
    const asset = level.theme.decorations[definition.asset];
    if (!asset) {
      throw new Error(`Decoration asset "${definition.asset}" is not defined by theme "${level.theme.id}".`);
    }

    const model = await this.loadModel(asset.url);
    stage.addEntity(new SceneryElement(definition.x, definition.y, {
      mesh: model.scene.clone(true),
      scale: definition.scale ?? 1,
      offset: { x: 0, y: 0, z: definition.z ?? -20 },
      rotation: definition.rotation,
      width: 0,
      height: 0,
    }));
  }

  private addRuntimeDecoration(stage: Stage, definition: RuntimeDecorationDefinition): void {
    const art = createGreenHillRuntimeArt(definition.art);
    stage.addEntity(new SceneryElement(definition.x, definition.y, {
      mesh: art,
      scale: definition.scale ?? 1,
      offset: { x: 0, y: 0, z: definition.z ?? -20 },
      rotation: definition.rotation,
      width: 0,
      height: 0,
    }));
  }

  private async loadClassicSonicModel(player: Player): Promise<void> {
    const url = this.resolveAssetUrl(
      'models/sonic/classic-sonic-runners/classic-sonic-runners.glb',
      new URL('../../assets/models/sonic/classic-sonic-runners/classic-sonic-runners.glb', import.meta.url).href,
    );

    try {
      const model = await this.loadModel(url);
      player.setAnimatedModel(model.scene, model.animations, {
        scale: 8,
        offset: { x: 0, y: -5, z: 0 },
      });
    } catch (error) {
      console.warn('Failed to load Sonic Runners model, using placeholder player.', error);
    }
  }

  private resolveAssetUrl(pathRelativeToAssets: string, bundledUrl: string): string {
    if (this.options.assetBase) {
      return `${this.options.assetBase.replace(/\/+$/, '')}/${pathRelativeToAssets}`;
    }
    return bundledUrl;
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
