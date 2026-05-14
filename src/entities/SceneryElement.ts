import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';

export interface SceneryElementOptions {
  mesh?: THREE.Object3D;
  width?: number;
  height?: number;
  scale?: number;
  offset?: THREE.Vector3Like;
  rotation?: {
    x?: number;
    y?: number;
    z?: number;
  };
}

export class SceneryElement extends Entity {
  private readonly root: THREE.Group;

  constructor(x: number, y: number, options: SceneryElementOptions = {}) {
    super(x, y, options.width ?? 0, options.height ?? 0);

    this.root = new THREE.Group();
    this.mesh = this.root;

    if (options.mesh) {
      this.setModel(options.mesh, options);
    }

    this.syncMesh();
  }

  public setModel(model: THREE.Object3D, options: SceneryElementOptions = {}): void {
    this.root.clear();
    this.root.add(model);

    const scale = options.scale ?? 1;
    model.scale.setScalar(scale);
    model.position.set(
      options.offset?.x ?? 0,
      options.offset?.y ?? 0,
      options.offset?.z ?? 0,
    );
    model.rotation.set(
      options.rotation?.x ?? 0,
      options.rotation?.y ?? 0,
      options.rotation?.z ?? 0,
    );
  }

  public update(_deltaTime: number, _engine: Engine): void {
    this.syncMesh();
  }

  public onCollision(_other: Entity): void {
    // Decorative scenery is intentionally non-interactive.
  }
}
