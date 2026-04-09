/**
 * FloatingToolbar — a shadow-DOM-isolated toolbar that pins itself above
 * (or below, when there's no room) the currently focused text field.
 *
 * Exposes two actions: Polish (F1) and Score (F5). The content script wires
 * the callbacks to the real feature handlers.
 */

const HOST_ID = 'agent-assist-toolbar-host';

const TOOLBAR_CSS = `
.toolbar {
  display: none;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 12px;
  color: #111827;
  user-select: none;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: #ffffff;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #2563eb;
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  line-height: 1;
}
.btn:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
}
.btn:active {
  background: #dbeafe;
}
.btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}
.btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
`;

export interface ToolbarCallbacks {
  onPolishClick: () => void;
  onScoreClick: () => void;
}

const TOOLBAR_HEIGHT_PX = 36;
const SPACING_PX = 6;
const MAX_Z_INDEX = 2147483647;

export class FloatingToolbar {
  private host: HTMLElement | null = null;
  private root: HTMLDivElement | null = null;
  private anchor: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;
  private readonly onScrollOrResize = (): void => this.reposition();

  constructor(callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
  }

  show(anchor: HTMLElement): void {
    this.ensureMounted();
    this.anchor = anchor;
    if (this.root) this.root.style.display = 'flex';
    this.reposition();
    window.addEventListener('scroll', this.onScrollOrResize, true);
    window.addEventListener('resize', this.onScrollOrResize);
  }

  hide(): void {
    this.anchor = null;
    if (this.root) this.root.style.display = 'none';
    window.removeEventListener('scroll', this.onScrollOrResize, true);
    window.removeEventListener('resize', this.onScrollOrResize);
  }

  destroy(): void {
    this.hide();
    this.host?.remove();
    this.host = null;
    this.root = null;
  }

  private ensureMounted(): void {
    if (this.host) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    // `all: initial` resets any host-page styles; then we re-apply what we
    // need with !important so page CSS targeting our id can't override.
    host.style.cssText = [
      'all: initial',
      'position: fixed !important',
      'top: 0 !important',
      'left: 0 !important',
      `z-index: ${MAX_Z_INDEX} !important`,
      'pointer-events: none !important',
    ].join('; ');
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = TOOLBAR_CSS;
    shadow.appendChild(style);

    const root = document.createElement('div');
    root.className = 'toolbar';
    root.style.pointerEvents = 'auto';
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'Agent Assist actions');

    root.append(
      this.makeButton('✨ Polish', 'Polish draft reply', this.callbacks.onPolishClick),
      this.makeButton('📊 Score', 'Score draft reply', this.callbacks.onScoreClick),
    );

    shadow.appendChild(root);

    this.host = host;
    this.root = root;
  }

  private makeButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = label;
    btn.setAttribute('aria-label', ariaLabel);
    // Prevent mousedown from stealing focus from the text field.
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      onClick();
    });
    return btn;
  }

  private reposition(): void {
    if (!this.host || !this.anchor) return;
    const rect = this.anchor.getBoundingClientRect();
    const fitsAbove = rect.top - TOOLBAR_HEIGHT_PX - SPACING_PX > 0;
    const top = fitsAbove ? rect.top - TOOLBAR_HEIGHT_PX - SPACING_PX : rect.bottom + SPACING_PX;
    const left = Math.max(0, rect.left);
    this.host.style.transform = `translate(${left}px, ${Math.max(0, top)}px)`;
  }
}
