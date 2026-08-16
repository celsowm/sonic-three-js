import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Player } from './Player';

/** A Motobug-style patrolling enemy. */
export class Badnik extends Entity {
  public patrolLeft: number;
  public patrolRight: number;
  public direction: number = 1;
  public speed: number = 1;

  private engine: Engine | null = null;
  private animationTime: number = 0;
  private readonly bodyGroup: THREE.Group;

  constructor(x: number, y: number, patrolDistance: number = 50) {
    super(x, y, 14, 12);
    this.patrolLeft = x - patrolDistance;
    this.patrolRight = x + patrolDistance;

    this.bodyGroup = this.buildBody();
    this.mesh = this.bodyGroup;
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    this.engine = engine;
    this.animationTime += deltaTime;

    this.x += this.speed * this.direction * deltaTime;
    if (this.x > this.patrolRight) {
      this.direction = -1;
    } else if (this.x < this.patrolLeft) {
      this.direction = 1;
    }

    // face the travel direction and bob while rolling along
    this.bodyGroup.scale.x = this.direction;
    this.bodyGroup.children[0].position.y = Math.abs(Math.sin(this.animationTime * 0.3)) * 0.8;

    this.syncMesh();
  }

  public onCollision(other: Entity): void {
    if (other instanceof Player && !this.destroyFlag) {
      const player = other;
      const attacking = player.isRolling
        || player.invincibilityTimer > 0
        || (!player.isGrounded && player.velocityY < 0);

      if (attacking) {
        this.destroyFlag = true;
        player.score += 100;
        // bounce the player when stomping from above
        if (!player.isGrounded && player.invincibilityTimer <= 0) {
          player.launch(player.velocityX, 5);
        }
      } else {
        player.hurt(this.x);
      }
    }
  }

  private buildBody(): THREE.Group {
    const root = new THREE.Group();
    const bobbing = new THREE.Group();
    root.add(bobbing);

    // red shell
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xd6301f }),
    );
    shell.position.y = 3;
    bobbing.add(shell);

    // dark underside
    bobbing.add(new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 3, 16),
      new THREE.MeshLambertMaterial({ color: 0x4a1d10 }),
    ));

    // wheels
    const wheelGeometry = new THREE.CylinderGeometry(3.2, 3.2, 2.4, 12);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const frontWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    frontWheel.rotation.x = Math.PI / 2;
    frontWheel.position.set(4.5, -2.5, 0);
    bobbing.add(frontWheel);
    const rearWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    rearWheel.rotation.x = Math.PI / 2;
    rearWheel.position.set(-4, -2.5, 0);
    bobbing.add(rearWheel);

    // eyes on stalks
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const offset of [-2, 2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), eyeMaterial);
      eye.position.set(offset, 5.5, 5.5);
      bobbing.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), pupilMaterial);
      pupil.position.set(offset, 5.5, 6.9);
      bobbing.add(pupil);
    }

    // antenna
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 4, 6),
      new THREE.MeshLambertMaterial({ color: 0x666666 }),
    );
    antenna.position.y = 10;
    bobbing.add(antenna);

    return root;
  }
}
