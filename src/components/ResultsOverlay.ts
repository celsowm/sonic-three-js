export interface ResultsRow {
  label: string;
  value: string;
}

/** Centered result panel used for stage clear and game over screens. */
export class ResultsOverlay {
  private readonly container: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly rowsEl: HTMLDivElement;
  private readonly buttonEl: HTMLButtonElement;

  constructor(parentId: string) {
    const parent = document.getElementById(parentId);
    if (!parent) throw new Error(`Parent ${parentId} not found`);

    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.inset = '0';
    this.container.style.background = 'rgba(5, 12, 22, 0.75)';
    this.container.style.backdropFilter = 'blur(6px)';
    this.container.style.display = 'none';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    this.container.style.zIndex = '30';
    this.container.style.fontFamily = "'Press Start 2P', monospace, sans-serif";

    const panel = document.createElement('div');
    panel.style.background = 'linear-gradient(180deg, #122c44 0%, #0a1928 100%)';
    panel.style.border = '4px solid #ffe600';
    panel.style.borderRadius = '12px';
    panel.style.padding = '36px 54px';
    panel.style.textAlign = 'center';
    panel.style.boxShadow = '0 16px 50px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(255, 230, 0, 0.15)';
    panel.style.maxWidth = '500px';

    this.titleEl = document.createElement('div');
    this.titleEl.style.color = '#ffe600';
    this.titleEl.style.fontSize = '22px';
    this.titleEl.style.lineHeight = '1.4';
    this.titleEl.style.letterSpacing = '2px';
    this.titleEl.style.marginBottom = '28px';
    this.titleEl.style.textShadow = '3px 3px 0 #000';

    this.rowsEl = document.createElement('div');
    this.rowsEl.style.color = '#ffffff';
    this.rowsEl.style.fontSize = '14px';
    this.rowsEl.style.lineHeight = '1.8';
    this.rowsEl.style.display = 'flex';
    this.rowsEl.style.flexDirection = 'column';
    this.rowsEl.style.gap = '12px';
    this.rowsEl.style.marginBottom = '32px';

    this.buttonEl = document.createElement('button');
    this.buttonEl.style.background = 'linear-gradient(180deg, #ffe600 0%, #ffaa00 100%)';
    this.buttonEl.style.color = '#000000';
    this.buttonEl.style.border = '3px solid #ffffff';
    this.buttonEl.style.borderRadius = '8px';
    this.buttonEl.style.padding = '14px 28px';
    this.buttonEl.style.fontSize = '14px';
    this.buttonEl.style.fontFamily = "'Press Start 2P', monospace, sans-serif";
    this.buttonEl.style.fontWeight = 'bold';
    this.buttonEl.style.cursor = 'pointer';
    this.buttonEl.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
    this.buttonEl.style.transition = 'transform 0.1s, filter 0.1s';

    this.buttonEl.onmouseover = () => {
      this.buttonEl.style.filter = 'brightness(1.15)';
      this.buttonEl.style.transform = 'scale(1.04)';
    };
    this.buttonEl.onmouseout = () => {
      this.buttonEl.style.filter = 'none';
      this.buttonEl.style.transform = 'none';
    };

    panel.appendChild(this.titleEl);
    panel.appendChild(this.rowsEl);
    panel.appendChild(this.buttonEl);
    this.container.appendChild(panel);
    parent.style.position = 'relative';
    parent.appendChild(this.container);
  }

  public show(title: string, rows: ResultsRow[], buttonText: string, onButton: () => void): void {
    this.titleEl.innerText = title;
    this.rowsEl.innerHTML = '';
    for (const row of rows) {
      const line = document.createElement('div');
      line.style.display = 'flex';
      line.style.justifyContent = 'space-between';
      line.style.alignItems = 'center';

      const label = document.createElement('span');
      label.style.color = '#ffe600';
      label.style.textShadow = '2px 2px 0 #000';
      label.innerText = row.label;

      const value = document.createElement('span');
      value.style.color = '#ffffff';
      value.style.textShadow = '2px 2px 0 #000';
      value.innerText = row.value;

      line.appendChild(label);
      line.appendChild(value);
      this.rowsEl.appendChild(line);
    }
    this.buttonEl.innerText = buttonText;
    this.buttonEl.onclick = () => onButton();
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public destroy(): void {
    this.container.remove();
  }
}
