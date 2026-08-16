import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// Must mock THREE's WebGLRenderer before importing classes that use it
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor() {
      this.domElement = document.createElement('canvas');
    }
    setSize() {}
    render() {}
    dispose() {}
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

import { Engine } from '../src/core/Engine';
import { Entity } from '../src/entities/Entity';
import { SceneryElement } from '../src/entities/SceneryElement';
import * as THREE from 'three';

class TestEntity extends Entity {
  public updateMock = vi.fn();
  public collisionMock = vi.fn();

  update(deltaTime: number, engine: Engine): void {
    this.updateMock(deltaTime, engine);
  }

  onCollision(other: Entity): void {
    this.collisionMock(other);
  }
}

describe('Engine', () => {
  let container: HTMLDivElement;
  let engine: Engine;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'game-container';
    document.body.appendChild(container);
    engine = new Engine('game-container');
  });

  afterEach(() => {
    if (engine.entities.length || engine.renderer) {
      try {
        engine.destroy();
      } catch {
        // already destroyed in the test
      }
    }
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it('emits entityAdded and entityDestroyed events', () => {
    const added = vi.fn();
    const destroyed = vi.fn();
    engine.events.on('entityAdded', added);
    engine.events.on('entityDestroyed', destroyed);

    const entity = new TestEntity(0, 0, 10, 10);
    engine.addEntity(entity);
    expect(added).toHaveBeenCalledWith(entity);

    engine.removeEntity(entity);
    expect(destroyed).toHaveBeenCalledWith(entity);
    expect(engine.entities).toHaveLength(0);
  });

  it('garbage-collects entities flagged for destruction each step', () => {
    const entity = new TestEntity(0, 0, 10, 10);
    engine.addEntity(entity);

    entity.destroyFlag = true;
    engine.step();

    expect(engine.entities).toHaveLength(0);
  });

  it('runs one fixed update per 1/60s frame tick', () => {
    const entity = new TestEntity(0, 0, 10, 10);
    engine.addEntity(entity);

    engine.tick(1 / 60);
    expect(entity.updateMock).toHaveBeenCalledTimes(1);
    expect(entity.updateMock).toHaveBeenCalledWith(1, engine);

    // a long frame is clamped to 0.1s = 6 steps
    engine.tick(5);
    expect(entity.updateMock).toHaveBeenCalledTimes(7);
  });

  it('calls onUpdate frame callbacks after the fixed steps', () => {
    const frameCallback = vi.fn();
    const unsubscribe = engine.onUpdate(frameCallback);
    const entity = new TestEntity(0, 0, 10, 10);
    engine.addEntity(entity);

    engine.tick(1 / 60);
    expect(frameCallback).toHaveBeenCalledTimes(1);
    expect(entity.updateMock).toHaveBeenCalledTimes(1);

    unsubscribe();
    engine.tick(1 / 60);
    expect(frameCallback).toHaveBeenCalledTimes(1);
  });

  it('does not step or fire frame callbacks while paused', () => {
    const entity = new TestEntity(0, 0, 10, 10);
    engine.addEntity(entity);

    engine.pause();
    engine.tick(1 / 60);

    expect(entity.updateMock).not.toHaveBeenCalled();

    engine.resume();
    engine.tick(1 / 60);
    expect(entity.updateMock).toHaveBeenCalledTimes(1);
  });

  it('skips collision checks for non-collidable entities like scenery', () => {
    const scenery = new SceneryElement(0, 0, { width: 0, height: 0 });
    const entity = new TestEntity(0, 0, 10, 10);
    engine.addEntity(scenery);
    engine.addEntity(entity);

    engine.step();

    expect(entity.collisionMock).not.toHaveBeenCalled();
  });

  it('dispatches collisions between overlapping collidable entities', () => {
    const first = new TestEntity(0, 0, 10, 10);
    const second = new TestEntity(5, 0, 10, 10);
    engine.addEntity(first);
    engine.addEntity(second);

    engine.step();

    expect(first.collisionMock).toHaveBeenCalledWith(second);
    expect(second.collisionMock).toHaveBeenCalledWith(first);
  });

  it('destroy removes entities and input listeners', () => {
    const entity = new TestEntity(0, 0, 10, 10);
    engine.addEntity(entity);

    engine.destroy();

    expect(engine.entities).toHaveLength(0);
    // only the renderer's own lights remain in the scene
    const remaining = engine.renderer.scene.children;
    expect(remaining.every(child => child instanceof THREE.Light)).toBe(true);

    // input listeners are gone: key events no longer register
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    expect(engine.input.isDown('ArrowRight')).toBe(false);
  });
});
