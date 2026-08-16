import type { LevelDefinition, StageThemeDefinition, Vector2Definition } from '../level/LevelDefinition';

export const playgroundTheme: StageThemeDefinition = {
  id: 'playground',
  skyColor: 0x7fb2e8,
  terrainMaterials: {
    panel: {
      color: 0x3e6b8f,
    },
  },
  decorations: {},
};

/** Counter-clockwise circle points (walkable inside) starting at the bottom. */
const circlePoints = (centerX: number, centerY: number, radius: number, segments = 48): Vector2Definition[] =>
  Array.from({ length: segments }, (_, index) => {
    const theta = -Math.PI / 2 + (Math.PI * 2 * (index + 1)) / segments;
    return { x: centerX + Math.cos(theta) * radius, y: centerY + Math.sin(theta) * radius };
  });

const LOOP_CENTER_X = 1080;
const LOOP_RADIUS = 26;

/**
 * A terrain physics sandbox: a ladder of increasingly steep slopes, a
 * half-pipe, a cliff with a pit, a large loop, springs and platform steps.
 */
export const physicsPlayground: LevelDefinition = {
  id: 'physics-playground',
  theme: playgroundTheme,
  camera: {
    visibleHeight: 130,
    followOffsetX: 20,
    followOffsetY: 30,
  },
  player: {
    x: -100,
    y: 50,
  },
  background: [],
  terrain: [
    {
      // slope ladder: 15, 30, 45 and 60 degrees
      type: 'path',
      material: 'panel',
      thickness: 70,
      points: [
        { x: -200, y: 0 },
        { x: 200, y: 0 },
        { x: 230, y: 8 },
        { x: 280, y: 8 },
        { x: 315, y: 28 },
        { x: 365, y: 28 },
        { x: 400, y: 63 },
        { x: 450, y: 63 },
        { x: 470, y: 97 },
        { x: 500, y: 97 },
      ],
    },
    {
      // half-pipe down to a valley and back up to a cliff
      type: 'path',
      material: 'panel',
      thickness: 70,
      points: [
        { x: 500, y: 97 },
        { x: 560, y: 30 },
        { x: 620, y: -60 },
        { x: 700, y: -60 },
        { x: 760, y: 30 },
        { x: 820, y: 97 },
        { x: 880, y: 97 },
      ],
    },
    {
      // ground with the loop carrier (collision only, overlaps itself)
      type: 'path',
      material: 'panel',
      collisionOnly: true,
      points: [
        { x: 960, y: 0 },
        { x: LOOP_CENTER_X, y: 0 },
        ...circlePoints(LOOP_CENTER_X, LOOP_RADIUS, LOOP_RADIUS),
        { x: 1140, y: 0 },
        { x: 1650, y: 0 },
      ],
    },
    {
      // flat ground twin rendered through the loop
      type: 'path',
      material: 'panel',
      thickness: 70,
      visualOnly: true,
      points: [
        { x: 960, y: 0 },
        { x: LOOP_CENTER_X, y: 0 },
        { x: 1140, y: 0 },
        { x: 1650, y: 0 },
      ],
    },
    {
      // platform steps
      type: 'solid-platform',
      x: 1450,
      y: 16,
      width: 100,
      height: 60,
      material: 'panel',
    },
    {
      type: 'solid-platform',
      x: 1600,
      y: 34,
      width: 100,
      height: 80,
      material: 'panel',
    },
  ],
  entities: [
    { type: 'monitor', x: 60, y: 8, monitorType: 'rings' },
    { type: 'ring', x: 214, y: 20 },
    { type: 'ring', x: 244, y: 20 },
    { type: 'ring', x: 297, y: 40 },
    { type: 'ring', x: 340, y: 40 },
    { type: 'ring', x: 382, y: 75 },
    { type: 'ring', x: 425, y: 75 },
    { type: 'ring', x: 460, y: 109 },
    { type: 'ring', x: 660, y: -44 },
    { type: 'ring', x: 690, y: -44 },
    { type: 'spring', x: 1250, y: 0, direction: 'up' },
    { type: 'ring', x: 1250, y: 40 },
    { type: 'ring', x: 1250, y: 75 },
    { type: 'ring', x: 1250, y: 110 },
    { type: 'spring', x: 1330, y: 0, direction: 'up-right' },
    { type: 'spring', x: 1410, y: 0, direction: 'up-left' },
    { type: 'badnik', x: 1180, y: 5, patrolDistance: 30 },
    { type: 'checkpoint', x: 980, y: 0 },
    { type: 'finish-sign', x: 1700, y: 12 },
  ],
  decorations: [],
};
