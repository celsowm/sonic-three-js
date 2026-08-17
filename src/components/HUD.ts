import { Player } from '../entities/Player';

const ensureHUDStyle = (): void => {
  const styleId = 'sonic-hud-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

    .sonic-hud-container {
      position: absolute;
      top: 16px;
      left: 16px;
      font-family: 'Press Start 2P', monospace, sans-serif;
      font-size: 16px;
      line-height: 1.8;
      pointer-events: none;
      user-select: none;
      z-index: 10;
    }

    .sonic-hud-row {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
      filter: drop-shadow(2px 2px 0px #000000);
    }

    .sonic-hud-label {
      color: #ffe600;
      width: 90px;
      letter-spacing: 1px;
      text-shadow:
        -1px -1px 0 #000,
         1px -1px 0 #000,
        -1px  1px 0 #000,
         1px  1px 0 #000,
         2px  2px 0 #000;
    }

    .sonic-hud-value {
      color: #ffffff;
      letter-spacing: 1px;
      text-shadow:
        -1px -1px 0 #000,
         1px -1px 0 #000,
        -1px  1px 0 #000,
         1px  1px 0 #000,
         2px  2px 0 #000;
    }

    .sonic-hud-label.flash-red {
      animation: sonicRingFlash 0.5s infinite alternate;
    }

    @keyframes sonicRingFlash {
      0% { color: #ffe600; }
      100% { color: #ff3333; }
    }
  `;
  document.head.appendChild(style);
};

export class HUD {
  private container: HTMLDivElement;
  private scoreEl: HTMLSpanElement;
  private timeEl: HTMLSpanElement;
  private ringsLabelEl: HTMLSpanElement;
  private ringsValueEl: HTMLSpanElement;
  private livesEl: HTMLSpanElement;

  private startTime: number = Date.now();
  private pausedAt: number | null = null;
  private elapsedSeconds: number = 0;

  constructor(parentId: string) {
    const parent = document.getElementById(parentId);
    if (!parent) throw new Error(`Parent ${parentId} not found`);

    ensureHUDStyle();

    this.container = document.createElement('div');
    this.container.className = 'sonic-hud-container';

    // Score Row
    const scoreRow = document.createElement('div');
    scoreRow.className = 'sonic-hud-row';
    const scoreLabel = document.createElement('span');
    scoreLabel.className = 'sonic-hud-label';
    scoreLabel.innerText = 'SCORE';
    this.scoreEl = document.createElement('span');
    this.scoreEl.className = 'sonic-hud-value';
    scoreRow.appendChild(scoreLabel);
    scoreRow.appendChild(this.scoreEl);

    // Time Row
    const timeRow = document.createElement('div');
    timeRow.className = 'sonic-hud-row';
    const timeLabel = document.createElement('span');
    timeLabel.className = 'sonic-hud-label';
    timeLabel.innerText = 'TIME';
    this.timeEl = document.createElement('span');
    this.timeEl.className = 'sonic-hud-value';
    timeRow.appendChild(timeLabel);
    timeRow.appendChild(this.timeEl);

    // Rings Row
    const ringsRow = document.createElement('div');
    ringsRow.className = 'sonic-hud-row';
    this.ringsLabelEl = document.createElement('span');
    this.ringsLabelEl.className = 'sonic-hud-label';
    this.ringsLabelEl.innerText = 'RINGS';
    this.ringsValueEl = document.createElement('span');
    this.ringsValueEl.className = 'sonic-hud-value';
    ringsRow.appendChild(this.ringsLabelEl);
    ringsRow.appendChild(this.ringsValueEl);

    // Lives Row
    const livesRow = document.createElement('div');
    livesRow.className = 'sonic-hud-row';
    const livesLabel = document.createElement('span');
    livesLabel.className = 'sonic-hud-label';
    livesLabel.innerText = 'LIVES';
    this.livesEl = document.createElement('span');
    this.livesEl.className = 'sonic-hud-value';
    livesRow.appendChild(livesLabel);
    livesRow.appendChild(this.livesEl);

    this.container.appendChild(scoreRow);
    this.container.appendChild(timeRow);
    this.container.appendChild(ringsRow);
    this.container.appendChild(livesRow);

    parent.style.position = 'relative';
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

    this.scoreEl.innerText = String(score).padStart(6, ' ');
    this.timeEl.innerText = timeStr;
    this.ringsValueEl.innerText = String(rings).padStart(3, ' ');
    this.livesEl.innerText = String(Math.max(0, lives));

    if (rings === 0) {
      this.ringsLabelEl.classList.add('flash-red');
    } else {
      this.ringsLabelEl.classList.remove('flash-red');
    }
  }

  public destroy() {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
