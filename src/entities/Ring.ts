import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Player } from './Player';

export interface RingOptions {
  /** Scattered rings arc out, bounce on terrain and expire. */
  scattered?: boolean;
  velocityX?: number;
  velocityY?: number;
  /** Frames before a scattered ring can be re-collected. */
  collectDelay?: number;
  /** Frames a scattered ring lives for. */
  lifetime?: number;
}

const GRAVITY = 0.18;
const BOUNCE_DAMPING = 0.6;

export class Ring extends Entity {
  private readonly scattered: boolean;
  private readonly lifetime: number;
  private remainingLife: number;
  private collectDelay: number;
  private engine: Engine | null = null;
  private sparkleTimer = 0;

  constructor(x: number, y: number, options: RingOptions = {}) {
    super(x, y, 8, 8);

    this.scattered = options.scattered ?? false;
    this.velocityX = options.velocityX ?? 0;
    this.velocityY = options.velocityY ?? 0;
    this.collectDelay = options.collectDelay ?? (this.scattered ? 20 : 0);
    this.lifetime = options.lifetime ?? (this.scattered ? 240 : Infinity);
    this.remainingLife = this.lifetime;

    const geometry = new THREE.TorusGeometry(3.2, 0.65, 8, 24);
    const material = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    this.engine = engine;

    if (this.collectDelay > 0) {
      this.collectDelay -= deltaTime;
    }

    if (this.scattered) {
      this.velocityY -= GRAVITY * deltaTime;
      this.x += this.velocityX * deltaTime;
      this.y += this.velocityY * deltaTime;

      const groundY = engine.terrain.groundBelow(this.x, this.y + 8);
      if (groundY !== null && this.y <= groundY && this.velocityY < 0) {
        this.y = groundY;
        this.velocityY = -this.velocityY * BOUNCE_DAMPING;
        this.velocityX *= 0.92;
        if (Math.abs(this.velocityY) < 0.8) {
          this.velocityY = 0;
          this.velocityX = 0;
        }
      }

      this.remainingLife -= deltaTime;
      if (this.remainingLife <= 0) {
        this.destroyFlag = true;
      } else if (this.remainingLife < 60) {
        // blink out at the end of its life
        this.sparkleTimer += deltaTime;
        if (this.mesh) {
          this.mesh.visible = Math.floor(this.sparkleTimer / 4) % 2 === 0;
        }
      }

      this.syncMesh();
    }

    if (this.mesh) {
      this.mesh.rotation.y += 0.05 * deltaTime;
    }
  }

  public onCollision(other: Entity): void {
    if (other instanceof Player && !this.destroyFlag && this.collectDelay <= 0) {
      this.destroyFlag = true;
      other.rings++;
      other.score += 10;
      this.engine?.events.emit('ringCollected', { total: other.rings, score: other.score });
    }
  }
}
