/**
 * PolishHandler — wires the pill-bar Polish button to the background
 * service worker, previews the polished text next to the field, and only
 * writes the polished value on Accept. Reject dismisses the preview with
 * the original text intact.
 */

const LOG_PREFIX = '[AGENT-ASSIST]';
const ERROR_TIMEOUT_MS = 3_000;

type PolishResponse = { success: true; result: string } | { success: false; error: string };

export interface PolishDetector {
  getActiveField(): HTMLElement | null;
  getText(): string;
}

export interface PolishToolbar {
  setPolishLoading(loading: boolean): void;
  showPreview(text: string, onAccept: () => void, onReject: () => void): void;
  hidePreview(): void;
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
    this.toolbar.hidePreview();

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

      this.toolbar.showPreview(
        response.result,
        () => this.handleAccept(field, response.result),
        () => this.handleReject(),
      );
    } catch (err) {
      console.error(LOG_PREFIX, 'Polish failed', err);
      this.flashError('Something went wrong');
    } finally {
      this.toolbar.setPolishLoading(false);
    }
  }

  private handleAccept(field: HTMLElement, polished: string): void {
    writeField(field, polished);
    this.toolbar.hidePreview();
  }

  private handleReject(): void {
    this.toolbar.hidePreview();
  }

  private flashError(message: string): void {
    this.toolbar.showError(message);
    window.setTimeout(() => this.toolbar.clearStatus(), ERROR_TIMEOUT_MS);
  }
}
