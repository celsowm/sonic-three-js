import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Player } from './Player';

export class Badnik extends Entity {
  public patrolLeft: number;
  public patrolRight: number;
  public direction: number = 1;
  public speed: number = 1;

  constructor(x: number, y: number, patrolDistance: number = 50) {
    super(x, y, 12, 12);
    this.patrolLeft = x - patrolDistance;
    this.patrolRight = x + patrolDistance;

    const geometry = new THREE.BoxGeometry(12, 12, 12);
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    this.x += this.speed * this.direction * deltaTime;
    if (this.x > this.patrolRight) {
      this.direction = -1;
    } else if (this.x < this.patrolLeft) {
      this.direction = 1;
    }
    this.syncMesh();
  }

  public onCollision(other: Entity): void {
    if (other instanceof Player && !this.destroyFlag) {
      // Very basic collision rule: If player is falling/rolling, badnik dies. Otherwise player loses rings.
      if (other.velocityY < 0 || other.isRolling) {
        this.destroyFlag = true;
        other.score += 100;
        // Bounce player
        other.velocityY = 5;
      } else {
        // Player gets hit
        if (other.rings > 0) {
          other.rings = 0; // Drop rings
          // push back
          other.velocityX = -Math.sign(other.velocityX) * 5;
          other.velocityY = 4;
        } else {
          // Die (simplified, just reset position)
          other.x = 0;
          other.y = 10;
          other.velocityX = 0;
          other.velocityY = 0;
        }
      }
    }
  }
}
