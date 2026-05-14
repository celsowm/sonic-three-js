import type { LevelDefinition, StageThemeDefinition } from '../level/LevelDefinition';

const PALM_TREE_URL = new URL(
  '../../assets/models/elements/green-hill-palm-tree/green-hill-palm-tree.glb',
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
      y: -45,
      z: -80,
      width: 1800,
      height: 80,
      color: 0x1b7d26,
    },
  ],
  terrain: [
    {
      type: 'solid-platform',
      x: 500,
      y: -45,
      z: -20,
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
    { type: 'model', asset: 'green-hill-palm-tree', x: 90, y: -5, z: -24, scale: 0.72 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 310, y: -5, z: -28, scale: 0.68 },
    { type: 'model', asset: 'green-hill-palm-tree', x: 560, y: -5, z: -32, scale: 0.64 },
  ],
};
