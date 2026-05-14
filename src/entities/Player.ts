import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from '../core/Engine';

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

export class Player extends Entity {
  public speed: number = 0.35;
  public airAcceleration: number = 0.16;
  public deceleration: number = 0.55;
  public braking: number = 0.9;
  public rollingDeceleration: number = 0.12;
  public airDrag: number = 0.995;
  public maxRunSpeed: number = 8.5;
  public jumpForce: number = 9;
  public isRolling: boolean = false;
  public rings: number = 0;
  public score: number = 0;
  public currentAnimationName: string | null = null;

  private readonly visualRoot: THREE.Group;
  private readonly modelRoot: THREE.Group;
  private placeholder: THREE.Object3D;
  private animationMixer: THREE.AnimationMixer | null = null;
  private animationActions = new Map<string, THREE.AnimationAction>();
  private animationMap: Record<PlayerAnimationState, string> = { ...DEFAULT_ANIMATION_MAP };
  private facingDirection: 1 | -1 = 1;

  constructor(x: number, y: number) {
    super(x, y, 12, 22);

    this.visualRoot = new THREE.Group();
    this.modelRoot = new THREE.Group();

    const geometry = new THREE.SphereGeometry(5, 16, 16);
    const material = new THREE.MeshLambertMaterial({ color: 0x0000ff });
    this.placeholder = new THREE.Mesh(geometry, material);

    this.visualRoot.add(this.placeholder);
    this.visualRoot.add(this.modelRoot);
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
    const input = engine.input;
    const physics = engine.physics;
    const inputDirection = Number(input.isDown('ArrowRight')) - Number(input.isDown('ArrowLeft'));

    this.updateHorizontalMovement(inputDirection, input.isDown('ArrowDown'), deltaTime);

    // Jumping
    if (input.isDown('Space') && this.isGrounded) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
    }

    // Apply physics
    physics.applyGravity(this, deltaTime);
    physics.applyVelocity(this, deltaTime);

    // Basic floor collision at y=0
    if (this.y <= 0) {
      this.y = 0;
      this.velocityY = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    this.syncMesh();
    this.updateVisualState(deltaTime);
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

  private updateHorizontalMovement(inputDirection: number, wantsRoll: boolean, deltaTime: number): void {
    if (wantsRoll && this.isGrounded && Math.abs(this.velocityX) > 2) {
      this.isRolling = true;
    } else if (!wantsRoll || Math.abs(this.velocityX) < 0.5) {
      this.isRolling = false;
    }

    if (inputDirection !== 0) {
      this.facingDirection = inputDirection as 1 | -1;
      const isReversing = this.velocityX !== 0 && Math.sign(this.velocityX) !== inputDirection;
      const acceleration = this.isGrounded
        ? (isReversing ? this.braking : this.speed)
        : this.airAcceleration;

      this.velocityX += inputDirection * acceleration * deltaTime;
      this.velocityX = THREE.MathUtils.clamp(this.velocityX, -this.maxRunSpeed, this.maxRunSpeed);
      return;
    }

    if (this.isGrounded) {
      const deceleration = this.isRolling ? this.rollingDeceleration : this.deceleration;
      this.velocityX = this.moveTowardZero(this.velocityX, deceleration * deltaTime);
      return;
    }

    this.velocityX *= this.airDrag ** deltaTime;
    if (Math.abs(this.velocityX) < 0.001) {
      this.velocityX = 0;
    }
  }

  private moveTowardZero(value: number, amount: number): number {
    if (value > 0) return Math.max(0, value - amount);
    if (value < 0) return Math.min(0, value + amount);
    return 0;
  }

  private updateVisualState(deltaTime: number): void {
    this.visualRoot.scale.x = this.facingDirection;
    this.playAnimationForState(this.getAnimationState());
    this.animationMixer?.update(deltaTime / 60);
  }

  private getAnimationState(): PlayerAnimationState {
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
