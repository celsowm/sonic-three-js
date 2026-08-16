import type { LevelDefinition, StageThemeDefinition, TerrainDefinition, Vector2Definition } from '../level/LevelDefinition';

const GREEN_HILL_ENVIRONMENT_URL = '../../assets/models/elements/green-hill-environment/';
const GREEN_HILL_PALM_URL = '../../assets/models/elements/green-hill-palm-tree/green-hill-palm-tree.glb';

const environmentAssetUrl = (fileName: string) => new URL(
  `${GREEN_HILL_ENVIRONMENT_URL}${fileName}`,
  import.meta.url,
).href;

export const greenHillTheme: StageThemeDefinition = {
  id: 'green-hill',
  skyColor: 0x8ed8f7,
  terrainMaterials: {
    'green-hill-grass': {
      color: 0x2ea334,
    },
  },
  decorations: {
    'green-hill-loop': {
      url: environmentAssetUrl('green-hill-loop.glb'),
    },
    'green-hill-palm-tree': {
      url: new URL(GREEN_HILL_PALM_URL, import.meta.url).href,
    },
  },
};

/** Smooth cosine bump from y=0 up to `peak` and back down. */
const bump = (x0: number, x1: number, peak: number, steps = 10): Vector2Definition[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    return { x: x0 + (x1 - x0) * t, y: peak * Math.sin(Math.PI * t) };
  });

/** Counter-clockwise circle points (walkable inside) starting at the bottom. */
const circlePoints = (centerX: number, centerY: number, radius: number, segments = 48): Vector2Definition[] =>
  Array.from({ length: segments }, (_, index) => {
    const theta = -Math.PI / 2 + (Math.PI * 2 * (index + 1)) / segments;
    return { x: centerX + Math.cos(theta) * radius, y: centerY + Math.sin(theta) * radius };
  });

const LOOP_CENTER_X = 1235;
const LOOP_RADIUS = 21;

const terrain: TerrainDefinition[] = [
  {
    // opening run, hill, and the launch ramp
    type: 'path',
    material: 'green-hill-grass',
    thickness: 46,
    points: [
      { x: -250, y: 0 },
      { x: 150, y: 0 },
      ...bump(150, 430, 38),
      { x: 640, y: 0 },
      { x: 700, y: 26 },
    ],
  },
  {
    // landing island after the pit
    type: 'solid-platform',
    x: 920,
    y: 20,
    z: -14,
    width: 180,
    height: 90,
    material: 'green-hill-grass',
  },
  {
    // descent into the loop: the path overlaps itself at the loop base so the
    // player is carried up and around exactly once, then continues right;
    // rendered by the flat twin below
    type: 'path',
    material: 'green-hill-grass',
    collisionOnly: true,
    points: [
      { x: 1010, y: 20 },
      { x: 1060, y: 8 },
      { x: 1105, y: 0 },
      { x: LOOP_CENTER_X, y: 0 },
      ...circlePoints(LOOP_CENTER_X, LOOP_RADIUS, LOOP_RADIUS),
      { x: 1290, y: 0 },
      { x: 1420, y: 0 },
      ...bump(1420, 1600, 24, 8),
      { x: 1660, y: 0 },
      { x: 1730, y: -20 },
      { x: 1800, y: 0 },
      { x: 2050, y: 0 },
    ],
  },
  {
    // flat ground through the loop, hills and valley to the goal
    type: 'path',
    material: 'green-hill-grass',
    thickness: 46,
    visualOnly: true,
    points: [
      { x: 1010, y: 20 },
      { x: 1060, y: 8 },
      { x: 1105, y: 0 },
      { x: LOOP_CENTER_X, y: 0 },
      { x: 1290, y: 0 },
      { x: 1420, y: 0 },
      ...bump(1420, 1600, 24, 8),
      { x: 1660, y: 0 },
      { x: 1730, y: -20 },
      { x: 1800, y: 0 },
      { x: 2050, y: 0 },
    ],
  },
];

