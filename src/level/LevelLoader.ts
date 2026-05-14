import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Stage } from '../entities/Stage';
import { Player } from '../entities/Player';
import { Ring } from '../entities/Ring';
import { Badnik } from '../entities/Badnik';
import { Monitor } from '../entities/Monitor';
import { FinishSign } from '../entities/FinishSign';
import { SceneryElement } from '../entities/SceneryElement';
import { createGreenHillRuntimeArt, createGreenHillTerrainVisual } from './greenHillRuntimeArt';
import type {
  BackgroundLayerDefinition,
  DecorationDefinition,
  GameplayEntityDefinition,
  LevelDefinition,
  ModelDecorationDefinition,
  RuntimeDecorationDefinition,
  TerrainDefinition,
} from './LevelDefinition';

export interface LevelLoadResult {
  player: Player;
}

export class LevelLoader {
  private readonly gltfLoader: GLTFLoader;
  private readonly modelCache = new Map<string, Promise<THREE.Group>>();

  constructor(gltfLoader = new GLTFLoader()) {
    this.gltfLoader = gltfLoader;
  }

  public async load(stage: Stage, level: LevelDefinition): Promise<LevelLoadResult> {
    stage.configureCamera({
      followOffsetX: level.camera.followOffsetX,
      followOffsetY: level.camera.followOffsetY,
    });
    stage.engine.renderer.setVisibleHeight(level.camera.visibleHeight);
    stage.engine.renderer.scene.background = new THREE.Color(level.theme.skyColor);

    for (const layer of level.background) {
      stage.engine.renderer.scene.add(this.createBackgroundLayer(layer));
    }

    for (const terrain of level.terrain) {
      stage.engine.renderer.scene.add(this.createTerrain(terrain, level));
    }

    const player = new Player(level.player.x, level.player.y);
    stage.addEntity(player);

    if (level.player.model === 'classic-sonic-runners') {
      this.loadClassicSonicModel(player);
    }

    for (const entity of level.entities) {
      stage.addEntity(this.createGameplayEntity(entity));
    }

    await Promise.all(level.decorations.map(decoration => this.addDecoration(stage, level, decoration)));

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
    }
  }

  private createBackgroundLayer(definition: BackgroundLayerDefinition): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(definition.width, definition.height);
    const material = new THREE.MeshBasicMaterial({ color: definition.color });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(definition.x, definition.y, definition.z);
    return mesh;
  }

  private createTerrain(definition: TerrainDefinition, level: LevelDefinition): THREE.Object3D {
    const materialDefinition = level.theme.terrainMaterials[definition.material];
    if (!materialDefinition) {
      throw new Error(`Terrain material "${definition.material}" is not defined by theme "${level.theme.id}".`);
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
      mesh: model.clone(true),
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

  private loadClassicSonicModel(player: Player): void {
    const url = new URL(
      '../../assets/models/sonic/classic-sonic-runners/classic-sonic-runners.glb',
      import.meta.url,
    ).href;

    this.gltfLoader.load(
      url,
      gltf => {
        player.setAnimatedModel(gltf.scene, gltf.animations, {
          scale: 8,
          offset: { x: 0, y: -5, z: 0 },
        });
      },
      undefined,
      error => {
        console.warn('Failed to load Sonic Runners model, using placeholder player.', error);
      },
    );
  }

  private loadModel(url: string): Promise<THREE.Group> {
    if (!this.modelCache.has(url)) {
      this.modelCache.set(url, new Promise((resolve, reject) => {
        this.gltfLoader.load(url, gltf => resolve(gltf.scene), undefined, reject);
      }));
    }

    return this.modelCache.get(url)!;
  }
}
