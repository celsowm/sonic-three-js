export class Input {
  public keys: Record<string, boolean> = {};

  constructor() {
    window.addEventListener("keydown", this.onKeyDown.bind(this));
    window.addEventListener("keyup", this.onKeyUp.bind(this));
  }

  private onKeyDown(e: KeyboardEvent) {
    this.keys[e.code] = true;
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys[e.code] = false;
  }

  public isDown(code: string): boolean {
    return !!this.keys[code];
  }

  public destroy() {
    window.removeEventListener("keydown", this.onKeyDown.bind(this));
    window.removeEventListener("keyup", this.onKeyUp.bind(this));
  }
}