export const greenHillAct1: LevelDefinition = {
  id: 'green-hill-act-1',
  theme: greenHillTheme,
  camera: {
    visibleHeight: 96,
    followOffsetX: 22,
    followOffsetY: 24,
  },
  player: {
    x: 0,
    y: 50,
    model: 'classic-sonic-runners',
  },
  background: [
    {
      type: 'color-band',
      x: 900,
      y: -92,
      z: -90,
      width: 2600,
      height: 74,
      color: 0x0d7ac0,
    },
    {
      type: 'color-band',
      x: 900,
      y: -77,
      z: -88,
      width: 2600,
      height: 16,
      color: 0x67c1e0,
    },
  ],
  terrain,
  entities: [
    { type: 'spring', x: 120, y: 0, direction: 'up', force: 7 },
    { type: 'ring', x: 120, y: 40 },
    { type: 'ring', x: 120, y: 65 },
    { type: 'ring', x: 120, y: 90 },
    { type: 'ring', x: 120, y: 115 },
    { type: 'ring', x: 190, y: 32 },
    { type: 'ring', x: 230, y: 46 },
    { type: 'ring', x: 290, y: 52 },
    { type: 'ring', x: 350, y: 46 },
    { type: 'ring', x: 390, y: 32 },
    { type: 'monitor', x: 470, y: 8, monitorType: 'shield' },
    { type: 'ring', x: 560, y: 14 },
    { type: 'ring', x: 590, y: 14 },
    { type: 'checkpoint', x: 600, y: 0 },
    { type: 'badnik', x: 530, y: 5, patrolDistance: 40 },
    { type: 'ring', x: 750, y: 42 },
    { type: 'ring', x: 790, y: 48 },
    { type: 'ring', x: 830, y: 46 },
    { type: 'ring', x: 870, y: 34 },
    { type: 'monitor', x: 890, y: 28, monitorType: 'rings' },
    { type: 'badnik', x: 940, y: 25, patrolDistance: 40 },
    { type: 'ring', x: 975, y: 34 },
    { type: 'ring', x: 1235, y: 50 },
    { type: 'ring', x: 1330, y: 14 },
    { type: 'ring', x: 1360, y: 14 },
    { type: 'ring', x: 1390, y: 14 },
    { type: 'badnik', x: 1350, y: 5, patrolDistance: 30 },
    { type: 'checkpoint', x: 1640, y: 0 },
    { type: 'ring', x: 1690, y: -4 },
    { type: 'ring', x: 1725, y: -4 },
    { type: 'ring', x: 1760, y: -4 },
    { type: 'monitor', x: 1840, y: 8, monitorType: 'invincibility' },
    { type: 'badnik', x: 1900, y: 5, patrolDistance: 30 },
    { type: 'finish-sign', x: 1970, y: 12 },
  ],
  decorations: [
    { type: 'runtime-art', art: 'green-hill-backdrop', x: 150, y: 8, z: -84, scale: 1.26 },
    { type: 'runtime-art', art: 'green-hill-backdrop', x: 750, y: 10, z: -86, scale: 1.34 },
    { type: 'runtime-art', art: 'green-hill-backdrop', x: 1350, y: 9, z: -85, scale: 1.22 },
    { type: 'runtime-art', art: 'green-hill-backdrop', x: 1850, y: 10, z: -84, scale: 1.2 },
    { type: 'model', asset: 'green-hill-loop', x: LOOP_CENTER_X, y: 6.4, z: -10, scale: 1, rotation: { x: Math.PI / 2 } },
    { type: 'model', asset: 'green-hill-palm-tree', x: 250, y: 0, z: -25, scale: 0.45 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 620, y: 0, z: -28, scale: 0.5 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 1120, y: 0, z: -26, scale: 0.42 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 1620, y: 0, z: -27, scale: 0.48 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 1930, y: 0, z: -25, scale: 0.4 },
    { type: 'runtime-art', art: 'green-hill-palm', x: 450, y: 0, z: -48, scale: 0.9 },
    { type: 'runtime-art', art: 'green-hill-palm', x: 1500, y: 0, z: -50, scale: 0.85 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 60, y: 0, z: -12, scale: 0.84 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 210, y: 0, z: -12, scale: 0.72 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 380, y: 0, z: -12, scale: 0.8 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 590, y: 0, z: -12, scale: 0.75 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 1080, y: 0, z: -12, scale: 0.82 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 1300, y: 0, z: -12, scale: 0.74 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 1460, y: 0, z: -12, scale: 0.8 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 1700, y: 0, z: -12, scale: 0.76 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 1990, y: 0, z: -12, scale: 0.84 },
    { type: 'runtime-art', art: 'green-hill-rock', x: 170, y: 0, z: -11, scale: 0.92 },
    { type: 'runtime-art', art: 'green-hill-rock', x: 410, y: 0, z: -11, scale: 0.96 },
    { type: 'runtime-art', art: 'green-hill-rock', x: 1180, y: 0, z: -11, scale: 0.9 },
    { type: 'runtime-art', art: 'green-hill-rock', x: 1550, y: 0, z: -11, scale: 0.95 },
    { type: 'runtime-art', art: 'green-hill-rock', x: 1880, y: 0, z: -11, scale: 0.9 },
    { type: 'runtime-art', art: 'green-hill-totem', x: 330, y: 0, z: -13, scale: 0.82 },
    { type: 'runtime-art', art: 'green-hill-totem', x: 1400, y: 0, z: -13, scale: 0.84, rotation: { y: 3.1416 } },
    { type: 'runtime-art', art: 'green-hill-sign', x: 520, y: 0, z: -13, scale: 0.86 },
    { type: 'runtime-art', art: 'green-hill-sign', x: 2050, y: 0, z: -13, scale: 0.78, rotation: { y: 3.1416 } },
  ],
};
