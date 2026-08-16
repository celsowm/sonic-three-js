import { Player } from '../entities/Player';

export class HUD {
  private container: HTMLDivElement;
  private scoreEl: HTMLDivElement;
  private timeEl: HTMLDivElement;
  private ringsEl: HTMLDivElement;
  private livesEl: HTMLDivElement;

  private startTime: number = Date.now();
  private pausedAt: number | null = null;
  private elapsedSeconds: number = 0;

  constructor(parentId: string) {
    const parent = document.getElementById(parentId);
    if (!parent) throw new Error(`Parent ${parentId} not found`);

    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '10px';
    this.container.style.left = '10px';
    this.container.style.color = '#fff';
    this.container.style.fontFamily = 'sans-serif';
    this.container.style.fontSize = '24px';
    this.container.style.textShadow = '2px 2px 0 #000';
    this.container.style.pointerEvents = 'none';

    this.scoreEl = document.createElement('div');
    this.timeEl = document.createElement('div');
    this.ringsEl = document.createElement('div');
    this.livesEl = document.createElement('div');

    this.container.appendChild(this.scoreEl);
    this.container.appendChild(this.timeEl);
    this.container.appendChild(this.ringsEl);
    this.container.appendChild(this.livesEl);

    parent.style.position = 'relative'; // ensure parent can contain absolute element
    parent.appendChild(this.container);

    this.updateDisplay(0, 0, 0, 3);
  }

  public update(player: Player) {
    if (this.pausedAt === null) {
      this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    }
    this.updateDisplay(player.score, this.elapsedSeconds, player.rings, player.lives);
  }

  /** Freezes the timer while the game is paused. */
  public pause(): void {
    if (this.pausedAt === null) {
      this.pausedAt = Date.now();
    }
  }

  public resume(): void {
    if (this.pausedAt !== null) {
      this.startTime += Date.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  /** Restarts the timer from zero (level restart). */
  public reset(): void {
    this.startTime = Date.now();
    this.pausedAt = null;
    this.elapsedSeconds = 0;
  }

  public get elapsed(): number {
    return this.elapsedSeconds;
  }

  private updateDisplay(score: number, time: number, rings: number, lives: number) {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    this.scoreEl.innerText = `SCORE: ${score}`;
    this.timeEl.innerText = `TIME: ${timeStr}`;
    this.ringsEl.innerText = `RINGS: ${rings}`;
    this.livesEl.innerText = `LIVES: ${Math.max(0, lives)}`;
  }

  public destroy() {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
