import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

import { Stage } from '../src/entities/Stage';
import { Player } from '../src/entities/Player';
import { Ring } from '../src/entities/Ring';
import { Badnik } from '../src/entities/Badnik';
import { Monitor } from '../src/entities/Monitor';
import { FinishSign } from '../src/entities/FinishSign';
import { Spring } from '../src/entities/Spring';
import { Checkpoint } from '../src/entities/Checkpoint';

describe('Gameplay mechanics', () => {
  let stage: Stage;
  let player: Player;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'game-container';
    document.body.appendChild(container);

    stage = new Stage('game-container');
    player = new Player(0, 0);
    player.isGrounded = true;
    stage.addEntity(player);
    // let the player capture the engine reference used by hurt()/events
    player.update(1, stage.engine);
  });

  afterEach(() => {
    stage.destroy();
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it('springs launch the player upward without jump cutoff', () => {
    const spring = new Spring(0, 0);
    stage.addEntity(spring);

    spring.onCollision(player);

    expect(player.isGrounded).toBe(false);
    expect(player.velocityY).toBe(9);
    expect(player.velocityX).toBe(0);
  });

  it('diagonal springs launch sideways too', () => {
    const spring = new Spring(0, 0, { direction: 'up-right' });
    stage.addEntity(spring);

    spring.onCollision(player);

    expect(player.velocityX).toBeGreaterThan(6);
    expect(player.velocityY).toBeGreaterThan(6);
  });

  it('springs have a cooldown and cannot retrigger every frame', () => {
    const spring = new Spring(0, 0);
    stage.addEntity(spring);

    spring.onCollision(player);
    const firstVelocityY = player.velocityY;
    player.velocityY = 0;
    spring.onCollision(player);

    expect(player.velocityY).toBe(0);

    for (let frame = 0; frame < 12; frame++) {
      spring.update(1, stage.engine);
    }
    spring.onCollision(player);
    expect(player.velocityY).toBe(firstVelocityY);
  });

  it('losing rings scatters collectible rings and grants invulnerability', () => {
    player.rings = 5;
    const badnik = new Badnik(10, 0, 0);
    stage.addEntity(badnik);

    badnik.onCollision(player);

    const scattered = stage.engine.entities.filter(entity => entity instanceof Ring);
    expect(scattered).toHaveLength(5);
    expect(player.rings).toBe(0);
    expect(player.invulnerableTimer).toBeGreaterThan(0);

    // an immediate second hit does nothing (invulnerability)
    badnik.onCollision(player);
    expect(player.rings).toBe(0);
    expect(stage.engine.entities.filter(entity => entity instanceof Ring)).toHaveLength(5);
  });

  it('scattered rings are only collectible after a short delay', () => {
    player.rings = 1;
    const badnik = new Badnik(10, 0, 0);
    stage.addEntity(badnik);
    badnik.onCollision(player);

    const scattered = stage.engine.entities.find(entity => entity instanceof Ring) as Ring;
    expect(scattered).toBeDefined();

    scattered.onCollision(player);
    expect(player.rings).toBe(0); // too early, not collected

    for (let frame = 0; frame < 25; frame++) {
      scattered.update(1, stage.engine);
    }
    scattered.onCollision(player);
    expect(player.rings).toBe(1);
    expect(scattered.destroyFlag).toBe(true);
  });

  it('shield monitors grant a shield that absorbs one hit', () => {
    const monitor = new Monitor(5, 0, 'shield');
    stage.addEntity(monitor);
    player.isGrounded = false;
    player.velocityY = -5;

    monitor.onCollision(player);

    expect(monitor.destroyFlag).toBe(true);
    expect(player.hasShield).toBe(true);

    const badnik = new Badnik(10, 0, 0);
    badnik.onCollision(player);

    expect(player.hasShield).toBe(false);
    expect(player.invulnerableTimer).toBeGreaterThan(0);
    expect(player.isDead).toBe(false);
  });

  it('invincibility monitors make the player lethal to touch', () => {
    const monitor = new Monitor(5, 0, 'invincibility');
    stage.addEntity(monitor);
    player.isGrounded = false;
    player.velocityY = -5;

    monitor.onCollision(player);
    expect(player.invincibilityTimer).toBeGreaterThan(0);

    const badnik = new Badnik(10, 0, 0);
    stage.addEntity(badnik);
    badnik.onCollision(player);

    expect(badnik.destroyFlag).toBe(true);
    expect(player.isDead).toBe(false);
  });

  it('checkpoints set the respawn point and emit an event', () => {
    const reached = vi.fn();
    stage.engine.events.on('checkpointReached', reached);

    const checkpoint = new Checkpoint(120, 0);
    stage.addEntity(checkpoint);
    checkpoint.update(1, stage.engine);
    checkpoint.onCollision(player);

    expect(checkpoint.passed).toBe(true);
    expect(player.spawnX).toBe(120);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it('the finish sign emits stageCleared instead of just logging', () => {
    const cleared = vi.fn();
    stage.engine.events.on('stageCleared', cleared);

    const sign = new FinishSign(100, 0);
    stage.addEntity(sign);
    sign.update(1, stage.engine);
    player.score = 250;
    sign.onCollision(player);

    expect(sign.passed).toBe(true);
    expect(cleared).toHaveBeenCalledWith({ score: 250, rings: player.rings });
  });

  it('dying with no rings respawns at the checkpoint and costs a life', () => {
    const checkpoint = new Checkpoint(120, 0);
    stage.addEntity(checkpoint);
    checkpoint.update(1, stage.engine);
    checkpoint.onCollision(player);

    const died = vi.fn();
    const respawned = vi.fn();
    stage.engine.events.on('playerDied', died);
    stage.engine.events.on('playerRespawned', respawned);

    player.rings = 0;
    const badnik = new Badnik(10, 0, 0);
    badnik.onCollision(player);

    expect(player.isDead).toBe(true);
    expect(died).toHaveBeenCalledTimes(1);
    expect(player.lives).toBe(3);

    for (let frame = 0; frame < 200; frame++) {
      player.update(1, stage.engine);
    }

    expect(player.isDead).toBe(false);
    expect(player.lives).toBe(2);
    expect(player.x).toBe(120);
    expect(respawned).toHaveBeenCalledTimes(1);
  });

  it('the kill plane kills the player', () => {
    player.y = -500;
    player.isGrounded = false;
    player.deathY = -400;

    player.update(1, stage.engine);

    expect(player.isDead).toBe(true);
  });

  it('running out of lives emits gameOver', () => {
    const gameOver = vi.fn();
    stage.engine.events.on('gameOver', gameOver);
    player.lives = 1;
    player.rings = 0;

    const badnik = new Badnik(10, 0, 0);
    badnik.onCollision(player);
    for (let frame = 0; frame < 200; frame++) {
      player.update(1, stage.engine);
    }

    expect(player.isDead).toBe(true);
    expect(gameOver).toHaveBeenCalledWith({ lives: 0 });
  });
});
