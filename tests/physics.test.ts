import { describe, it, expect, beforeEach } from 'vitest';
import { Physics } from '../src/core/Physics';
import { Entity } from '../src/entities/Entity';
import { Engine } from '../src/core/Engine';

class TestEntity extends Entity {
  constructor(x: number, y: number, w: number, h: number) {
    super(x, y, w, h);
  }
  update(dt: number, engine: Engine): void {}
  onCollision(other: Entity): void {}
}

describe('Physics', () => {
  let physics: Physics;

  beforeEach(() => {
    physics = new Physics({ gravity: 0.5, maxVelocityY: 10 });
  });

  it('should apply gravity to ungrounded entity', () => {
    const entity = new TestEntity(0, 10, 10, 10);
    entity.isGrounded = false;
    entity.velocityY = 0;

    physics.applyGravity(entity, 1);
    expect(entity.velocityY).toBe(-0.5);
  });

  it('should not apply gravity to grounded entity', () => {
    const entity = new TestEntity(0, 0, 10, 10);
    entity.isGrounded = true;
    entity.velocityY = 0;

    physics.applyGravity(entity, 1);
    expect(entity.velocityY).toBe(0);
  });

  it('should apply velocity and clamp to max', () => {
    const entity = new TestEntity(0, 0, 10, 10);
    entity.velocityX = 5;
    entity.velocityY = 15; // exceeds max 10

    physics.applyVelocity(entity, 1);

    expect(entity.x).toBe(5);
    expect(entity.y).toBe(10); // clamped to 10
    expect(entity.velocityY).toBe(10);
  });

  it('should detect AABB collision correctly', () => {
    const e1 = new TestEntity(0, 0, 10, 10);
    const e2 = new TestEntity(5, 5, 10, 10);
    const e3 = new TestEntity(20, 20, 10, 10);

    expect(physics.checkAABBCollision(e1, e2)).toBe(true);
    expect(physics.checkAABBCollision(e1, e3)).toBe(false);
  });
});
