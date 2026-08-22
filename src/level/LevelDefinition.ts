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
  /** Camera projection; gameplay stays 2D either way. Defaults to `side-scroller`. */
  mode?: 'side-scroller' | 'perspective';
  /** Vertical field of view in degrees for `perspective` mode. */
  fov?: number;
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

export interface SpringDefinition extends Vector2Definition {
  type: 'spring';
  direction?: 'up' | 'up-right' | 'up-left';
  force?: number;
}

export interface CheckpointDefinition extends Vector2Definition {
  type: 'checkpoint';
}

export type GameplayEntityDefinition =
  | RingDefinition
  | BadnikDefinition
  | MonitorDefinition
  | FinishSignDefinition
  | SpringDefinition
  | CheckpointDefinition;

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
  /** Collision only, no rendered fill (e.g. self-overlapping loop carriers). */
  collisionOnly?: boolean;
  /** Rendered fill only, no collision. */
  visualOnly?: boolean;
}

export type TerrainDefinition = SolidPlatformDefinition | PathTerrainDefinition;

export interface ModelDecorationDefinition extends Vector2Definition {
  type: 'model';
  asset: string;
  /** Picks a single named node from the asset (e.g. one prop out of a props collection GLB). */
  node?: string;
  scale?: number;
  z?: number;
  rotation?: RotationDefinition;
  /** Renders the model unlit, keeping its baked texture colors (e.g. flat billboard-style props). */
  unlit?: boolean;
}

export type DecorationDefinition = ModelDecorationDefinition;

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
  /** Theme texture library, loaded before terrain is built and counted in loading progress. */
  textures?: Record<string, AssetReferenceDefinition>;
  decorations: Record<string, AssetReferenceDefinition>;
}

/**
 * A loadable theme asset. `path` is relative to the engine's `assets/`
 * directory and is resolved by the LevelLoader (honoring `assetBase`);
 * `url` bypasses resolution and is used verbatim.
 */
export interface AssetReferenceDefinition {
  path?: string;
  url?: string;
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
