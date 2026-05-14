import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneryElement } from '../src/entities/SceneryElement';
import { Entity } from '../src/entities/Entity';
import { Engine } from '../src/core/Engine';

class TestEntity extends Entity {
  constructor() {
    super(0, 0, 10, 10);
  }

  update(_dt: number, _engine: Engine): void {}
  onCollision(_other: Entity): void {}
}

describe('SceneryElement', () => {
  it('keeps decorative scenery synced to its world position', () => {
    const model = new THREE.Group();
    const scenery = new SceneryElement(25, -5, { mesh: model, scale: 0.35, rotation: { z: Math.PI / 4 } });

    expect(scenery.mesh).toBeInstanceOf(THREE.Group);
    expect(scenery.mesh?.position.x).toBe(25);
    expect(scenery.mesh?.position.y).toBe(-5);
    expect(model.scale.x).toBe(0.35);
    expect(model.scale.y).toBe(0.35);
    expect(model.scale.z).toBe(0.35);
    expect(model.rotation.z).toBe(Math.PI / 4);
  });

  it('does not mutate itself or other entities on collision', () => {
    const scenery = new SceneryElement(10, 20, { width: 0, height: 0 });
    const other = new TestEntity();

    scenery.velocityX = 4;
    scenery.velocityY = -2;
    scenery.onCollision(other);
    scenery.update(1, {} as Engine);

    expect(scenery.x).toBe(10);
    expect(scenery.y).toBe(20);
    expect(scenery.velocityX).toBe(4);
    expect(scenery.velocityY).toBe(-2);
    expect(scenery.destroyFlag).toBe(false);
    expect(other.destroyFlag).toBe(false);
  });
});
