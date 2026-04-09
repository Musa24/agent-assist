/**
 * FloatingToolbar — a shadow-DOM-isolated toolbar that pins itself above
 * (or below, when there's no room) the currently focused text field.
 *
 * Exposes two primary actions — Polish (F1) and Score (F5) — plus a
 * transient Undo button that the PolishHandler shows after a successful
 * polish, and a status line for loading / error messages.
 */

const HOST_ID = 'agent-assist-toolbar-host';

const TOOLBAR_CSS = `
.toolbar {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 12px;
  color: #111827;
  user-select: none;
}
.actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
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
  white-space: nowrap;
}
.btn:hover:not([disabled]) {
  background: #eff6ff;
  border-color: #bfdbfe;
}
.btn:active:not([disabled]) {
  background: #dbeafe;
}
.btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}
.btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn.undo {
  color: #374151;
}
.status {
  display: none;
  padding: 2px 6px 0;
  font-size: 11px;
  line-height: 1.3;
}
.status.visible {
  display: block;
}
.status.error {
  color: #dc2626;
}
.status.success {
  color: #16a34a;
}
.status.info {
  color: #374151;
}
`;

export interface ToolbarCallbacks {
  onPolishClick: () => void;
  onScoreClick: () => void;
}

type StatusKind = 'error' | 'success' | 'info';

const TOOLBAR_HEIGHT_PX = 44;
const SPACING_PX = 6;
const MAX_Z_INDEX = 2147483647;
const POLISH_LABEL_IDLE = '✨ Polish';
const POLISH_LABEL_LOADING = '✨ Polishing…';

export class FloatingToolbar {
  private host: HTMLElement | null = null;
  private root: HTMLDivElement | null = null;
  private actions: HTMLDivElement | null = null;
  private polishBtn: HTMLButtonElement | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private statusEl: HTMLDivElement | null = null;
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
    this.actions = null;
    this.polishBtn = null;
    this.undoBtn = null;
    this.statusEl = null;
  }

  // ----- Polish button state -----

  setPolishLoading(loading: boolean): void {
    this.ensureMounted();
    if (!this.polishBtn) return;
    this.polishBtn.disabled = loading;
    this.polishBtn.textContent = loading ? POLISH_LABEL_LOADING : POLISH_LABEL_IDLE;
  }

  // ----- Undo button -----

  showUndo(onClick: () => void): void {
    this.ensureMounted();
    if (!this.actions) return;
    this.hideUndo();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn undo';
    btn.textContent = '↶ Undo';
    btn.setAttribute('aria-label', 'Undo polish');
    btn.addEventListener('mousedown', (event) => event.preventDefault());
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      onClick();
    });
    // Insert after Polish button (if present), otherwise at the start.
    if (this.polishBtn && this.polishBtn.nextSibling) {
      this.actions.insertBefore(btn, this.polishBtn.nextSibling);
    } else {
      this.actions.append(btn);
    }
    this.undoBtn = btn;
  }

  hideUndo(): void {
    if (!this.undoBtn) return;
    this.undoBtn.remove();
    this.undoBtn = null;
  }

  // ----- Status line -----

  showError(message: string): void {
    this.setStatus('error', message);
  }

  showSuccess(message: string): void {
    this.setStatus('success', message);
  }

  clearStatus(): void {
    if (!this.statusEl) return;
    this.statusEl.className = 'status';
    this.statusEl.textContent = '';
  }

  // ----- Mounting -----

  private setStatus(kind: StatusKind, message: string): void {
    this.ensureMounted();
    if (!this.statusEl) return;
    this.statusEl.className = `status visible ${kind}`;
    this.statusEl.textContent = message;
  }

  private ensureMounted(): void {
    if (this.host) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
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

    const actions = document.createElement('div');
    actions.className = 'actions';

    const polish = this.makeButton(POLISH_LABEL_IDLE, 'Polish draft reply', this.callbacks.onPolishClick);
    const score = this.makeButton('📊 Score', 'Score draft reply', this.callbacks.onScoreClick);
    actions.append(polish, score);

    const status = document.createElement('div');
    status.className = 'status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    root.append(actions, status);
    shadow.appendChild(root);

    this.host = host;
    this.root = root;
    this.actions = actions;
    this.polishBtn = polish;
    this.statusEl = status;
    void score; // score button handled entirely via callbacks, no stored ref needed
  }

  private makeButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = label;
    btn.setAttribute('aria-label', ariaLabel);
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
