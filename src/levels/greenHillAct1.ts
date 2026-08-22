import type {
  LevelDefinition,
  ModelScatterDecorationDefinition,
  StageThemeDefinition,
  TerrainDefinition,
  Vector2Definition,
} from '../level/LevelDefinition';

/** Paths are relative to the engine's bundled `assets/` directory. */
export const greenHillTheme: StageThemeDefinition = {
  id: 'green-hill',
  skyColor: 0x1688e8,
  environment: {
    fog: { color: 0xb8efff, near: 320, far: 1450 },
    hemisphere: {
      skyColor: 0xe9f8ff,
      groundColor: 0x579332,
      intensity: 1.3,
    },
    sun: {
      color: 0xfff0c2,
      intensity: 2.3,
      position: { x: 74, y: 138, z: 118 },
    },
    rim: {
      color: 0x78b7ff,
      intensity: 0.24,
      position: { x: -62, y: 34, z: -72 },
    },
  },
  terrainMaterials: {
    'green-hill-grass': {
      color: 0x48b400,
    },
  },
  textures: {
    'dirt-checker': { path: 'textures/green-hill/dirt-checker.png' },
    'dirt-band': { path: 'textures/green-hill/dirt-band.png' },
    'grass-top': { path: 'textures/green-hill/grass-top.png' },
    'grass-front': { path: 'textures/green-hill/grass-front.png' },
  },
  decorations: {
    'green-hill-loop': {
      path: 'models/elements/green-hill-environment/green-hill-loop.glb',
    },
    'green-hill-props': {
      path: 'models/elements/green-hill-environment/green-hill-props.glb',
    },
    'green-hill-background': {
      path: 'models/elements/green-hill-environment/green-hill-background.glb',
    },
    'green-hill-palm-tree': {
      path: 'models/elements/green-hill-palm-tree/green-hill-palm-tree.glb',
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

const scatter = (
  asset: string,
  node: string | undefined,
  instances: ModelScatterDecorationDefinition['instances'],
  options: Pick<ModelScatterDecorationDefinition, 'unlit' | 'castShadow' | 'receiveShadow'> = {},
): ModelScatterDecorationDefinition => ({
  type: 'model-scatter',
  asset,
  node,
  instances,
  ...options,
});

const flowerInstances = (xs: number[], z: number, scale = 1.35): ModelScatterDecorationDefinition['instances'] =>
  xs.map((x, index) => ({
    x,
    y: 0,
    z: z - (index % 3) * 1.8,
    scale: scale * (0.86 + (index % 4) * 0.08),
    rotation: { y: (index % 2) * 0.18 },
  }));

export const greenHillAct1: LevelDefinition = {
  id: 'green-hill-act-1',
  theme: greenHillTheme,
  rendering: {
    quality: 'cinematic',
    maxPixelRatio: 1.8,
    shadows: true,
    exposure: 1.02,
    antialias: 'smaa',
    ambientOcclusion: {
      kernelRadius: 5,
      minDistance: 0.001,
      maxDistance: 0.028,
    },
    bloom: {
      strength: 0.14,
      radius: 0.22,
      threshold: 0.9,
    },
  },
  camera: {
    visibleHeight: 96,
    followOffsetX: 22,
    followOffsetY: 24,
    mode: 'perspective',
    fov: 40,
  },
  player: {
    x: 0,
    y: 50,
    model: 'classic-sonic-runners',
  },
  background: [
    {
      type: 'gradient-band',
      x: 950,
      y: 42,
      z: -260,
      width: 9000,
      height: 1600,
      topColor: 0x1688e8,
      bottomColor: 0xb8efff,
    },
    {
      // Keep the current procedural cloud implementation restrained until the
      // next art pass replaces it with softer authored/billboard silhouettes.
      type: 'cloud-field',
      x: 950,
      y: 112,
      z: -220,
      width: 5200,
      height: 210,
      count: 9,
      color: 0xfafcff,
      seed: 11,
      minScale: 10,
      maxScale: 25,
    },
    {
      type: 'color-band',
      x: 950,
      y: -96,
      z: -196,
      width: 8000,
      height: 74,
      color: 0x4fbde7,
    },
    {
      type: 'ridge-band',
      x: 950,
      y: -30,
      z: -180,
      width: 6500,
      height: 170,
      color: 0x8bd7cb,
      segments: 42,
      roughness: 0.12,
      seed: 5,
    },
    {
      type: 'ridge-band',
      x: 950,
      y: -33,
      z: -148,
      width: 5600,
      height: 150,
      color: 0x57b96c,
      segments: 46,
      roughness: 0.24,
      seed: 17,
    },
    {
      type: 'ridge-band',
      x: 950,
      y: -38,
      z: -120,
      width: 4800,
      height: 126,
      color: 0x2d8b3c,
      segments: 48,
      roughness: 0.32,
      seed: 29,
    },
  ],
  terrain,
  entities: [
    { type: 'spring', x: 128, y: 0, direction: 'up', force: 7 },
    { type: 'ring', x: 122, y: 28 },
    { type: 'ring', x: 150, y: 44 },
    { type: 'ring', x: 180, y: 59 },
    { type: 'ring', x: 212, y: 72 },
    { type: 'ring', x: 250, y: 43 },
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
    scatter('green-hill-background', 'ghz-backdrop', [
      { x: 120, y: 10, z: -91, scale: 2.5 },
      { x: 620, y: 8, z: -94, scale: 2.65 },
      { x: 1120, y: 11, z: -92, scale: 2.5 },
      { x: 1620, y: 9, z: -95, scale: 2.65 },
      { x: 2070, y: 10, z: -92, scale: 2.45 },
    ], { castShadow: false, receiveShadow: false }),

    { type: 'model', asset: 'green-hill-loop', x: LOOP_CENTER_X, y: 6.4, z: -8, scale: 1, rotation: { x: Math.PI / 2 } },

    scatter('green-hill-palm-tree', undefined, [
      { x: 210, y: 0, z: -31, scale: 0.62 },
      { x: 485, y: 0, z: -39, scale: 0.62 },
      { x: 650, y: 0, z: -31, scale: 0.52 },
      { x: 835, y: 20, z: -43, scale: 0.6 },
      { x: 1080, y: 0, z: -35, scale: 0.5 },
      { x: 1330, y: 0, z: -42, scale: 0.64 },
      { x: 1510, y: 0, z: -31, scale: 0.5 },
      { x: 1670, y: 0, z: -40, scale: 0.58 },
      { x: 1870, y: 0, z: -32, scale: 0.54 },
      { x: 2020, y: 0, z: -44, scale: 0.62 },
    ]),

    scatter('green-hill-props', 'ghz-palm-tall', [
      { x: 238, y: 0, z: -27, scale: 1.62 },
      { x: 740, y: 18, z: -36, scale: 1.7 },
      { x: 1160, y: 0, z: -29, scale: 1.55 },
      { x: 1450, y: 0, z: -37, scale: 1.65 },
      { x: 1940, y: 0, z: -27, scale: 1.5 },
    ]),
    scatter('green-hill-props', 'ghz-palm-short', [
      { x: 560, y: 0, z: -27, scale: 1.6 },
      { x: 980, y: 20, z: -34, scale: 1.5 },
      { x: 1380, y: 0, z: -25, scale: 1.5 },
      { x: 1605, y: 0, z: -34, scale: 1.7 },
      { x: 1810, y: 0, z: -27, scale: 1.55 },
    ]),

    scatter('green-hill-props', 'ghz-flower-red', [
      ...flowerInstances([34, 72, 104, 182, 455, 505, 545, 1050, 1100, 1310, 1360, 1410, 1620, 1830, 1920, 2010], -12, 1.6),
      { x: 300, y: 18, z: -23, scale: 1.75 },
      { x: 1540, y: 18, z: -22, scale: 1.7 },
    ]),
    scatter('green-hill-props', 'ghz-flower-blue', [
      ...flowerInstances([18, 54, 128, 196, 470, 520, 575, 1025, 1075, 1285, 1340, 1390, 1650, 1855, 1950, 2035], -14, 1.5),
      { x: 335, y: 22, z: -26, scale: 1.65 },
      { x: 1500, y: 20, z: -25, scale: 1.6 },
    ]),
    scatter('green-hill-props', 'ghz-flower-red-b', flowerInstances(
      [125, 430, 600, 1010, 1140, 1260, 1435, 1580, 1685, 1805, 1885, 1985],
      -16,
      1.3,
    )),

    scatter('green-hill-props', 'ghz-rock', [
      { x: 154, y: 0, z: -16, scale: 1.15 },
      { x: 205, y: 7, z: -20, scale: 1.35 },
      { x: 420, y: 0, z: -14, scale: 1.25 },
      { x: 610, y: 0, z: -22, scale: 1.1 },
      { x: 870, y: 20, z: -14, scale: 1.2 },
      { x: 1035, y: 10, z: -14, scale: 1.0 },
      { x: 1180, y: 0, z: -13, scale: 1.15 },
      { x: 1320, y: 0, z: -20, scale: 1.25 },
      { x: 1550, y: 17, z: -13, scale: 1.2 },
      { x: 1660, y: 0, z: -22, scale: 1.1 },
      { x: 1880, y: 0, z: -13, scale: 1.15 },
      { x: 2000, y: 0, z: -20, scale: 1.0 },
    ]),

    scatter('green-hill-props', 'ghz-totem', [
      { x: 330, y: 14, z: -24, scale: 1.0 },
      { x: 680, y: 8, z: -29, scale: 0.9 },
      { x: 1150, y: 0, z: -18, scale: 0.95 },
      { x: 1400, y: 0, z: -19, scale: 1.05 },
      { x: 1740, y: -16, z: -22, scale: 0.95 },
    ]),

    scatter('green-hill-props', 'ghz-sign', [
      { x: 520, y: 0, z: -15, scale: 0.9 },
      { x: 2050, y: 0, z: -15, scale: 0.85 },
    ]),
  ],
};