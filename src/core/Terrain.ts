export interface TerrainPoint {
  x: number;
  y: number;
}

export interface TerrainSample {
  x: number;
  y: number;
  /**
   * Surface angle of the segment, unwrapped to stay continuous along the
   * path: 0 = flat, positive = ascending to the right, PI = ceiling.
   * A full counter-clockwise loop accumulates up to 2*PI.
   */
  angle: number;
}

export interface RaycastHit {
  x: number;
  y: number;
  angle: number;
  path: TerrainPath;
  /** Arclength position of the hit along the path. */
  pathDistance: number;
}

interface PathSegment {
  readonly path: TerrainPath;
  readonly startDistance: number;
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly length: number;
  readonly angle: number;
}

const BUCKET_SIZE = 100;
const TWO_PI = Math.PI * 2;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * A walkable collision surface: an open polyline (floors, hills, ramps) or a
 * closed polyline (loop-de-loops). Entities move along it by arclength while
 * grounded, which is what makes slopes and 360° loops work.
 */
export class TerrainPath {
  public readonly points: readonly TerrainPoint[];
  public readonly closed: boolean;
  public readonly totalLength: number;
  public readonly segments: readonly PathSegment[];

  constructor(points: TerrainPoint[], closed: boolean = false) {
    if (points.length < 2) {
      throw new Error('A terrain path needs at least two points.');
    }
    this.points = points;
    this.closed = closed;

    const segments: PathSegment[] = [];
    let previousAngle = 0;
    let startDistance = 0;

    const link = (ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) return;

      let angle = Math.atan2(dy, dx);
      while (angle - previousAngle > Math.PI) angle -= TWO_PI;
      while (previousAngle - angle > Math.PI) angle += TWO_PI;

      segments.push({ path: this, startDistance, ax, ay, bx, by, length, angle });
      startDistance += length;
      previousAngle = angle;
    };

    for (let i = 0; i < points.length - 1; i++) {
      link(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
    if (closed) {
      const last = points[points.length - 1];
      link(last.x, last.y, points[0].x, points[0].y);
    }

    if (segments.length < 1) {
      throw new Error('A terrain path needs at least two distinct points.');
    }

    this.segments = segments;
    this.totalLength = startDistance;
  }

  /** Position and surface angle at an arclength distance along the path. */
  public sample(distance: number): TerrainSample {
    let d = distance;
    if (this.closed) {
      d = distance % this.totalLength;
      if (d < 0) d += this.totalLength;
    } else {
      d = clamp(distance, 0, this.totalLength);
    }

    let segment = this.segments[this.segments.length - 1];
    for (const candidate of this.segments) {
      if (d >= candidate.startDistance && d <= candidate.startDistance + candidate.length) {
        segment = candidate;
        break;
      }
    }

    const t = (d - segment.startDistance) / segment.length;
    return {
      x: segment.ax + (segment.bx - segment.ax) * t,
      y: segment.ay + (segment.by - segment.ay) * t,
      angle: segment.angle,
    };
  }
}

interface Wall {
  readonly x: number;
  readonly bottom: number;
  readonly top: number;
}

/**
 * The collision world: walkable paths plus solid-box side walls, indexed by
 * x buckets so raycast queries stay cheap.
 */
export class Terrain {
  private readonly paths: TerrainPath[] = [];
  private readonly walls: Wall[] = [];
  private readonly buckets = new Map<number, PathSegment[]>();
  private indexed = false;

  public addPath(points: TerrainPoint[], closed: boolean = false): TerrainPath {
    const path = new TerrainPath(points, closed);
    this.paths.push(path);
    this.indexed = false;
    return path;
  }

  /**
   * A solid rectangular platform (top at y, extending down by height):
   * the top edge becomes a walkable path, the sides become blocking walls.
   */
  public addSolidPlatform(x: number, y: number, width: number, height: number): TerrainPath {
    const left = x - width / 2;
    const right = x + width / 2;
    this.walls.push({ x: left, bottom: y - height, top: y });
    this.walls.push({ x: right, bottom: y - height, top: y });
    this.indexed = false;
    return this.addPath([{ x: left, y }, { x: right, y }], false);
  }

