import { describe, expect, it } from 'vitest';
import { Input } from '../src/core/Input';

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));
const release = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }));

describe('Input', () => {
  it('tracks key down/up state', () => {
    const input = new Input();

    expect(input.isDown('ArrowRight')).toBe(false);

    press('ArrowRight');
    expect(input.isDown('ArrowRight')).toBe(true);

    release('ArrowRight');
    expect(input.isDown('ArrowRight')).toBe(false);

    input.destroy();
  });

  it('reports justPressed only until the frame ends', () => {
    const input = new Input();

    press('Space');
    expect(input.justPressed('Space')).toBe(true);

    input.endFrame();
    expect(input.justPressed('Space')).toBe(false);
    expect(input.isDown('Space')).toBe(true);

    input.destroy();
  });

  it('prevents default scrolling for game keys', () => {
    const input = new Input();

    const spaceEvent = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
    window.dispatchEvent(spaceEvent);
    expect(spaceEvent.defaultPrevented).toBe(true);

    const keyAEvent = new KeyboardEvent('keydown', { code: 'KeyA', cancelable: true });
    window.dispatchEvent(keyAEvent);
    expect(keyAEvent.defaultPrevented).toBe(false);

    input.destroy();
  });

  it('clears key state when the window loses focus', () => {
    const input = new Input();

    press('ArrowLeft');
    expect(input.isDown('ArrowLeft')).toBe(true);

    window.dispatchEvent(new Event('blur'));
    expect(input.isDown('ArrowLeft')).toBe(false);

    input.destroy();
  });

  it('destroy actually removes the listeners', () => {
    const input = new Input();
    input.destroy();

    press('ArrowRight');
    expect(input.isDown('ArrowRight')).toBe(false);
    expect(input.justPressed('ArrowRight')).toBe(false);
  });
});
