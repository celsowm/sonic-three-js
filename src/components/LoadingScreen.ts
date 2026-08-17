/** Full-screen loading overlay driven by LevelLoader progress callbacks. */
export class LoadingScreen {
  private readonly container: HTMLDivElement;
  private readonly labelEl: HTMLDivElement;
  private readonly fillEl: HTMLDivElement;

  constructor(parentId: string) {
    const parent = document.getElementById(parentId);
    if (!parent) throw new Error(`Parent ${parentId} not found`);

    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.inset = '0';
    this.container.style.background = 'radial-gradient(circle at center, #1b3d5d 0%, #08121e 100%)';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    this.container.style.gap = '20px';
    this.container.style.zIndex = '40';
    this.container.style.fontFamily = "'Press Start 2P', monospace, sans-serif";

    const card = document.createElement('div');
    card.style.background = 'rgba(10, 24, 40, 0.88)';
    card.style.border = '3px solid #ffe600';
    card.style.borderRadius = '12px';
    card.style.padding = '36px 48px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(255, 230, 0, 0.15)';

    this.labelEl = document.createElement('div');
    this.labelEl.style.color = '#ffe600';
    this.labelEl.style.fontSize = '20px';
    this.labelEl.style.letterSpacing = '2px';
    this.labelEl.style.marginBottom = '20px';
    this.labelEl.style.textShadow = '2px 2px 0 #000';
    this.labelEl.innerText = 'LOADING 0%';

    const track = document.createElement('div');
    track.style.width = '320px';
    track.style.height = '20px';
    track.style.border = '3px solid #ffffff';
    track.style.borderRadius = '10px';
    track.style.padding = '2px';
    track.style.background = '#040910';
    track.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.8)';

    this.fillEl = document.createElement('div');
    this.fillEl.style.height = '100%';
    this.fillEl.style.width = '0%';
    this.fillEl.style.borderRadius = '6px';
    this.fillEl.style.background = 'linear-gradient(90deg, #ffe600, #ff9900)';
    this.fillEl.style.boxShadow = '0 0 10px #ffe600';
    this.fillEl.style.transition = 'width 0.15s ease-out';
    track.appendChild(this.fillEl);

    card.appendChild(this.labelEl);
    card.appendChild(track);
    this.container.appendChild(card);

    parent.style.position = 'relative';
    parent.appendChild(this.container);
  }

  public update(loaded: number, total: number): void {
    const percent = total > 0 ? Math.round((loaded / total) * 100) : 100;
    this.fillEl.style.width = `${percent}%`;
    this.labelEl.innerText = `LOADING ${percent}%`;
  }

  public destroy(): void {
    this.container.remove();
  }
}
