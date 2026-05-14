import type { LevelDefinition, StageThemeDefinition } from '../level/LevelDefinition';

const PALM_TREE_URL = new URL(
  '../../assets/models/elements/green-hill-palm-tree/green-hill-palm-tree.glb',
  import.meta.url,
).href;
const GREEN_HILL_ENVIRONMENT_URL = '../../assets/models/elements/green-hill-environment/';

const environmentAssetUrl = (fileName: string) => new URL(
  `${GREEN_HILL_ENVIRONMENT_URL}${fileName}`,
  import.meta.url,
).href;

export const greenHillTheme: StageThemeDefinition = {
  id: 'green-hill',
  skyColor: 0x7ec8df,
  terrainMaterials: {
    'green-hill-grass': {
      color: 0x166b1b,
    },
  },
  decorations: {
    'green-hill-palm-tree': {
      url: PALM_TREE_URL,
    },
    'green-hill-terrain-set': {
      url: environmentAssetUrl('green-hill-terrain-set.glb'),
    },
    'green-hill-loop': {
      url: environmentAssetUrl('green-hill-loop.glb'),
    },
    'green-hill-props': {
      url: environmentAssetUrl('green-hill-props.glb'),
    },
    'green-hill-background': {
      url: environmentAssetUrl('green-hill-background.glb'),
    },
  },
};

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
      x: 500,
      y: -52,
      z: -90,
      width: 1800,
      height: 36,
      color: 0x0e74b8,
    },
    {
      type: 'color-band',
      x: 500,
      y: -68,
      z: -88,
      width: 1800,
      height: 34,
      color: 0x0a5f38,
    },
  ],
  terrain: [
    {
      type: 'solid-platform',
      x: 500,
      y: -45,
      z: -46,
      width: 1800,
      height: 80,
      material: 'green-hill-grass',
    },
  ],
  entities: [
    { type: 'ring', x: 45, y: 14 },
    { type: 'ring', x: 77, y: 14 },
    { type: 'ring', x: 109, y: 14 },
    { type: 'ring', x: 141, y: 14 },
    { type: 'ring', x: 173, y: 14 },
    { type: 'badnik', x: 220, y: 10, patrolDistance: 30 },
    { type: 'monitor', x: 320, y: 10, monitorType: 'rings' },
    { type: 'finish-sign', x: 520, y: 10 },
  ],
  decorations: [
    { type: 'model', asset: 'green-hill-background', x: 70, y: 20, z: -84, scale: 1.25 },
    { type: 'model', asset: 'green-hill-background', x: 380, y: 10, z: -86, scale: 1.35 },
    { type: 'model', asset: 'green-hill-background', x: 675, y: 13, z: -84, scale: 1.22 },
    { type: 'model', asset: 'green-hill-loop', x: 118, y: -2, z: -38, scale: 1.08 },
    { type: 'model', asset: 'green-hill-loop', x: 500, y: -4, z: -40, scale: 0.92 },
    { type: 'model', asset: 'green-hill-terrain-set', x: -20, y: 0, z: -16, scale: 1.1 },
    { type: 'model', asset: 'green-hill-terrain-set', x: 70, y: 0, z: -16, scale: 1.1 },
    { type: 'model', asset: 'green-hill-terrain-set', x: 160, y: 0, z: -16, scale: 1.1 },
    { type: 'model', asset: 'green-hill-terrain-set', x: 250, y: 0, z: -16, scale: 1.1 },
    { type: 'model', asset: 'green-hill-terrain-set', x: 340, y: 0, z: -16, scale: 1.1 },
    { type: 'model', asset: 'green-hill-terrain-set', x: 430, y: 0, z: -16, scale: 1.1 },
    { type: 'model', asset: 'green-hill-terrain-set', x: 520, y: 0, z: -16, scale: 1.1 },
    { type: 'model', asset: 'green-hill-terrain-set', x: 610, y: 0, z: -16, scale: 1.1 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 84, y: -5, z: -30, scale: 0.72 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 302, y: -5, z: -34, scale: 0.68 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 584, y: -5, z: -36, scale: 0.64 },
    { type: 'model', asset: 'green-hill-props', x: 42, y: 0, z: -12, scale: 0.72 },
    { type: 'model', asset: 'green-hill-props', x: 150, y: 0, z: -13, scale: 0.95 },
    { type: 'model', asset: 'green-hill-props', x: 515, y: 0, z: -13, scale: 0.86, rotation: { y: 3.1416 } },
    { type: 'model', asset: 'green-hill-props', x: 710, y: 0, z: -15, scale: 0.72 },
  ],
};
