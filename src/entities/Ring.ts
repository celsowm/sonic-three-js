import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Player } from './Player';

export class Ring extends Entity {
  constructor(x: number, y: number) {
    super(x, y, 8, 8);

    const geometry = new THREE.TorusGeometry(3.2, 0.65, 8, 24);
    const material = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    if (this.mesh) {
      this.mesh.rotation.y += 0.05 * deltaTime;
    }
  }

  public onCollision(other: Entity): void {
    if (other instanceof Player && !this.destroyFlag) {
      this.destroyFlag = true;
      other.rings++;
      other.score += 10;
      // Tell engine to remove this
    }
  }
}
