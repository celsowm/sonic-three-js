import type { LevelDefinition, StageThemeDefinition } from '../level/LevelDefinition';

const GREEN_HILL_ENVIRONMENT_URL = '../../assets/models/elements/green-hill-environment/';

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
      y: -72,
      z: -90,
      width: 1850,
      height: 74,
      color: 0x0d7ac0,
    },
    {
      type: 'color-band',
      x: 500,
      y: -57,
      z: -88,
      width: 1850,
      height: 16,
      color: 0x67c1e0,
    },
  ],
  terrain: [
    {
      type: 'solid-platform',
      x: 500,
      y: 0,
      z: -14,
      width: 1800,
      height: 74,
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
    { type: 'runtime-art', art: 'green-hill-backdrop', x: 70, y: 8, z: -84, scale: 1.26 },
    { type: 'runtime-art', art: 'green-hill-backdrop', x: 360, y: 10, z: -86, scale: 1.34 },
    { type: 'runtime-art', art: 'green-hill-backdrop', x: 670, y: 9, z: -85, scale: 1.22 },
    { type: 'model', asset: 'green-hill-loop', x: 132, y: 1, z: -37, scale: 1.02 },
    { type: 'model', asset: 'green-hill-loop', x: 502, y: 0, z: -39, scale: 0.94 },
    { type: 'runtime-art', art: 'green-hill-palm', x: 94, y: 0, z: -28, scale: 0.9 },
    { type: 'runtime-art', art: 'green-hill-palm', x: 342, y: 0, z: -30, scale: 0.84 },
    { type: 'runtime-art', art: 'green-hill-palm', x: 630, y: 0, z: -30, scale: 0.82 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 30, y: 0, z: -12, scale: 0.84 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 58, y: 0, z: -12, scale: 0.72 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 156, y: 0, z: -12, scale: 0.8 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 286, y: 0, z: -12, scale: 0.75 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 474, y: 0, z: -12, scale: 0.82 },
    { type: 'runtime-art', art: 'green-hill-sunflower', x: 660, y: 0, z: -12, scale: 0.74 },
    { type: 'runtime-art', art: 'green-hill-rock', x: 82, y: 0, z: -11, scale: 0.92 },
    { type: 'runtime-art', art: 'green-hill-rock', x: 190, y: 0, z: -11, scale: 0.96 },
    { type: 'runtime-art', art: 'green-hill-rock', x: 408, y: 0, z: -11, scale: 1.06 },
    { type: 'runtime-art', art: 'green-hill-rock', x: 554, y: 0, z: -11, scale: 0.9 },
    { type: 'runtime-art', art: 'green-hill-sign', x: 244, y: 0, z: -13, scale: 0.86 },
    { type: 'runtime-art', art: 'green-hill-sign', x: 714, y: 0, z: -13, scale: 0.78, rotation: { y: 3.1416 } },
    { type: 'runtime-art', art: 'green-hill-totem', x: 330, y: 0, z: -13, scale: 0.82 },
    { type: 'runtime-art', art: 'green-hill-totem', x: 598, y: 0, z: -13, scale: 0.84, rotation: { y: 3.1416 } },
  ],
};
