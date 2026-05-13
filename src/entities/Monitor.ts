import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Player } from './Player';

export class Monitor extends Entity {
  public type: 'rings' | 'shield' | 'invincibility';

  constructor(x: number, y: number, type: 'rings' | 'shield' | 'invincibility' = 'rings') {
    super(x, y, 14, 14);
    this.type = type;

    const geometry = new THREE.BoxGeometry(14, 14, 14);
    const material = new THREE.MeshLambertMaterial({ color: 0x888888 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    // Static object, does not update
  }

  public onCollision(other: Entity): void {
    if (other instanceof Player && !this.destroyFlag) {
      if (other.velocityY < 0 || other.isRolling) {
        this.destroyFlag = true;
        other.velocityY = 4; // Bounce

        if (this.type === 'rings') {
          other.rings += 10;
        }
        // Apply shield or invincibility effects...
      } else {
        // Solid block behavior (simplified)
        other.velocityX = 0;
      }
    }
  }
}
