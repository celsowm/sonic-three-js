import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Player } from './Player';

/** A checkpoint lamp post that sets the player's respawn point. */
export class Checkpoint extends Entity {
  public passed: boolean = false;

  private engine: Engine | null = null;
  private spinTime = 0;
  private readonly headGroup: THREE.Group;

  constructor(x: number, y: number) {
    super(x, y, 8, 44);

    this.mesh = this.buildPost();
    this.headGroup = this.mesh!.children[1] as THREE.Group;
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    this.engine = engine;

    if (this.passed) {
      // spin the head for a while after activation
      if (this.spinTime > 0) {
        this.spinTime -= deltaTime;
        this.headGroup.rotation.y += 0.35 * deltaTime;
      }
    }
  }

  public onCollision(other: Entity): void {
    if (other instanceof Player && !this.passed && !other.isDead) {
      this.passed = true;
      this.spinTime = 40;

      other.spawnX = this.x;
      other.spawnY = this.y + 10;

      const head = this.headGroup.children[0] as THREE.Mesh;
      (head.material as THREE.MeshLambertMaterial).color.setHex(0xd6301f);

      this.engine?.events.emit('checkpointReached', { checkpoint: this });
    }
  }

  private buildPost(): THREE.Group {
    const group = new THREE.Group();

    // pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 42, 10),
      new THREE.MeshLambertMaterial({ color: 0xbfc7cc }),
    );
    pole.position.y = 21;
    group.add(pole);

    const head = new THREE.Group();

    // ball head, blue until activated
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(4, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0x2266cc }),
    );
    ball.position.y = 44;
    head.add(ball);

    group.add(head);
    return group;
  }
}
