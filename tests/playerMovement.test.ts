import { describe, expect, it } from 'vitest';
import { Physics } from '../src/core/Physics';
import { Player } from '../src/entities/Player';

function engineWithKeys(keys: string[] = []) {
  const pressed = new Set(keys);

  return {
    input: {
      isDown: (code: string) => pressed.has(code),
    },
    physics: new Physics(),
  };
}

describe('Player movement feel', () => {
  it('accelerates toward a capped run speed instead of growing endlessly', () => {
    const player = new Player(0, 0);
    player.isGrounded = true;
    const engine = engineWithKeys(['ArrowRight']);

    for (let frame = 0; frame < 120; frame++) {
      player.update(1, engine as never);
    }

    expect(player.velocityX).toBe(player.maxRunSpeed);
  });

  it('decelerates quickly on ground when input is released', () => {
    const player = new Player(0, 0);
    player.isGrounded = true;
    player.velocityX = 5;

    player.update(1, engineWithKeys() as never);

    expect(player.velocityX).toBe(4.45);
  });

  it('brakes harder when reversing direction', () => {
    const coasting = new Player(0, 0);
    coasting.isGrounded = true;
    coasting.velocityX = 5;
    coasting.update(1, engineWithKeys() as never);

    const reversing = new Player(0, 0);
    reversing.isGrounded = true;
    reversing.velocityX = 5;
    reversing.update(1, engineWithKeys(['ArrowLeft']) as never);

    expect(reversing.velocityX).toBeLessThan(coasting.velocityX);
    expect(reversing.velocityX).toBe(4.1);
  });

  it('keeps more momentum while airborne', () => {
    const player = new Player(0, 10);
    player.isGrounded = false;
    player.velocityX = 5;

    player.update(1, engineWithKeys() as never);

    expect(player.velocityX).toBeGreaterThan(4.9);
  });

  it('reduces rolling deceleration to preserve momentum', () => {
    const rolling = new Player(0, 0);
    rolling.isGrounded = true;
    rolling.velocityX = 5;
    rolling.update(1, engineWithKeys(['ArrowDown']) as never);

    const standing = new Player(0, 0);
    standing.isGrounded = true;
    standing.velocityX = 5;
    standing.update(1, engineWithKeys() as never);

    expect(rolling.isRolling).toBe(true);
    expect(rolling.velocityX).toBeGreaterThan(standing.velocityX);
  });
});
