import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/Player';

function clip(name: string): THREE.AnimationClip {
  return new THREE.AnimationClip(name, 1, []);
}

describe('Player animated model', () => {
  it('keeps fallback mesh and hitbox before a GLB model is attached', () => {
    const player = new Player(0, 10);

    expect(player.mesh).toBeInstanceOf(THREE.Group);
    expect(player.width).toBe(12);
    expect(player.height).toBe(22);
  });

  it('attaches an animated model without changing physics bounds', () => {
    const player = new Player(0, 10);
    const model = new THREE.Group();

    player.setAnimatedModel(model, [
      clip('idle'),
      clip('sc_run_loop'),
      clip('sc_jump_ball_loop'),
      clip('sc_jump_fall_loop'),
    ]);

    expect(player.width).toBe(12);
    expect(player.height).toBe(22);
    expect(player.currentAnimationName).toBe('idle');
  });

  it('selects the expected animation clips for movement states', () => {
    const player = new Player(0, 10);
    const model = new THREE.Group();

    player.setAnimatedModel(model, [
      clip('idle'),
      clip('sc_run_loop'),
      clip('sc_boost_loop'),
      clip('sc_jump_ball_loop'),
      clip('sc_jump_fall_loop'),
    ]);

    player.isGrounded = true;
    player.velocityX = 1;
    player['updateVisualState'](1);
    expect(player.currentAnimationName).toBe('sc_run_loop');

    player.velocityX = 6;
    player['updateVisualState'](1);
    expect(player.currentAnimationName).toBe('sc_boost_loop');

    player.isRolling = true;
    player['updateVisualState'](1);
    expect(player.currentAnimationName).toBe('sc_jump_ball_loop');

    player.isRolling = false;
    player.isGrounded = false;
    player.velocityY = 2;
    player['updateVisualState'](1);
    expect(player.currentAnimationName).toBe('sc_jump_ball_loop');

    player.velocityY = -2;
    player['updateVisualState'](1);
    expect(player.currentAnimationName).toBe('sc_jump_fall_loop');
  });
});
