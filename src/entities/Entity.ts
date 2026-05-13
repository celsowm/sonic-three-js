import * as THREE from 'three';
import { Engine } from '../core/Engine';

export abstract class Entity {
  public x: number = 0;
  public y: number = 0;
  public width: number = 10;
  public height: number = 10;

  public velocityX: number = 0;
  public velocityY: number = 0;

  public isGrounded: boolean = false;

  public mesh?: THREE.Object3D;

  public destroyFlag: boolean = false;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public abstract update(deltaTime: number, engine: Engine): void;
  public abstract onCollision(other: Entity): void;

  public syncMesh() {
    if (this.mesh) {
      this.mesh.position.x = this.x;
      this.mesh.position.y = this.y;
    }
  }
}
