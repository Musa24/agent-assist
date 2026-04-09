/**
 * TextDetector — tracks the currently focused editable text element on the
 * page and notifies listeners when it changes.
 *
 * Detects:
 *   - <input> of text-like types (text, email, url, search, tel, password)
 *   - <textarea>
 *   - any element with [contenteditable="true"]
 *
 * Uses focusin / focusout on the document so it also catches fields added
 * dynamically by SPAs, plus a MutationObserver to clear the active field
 * when it is removed from the DOM.
 */

const TEXT_LIKE_INPUT_TYPES = new Set([
  '', // default type for <input>
  'text',
  'email',
  'search',
  'url',
  'tel',
  'password',
]);

export function isEditableTextField(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    return TEXT_LIKE_INPUT_TYPES.has(type) && !el.disabled && !el.readOnly;
  }
  return el.isContentEditable;
}

export type FieldChangeListener = (field: HTMLElement | null) => void;

const BLUR_GRACE_MS = 200;

export class TextDetector {
  private active: HTMLElement | null = null;
  private listeners = new Set<FieldChangeListener>();
  private observer: MutationObserver | null = null;
  private blurTimer: number | null = null;

  start(): void {
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('focusout', this.onFocusOut, true);
    this.observer = new MutationObserver(this.onMutate);
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  stop(): void {
    document.removeEventListener('focusin', this.onFocusIn, true);
    document.removeEventListener('focusout', this.onFocusOut, true);
    this.observer?.disconnect();
    this.observer = null;
    if (this.blurTimer !== null) {
      window.clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    this.setActive(null);
  }

  onChange(listener: FieldChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getActiveField(): HTMLElement | null {
    return this.active;
  }

  getText(): string {
    const field = this.active;
    if (!field) return '';
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      return field.value;
    }
    return field.textContent ?? '';
  }

  setText(text: string): void {
    const field = this.active;
    if (!field) return;
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    field.textContent = text;
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  private onFocusIn = (event: FocusEvent): void => {
    if (this.blurTimer !== null) {
      window.clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    if (isEditableTextField(event.target)) {
      this.setActive(event.target);
    }
  };

  private onFocusOut = (event: FocusEvent): void => {
    if (event.target !== this.active) return;
    // Delay the clear so a click on our toolbar has time to re-focus the
    // field without the toolbar disappearing underneath the user's cursor.
    if (this.blurTimer !== null) {
      window.clearTimeout(this.blurTimer);
    }
    this.blurTimer = window.setTimeout(() => {
      this.blurTimer = null;
      if (!isEditableTextField(document.activeElement)) {
        this.setActive(null);
      }
    }, BLUR_GRACE_MS);
  };

  private onMutate = (mutations: MutationRecord[]): void => {
    if (!this.active) return;
    const active = this.active;
    for (const mutation of mutations) {
      for (const removed of Array.from(mutation.removedNodes)) {
        if (removed === active) {
          this.setActive(null);
          return;
        }
        if (removed instanceof Element && removed.contains(active)) {
          this.setActive(null);
          return;
        }
      }
    }
  };

  private setActive(field: HTMLElement | null): void {
    if (field === this.active) return;
    this.active = field;
    for (const listener of this.listeners) {
      listener(field);
    }
  }
}
