/**
 * PolishHandler — wires the floating toolbar's Polish button to the
 * background service worker, handles field replacement, and tracks undo
 * state so the agent can revert if the polish is worse than the original.
 */

const LOG_PREFIX = '[AGENT-ASSIST]';
const UNDO_TIMEOUT_MS = 8_000;
const ERROR_TIMEOUT_MS = 3_000;

type PolishResponse = { success: true; result: string } | { success: false; error: string };

export interface PolishDetector {
  getActiveField(): HTMLElement | null;
  getText(): string;
}

export interface PolishToolbar {
  setPolishLoading(loading: boolean): void;
  showUndo(onClick: () => void): void;
  hideUndo(): void;
  showError(message: string): void;
  clearStatus(): void;
}

/**
 * Writes text into a form field or contenteditable element and dispatches
 * the events frameworks typically listen for (so React / Vue / etc pick up
 * the change).
 */
export function writeField(field: HTMLElement, text: string): void {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const attr = field.getAttribute('contenteditable');
  const isContentEditable = field.isContentEditable || attr === 'true' || attr === '';
  if (isContentEditable) {
    field.textContent = text;
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
}

export class PolishHandler {
  private detector: PolishDetector;
  private toolbar: PolishToolbar;
  private originalText: string | null = null;
  private targetField: HTMLElement | null = null;
  private undoTimer: number | null = null;

  constructor(detector: PolishDetector, toolbar: PolishToolbar) {
    this.detector = detector;
    this.toolbar = toolbar;
  }

  async handleClick(): Promise<void> {
    const field = this.detector.getActiveField();
    if (!field) return;

    const text = this.detector.getText();
    if (text.trim().length === 0) {
      this.flashError('Nothing to polish');
      return;
    }

    this.toolbar.setPolishLoading(true);
    this.toolbar.clearStatus();

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'POLISH_TEXT',
        text,
      })) as PolishResponse | undefined;

      if (!response) {
        this.flashError('Background did not respond');
        return;
      }
      if (!response.success) {
        this.flashError(response.error);
        return;
      }

      this.originalText = text;
      this.targetField = field;
      writeField(field, response.result);
      this.toolbar.showUndo(() => this.handleUndo());
      this.scheduleUndoExpire();
    } catch (err) {
      console.error(LOG_PREFIX, 'Polish failed', err);
      this.flashError('Something went wrong');
    } finally {
      this.toolbar.setPolishLoading(false);
    }
  }

  private handleUndo(): void {
    if (this.originalText !== null && this.targetField) {
      writeField(this.targetField, this.originalText);
    }
    this.clearUndoState();
    this.toolbar.hideUndo();
    this.toolbar.clearStatus();
  }

  private scheduleUndoExpire(): void {
    if (this.undoTimer !== null) window.clearTimeout(this.undoTimer);
    this.undoTimer = window.setTimeout(() => {
      this.clearUndoState();
      this.toolbar.hideUndo();
    }, UNDO_TIMEOUT_MS);
  }

  private clearUndoState(): void {
    if (this.undoTimer !== null) {
      window.clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
    this.originalText = null;
    this.targetField = null;
  }

  private flashError(message: string): void {
    this.toolbar.showError(message);
    window.setTimeout(() => this.toolbar.clearStatus(), ERROR_TIMEOUT_MS);
  }
}
