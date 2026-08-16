import { describe, expect, it } from 'vitest';
import { Physics } from '../src/core/Physics';
import { Terrain } from '../src/core/Terrain';
import { Player } from '../src/entities/Player';

function engineWithTerrain(terrain: Terrain, keys: string[] = []) {
  const pressed = new Set(keys);
  return {
    input: {
      isDown: (code: string) => pressed.has(code),
      justPressed: (code: string) => pressed.has(code),
    },
    physics: new Physics(),
    terrain,
  };
}

/** Places the player on a path at the given distance with a ground speed. */
function attach(player: Player, terrain: Terrain, pathIndex: number, distance: number, groundSpeed: number) {
  const path = terrain['paths'][pathIndex];
  player.groundPath = path;
  player.groundDistance = distance;
  player.groundSpeed = groundSpeed;
  player.isGrounded = true;
  const sample = path.sample(distance);
  player.x = sample.x;
  player.y = sample.y;
  player.groundAngle = sample.angle;
}

describe('Player terrain physics', () => {
  it('accelerates when sliding down a steep slope', () => {
    const steep = new Terrain();
    steep.addPath([
      { x: 0, y: 0 },
      { x: 100, y: -174 }, // ~60 degrees
    ]);
    const player = new Player(0, 0);
    attach(player, steep, 0, 10, 4);
    for (let frame = 0; frame < 20; frame++) {
      player.update(1, engineWithTerrain(steep) as never);
    }
    expect(player.groundSpeed).toBeGreaterThan(4);
  });

  it('gains speed faster running downhill than uphill', () => {
    const downhill = new Terrain();
    downhill.addPath([
      { x: 0, y: 0 },
      { x: 200, y: -100 },
    ]);
    const uphill = new Terrain();
    uphill.addPath([
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    ]);

    const downhillPlayer = new Player(0, 0);
    attach(downhillPlayer, downhill, 0, 10, 6);
    for (let frame = 0; frame < 20; frame++) {
      downhillPlayer.update(1, engineWithTerrain(downhill, ['ArrowRight']) as never);
    }

    const uphillPlayer = new Player(0, 0);
    attach(uphillPlayer, uphill, 0, 10, 6);
    for (let frame = 0; frame < 20; frame++) {
      uphillPlayer.update(1, engineWithTerrain(uphill, ['ArrowRight']) as never);
    }

    expect(downhillPlayer.groundSpeed).toBeGreaterThan(uphillPlayer.groundSpeed);
  });

  it('rolls faster downhill than it runs', () => {
    const slope = new Terrain();
    slope.addPath([
      { x: 0, y: 0 },
      { x: 100, y: -174 }, // ~60 degrees: friction is off, slope factor rules
    ]);

    const runner = new Player(0, 0);
    attach(runner, slope, 0, 10, 3);
    for (let frame = 0; frame < 30; frame++) {
      runner.update(1, engineWithTerrain(slope) as never);
    }

    const roller = new Player(0, 0);
    attach(roller, slope, 0, 10, 3);
    roller.isRolling = true;
    for (let frame = 0; frame < 30; frame++) {
      roller.update(1, engineWithTerrain(slope, ['ArrowDown']) as never);
    }

    expect(roller.groundSpeed).toBeGreaterThan(runner.groundSpeed);
  });

  it('launches upward when running off an upward ramp', () => {
    const terrain = new Terrain();
    terrain.addPath([
      { x: 0, y: 0 },
      { x: 40, y: 20 },
    ]);

    const player = new Player(0, 0);
    attach(player, terrain, 0, 5, 8);
    const engine = engineWithTerrain(terrain);
    for (let frame = 0; frame < 40 && player.isGrounded; frame++) {
      player.update(1, engine as never);
    }

    expect(player.isGrounded).toBe(false);
    expect(player.velocityY).toBeGreaterThan(0);
    expect(player.velocityX).toBeGreaterThan(0);
  });

  it('stays attached through a full loop at speed', () => {
    const terrain = new Terrain();
    const segments = 36;
    const radius = 30;
    const points = Array.from({ length: segments }, (_, index) => {
      const theta = -Math.PI / 2 + (Math.PI * 2 * index) / segments;
      return { x: 100 + Math.cos(theta) * radius, y: 40 + Math.sin(theta) * radius };
    });
    const loop = terrain.addPath(points, true);

    const player = new Player(0, 0);
    attach(player, terrain, 0, 1, 9);

    let reachedTop = false;
    let fellOff = false;
    // a bit over one full lap
    for (let frame = 0; frame < 45; frame++) {
      player.update(1, engineWithTerrain(terrain) as never);
      if (player.isGrounded && Math.abs(player.groundAngle - Math.PI) < 0.4) {
        reachedTop = true;
      }
      if (!player.isGrounded) {
        fellOff = true;
        break;
      }
    }

    expect(fellOff).toBe(false);
    expect(reachedTop).toBe(true);
    // slowed by the loop but well above the slip threshold
    expect(player.groundSpeed).toBeGreaterThan(4);
    expect(loop.totalLength).toBeGreaterThan(0);
  });

  it('falls off a loop wall when too slow', () => {
    const terrain = new Terrain();
    const segments = 36;
    const radius = 30;
    const points = Array.from({ length: segments }, (_, index) => {
      const theta = -Math.PI / 2 + (Math.PI * 2 * index) / segments;
      return { x: 100 + Math.cos(theta) * radius, y: 40 + Math.sin(theta) * radius };
    });
    const loop = terrain.addPath(points, true);

    // ran up the loop but lost speed on the wall
    const player = new Player(0, 0);
    attach(player, terrain, 0, loop.totalLength * 0.25, 2);

    player.update(1, engineWithTerrain(terrain) as never);

    expect(player.isGrounded).toBe(false);
  });

  it('lands on a platform and converts velocity to ground speed', () => {
    const terrain = new Terrain();
    terrain.addSolidPlatform(100, 30, 200, 40);

    const player = new Player(50, 60);
    player.velocityX = 3;
    const engine = engineWithTerrain(terrain);
    for (let frame = 0; frame < 30 && !player.isGrounded; frame++) {
      player.update(1, engine as never);
    }

    expect(player.isGrounded).toBe(true);
    expect(player.y).toBeCloseTo(30, 0);
    // close to the horizontal velocity at impact (air drag shaves a little)
    expect(player.groundSpeed).toBeGreaterThan(2.5);
    expect(player.groundSpeed).toBeLessThan(3.01);
  });

  it('is blocked by solid platform walls while airborne', () => {
    const terrain = new Terrain();
    terrain.addSolidPlatform(100, 30, 60, 60); // walls at x=70 and x=130

    const player = new Player(50, 20);
    player.velocityX = 5;
    const engine = engineWithTerrain(terrain);
    for (let frame = 0; frame < 10; frame++) {
      player.update(1, engine as never);
    }

    expect(player.x).toBeLessThan(70);
    expect(player.velocityX).toBe(0);
  });

  it('jumps along the surface normal on slopes', () => {
    const terrain = new Terrain();
    terrain.addPath([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);

    const player = new Player(0, 0);
    attach(player, terrain, 0, 20, 4);
    const engine = engineWithTerrain(terrain, ['Space']);

    player.update(1, engine as never);

    expect(player.isGrounded).toBe(false);
    // 45° slope: jump pushes up-left relative to travel
    expect(player.velocityY).toBeGreaterThan(0);
    expect(player.velocityX).toBeLessThan(4);
  });

  it('cuts jump height when the button is released early', () => {
    const terrain = new Terrain();
    terrain.addPath([
      { x: -100, y: 0 },
      { x: 100, y: 0 },
    ]);

    const player = new Player(0, 0);
    attach(player, terrain, 0, 10, 0);

    player.update(1, engineWithTerrain(terrain, ['Space']) as never);
    expect(player.velocityY).toBe(6);

    // button released while ascending: cut to 4, then one frame of gravity
    player.update(1, engineWithTerrain(terrain) as never);
    expect(player.velocityY).toBeCloseTo(3.8, 1);
  });
});
