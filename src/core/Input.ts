const PREVENT_DEFAULT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

export class Input {
  public keys: Record<string, boolean> = {};
  private pressedSinceLastFrame: Record<string, boolean> = {};

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (PREVENT_DEFAULT_KEYS.has(event.code)) {
      event.preventDefault();
    }
    this.keys[event.code] = true;
    this.pressedSinceLastFrame[event.code] = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys[event.code] = false;
  };

  private readonly onBlur = (): void => {
    // avoid stuck keys when the window loses focus mid-press
    this.keys = {};
    this.pressedSinceLastFrame = {};
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  public isDown(code: string): boolean {
    return !!this.keys[code];
  }

  /** True if the key went down since the last frame; for one-frame actions like jumping. */
  public justPressed(code: string): boolean {
    return !!this.pressedSinceLastFrame[code];
  }

  /** Called by the engine at the end of each frame. */
  public endFrame(): void {
    this.pressedSinceLastFrame = {};
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