  public clear(): void {
    this.paths.length = 0;
    this.walls.length = 0;
    this.buckets.clear();
    this.indexed = false;
  }

  public get isEmpty(): boolean {
    return this.paths.length === 0;
  }

  /**
   * Casts a ray against all walkable surfaces. Only hits coming from the
   * walkable side of a segment count, so a downward ray never lands a player
   * on the underside of a floor.
   */
  public raycast(
    originX: number,
    originY: number,
    dirX: number,
    dirY: number,
    maxDistance: number,
  ): RaycastHit | null {
    this.ensureIndex();

    const length = Math.hypot(dirX, dirY);
    if (length < 1e-8) return null;
    const dx = dirX / length;
    const dy = dirY / length;

    const firstBucket = Math.floor(Math.min(originX, originX + dx * maxDistance) / BUCKET_SIZE);
    const lastBucket = Math.floor(Math.max(originX, originX + dx * maxDistance) / BUCKET_SIZE);

    let best: RaycastHit | null = null;
    let bestDistance = Infinity;

    for (let bucketIndex = firstBucket; bucketIndex <= lastBucket; bucketIndex++) {
      const bucket = this.buckets.get(bucketIndex);
      if (!bucket) continue;

      for (const segment of bucket) {
        const ex = segment.bx - segment.ax;
        const ey = segment.by - segment.ay;
        const denom = dx * ey - dy * ex;
        if (Math.abs(denom) < 1e-10) continue;

        const wx = segment.ax - originX;
        const wy = segment.ay - originY;
        const t = (wx * ey - wy * ex) / denom;
        const u = (wx * dy - wy * dx) / denom;
        if (t < 0 || t > maxDistance || u < 0 || u > 1) continue;

        // the ray must arrive from the walkable side (opposite the surface normal)
        const normalX = -Math.sin(segment.angle);
        const normalY = Math.cos(segment.angle);
        if (dx * normalX + dy * normalY >= 0) continue;

        if (t < bestDistance) {
          best = {
            x: originX + dx * t,
            y: originY + dy * t,
            angle: segment.angle,
            path: segment.path,
            pathDistance: segment.startDistance + u * segment.length,
          };
          bestDistance = t;
        }
      }
    }

    return best;
  }

  /**
   * Returns the x of the first solid wall between fromX and toX that overlaps
   * the given y range, or null when the movement is unobstructed.
   */
  public wallBetween(fromX: number, toX: number, bottomY: number, topY: number): number | null {
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    for (const wall of this.walls) {
      if (wall.x >= minX && wall.x <= maxX && wall.top > bottomY && wall.bottom < topY) {
        return wall.x;
      }
    }
    return null;
  }

  /** Highest walkable surface strictly below fromY at column x, if any. */
  public groundBelow(x: number, fromY: number): number | null {
    const hit = this.raycast(x, fromY, 0, -1, 1e6);
    return hit ? hit.y : null;
  }

  private ensureIndex(): void {
    if (this.indexed) return;

    this.buckets.clear();
    for (const path of this.paths) {
      for (const segment of path.segments) {
        const firstBucket = Math.floor(Math.min(segment.ax, segment.bx) / BUCKET_SIZE);
        const lastBucket = Math.floor(Math.max(segment.ax, segment.bx) / BUCKET_SIZE);
        for (let bucketIndex = firstBucket; bucketIndex <= lastBucket; bucketIndex++) {
          let bucket = this.buckets.get(bucketIndex);
          if (!bucket) {
            bucket = [];
            this.buckets.set(bucketIndex, bucket);
          }
          bucket.push(segment);
        }
      }
    }

    this.indexed = true;
  }
}
