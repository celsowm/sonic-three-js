import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Player } from './Player';

export type SpringDirection = 'up' | 'up-right' | 'up-left';

export interface SpringOptions {
  direction?: SpringDirection;
  force?: number;
}

const DIRECTION_VECTORS: Record<SpringDirection, [number, number]> = {
  up: [0, 1],
  'up-right': [Math.SQRT1_2, Math.SQRT1_2],
  'up-left': [-Math.SQRT1_2, Math.SQRT1_2],
};

/** A classic red spring pad that launches the player. */
export class Spring extends Entity {
  public readonly direction: SpringDirection;
  public readonly force: number;

  private cooldown = 0;
  private squash = 0;
  private readonly topGroup: THREE.Group;

  constructor(x: number, y: number, options: SpringOptions = {}) {
    super(x, y, 18, 8);

    this.direction = options.direction ?? 'up';
    this.force = options.force ?? 12.5;

    this.mesh = this.buildSpring();
    this.topGroup = this.mesh!.children[1] as THREE.Group;
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    if (this.cooldown > 0) this.cooldown -= deltaTime;
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - 0.08 * deltaTime);
    }
    this.topGroup.scale.y = 1 - this.squash * 0.6;
    this.topGroup.position.y = 1 + this.squash * 1.5;
  }

  public onCollision(other: Entity): void {
    if (other instanceof Player && this.cooldown <= 0 && !other.isDead) {
      this.cooldown = 10;
      this.squash = 1;

      const [dx, dy] = DIRECTION_VECTORS[this.direction];
      other.launch(dx * this.force, dy * this.force);
    }
  }

  private buildSpring(): THREE.Group {
    const group = new THREE.Group();

    // base plate
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(18, 2, 8),
      new THREE.MeshLambertMaterial({ color: 0x777777 }),
    );
    base.position.y = 1;
    group.add(base);

    const top = new THREE.Group();

    // coil
    const coil = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 5, 12, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xcccccc, side: THREE.DoubleSide }),
    );
    coil.position.y = 2.5;
    top.add(coil);

    // red top pad
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(16, 2.5, 7),
      new THREE.MeshLambertMaterial({ color: 0xd6301f }),
    );
    pad.position.y = 6;
    top.add(pad);

    group.add(top);
    return group;
  }
}
