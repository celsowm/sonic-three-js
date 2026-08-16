import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Player } from './Player';

const MONITOR_TYPE_COLORS: Record<Monitor['type'], number> = {
  rings: 0xf5c518,
  shield: 0x4db8ff,
  invincibility: 0xf0f0f0,
};

/** An item monitor: break it while rolling or falling to collect the item. */
export class Monitor extends Entity {
  public type: 'rings' | 'shield' | 'invincibility';

  constructor(x: number, y: number, type: 'rings' | 'shield' | 'invincibility' = 'rings') {
    super(x, y, 14, 16);
    this.type = type;

    this.mesh = this.buildMonitor();
    this.syncMesh();
  }

  public update(deltaTime: number, engine: Engine): void {
    // static object
  }

  public onCollision(other: Entity): void {
    if (other instanceof Player && !this.destroyFlag) {
      const player = other;
      const attacking = player.isRolling
        || (!player.isGrounded && player.velocityY < 0)
        || player.invincibilityTimer > 0;

      if (attacking) {
        this.destroyFlag = true;
        this.applyItem(player);

        // bounce the player when breaking it from above
        if (!player.isGrounded && player.invincibilityTimer <= 0) {
          player.launch(player.velocityX, 4);
        }
      } else {
        // solid block behavior
        player.velocityX = 0;
        player.groundSpeed = 0;
      }
    }
  }

  private applyItem(player: Player): void {
    switch (this.type) {
      case 'rings':
        player.rings += 10;
        player.score += 10;
        break;
      case 'shield':
        player.hasShield = true;
        break;
      case 'invincibility':
        player.invincibilityTimer = 480;
        break;
    }
  }

  private buildMonitor(): THREE.Group {
    const group = new THREE.Group();

    // TV box
    group.add(new THREE.Mesh(
      new THREE.BoxGeometry(13, 13, 8),
      new THREE.MeshLambertMaterial({ color: 0x9a9a9a }),
    ));

    // screen showing the item
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(9.5, 9.5),
      new THREE.MeshBasicMaterial({ color: MONITOR_TYPE_COLORS[this.type] }),
    );
    screen.position.z = 4.1;
    group.add(screen);

    // stand
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(9, 3, 5),
      new THREE.MeshLambertMaterial({ color: 0x5c5c5c }),
    );
    stand.position.y = -8;
    group.add(stand);

    return group;
  }
}
