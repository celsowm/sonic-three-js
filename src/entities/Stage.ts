import * as THREE from 'three';
import { Engine } from '../core/Engine';
import type { EngineOptions } from '../core/Engine';
import { Entity } from './Entity';
import { Player } from './Player';

export interface StageOptions {
  engine?: EngineOptions;
  camera?: {
    followOffsetX?: number;
    followOffsetY?: number;
  };
}

export class Stage {
  public engine: Engine;
  public player: Player | null = null;
  private cameraFollowOffsetX: number;
  private cameraFollowOffsetY: number;
  private running = false;
  private detachFrameHook: (() => void) | null = null;

  constructor(containerId: string, options: StageOptions = {}) {
    this.engine = new Engine(containerId, options.engine);
    this.cameraFollowOffsetX = options.camera?.followOffsetX ?? 20;
    this.cameraFollowOffsetY = options.camera?.followOffsetY ?? 22;
  }

  public configureCamera(camera: NonNullable<StageOptions['camera']>): void {
    if (camera.followOffsetX !== undefined) {
      this.cameraFollowOffsetX = camera.followOffsetX;
    }
    if (camera.followOffsetY !== undefined) {
      this.cameraFollowOffsetY = camera.followOffsetY;
    }
  }

  public addEntity(entity: Entity): void {
    if (entity instanceof Player) {
      this.player = entity;
    }
    this.engine.addEntity(entity);
  }

  /** Removes every entity and all non-light scene content added by a loaded level. */
  public unload(): void {
    for (const entity of [...this.engine.entities]) {
      this.engine.removeEntity(entity);
    }

    const scene = this.engine.renderer.scene;
    for (const child of [...scene.children]) {
      if (!(child instanceof THREE.Light)) {
        scene.remove(child);
      }
    }

    this.engine.terrain.clear();
    this.player = null;
  }

  public updateCamera(): void {
    if (this.player) {
      this.engine.renderer.camera.position.x = this.player.x + this.cameraFollowOffsetX;
      this.engine.renderer.camera.position.y = this.player.y + this.cameraFollowOffsetY;
    }
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.detachFrameHook = this.engine.onUpdate(() => this.updateCamera());
    this.engine.start();
  }

  public pause(): void {
    this.engine.pause();
  }

  public resume(): void {
    this.engine.resume();
  }

  public get isPaused(): boolean {
    return this.engine.isPaused;
  }

  public destroy(): void {
    this.detachFrameHook?.();
    this.detachFrameHook = null;
    this.running = false;
    this.unload();
    this.engine.destroy();
  }
}
