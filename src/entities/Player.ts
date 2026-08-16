import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';
import { Ring } from './Ring';
import type { RaycastHit, Terrain, TerrainPath } from '../core/Terrain';

export type PlayerAnimationState = 'idle' | 'run' | 'boost' | 'jump' | 'fall' | 'roll';

export interface PlayerModelOptions {
  scale?: number;
  offset?: THREE.Vector3Like;
  rotation?: THREE.Euler | THREE.Vector3Like;
  animationMap?: Partial<Record<PlayerAnimationState, string>>;
}

const DEFAULT_ANIMATION_MAP: Record<PlayerAnimationState, string> = {
  idle: 'idle',
  run: 'sc_run_loop',
  boost: 'sc_boost_loop',
  jump: 'sc_jump_ball_loop',
  fall: 'sc_jump_fall_loop',
  roll: 'sc_jump_ball_loop',
};

const TWO_PI = Math.PI * 2;
const FL45 = Math.PI / 4; // outside +/- 45° a surface is wall or ceiling, not floor

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export class Player extends Entity {
  public speed: number = 0.35;
  public airAcceleration: number = 0.16;
  /** Ground friction; kept well below the slope factor so loops stay runnable. */
  public deceleration: number = 0.12;
  public braking: number = 0.9;
  public rollingDeceleration: number = 0.08;
  public airDrag: number = 0.995;
  public maxRunSpeed: number = 8.5;
  /** Launch speed ~1 screen; peaks around 90 units with default gravity. */
  public jumpForce: number = 6;

  /** Slope acceleration while running (classic Sonic slope factor). */
  public slopeFactor: number = 0.125;
  public slopeRollUp: number = 0.078;
  public slopeRollDown: number = 0.3125;
  /** Below this speed the player slips off walls/ceilings (loops). */
  public slipSpeed: number = 2.5;
  /** Steepness beyond which a slow player slips (radians away from flat). */
  public slipAngle: number = 0.6;
  /** How far landing sensors reach to snap onto a surface. */
  public landingSnap: number = 16;
  /** How fast the airborne orientation returns to upright, rad/frame. */
  public airAngleRecovery: number = 0.09;
  /** Releasing jump early cuts upward speed to this value. */
  public jumpCutoff: number = 4;
  public maxFallSpeed: number = 16;

  public isRolling: boolean = false;
  public rings: number = 0;
  public score: number = 0;
  public currentAnimationName: string | null = null;

  public lives: number = 3;
  /** Respawn point, updated by checkpoints. */
  public spawnX: number;
  public spawnY: number;
  /** Falling below this Y kills the player. */
  public deathY: number = -1000;

  public isDead: boolean = false;
  public deathTimer: number = 0;
  /** Invulnerability after a hit or shield loss, in frames. */
  public invulnerableTimer: number = 0;
  /** Monitor-granted invincibility, in frames. */
  public invincibilityTimer: number = 0;
  public hasShield: boolean = false;
  /** Input is ignored while this counts down (hurt knockback). */
  public controlLockTimer: number = 0;

  /** Speed along the ground surface while grounded (classic "gsp"). */
  public groundSpeed: number = 0;
  /** Current surface angle in radians; recovers toward 0 while airborne. */
  public groundAngle: number = 0;
  public groundPath: TerrainPath | null = null;
  /** Arclength position along the ground path. */
  public groundDistance: number = 0;

  private isJumping: boolean = false;
  private currentEngine: Engine | null = null;

  private readonly visualRoot: THREE.Group;
  private readonly orientationGroup: THREE.Group;
  private readonly modelRoot: THREE.Group;
  private readonly shieldMesh: THREE.Mesh;
  private readonly sparkleGroup: THREE.Group;
  private placeholder: THREE.Object3D;
  private animationMixer: THREE.AnimationMixer | null = null;
  private animationActions = new Map<string, THREE.AnimationAction>();
  private animationMap: Record<PlayerAnimationState, string> = { ...DEFAULT_ANIMATION_MAP };
  private facingDirection: 1 | -1 = 1;

  constructor(x: number, y: number) {
    super(x, y, 12, 22);

    this.spawnX = x;
    this.spawnY = y;

    this.visualRoot = new THREE.Group();
    this.orientationGroup = new THREE.Group();
    this.modelRoot = new THREE.Group();

    const geometry = new THREE.SphereGeometry(5, 16, 16);
    const material = new THREE.MeshLambertMaterial({ color: 0x0000ff });
    this.placeholder = new THREE.Mesh(geometry, material);

    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(15, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0x4db8ff, transparent: true, opacity: 0.22 }),
    );
    this.shieldMesh.visible = false;

    this.sparkleGroup = new THREE.Group();
    for (let index = 0; index < 4; index++) {
      const star = new THREE.Mesh(
        new THREE.TetrahedronGeometry(1.6),
        new THREE.MeshBasicMaterial({ color: 0xffe24d }),
      );
      const angle = (Math.PI * 2 * index) / 4;
      star.position.set(Math.cos(angle) * 16, Math.sin(angle) * 16, 4);
      this.sparkleGroup.add(star);
    }
    this.sparkleGroup.visible = false;

    this.visualRoot.add(this.orientationGroup);
    this.orientationGroup.add(this.placeholder);
    this.orientationGroup.add(this.modelRoot);
    this.orientationGroup.add(this.shieldMesh);
    this.orientationGroup.add(this.sparkleGroup);
    this.mesh = this.visualRoot;
    this.syncMesh();
  }

  public setAnimatedModel(
    model: THREE.Object3D,
    animations: THREE.AnimationClip[],
    options: PlayerModelOptions = {},
  ): void {
    this.modelRoot.clear();
    this.modelRoot.add(model);
    this.placeholder.visible = false;

    this.modelRoot.position.set(
      options.offset?.x ?? 0,
      options.offset?.y ?? -5,
      options.offset?.z ?? 0,
    );

    const scale = options.scale ?? 8;
    this.modelRoot.scale.setScalar(scale);

    if (options.rotation instanceof THREE.Euler) {
      this.modelRoot.rotation.copy(options.rotation);
    } else if (options.rotation) {
      this.modelRoot.rotation.set(options.rotation.x, options.rotation.y, options.rotation.z);
    }

    this.animationMap = {
      ...DEFAULT_ANIMATION_MAP,
      ...options.animationMap,
    };

    this.animationMixer = new THREE.AnimationMixer(model);
    this.animationActions.clear();

    for (const clip of animations) {
      this.animationActions.set(clip.name, this.animationMixer.clipAction(clip));
    }

    this.playAnimationForState('idle');
  }

  public update(deltaTime: number, engine: Engine): void {
    this.currentEngine = engine;

    if (this.invulnerableTimer > 0) this.invulnerableTimer -= deltaTime;
    if (this.invincibilityTimer > 0) this.invincibilityTimer -= deltaTime;
    if (this.controlLockTimer > 0) this.controlLockTimer -= deltaTime;

    this.shieldMesh.visible = this.hasShield;
    this.sparkleGroup.visible = this.invincibilityTimer > 0;
    if (this.sparkleGroup.visible) {
      this.sparkleGroup.rotation.z += 0.25 * deltaTime;
    }

    if (this.isDead) {
      this.updateDeath(deltaTime);
      this.syncMesh();
      this.updateVisualState(deltaTime);
      return;
    }

    // kill plane (pits), checked before physics so deep falls resolve even
    // against the legacy floor
    if (this.y < this.deathY) {
      this.die();
      this.syncMesh();
      this.updateVisualState(deltaTime);
      return;
    }

    const input = engine.input;
    const inputDirection = this.controlLockTimer > 0
      ? 0
      : Number(input.isDown('ArrowRight')) - Number(input.isDown('ArrowLeft'));

    if (this.isGrounded) {
      this.updateGrounded(inputDirection, input.isDown('ArrowDown'), input.justPressed('Space'), deltaTime, engine);
    } else {
      this.updateAirborne(inputDirection, input.isDown('Space'), deltaTime, engine);
    }

    this.syncMesh();
    this.updateVisualState(deltaTime);
  }

  /** Applies spring-style launch velocities and detaches from the ground. */
  public launch(velocityX: number, velocityY: number): void {
    this.isGrounded = false;
    this.isJumping = false;
    this.groundPath = null;
    this.groundAngle = 0;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
  }

  /**
   * Classic hit reaction: shield absorbs, rings scatter, otherwise death.
   * Returns true when the hit actually landed.
   */
  public hurt(sourceX: number): boolean {
    if (this.isDead || this.invulnerableTimer > 0 || this.invincibilityTimer > 0) {
      return false;
    }

    if (this.hasShield) {
      this.hasShield = false;
      this.invulnerableTimer = 90;
      this.applyHurtKnockback(sourceX);
      this.currentEngine?.events.emit('playerHurt', { player: this });
      return true;
    }

    if (this.rings > 0) {
      this.scatterRings();
      this.rings = 0;
      this.invulnerableTimer = 120;
      this.applyHurtKnockback(sourceX);
      this.currentEngine?.events.emit('playerHurt', { player: this });
      return true;
    }

    this.die();
    return true;
  }

  public die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.deathTimer = 0;
    this.isGrounded = false;
    this.groundPath = null;
    this.isRolling = false;
    this.velocityX = 0;
    this.velocityY = 0;
    this.currentEngine?.events.emit('playerDied', { player: this });
  }

  private applyHurtKnockback(sourceX: number): void {
    const awayFromSource = this.x >= sourceX ? 1 : -1;
    this.isGrounded = false;
    this.groundPath = null;
    this.controlLockTimer = 30;
    this.velocityX = 2 * awayFromSource;
    this.velocityY = 4;
  }

  private scatterRings(): void {
    const engine = this.currentEngine;
    if (!engine) return;

    const count = Math.min(this.rings, 16);
    for (let index = 0; index < count; index++) {
      const spread = 0.35 + (index % 8) * 0.2;
      const direction = index % 2 === 0 ? 1 : -1;
      const speed = 4 + (index % 3);
      engine.addEntity(new Ring(this.x, this.y + this.height / 2, {
        scattered: true,
        velocityX: Math.sin(spread) * speed * direction,
        velocityY: Math.cos(spread) * speed,
      }));
    }
  }

  private updateDeath(deltaTime: number): void {
    this.deathTimer += deltaTime;
    // brief freeze, then fall off-screen
    if (this.deathTimer > 30) {
      this.velocityY -= 0.3 * deltaTime;
      this.velocityY = Math.max(this.velocityY, -14);
      this.y += this.velocityY * deltaTime;
    }

    if (this.deathTimer > 150 || this.y < this.deathY - 600) {
      this.resolveDeath();
    }
  }

  private resolveDeath(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.currentEngine?.events.emit('gameOver', { lives: this.lives });
      return;
    }

    this.isDead = false;
    this.deathTimer = 0;
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.groundSpeed = 0;
    this.groundAngle = 0;
    this.groundPath = null;
    this.isGrounded = false;
    this.isJumping = false;
    this.invulnerableTimer = 90;
    this.currentEngine?.events.emit('playerRespawned', { player: this });
  }

  public onCollision(other: Entity): void {
    // Handled in other entities (e.g. Ring, Badnik)
  }

  public override getBounds() {
    return {
      left: this.x - this.width / 2,
      right: this.x + this.width / 2,
      bottom: this.y,
      top: this.y + this.height,
    };
  }

  private updateGrounded(
    inputDirection: number,
    wantsRoll: boolean,
    wantsJump: boolean,
    deltaTime: number,
    engine: Engine,
  ): void {
    const terrain = engine.terrain;
    const legacyFloor = !terrain || terrain.isEmpty;

    if (!this.groundPath && !legacyFloor) {
      // grounded without an actual surface (shouldn't happen) - start falling
      this.isGrounded = false;
      return;
    }

    if (!this.groundPath) {
      // legacy flat floor: velocityX stays authoritative for simple setups
      this.groundSpeed = this.velocityX;
    }

    if (wantsRoll && Math.abs(this.groundSpeed) > 2) {
      this.isRolling = true;
    } else if (!wantsRoll || Math.abs(this.groundSpeed) < 0.5) {
      this.isRolling = false;
    }

    if (inputDirection !== 0) {
      this.facingDirection = inputDirection as 1 | -1;
      const isReversing = this.groundSpeed !== 0 && Math.sign(this.groundSpeed) !== inputDirection;
      const acceleration = isReversing ? this.braking : this.speed;

      this.groundSpeed += inputDirection * acceleration * deltaTime;
    } else if (this.isFloorAngle(this.groundAngle)) {
      // friction only applies on floor-like surfaces; walls and ceilings
      // (loop interiors) are governed by the slope factor alone
      const deceleration = this.isRolling ? this.rollingDeceleration : this.deceleration;
      this.groundSpeed = this.moveTowardZero(this.groundSpeed, deceleration * deltaTime);
    }
    this.groundSpeed = clamp(this.groundSpeed, -this.maxRunSpeed, this.maxRunSpeed);

    // slope factor: gravity projected on the surface tangent
    const sinAngle = Math.sin(this.groundAngle);
    if (this.isRolling) {
      const uphill = sinAngle !== 0 && Math.sign(this.groundSpeed) === Math.sign(sinAngle);
      const slope = uphill ? this.slopeRollUp : this.slopeRollDown;
      this.groundSpeed -= slope * sinAngle * deltaTime;
    } else {
      this.groundSpeed -= this.slopeFactor * sinAngle * deltaTime;
    }

    if (wantsJump) {
      const cos = Math.cos(this.groundAngle);
      const sin = Math.sin(this.groundAngle);
      this.isGrounded = false;
      this.isJumping = true;
      this.groundPath = null;
      // jump along the surface normal; keep groundAngle as launch orientation
      this.velocityX = this.groundSpeed * cos - this.jumpForce * sin;
      this.velocityY = this.groundSpeed * sin + this.jumpForce * cos;
      return;
    }

    if (!this.groundPath) {
      this.velocityX = this.groundSpeed;
      this.velocityY = 0;
      return;
    }

    this.followGroundPath(this.groundPath, terrain, deltaTime);
  }

  private followGroundPath(path: TerrainPath, terrain: Terrain | undefined, deltaTime: number): void {
    // slip off steep surfaces when too slow (classic Sonic slipping, and
    // falling out of a loop)
    const normalized = ((this.groundAngle % TWO_PI) + TWO_PI) % TWO_PI;
    const steepness = Math.min(normalized, TWO_PI - normalized);
    if (Math.abs(this.groundSpeed) < this.slipSpeed && steepness > this.slipAngle) {
      this.detachFromGround();
      return;
    }

    const previousDistance = this.groundDistance;
    this.groundDistance += this.groundSpeed * deltaTime;

    if (!path.closed && (this.groundDistance < 0 || this.groundDistance > path.totalLength)) {
      // ran off the end of the surface: launch with the current momentum
      this.detachFromGround();
      return;
    }

    const sample = path.sample(this.groundDistance);

    if (terrain && this.groundSpeed !== 0) {
      const movingRight = sample.x > this.x;
      const wallX = terrain.wallBetween(
        this.x,
        sample.x,
        Math.min(this.y, sample.y) + this.height * 0.25,
        Math.max(this.y, sample.y) + this.height * 0.9,
      );
      const blocking = wallX !== null
        && ((movingRight && wallX > this.x) || (!movingRight && wallX < this.x));
      if (blocking && wallX !== null) {
        this.groundDistance = previousDistance;
        this.groundSpeed = 0;
        const restored = path.sample(previousDistance);
        this.x = restored.x;
        this.y = restored.y;
        this.velocityX = 0;
        this.velocityY = 0;
        return;
      }
    }

    this.x = sample.x;
    this.y = sample.y;
    this.groundAngle = sample.angle;

    const cos = Math.cos(this.groundAngle);
    const sin = Math.sin(this.groundAngle);
    this.velocityX = this.groundSpeed * cos;
    this.velocityY = this.groundSpeed * sin;
  }

  private updateAirborne(
    inputDirection: number,
    jumpHeld: boolean,
    deltaTime: number,
    engine: Engine,
  ): void {
    const terrain = engine.terrain;

    if (inputDirection !== 0) {
      this.facingDirection = inputDirection as 1 | -1;
      this.velocityX += inputDirection * this.airAcceleration * deltaTime;
      this.velocityX = clamp(this.velocityX, -this.maxRunSpeed, this.maxRunSpeed);
    } else {
      this.velocityX *= this.airDrag ** deltaTime;
      if (Math.abs(this.velocityX) < 0.001) {
        this.velocityX = 0;
      }
    }

    // variable jump height: releasing the button cuts upward speed
    if (this.isJumping && !jumpHeld && this.velocityY > this.jumpCutoff) {
      this.velocityY = this.jumpCutoff;
    }

    // airborne orientation slowly returns upright (classic air angle recovery)
    if (this.groundAngle !== 0) {
      const step = this.airAngleRecovery * deltaTime;
      if (Math.abs(this.groundAngle) <= step) {
        this.groundAngle = 0;
      } else {
        this.groundAngle -= Math.sign(this.groundAngle) * step;
      }
    }

    engine.physics.applyGravity(this, deltaTime);
    if (this.velocityY < -this.maxFallSpeed) {
      this.velocityY = -this.maxFallSpeed;
    }

    const previousX = this.x;
    this.x += this.velocityX * deltaTime;
    this.y += this.velocityY * deltaTime;

    if (terrain && !terrain.isEmpty && this.x !== previousX) {
      const movingRight = this.x > previousX;
      const wallX = terrain.wallBetween(previousX, this.x, this.y + 2, this.y + this.height - 2);
      const blocking = wallX !== null
        && ((movingRight && wallX > previousX) || (!movingRight && wallX < previousX));
      if (blocking && wallX !== null) {
        this.x = movingRight
          ? wallX - this.width / 2 - 0.01
          : wallX + this.width / 2 + 0.01;
        this.velocityX = 0;
      }
    }

    if (terrain && !terrain.isEmpty) {
      const hit = this.detectLanding(terrain);
      if (hit) {
        this.attachToGround(hit);
      }
      return;
    }

    // legacy infinite floor at y=0
    if (this.y <= 0) {
      this.y = 0;
      this.velocityY = 0;
      this.isGrounded = true;
      this.isJumping = false;
      this.groundAngle = 0;
      this.groundSpeed = this.velocityX;
    }
  }

  private detectLanding(terrain: Terrain): RaycastHit | null {
    const cos = Math.cos(this.groundAngle);
    const sin = Math.sin(this.groundAngle);
    // "down" relative to the current orientation
    const dirX = sin;
    const dirY = -cos;

    const sensors: Array<[number, number]> = [
      [this.x + cos * (this.width / 4), this.y + sin * (this.width / 4)],
      [this.x - cos * (this.width / 4), this.y - sin * (this.width / 4)],
    ];
    const directions: Array<[number, number]> = [[dirX, dirY]];
    // straight world-down as well, so falls inside loops land on any surface
    if (Math.abs(dirX) > 1e-3 || Math.abs(dirY + 1) > 1e-3) {
      directions.push([0, -1]);
    }

    const reach = this.landingSnap
      + Math.max(0, this.velocityX * dirX + this.velocityY * dirY);

    let best: RaycastHit | null = null;
    let bestDistance = Infinity;

    for (const [originX, originY] of sensors) {
      for (const [dx, dy] of directions) {
        // must be moving toward the surface (or barely moving at all)
        const approach = this.velocityX * dx + this.velocityY * dy;
        if (approach < -0.01) continue;

        const hit = terrain.raycast(originX, originY, dx, dy, reach);
        if (!hit) continue;

        const distance = Math.hypot(hit.x - originX, hit.y - originY);
        if (distance < bestDistance) {
          best = hit;
          bestDistance = distance;
        }
      }
    }

    return best;
  }

  private attachToGround(hit: RaycastHit): void {
    const cos = Math.cos(hit.angle);
    const sin = Math.sin(hit.angle);

    this.groundPath = hit.path;
    this.groundAngle = hit.angle;
    this.isGrounded = true;
    this.isJumping = false;

    // project current velocity onto the surface tangent
    this.groundSpeed = this.velocityX * cos + this.velocityY * sin;

    // center the feet on the surface at the point under the player
    const alongPath = (this.x - hit.x) * cos + (this.y - hit.y) * sin;
    this.groundDistance = hit.pathDistance + alongPath;
    if (!hit.path.closed) {
      this.groundDistance = clamp(this.groundDistance, 0, hit.path.totalLength);
    }
    const sample = hit.path.sample(this.groundDistance);
    this.x = sample.x;
    this.y = sample.y;

    this.velocityX = this.groundSpeed * cos;
    this.velocityY = this.groundSpeed * sin;
  }

  private detachFromGround(): void {
    const cos = Math.cos(this.groundAngle);
    const sin = Math.sin(this.groundAngle);
    this.velocityX = this.groundSpeed * cos;
    this.velocityY = this.groundSpeed * sin;
    this.isGrounded = false;
    this.groundPath = null;
    // groundAngle is kept as the launch orientation; it recovers in air
  }

  private isFloorAngle(angle: number): boolean {
    const normalized = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
    return normalized < FL45 || normalized > TWO_PI - FL45;
  }

  private moveTowardZero(value: number, amount: number): number {
    if (value > 0) return Math.max(0, value - amount);
    if (value < 0) return Math.min(0, value + amount);
    return 0;
  }

  private updateVisualState(deltaTime: number): void {
    this.visualRoot.scale.x = this.facingDirection;
    // blink while invulnerable after a hit (not during monitor invincibility)
    this.visualRoot.visible = !(this.invulnerableTimer > 0
      && Math.floor(this.invulnerableTimer / 3) % 2 === 0);
    // the flip inverts child rotation, so pre-multiply by the facing to keep
    // the world tilt consistent on slopes and loops
    this.orientationGroup.rotation.z = this.facingDirection * this.groundAngle;
    this.playAnimationForState(this.getAnimationState());
    this.animationMixer?.update(deltaTime / 60);
  }

  private getAnimationState(): PlayerAnimationState {
    if (this.isDead) return 'jump';
    if (this.isRolling) return 'roll';
    if (!this.isGrounded && this.velocityY > 0) return 'jump';
    if (!this.isGrounded && this.velocityY < 0) return 'fall';
    if (Math.abs(this.velocityX) > 5) return 'boost';
    if (Math.abs(this.velocityX) > 0.1) return 'run';
    return 'idle';
  }

  private playAnimationForState(state: PlayerAnimationState): void {
    const clipName = this.animationMap[state];
    if (!clipName || clipName === this.currentAnimationName) return;

    const nextAction = this.animationActions.get(clipName);
    if (!nextAction) return;

    const previousAction = this.currentAnimationName
      ? this.animationActions.get(this.currentAnimationName)
      : null;

    previousAction?.fadeOut(0.08);
    nextAction.reset().fadeIn(0.08).play();
    this.currentAnimationName = clipName;
  }
}
