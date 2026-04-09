/**
 * FloatingToolbar — a shadow-DOM-isolated pill capsule that pins itself to
 * the right edge of the focused text field. Phase 1 hosts a single Polish
 * (✨) icon button. A preview card appears below the field when the Polish
 * result arrives, offering Accept / Reject before the field is modified.
 *
 * Positioning strategy: the host mirrors the input's bounding rect
 * (position: fixed, same left/top/width/height). Children are placed inside
 * the host with absolute positioning — capsule at the right edge, preview
 * card below the input. This keeps reposition logic trivial on scroll.
 */

const HOST_ID = 'agent-assist-host';

const SHADOW_CSS = `
.root {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  color: #111827;
}
.capsule {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  pointer-events: auto;
}
.capsule.tall {
  top: auto;
  bottom: 8px;
  transform: none;
}
.capsule.visible {
  display: inline-flex;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 999px;
  color: #2563eb;
  cursor: pointer;
}
.icon-btn:hover:not([disabled]) {
  background: #eff6ff;
}
.icon-btn:active:not([disabled]) {
  background: #dbeafe;
}
.icon-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}
.icon-btn[disabled] {
  cursor: not-allowed;
  opacity: 0.7;
}
.icon-btn svg {
  width: 18px;
  height: 18px;
  display: block;
}
.icon-btn.loading svg {
  animation: aa-pulse 1.2s ease-in-out infinite;
}
@keyframes aa-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(0.85); }
}
.preview {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 8px;
  display: none;
  flex-direction: column;
  gap: 8px;
  min-width: 280px;
  max-width: min(520px, 100vw - 24px);
  padding: 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.14);
  pointer-events: auto;
}
.preview.above {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 8px;
}
.preview.visible {
  display: flex;
}
.preview-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.preview-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #111827;
  line-height: 1.45;
  max-height: 240px;
  overflow-y: auto;
}
.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn {
  padding: 6px 12px;
  font: inherit;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn-accept {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}
.btn-accept:hover { background: #1d4ed8; }
.btn-reject {
  background: #ffffff;
  color: #374151;
  border-color: #d1d5db;
}
.btn-reject:hover { background: #f3f4f6; }
.status {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 6px;
  display: none;
  padding: 6px 10px;
  font-size: 11px;
  line-height: 1.3;
  border-radius: 6px;
  pointer-events: auto;
}
.status.visible { display: block; }
.status.error   { color: #dc2626; background: #fee2e2; border: 1px solid #fecaca; }
.status.success { color: #16a34a; background: #dcfce7; border: 1px solid #bbf7d0; }
`;

