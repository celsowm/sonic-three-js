import { Renderer } from './Renderer';
import { Physics } from './Physics';
import { Input } from './Input';
import { Entity } from '../entities/Entity';

export class Engine {
  public renderer: Renderer;
  public physics: Physics;
  public input: Input;
  public entities: Entity[] = [];

  private lastTime: number = 0;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;

  constructor(containerId: string) {
    this.renderer = new Renderer(containerId);
    this.physics = new Physics();
    this.input = new Input();
  }

  public addEntity(entity: Entity) {
    this.entities.push(entity);
    if (entity.mesh) {
      this.renderer.scene.add(entity.mesh);
    }
  }

  public removeEntity(entity: Entity) {
    this.entities = this.entities.filter(e => e !== entity);
    if (entity.mesh) {
      this.renderer.scene.remove(entity.mesh);
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private loop(time: number) {
    if (!this.isRunning) return;

    // time in seconds, clamped to max 0.1s to avoid huge jumps on lag
    const deltaTime = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.update(deltaTime);
    this.renderer.render();

    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
  }

  private update(deltaTime: number) {
    // 60 FPS baseline multiplier for legacy logic, or just pass deltaTime
    const timeScale = deltaTime * 60;

    // Update all entities
    for (const entity of this.entities) {
      entity.update(timeScale, this);
    }

    // Simple collision check brute force
    for (let i = 0; i < this.entities.length; i++) {
      for (let j = i + 1; j < this.entities.length; j++) {
        const e1 = this.entities[i];
        const e2 = this.entities[j];
        if (this.physics.checkAABBCollision(e1, e2)) {
          e1.onCollision(e2);
          e2.onCollision(e1);
        }
      }
    }
  }
}
