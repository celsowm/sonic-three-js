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
    this.container.style.background = '#0b1c2c';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    this.container.style.gap = '18px';
    this.container.style.zIndex = '40';
    this.container.style.fontFamily = 'sans-serif';

    this.labelEl = document.createElement('div');
    this.labelEl.style.color = '#ffffff';
    this.labelEl.style.fontSize = '26px';
    this.labelEl.style.letterSpacing = '6px';
    this.labelEl.innerText = 'LOADING';

    const track = document.createElement('div');
    track.style.width = '320px';
    track.style.height = '16px';
    track.style.border = '2px solid #ffffff';
    track.style.padding = '2px';

    this.fillEl = document.createElement('div');
    this.fillEl.style.height = '100%';
    this.fillEl.style.width = '0%';
    this.fillEl.style.background = '#ffd23f';
    this.fillEl.style.transition = 'width 0.15s ease-out';
    track.appendChild(this.fillEl);

    this.container.appendChild(this.labelEl);
    this.container.appendChild(track);
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
