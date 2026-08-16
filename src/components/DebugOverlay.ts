import * as THREE from 'three';
import { Stage } from '../entities/Stage';
import { Player } from '../entities/Player';
import type { Entity } from '../entities/Entity';

/**
 * Debug overlay (F3): FPS, player physics state and per-entity hitboxes.
 * Hitboxes track the entity list via engine events.
 */
export class DebugOverlay {
  private enabled: boolean;
  private readonly stage: Stage;
  private readonly panel: HTMLDivElement;
  private readonly helpers = new Map<Entity, THREE.Box3Helper>();
  private readonly unsubscribe: (() => void)[];
  private fps = 60;

  constructor(parentId: string, stage: Stage, enabled = false) {
    const parent = document.getElementById(parentId);
    if (!parent) throw new Error(`Parent ${parentId} not found`);
    this.stage = stage;
    this.enabled = enabled;

    this.panel = document.createElement('div');
    this.panel.style.position = 'absolute';
    this.panel.style.top = '10px';
    this.panel.style.right = '10px';
    this.panel.style.color = '#c8ffb0';
    this.panel.style.background = 'rgba(0, 0, 0, 0.55)';
    this.panel.style.fontFamily = 'monospace';
    this.panel.style.fontSize = '13px';
    this.panel.style.lineHeight = '1.5';
    this.panel.style.padding = '8px 12px';
    this.panel.style.whiteSpace = 'pre';
    this.panel.style.pointerEvents = 'none';
    this.panel.style.display = enabled ? 'block' : 'none';

    parent.style.position = 'relative';
    parent.appendChild(this.panel);

    this.unsubscribe = [
      stage.engine.events.on('entityAdded', entity => this.trackEntity(entity)),
      stage.engine.events.on('entityDestroyed', entity => this.untrackEntity(entity)),
    ];
    for (const entity of stage.engine.entities) {
      this.trackEntity(entity);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.panel.style.display = enabled ? 'block' : 'none';
    for (const helper of this.helpers.values()) {
      helper.visible = enabled;
    }
  }

  public toggle(): void {
    this.setEnabled(!this.enabled);
  }

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public update(deltaTime: number): void {
    if (!this.enabled) return;

    if (deltaTime > 0) {
      const instant = 1 / deltaTime;
      this.fps += (instant - this.fps) * 0.08;
    }

    this.panel.innerText = this.describeState();
    this.syncHelpers();
  }

  public destroy(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    for (const entity of [...this.helpers.keys()]) {
      this.untrackEntity(entity);
    }
    this.panel.remove();
  }

  private describeState(): string {
    const player = this.stage.player;
    const lines = [`FPS   ${this.fps.toFixed(0)}`, `ENT   ${this.stage.engine.entities.length}`];

    if (player instanceof Player) {
      const degrees = ((player.groundAngle * 180 / Math.PI) % 360 + 360) % 360;
      lines.push(
        `POS   x ${player.x.toFixed(1)}  y ${player.y.toFixed(1)}`,
        `GSP   ${player.groundSpeed.toFixed(2)}`,
        `VEL   x ${player.velocityX.toFixed(2)}  y ${player.velocityY.toFixed(2)}`,
        `ANGLE ${degrees.toFixed(0)}°  GROUNDED ${player.isGrounded ? 'Y' : 'N'}`,
        `STATE ${player.currentAnimationName ?? '-'}${player.isRolling ? ' (roll)' : ''}`,
        `RINGS ${player.rings}  LIVES ${player.lives}${player.hasShield ? '  SHIELD' : ''}${player.invincibilityTimer > 0 ? '  INVINCIBLE' : ''}`,
      );
    }

    return lines.join('\n');
  }

  private trackEntity(entity: Entity): void {
    if (!entity.collidable || this.helpers.has(entity)) return;

    const box = new THREE.Box3();
    const helper = new THREE.Box3Helper(box, entity instanceof Player ? 0x51ff51 : 0xff6b6b);
    helper.visible = this.enabled;
    this.stage.engine.renderer.scene.add(helper);
    this.helpers.set(entity, helper);
  }

  private untrackEntity(entity: Entity): void {
    const helper = this.helpers.get(entity);
    if (!helper) return;
    this.stage.engine.renderer.scene.remove(helper);
    (helper.geometry as THREE.BufferGeometry).dispose();
    this.helpers.delete(entity);
  }

  private syncHelpers(): void {
    for (const [entity, helper] of this.helpers) {
      const bounds = entity.getBounds();
      helper.box.min.set(bounds.left, bounds.bottom, -4);
      helper.box.max.set(bounds.right, bounds.top, 4);
    }
  }
}
