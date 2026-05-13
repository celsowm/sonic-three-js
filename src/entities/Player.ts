import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';

export class Player extends Entity {
  public speed: number = 0.5;
  public jumpForce: number = 8;
  public isRolling: boolean = false;
  public rings: number = 0;
  public score: number = 0;

  constructor(x: number, y: number) {
    super(x, y, 10, 10);

    // Simple placeholder mesh
    const geometry = new THREE.SphereGeometry(5, 16, 16);
    const material = new THREE.MeshLambertMaterial({ color: 0x0000ff });
    this.mesh = new THREE.Mesh(geometry, material);
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    const input = engine.input;
    const physics = engine.physics;

    // Movement
    if (input.isDown('ArrowRight')) {
      this.velocityX += this.speed * deltaTime;
    } else if (input.isDown('ArrowLeft')) {
      this.velocityX -= this.speed * deltaTime;
    }

    // Jumping
    if (input.isDown('Space') && this.isGrounded) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }

    // Rolling (simplified: ducking triggers rolling state if moving fast)
    if (input.isDown('ArrowDown') && Math.abs(this.velocityX) > 2) {
      this.isRolling = true;
    } else if (!input.isDown('ArrowDown')) {
      this.isRolling = false;
    }

    // Apply physics
    physics.applyGravity(this, deltaTime);
    physics.applyFriction(this, deltaTime);
    physics.applyVelocity(this, deltaTime);

    // Basic floor collision at y=0
    if (this.y <= 0) {
      this.y = 0;
      this.velocityY = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    this.syncMesh();
  }

  public onCollision(other: Entity): void {
    // Handled in other entities (e.g. Ring, Badnik)
  }
}
