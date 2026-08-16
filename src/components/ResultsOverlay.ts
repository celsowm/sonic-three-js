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
    this.container.style.background = 'rgba(0, 0, 0, 0.55)';
    this.container.style.display = 'none';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    this.container.style.zIndex = '30';
    this.container.style.fontFamily = 'sans-serif';

    const panel = document.createElement('div');
    panel.style.background = '#122c44';
    panel.style.border = '4px solid #ffd23f';
    panel.style.padding = '30px 54px';
    panel.style.textAlign = 'center';
    panel.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.5)';

    this.titleEl = document.createElement('div');
    this.titleEl.style.color = '#ffd23f';
    this.titleEl.style.fontSize = '30px';
    this.titleEl.style.letterSpacing = '4px';
    this.titleEl.style.marginBottom = '22px';

    this.rowsEl = document.createElement('div');
    this.rowsEl.style.color = '#ffffff';
    this.rowsEl.style.fontSize = '20px';
    this.rowsEl.style.display = 'flex';
    this.rowsEl.style.flexDirection = 'column';
    this.rowsEl.style.gap = '8px';
    this.rowsEl.style.marginBottom = '26px';

    this.buttonEl = document.createElement('button');
    this.buttonEl.style.background = '#ffd23f';
    this.buttonEl.style.border = 'none';
    this.buttonEl.style.padding = '12px 28px';
    this.buttonEl.style.fontSize = '18px';
    this.buttonEl.style.fontWeight = 'bold';
    this.buttonEl.style.cursor = 'pointer';

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
      const label = document.createElement('span');
      label.style.color = '#9fc3e8';
      label.style.marginRight = '14px';
      label.innerText = row.label;
      const value = document.createElement('span');
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
