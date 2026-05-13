import { Engine } from '../core/Engine';
import { Entity } from './Entity';
import { Player } from './Player';

export class Stage {
  public engine: Engine;
  public player!: Player;

  constructor(containerId: string) {
    this.engine = new Engine(containerId);
  }

  public load(levelData: { type: string, x: number, y: number }[]) {
    // Clear old entities
    this.engine.entities.forEach(e => {
      if (e.mesh) this.engine.renderer.scene.remove(e.mesh);
    });
    this.engine.entities = [];

    // Dynamically instantiate based on level data (simplified)
    // Real implementation would use a factory
  }

  public addEntity(entity: Entity) {
    if (entity instanceof Player) {
      this.player = entity;
    }
    this.engine.addEntity(entity);
  }

  public updateCamera() {
    if (this.player && this.engine.renderer.camera) {
      // Follow player on X axis
      this.engine.renderer.camera.position.x = this.player.x;
      // Basic follow on Y, keeping player near bottom
      this.engine.renderer.camera.position.y = this.player.y + 20;
    }
  }

  public start() {
    // Override engine loop to include camera update and GC of destroyed entities
    const origUpdate = this.engine['update'].bind(this.engine);
    this.engine['update'] = (deltaTime: number) => {
      origUpdate(deltaTime);

      this.updateCamera();

      // Clean up destroyed entities
      const destroyed = this.engine.entities.filter(e => e.destroyFlag);
      destroyed.forEach(e => this.engine.removeEntity(e));
    };

    this.engine.start();
  }
}
