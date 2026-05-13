import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

import { Stage } from '../src/entities/Stage';
import { Player } from '../src/entities/Player';
import { Ring } from '../src/entities/Ring';
import { Badnik } from '../src/entities/Badnik';
import { Monitor } from '../src/entities/Monitor';
import { FinishSign } from '../src/entities/FinishSign';
import { HUD } from '../src/components/HUD';

describe('Gameplay E2E Simulation', () => {
  let stage: Stage;
  let player: Player;
  let hud: HUD;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'game-container';
    document.body.appendChild(container);

    stage = new Stage('game-container');
    hud = new HUD('game-container');

    player = new Player(0, 10);
    stage.addEntity(player);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it('should allow player to collect a ring', () => {
    const ring = new Ring(10, 10);
    stage.addEntity(ring);

    player.x = 10;
    player.y = 10;

    // Force physics collision explicitly since engine update relies on AABB
    player.width = 10; player.height = 10;
    ring.width = 8; ring.height = 8;

    stage.engine['update'](0.1);

    expect(player.rings).toBe(1);
    expect(player.score).toBe(10);
    expect(ring.destroyFlag).toBe(true);
  });

  it('should allow player to break a monitor and get rings', () => {
    const monitor = new Monitor(20, 0, 'rings');
    stage.addEntity(monitor);

    player.x = 20;
    player.y = 5;
    player.width = 10; player.height = 10;
    monitor.x = 20;
    monitor.y = 0;
    monitor.width = 14; monitor.height = 14;

    // Need to trigger onCollision directly for fine control in test
    // or rely on AABB inside update
    player.velocityY = -5; // Falling

    // Simulate the collision manually to guarantee it
    monitor.onCollision(player);

    expect(monitor.destroyFlag).toBe(true);
    expect(player.rings).toBe(10);
    expect(player.velocityY).toBe(4); // Bounced up
  });

  it('should cause player to lose rings when hit by badnik normally', () => {
    player.rings = 5;
    const badnik = new Badnik(30, 10, 0); // No patrol
    stage.addEntity(badnik);

    // Ensure overlap
    player.x = 30;
    player.y = 10;
    badnik.x = 30;
    badnik.y = 10;

    player.velocityY = 0; // Not falling
    player.isRolling = false; // Not rolling

    // The Badnik's onCollision logic checks if player is rolling/falling
    badnik.onCollision(player);

    expect(badnik.destroyFlag).toBe(false); // Badnik lives
    expect(player.rings).toBe(0); // Player drops rings
  });

  it('should allow player to destroy badnik when rolling', () => {
    const badnik = new Badnik(40, 10, 0);
    stage.addEntity(badnik);

    player.x = 40;
    player.y = 10;
    badnik.x = 40;
    badnik.y = 10;

    player.isRolling = true; // Rolling state

    badnik.onCollision(player);

    expect(badnik.destroyFlag).toBe(true);
    expect(player.score).toBe(100); // 100 points for badnik
  });

  it('should trigger finish sign on collision', () => {
    const sign = new FinishSign(100, 10);
    stage.addEntity(sign);

    player.x = 100;
    player.y = 10;
    sign.x = 100;
    sign.y = 10;

    sign.onCollision(player);

    expect(sign.passed).toBe(true);
  });
});
