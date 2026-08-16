import { describe, expect, it } from 'vitest';
import { Terrain, TerrainPath } from '../src/core/Terrain';

const TAU = Math.PI * 2;

describe('TerrainPath', () => {
  it('samples positions and clamps distance on open paths', () => {
    const path = new TerrainPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);

    expect(path.totalLength).toBe(100);
    expect(path.sample(30).x).toBeCloseTo(30);
    expect(path.sample(-5).x).toBe(0);
    expect(path.sample(500).x).toBe(100);
  });

  it('computes the surface angle of slopes', () => {
    const path = new TerrainPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);

    expect(path.sample(5).angle).toBeCloseTo(Math.PI / 4);
  });

  it('wraps distance around closed paths', () => {
    const path = new TerrainPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ], true);

    expect(path.totalLength).toBeCloseTo(40);
    const sample = path.sample(45); // one full loop + 5 along the bottom
    expect(sample.x).toBeCloseTo(5);
    expect(sample.y).toBeCloseTo(0);
  });

  it('keeps angles continuous (unwrapped) around a counter-clockwise loop', () => {
    const segments = 36;
    const radius = 30;
    const points = Array.from({ length: segments }, (_, index) => {
      const theta = -Math.PI / 2 + (TAU * index) / segments;
      return { x: Math.cos(theta) * radius, y: Math.sin(theta) * radius };
    });
    const loop = new TerrainPath(points, true);

    // bottom of the loop: near flat (chord angle is half the arc step)
    expect(Math.abs(loop.sample(0.1).angle)).toBeLessThan(0.1);
    // right wall: ascending (angle ~ +PI/2)
    const quarter = loop.sample(loop.totalLength * 0.25);
    expect(Math.abs(quarter.angle - Math.PI / 2)).toBeLessThan(0.15);
    // ceiling: upside down (angle ~ PI, not -PI)
    const top = loop.sample(loop.totalLength * 0.5);
    expect(Math.abs(top.angle - Math.PI)).toBeLessThan(0.1);
    expect(top.angle).toBeGreaterThan(0); // unwrapped, not -PI
  });
});

describe('Terrain', () => {
  it('raycasts downward onto a floor', () => {
    const terrain = new Terrain();
    terrain.addPath([
      { x: -100, y: 0 },
      { x: 100, y: 0 },
    ]);

    const hit = terrain.raycast(10, 50, 0, -1, 100);
    expect(hit).not.toBeNull();
    expect(hit!.y).toBeCloseTo(0);
    expect(hit!.angle).toBeCloseTo(0);
  });

  it('ignores hits from the unwalkable side of a surface', () => {
    const terrain = new Terrain();
    terrain.addPath([
      { x: -100, y: 0 },
      { x: 100, y: 0 },
    ]);

    // ray upward from below the floor must not "land" on its underside
    expect(terrain.raycast(10, -50, 0, 1, 100)).toBeNull();
  });

  it('raycasts onto slopes and reports the surface angle', () => {
    const terrain = new Terrain();
    terrain.addPath([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ]);

    const hit = terrain.raycast(50, 100, 0, -1, 200)!;
    expect(hit).not.toBeNull();
    expect(hit.x).toBeCloseTo(50);
    expect(hit.y).toBeCloseTo(25);
    expect(hit.angle).toBeCloseTo(Math.atan2(50, 100));
  });

  it('finds the highest ground below a point', () => {
    const terrain = new Terrain();
    terrain.addPath([
      { x: -100, y: 0 },
      { x: 100, y: 0 },
    ]);
    terrain.addPath([
      { x: 0, y: 20 },
      { x: 100, y: 20 },
    ]);

    expect(terrain.groundBelow(50, 100)).toBe(20);
    expect(terrain.groundBelow(50, 10)).toBe(0);
  });

  it('solid platforms expose a walkable top and blocking side walls', () => {
    const terrain = new Terrain();
    terrain.addSolidPlatform(200, 30, 60, 40); // top y=30, x in [170, 230]

    const top = terrain.raycast(200, 100, 0, -1, 200)!;
    expect(top).not.toBeNull();
    expect(top.y).toBeCloseTo(30);

    expect(terrain.wallBetween(160, 180, 10, 25)).toBe(170);
    expect(terrain.wallBetween(220, 240, 10, 25)).toBe(230);
    expect(terrain.wallBetween(100, 160, 10, 25)).toBeNull();
    // above the platform top the sides do not block
    expect(terrain.wallBetween(160, 180, 35, 50)).toBeNull();
  });

  it('clears and reports emptiness', () => {
    const terrain = new Terrain();
    expect(terrain.isEmpty).toBe(true);

    terrain.addSolidPlatform(0, 0, 10, 10);
    expect(terrain.isEmpty).toBe(false);

    terrain.clear();
    expect(terrain.isEmpty).toBe(true);
    expect(terrain.raycast(0, 10, 0, -1, 100)).toBeNull();
  });
});
