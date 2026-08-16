import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Player } from './Player';

/** The goal sign; passing it emits the stageCleared event. */
export class FinishSign extends Entity {
  public passed: boolean = false;

  private engine: Engine | null = null;

  constructor(x: number, y: number) {
    super(x, y, 20, 40);

    const group = new THREE.Group();

    // Pole
    const poleGeo = new THREE.CylinderGeometry(1, 1, 40);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    group.add(pole);

    // Sign
    const signGeo = new THREE.PlaneGeometry(16, 16);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.y = 10;
    group.add(sign);

    this.mesh = group;
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    this.engine = engine;

    if (this.passed && this.mesh) {
      // Spin the sign
      const sign = this.mesh.children[1];
      if (sign) {
        sign.rotation.y += 0.2 * deltaTime;
      }
    }
  }

  public onCollision(other: Entity): void {
    if (other instanceof Player && !this.passed) {
      this.passed = true;

      const sign = this.mesh?.children[1] as THREE.Mesh | undefined;
      if (sign) {
        (sign.material as THREE.MeshBasicMaterial).color.setHex(0xff0000);
      }

      this.engine?.events.emit('stageCleared', { score: other.score, rings: other.rings });
    }
  }
}
