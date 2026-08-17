import type { LevelDefinition, StageThemeDefinition, TerrainDefinition, Vector2Definition } from '../level/LevelDefinition';

const GREEN_HILL_ENVIRONMENT_URL = '../../assets/models/elements/green-hill-environment/';
const GREEN_HILL_PALM_URL = '../../assets/models/elements/green-hill-palm-tree/green-hill-palm-tree.glb';
const GREEN_HILL_TEXTURES_URL = '../../assets/textures/green-hill/';

const environmentAssetUrl = (fileName: string) => new URL(
  `${GREEN_HILL_ENVIRONMENT_URL}${fileName}`,
  import.meta.url,
).href;

const textureUrl = (name: string) => new URL(
  `${GREEN_HILL_TEXTURES_URL}${name}.png`,
  import.meta.url,
).href;

export const greenHillTheme: StageThemeDefinition = {
  id: 'green-hill',
  skyColor: 0x3aa8f7,
  terrainMaterials: {
    'green-hill-grass': {
      color: 0x48b400,
    },
  },
  textures: {
    'dirt-checker': { url: textureUrl('dirt-checker') },
    'dirt-band': { url: textureUrl('dirt-band') },
    'grass-top': { url: textureUrl('grass-top') },
    'grass-front': { url: textureUrl('grass-front') },
  },
  decorations: {
    'green-hill-loop': {
      url: environmentAssetUrl('green-hill-loop.glb'),
    },
    'green-hill-props': {
      url: environmentAssetUrl('green-hill-props.glb'),
    },
    'green-hill-background': {
      url: environmentAssetUrl('green-hill-background.glb'),
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
      type: 'color-band',
      x: 1000,
      y: -95,
      z: -90,
      width: 3200,
      height: 80,
      color: 0x0055c8,
    },
    {
      type: 'color-band',
      x: 1000,
      y: -78,
      z: -88,
      width: 3200,
      height: 18,
      color: 0x60c8f8,
    },
    {
      type: 'color-band',
      x: 1000,
      y: -68,
      z: -87,
      width: 3200,
      height: 10,
      color: 0x90e0ff,
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
    { type: 'model', asset: 'green-hill-background', node: 'ghz-backdrop', x: 150, y: 8, z: -84, scale: 2.2, unlit: true },
    { type: 'model', asset: 'green-hill-background', node: 'ghz-backdrop', x: 750, y: 10, z: -86, scale: 2.3, unlit: true },
    { type: 'model', asset: 'green-hill-background', node: 'ghz-backdrop', x: 1350, y: 9, z: -85, scale: 2.2, unlit: true },
    { type: 'model', asset: 'green-hill-background', node: 'ghz-backdrop', x: 1850, y: 10, z: -84, scale: 2.2, unlit: true },
    { type: 'model', asset: 'green-hill-loop', x: LOOP_CENTER_X, y: 6.4, z: -8, scale: 1, rotation: { x: Math.PI / 2 } },
    { type: 'model', asset: 'green-hill-palm-tree', x: 250, y: 0, z: -30, scale: 0.45 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 620, y: 0, z: -33, scale: 0.5 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 1120, y: 0, z: -31, scale: 0.42 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 1620, y: 0, z: -32, scale: 0.48 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 1930, y: 0, z: -30, scale: 0.4 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-palm-tall', x: 450, y: 0, z: -26, scale: 1.5 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-palm-short', x: 1500, y: 0, z: -30, scale: 1.6 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-flower-red', x: 60, y: 0, z: -14, scale: 1.4 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-flower-blue', x: 210, y: 0, z: -14, scale: 1.3 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-flower-red-b', x: 380, y: 0, z: -14, scale: 1.4 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-flower-blue', x: 590, y: 0, z: -14, scale: 1.3 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-flower-red', x: 1080, y: 0, z: -14, scale: 1.4 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-flower-blue', x: 1300, y: 0, z: -14, scale: 1.3 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-flower-red-b', x: 1460, y: 0, z: -14, scale: 1.4 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-flower-blue', x: 1700, y: 0, z: -14, scale: 1.3 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-flower-red', x: 1990, y: 0, z: -14, scale: 1.4 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-rock', x: 170, y: 0, z: -13, scale: 1.15 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-rock', x: 410, y: 0, z: -13, scale: 1.2 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-rock', x: 1180, y: 0, z: -13, scale: 1.1 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-rock', x: 1550, y: 0, z: -13, scale: 1.15 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-rock', x: 1880, y: 0, z: -13, scale: 1.1 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-totem', x: 330, y: 0, z: -15, scale: 1 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-totem', x: 1400, y: 0, z: -15, scale: 1 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-sign', x: 520, y: 0, z: -15, scale: 0.9 },
    { type: 'model', asset: 'green-hill-props', node: 'ghz-sign', x: 2050, y: 0, z: -15, scale: 0.85 },
  ],
};
