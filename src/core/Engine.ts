import { Renderer } from './Renderer';
import type { RendererOptions } from './Renderer';
import { Physics } from './Physics';
import { Input } from './Input';
import { Entity } from '../entities/Entity';
import { Emitter } from './events';

export interface EngineOptions {
  renderer?: RendererOptions;
}

export type EngineEvents = {
  entityAdded: Entity;
  entityDestroyed: Entity;
  entitiesCollided: { a: Entity; b: Entity };
};

export type FrameCallback = (deltaTime: number) => void;

/** Logic runs in fixed 1/60s steps so physics stays deterministic across frame rates. */
export const FIXED_TIMESTEP = 1 / 60;

const MAX_FRAME_TIME = 0.1;
const MAX_STEPS_PER_FRAME = Math.ceil(MAX_FRAME_TIME / FIXED_TIMESTEP);

export class Engine {
  public renderer: Renderer;
  public physics: Physics;
  public input: Input;
  public entities: Entity[] = [];
  public readonly events = new Emitter<EngineEvents>();

  private lastTime = 0;
  private accumulator = 0;
  private animationFrameId: number | null = null;
  private isRunning = false;
  private paused = false;
  private readonly boundLoop = this.loop.bind(this);
  private readonly frameCallbacks = new Set<FrameCallback>();

  constructor(containerId: string, options: EngineOptions = {}) {
    this.renderer = new Renderer(containerId, options.renderer);
    this.physics = new Physics();
    this.input = new Input();
  }

  /** Runs once per rendered frame, after that frame's fixed logic steps. */
  public onUpdate(callback: FrameCallback): () => void {
    this.frameCallbacks.add(callback);
    return () => this.frameCallbacks.delete(callback);
  }

  public addEntity(entity: Entity): void {
    this.entities.push(entity);
    if (entity.mesh) {
      this.renderer.scene.add(entity.mesh);
    }
    this.events.emit('entityAdded', entity);
  }

  public removeEntity(entity: Entity): void {
    const index = this.entities.indexOf(entity);
    if (index === -1) return;
    this.entities.splice(index, 1);
    if (entity.mesh) {
      this.renderer.scene.remove(entity.mesh);
    }
    this.events.emit('entityDestroyed', entity);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.animationFrameId = requestAnimationFrame(this.boundLoop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
    // keydowns that arrived while paused must not fire as "just pressed"
    this.input.endFrame();
  }

  public get isPaused(): boolean {
    return this.paused;
  }

  /** Advances the simulation by one or more fixed steps, without rendering. */
  public step(steps = 1): void {
    for (let i = 0; i < steps; i++) {
      this.fixedUpdate();
    }
  }

  /**
   * Advances logic for a frame's elapsed time: runs as many fixed steps as
   * fit, then the per-frame callbacks. Public so it can be driven in tests.
   */
  public tick(deltaTime: number): void {
    if (this.paused) return;

    const clampedTime = Math.min(Math.max(deltaTime, 0), MAX_FRAME_TIME);
    this.accumulator += clampedTime;
    let steps = 0;
    while (this.accumulator >= FIXED_TIMESTEP && steps < MAX_STEPS_PER_FRAME) {
      this.fixedUpdate();
      this.accumulator -= FIXED_TIMESTEP;
      steps += 1;
    }
    if (this.accumulator > FIXED_TIMESTEP) {
      // drop backlog instead of spiraling after a long stall
      this.accumulator = FIXED_TIMESTEP;
    }

    for (const callback of [...this.frameCallbacks]) {
      callback(clampedTime);
    }

    this.input.endFrame();
  }

  public destroy(): void {
    this.stop();
    for (const entity of [...this.entities]) {
      this.removeEntity(entity);
    }
    this.frameCallbacks.clear();
    this.events.clear();
    this.input.destroy();
    this.renderer.destroy();
  }

  private loop(time: number): void {
    if (!this.isRunning) return;

    const deltaTime = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.tick(deltaTime);
    this.renderer.render();

    this.animationFrameId = requestAnimationFrame(this.boundLoop);
  }

  private fixedUpdate(): void {
    for (const entity of [...this.entities]) {
      entity.update(1, this);
    }

    this.resolveCollisions();
    this.collectDestroyed();
  }

  private resolveCollisions(): void {
    for (let i = 0; i < this.entities.length; i++) {
      const first = this.entities[i];
      if (!first.collidable || first.destroyFlag) continue;
      for (let j = i + 1; j < this.entities.length; j++) {
        const second = this.entities[j];
        if (!second.collidable || second.destroyFlag) continue;
        if (this.physics.checkAABBCollision(first, second)) {
          first.onCollision(second);
          second.onCollision(first);
          this.events.emit('entitiesCollided', { a: first, b: second });
        }
      }
    }
  }

  private collectDestroyed(): void {
    for (const entity of [...this.entities]) {
      if (entity.destroyFlag) {
        this.removeEntity(entity);
      }
    }
  }
}
