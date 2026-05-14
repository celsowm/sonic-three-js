export interface Vector2Definition {
  x: number;
  y: number;
}

export interface Vector3Definition extends Vector2Definition {
  z: number;
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

export interface TerrainDefinition extends Vector2Definition {
  type: 'solid-platform';
  width: number;
  height: number;
  material: string;
  z?: number;
}

export interface DecorationDefinition extends Vector2Definition {
  type: 'model';
  asset: string;
  scale?: number;
  z?: number;
}

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
  background: BackgroundLayerDefinition[];
  terrain: TerrainDefinition[];
  entities: GameplayEntityDefinition[];
  decorations: DecorationDefinition[];
}
