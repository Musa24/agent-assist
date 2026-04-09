/**
 * Unit tests for the PolishHandler.
 * Fakes the detector + toolbar (structural typing) and mocks
 * chrome.runtime.sendMessage via the existing test setup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PolishDetector,
  PolishHandler,
  PolishToolbar,
  writeField,
} from '../../src/content/polish-handler';

type MockFn = ReturnType<typeof vi.fn>;

function makeField(value: string, type: 'input' | 'textarea' | 'contenteditable' = 'input'): HTMLElement {
  if (type === 'input') {
    const el = document.createElement('input');
    el.type = 'text';
    el.value = value;
    document.body.appendChild(el);
    return el;
  }
  if (type === 'textarea') {
    const el = document.createElement('textarea');
    el.value = value;
    document.body.appendChild(el);
    return el;
  }
  const el = document.createElement('div');
  el.setAttribute('contenteditable', 'true');
  el.textContent = value;
  document.body.appendChild(el);
  return el;
}

function readField(field: HTMLElement): string {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.value;
  }
  return field.textContent ?? '';
}

function makeDetector(field: HTMLElement | null, text: string): PolishDetector {
  return {
    getActiveField: vi.fn(() => field),
    getText: vi.fn(() => text),
  };
}

function makeToolbar(): PolishToolbar & { [K in keyof PolishToolbar]: MockFn } {
  return {
    setPolishLoading: vi.fn(),
    showUndo: vi.fn(),
    hideUndo: vi.fn(),
    showError: vi.fn(),
    clearStatus: vi.fn(),
  };
}

describe('writeField', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('writes into <input>', () => {
    const field = makeField('old', 'input');
    writeField(field, 'new');
    expect(readField(field)).toBe('new');
  });

  it('writes into <textarea>', () => {
    const field = makeField('old', 'textarea');
    writeField(field, 'new');
    expect(readField(field)).toBe('new');
  });

  it('writes into contenteditable', () => {
    const field = makeField('old', 'contenteditable');
    writeField(field, 'new');
    expect(readField(field)).toBe('new');
  });

  it('dispatches input event so frameworks see the change', () => {
    const field = makeField('old', 'input');
    const listener = vi.fn();
    field.addEventListener('input', listener);
    writeField(field, 'new');
    expect(listener).toHaveBeenCalled();
  });
});

describe('PolishHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (chrome.runtime.sendMessage as unknown as MockFn).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('replaces field text with the polished result and shows Undo', async () => {
    const field = makeField('hi ur bet was voided');
    const detector = makeDetector(field, 'hi ur bet was voided');
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockResolvedValue({
      success: true,
      result: 'Hi, your bet was voided.',
    });
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(readField(field)).toBe('Hi, your bet was voided.');
    expect(toolbar.setPolishLoading).toHaveBeenNthCalledWith(1, true);
    expect(toolbar.setPolishLoading).toHaveBeenLastCalledWith(false);
    expect(toolbar.showUndo).toHaveBeenCalledTimes(1);
  });

  it('works for <textarea> with multiline Swahili text', async () => {
    const original = 'mteja akaunti yako iko sawa';
    const polished = 'Habari, akaunti yako iko sawa.';
    const field = makeField(original, 'textarea');
    const detector = makeDetector(field, original);
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockResolvedValue({
      success: true,
      result: polished,
    });
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(readField(field)).toBe(polished);
  });

  it('works for contenteditable with mixed-language text', async () => {
    const original = 'hi mteja, ur Accumulator imevoid';
    const polished = 'Hi, your Accumulator was voided.';
    const field = makeField(original, 'contenteditable');
    const detector = makeDetector(field, original);
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockResolvedValue({
      success: true,
      result: polished,
    });
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(readField(field)).toBe(polished);
  });

  it('shows "Nothing to polish" on empty/whitespace input and skips the API call', async () => {
    const field = makeField('');
    const detector = makeDetector(field, '   ');
    const toolbar = makeToolbar();
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(toolbar.showError).toHaveBeenCalledWith('Nothing to polish');
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(readField(field)).toBe('');
  });

  it('does nothing silently when there is no active field', async () => {
    const detector = makeDetector(null, '');
    const toolbar = makeToolbar();
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(toolbar.showError).not.toHaveBeenCalled();
  });

  it('shows the API error message when the response is a failure', async () => {
    const field = makeField('hello');
    const detector = makeDetector(field, 'hello');
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockResolvedValue({
      success: false,
      error: 'Your Claude API key is invalid.',
    });
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(toolbar.showError).toHaveBeenCalledWith('Your Claude API key is invalid.');
    expect(readField(field)).toBe('hello');
    expect(toolbar.showUndo).not.toHaveBeenCalled();
  });

  it('shows a generic error when sendMessage rejects', async () => {
    const field = makeField('hello');
    const detector = makeDetector(field, 'hello');
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockRejectedValue(new Error('boom'));
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(toolbar.showError).toHaveBeenCalled();
    expect(readField(field)).toBe('hello');
  });

  it('undo restores the original text and clears the toolbar state', async () => {
    const field = makeField('hi');
    const detector = makeDetector(field, 'hi');
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockResolvedValue({
      success: true,
      result: 'Hi.',
    });
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();
    expect(readField(field)).toBe('Hi.');

    const undoCallback = (toolbar.showUndo as MockFn).mock.calls[0][0] as () => void;
    undoCallback();

    expect(readField(field)).toBe('hi');
    expect(toolbar.hideUndo).toHaveBeenCalled();
    expect(toolbar.clearStatus).toHaveBeenCalled();
  });
});