const POLISH_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 3 L13.6 10.4 L21 12 L13.6 13.6 L12 21 L10.4 13.6 L3 12 L10.4 10.4 Z"/>
</svg>
`;

export interface ToolbarCallbacks {
  onPolishClick: () => void;
}

const MAX_Z_INDEX = 2147483647;
const TALL_FIELD_THRESHOLD_PX = 60;
const PREVIEW_MIN_SPACE_PX = 220;
const PREVIEW_VIEWPORT_MARGIN_PX = 12;

export class FloatingToolbar {
  private host: HTMLElement | null = null;
  private capsule: HTMLDivElement | null = null;
  private polishBtn: HTMLButtonElement | null = null;
  private previewEl: HTMLDivElement | null = null;
  private previewTextEl: HTMLDivElement | null = null;
  private previewAcceptBtn: HTMLButtonElement | null = null;
  private previewRejectBtn: HTMLButtonElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private anchor: HTMLElement | null = null;
  private callbacks: ToolbarCallbacks;
  private readonly onScrollOrResize = (): void => this.reposition();

  constructor(callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;
  }

  // ----- show / hide / destroy -----

  show(anchor: HTMLElement): void {
    this.ensureMounted();
    this.anchor = anchor;
    if (this.capsule) this.capsule.classList.add('visible');
    this.reposition();
    window.addEventListener('scroll', this.onScrollOrResize, true);
    window.addEventListener('resize', this.onScrollOrResize);
  }

  hide(): void {
    this.anchor = null;
    if (this.capsule) this.capsule.classList.remove('visible');
    this.hidePreview();
    this.clearStatus();
    window.removeEventListener('scroll', this.onScrollOrResize, true);
    window.removeEventListener('resize', this.onScrollOrResize);
  }

  destroy(): void {
    this.hide();
    this.host?.remove();
    this.host = null;
    this.capsule = null;
    this.polishBtn = null;
    this.previewEl = null;
    this.previewTextEl = null;
    this.previewAcceptBtn = null;
    this.previewRejectBtn = null;
    this.statusEl = null;
  }

  // ----- Polish button state -----

  setPolishLoading(loading: boolean): void {
    this.ensureMounted();
    if (!this.polishBtn) return;
    this.polishBtn.disabled = loading;
    this.polishBtn.classList.toggle('loading', loading);
    this.polishBtn.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  // ----- Preview / Accept / Reject -----

  showPreview(text: string, onAccept: () => void, onReject: () => void): void {
    this.ensureMounted();
    if (!this.previewEl || !this.previewTextEl || !this.previewAcceptBtn || !this.previewRejectBtn) {
      return;
    }
    this.clearStatus();
    this.previewTextEl.textContent = text;
    this.previewEl.classList.add('visible');

    // Replace handlers each time so we only ever invoke the latest one.
    this.previewAcceptBtn.onclick = (event): void => {
      event.preventDefault();
      onAccept();
    };
    this.previewRejectBtn.onclick = (event): void => {
      event.preventDefault();
      onReject();
    };

    // Re-run positioning now that the preview is in the viewport flow so we
    // flip above the field if there isn't enough room below.
    this.reposition();
  }

  hidePreview(): void {
    if (!this.previewEl) return;
    this.previewEl.classList.remove('visible');
    if (this.previewTextEl) this.previewTextEl.textContent = '';
    if (this.previewAcceptBtn) this.previewAcceptBtn.onclick = null;
    if (this.previewRejectBtn) this.previewRejectBtn.onclick = null;
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

  // ----- Internals -----

  private setStatus(kind: 'error' | 'success', message: string): void {
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
      'width: 0 !important',
      'height: 0 !important',
      `z-index: ${MAX_Z_INDEX} !important`,
      'pointer-events: none !important',
    ].join('; ');
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    shadow.appendChild(style);

    const root = document.createElement('div');
    root.className = 'root';

    const capsule = document.createElement('div');
    capsule.className = 'capsule';
    capsule.setAttribute('role', 'toolbar');
    capsule.setAttribute('aria-label', 'Agent Assist actions');

    const polishBtn = document.createElement('button');
    polishBtn.type = 'button';
    polishBtn.className = 'icon-btn polish';
    polishBtn.setAttribute('aria-label', 'Polish draft reply');
    polishBtn.title = 'Polish';
    polishBtn.innerHTML = POLISH_ICON_SVG;
    polishBtn.addEventListener('mousedown', (event) => event.preventDefault());
    polishBtn.addEventListener('click', (event) => {
      event.preventDefault();
      this.callbacks.onPolishClick();
    });
    capsule.appendChild(polishBtn);

    const preview = document.createElement('div');
    preview.className = 'preview';
    preview.setAttribute('role', 'dialog');
    preview.setAttribute('aria-label', 'Polished reply preview');

    const previewLabel = document.createElement('div');
    previewLabel.className = 'preview-label';
    previewLabel.textContent = 'Polished reply';

    const previewText = document.createElement('div');
    previewText.className = 'preview-text';

    const previewActions = document.createElement('div');
    previewActions.className = 'preview-actions';
    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'btn btn-reject';
    rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('mousedown', (event) => event.preventDefault());
    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'btn btn-accept';
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('mousedown', (event) => event.preventDefault());
    previewActions.append(rejectBtn, acceptBtn);

    preview.append(previewLabel, previewText, previewActions);

    const status = document.createElement('div');
    status.className = 'status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    root.append(capsule, preview, status);
    shadow.appendChild(root);

    this.host = host;
    this.capsule = capsule;
    this.polishBtn = polishBtn;
    this.previewEl = preview;
    this.previewTextEl = previewText;
    this.previewAcceptBtn = acceptBtn;
    this.previewRejectBtn = rejectBtn;
    this.statusEl = status;
  }

  private reposition(): void {
    if (!this.host || !this.anchor || !this.capsule) return;
    const rect = this.anchor.getBoundingClientRect();
    this.host.style.top = `${rect.top}px`;
    this.host.style.left = `${rect.left}px`;
    this.host.style.width = `${rect.width}px`;
    this.host.style.height = `${rect.height}px`;
    this.capsule.classList.toggle('tall', rect.height > TALL_FIELD_THRESHOLD_PX);
    this.positionPreview(rect);
  }

  /**
   * Flip the preview card above the field when there isn't enough room
   * below it in the viewport, and constrain its max-height so the Accept /
   * Reject buttons are always visible on-screen.
   */
  private positionPreview(rect: DOMRect): void {
    if (!this.previewEl || !this.previewTextEl) return;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - PREVIEW_VIEWPORT_MARGIN_PX;
    const spaceAbove = rect.top - PREVIEW_VIEWPORT_MARGIN_PX;
    const flipAbove = spaceBelow < PREVIEW_MIN_SPACE_PX && spaceAbove > spaceBelow;
    this.previewEl.classList.toggle('above', flipAbove);

    const available = Math.max(PREVIEW_MIN_SPACE_PX, flipAbove ? spaceAbove : spaceBelow);
    // Reserve ~90px for label + actions + padding; the rest is text height.
    const textMax = Math.max(80, available - 90);
    this.previewTextEl.style.maxHeight = `${textMax}px`;
    this.previewTextEl.style.overflowY = 'auto';
  }
}
