export interface Vector2Definition {
  x: number;
  y: number;
}

export interface Vector3Definition extends Vector2Definition {
  z: number;
}

export interface RotationDefinition {
  x?: number;
  y?: number;
  z?: number;
}

export interface CameraDefinition {
  visibleHeight: number;
  followOffsetX: number;
  followOffsetY: number;
}

export interface PlayerDefinition extends Vector2Definition {
  model?: 'classic-sonic-runners';
}

export interface RingDefinition extends Vector2Definition {
  type: 'ring';
}

export interface BadnikDefinition extends Vector2Definition {
  type: 'badnik';
  patrolDistance?: number;
}

export interface MonitorDefinition extends Vector2Definition {
  type: 'monitor';
  monitorType?: 'rings' | 'shield' | 'invincibility';
}

export interface FinishSignDefinition extends Vector2Definition {
  type: 'finish-sign';
}

export type GameplayEntityDefinition =
  | RingDefinition
  | BadnikDefinition
  | MonitorDefinition
  | FinishSignDefinition;

export interface SolidPlatformDefinition extends Vector2Definition {
  type: 'solid-platform';
  width: number;
  height: number;
  material: string;
  z?: number;
}

export interface PathTerrainDefinition {
  type: 'path';
  /**
   * Walkable surface polyline in world space, ordered along the direction of
   * travel. Closed paths (loops) must wind counter-clockwise so the walkable
   * side faces the inside.
   */
  points: Vector2Definition[];
  closed?: boolean;
  material: string;
  z?: number;
  /** Visual thickness of the terrain fill below the surface. */
  thickness?: number;
}

export type TerrainDefinition = SolidPlatformDefinition | PathTerrainDefinition;

export interface ModelDecorationDefinition extends Vector2Definition {
  type: 'model';
  asset: string;
  scale?: number;
  z?: number;
  rotation?: RotationDefinition;
}

export interface RuntimeDecorationDefinition extends Vector2Definition {
  type: 'runtime-art';
  art:
    | 'green-hill-backdrop'
    | 'green-hill-palm'
    | 'green-hill-sunflower'
    | 'green-hill-rock'
    | 'green-hill-totem'
    | 'green-hill-sign';
  scale?: number;
  z?: number;
  rotation?: RotationDefinition;
}

export type DecorationDefinition = ModelDecorationDefinition | RuntimeDecorationDefinition;

export interface BackgroundLayerDefinition extends Vector2Definition {
  type: 'color-band';
  width: number;
  height: number;
  color: number;
  z: number;
}

export interface StageThemeDefinition {
  id: string;
  skyColor: number;
  terrainMaterials: Record<string, {
    color: number;
  }>;
  decorations: Record<string, {
    url: string;
  }>;
}

export interface LevelDefinition {
  id: string;
  theme: StageThemeDefinition;
  camera: CameraDefinition;
  player: PlayerDefinition;
  /** Y below which the player dies; defaults to a value far below the terrain. */
  deathY?: number;
  /** Respawn point; defaults to the player start position. */
  spawn?: Vector2Definition;
  background: BackgroundLayerDefinition[];
  terrain: TerrainDefinition[];
  entities: GameplayEntityDefinition[];
  decorations: DecorationDefinition[];
}
