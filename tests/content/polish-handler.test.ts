/**
 * Unit tests for the PolishHandler.
 * Uses structural typing for the detector + toolbar fakes, plus the
 * existing chrome.runtime.sendMessage stub from tests/setup.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PolishDetector,
  PolishHandler,
  PolishToolbar,
  writeField,
} from '../../src/content/polish-handler';

type MockFn = ReturnType<typeof vi.fn>;
type FakeToolbar = PolishToolbar & { [K in keyof PolishToolbar]: MockFn };

function makeField(
  value: string,
  type: 'input' | 'textarea' | 'contenteditable' = 'input',
): HTMLElement {
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

function makeToolbar(): FakeToolbar {
  return {
    setPolishLoading: vi.fn(),
    showPreview: vi.fn(),
    hidePreview: vi.fn(),
    showError: vi.fn(),
    clearStatus: vi.fn(),
  };
}

function capturePreviewCallbacks(toolbar: FakeToolbar): {
  accept: () => void;
  reject: () => void;
  text: string;
} {
  expect(toolbar.showPreview).toHaveBeenCalledTimes(1);
  const call = toolbar.showPreview.mock.calls[0];
  return {
    text: call[0] as string,
    accept: call[1] as () => void,
    reject: call[2] as () => void,
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

  it('does not touch the field until Accept is clicked', async () => {
    const field = makeField('hi ur bet was voided');
    const detector = makeDetector(field, 'hi ur bet was voided');
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockResolvedValue({
      success: true,
      result: 'Hi, your bet was voided.',
    });
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    // The preview was shown with the polished text, but the field is untouched.
    expect(readField(field)).toBe('hi ur bet was voided');
    const { text, accept } = capturePreviewCallbacks(toolbar);
    expect(text).toBe('Hi, your bet was voided.');

    // Accept writes the polished text into the field.
    accept();
    expect(readField(field)).toBe('Hi, your bet was voided.');
    expect(toolbar.hidePreview).toHaveBeenCalled();
  });

  it('Reject leaves the field unchanged and hides the preview', async () => {
    const field = makeField('original');
    const detector = makeDetector(field, 'original');
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockResolvedValue({
      success: true,
      result: 'Rewritten version.',
    });
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();
    const { reject } = capturePreviewCallbacks(toolbar);
    reject();

    expect(readField(field)).toBe('original');
    expect(toolbar.hidePreview).toHaveBeenCalled();
  });

  it('toggles loading state on the toolbar', async () => {
    const field = makeField('hi');
    const detector = makeDetector(field, 'hi');
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockResolvedValue({
      success: true,
      result: 'Hi.',
    });
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(toolbar.setPolishLoading).toHaveBeenNthCalledWith(1, true);
    expect(toolbar.setPolishLoading).toHaveBeenLastCalledWith(false);
  });

  it('works for <textarea> with Swahili text', async () => {
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
    const { accept } = capturePreviewCallbacks(toolbar);
    accept();

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
    const { accept } = capturePreviewCallbacks(toolbar);
    accept();

    expect(readField(field)).toBe(polished);
  });

  it('shows "Nothing to polish" on empty/whitespace and skips the API call', async () => {
    const field = makeField('');
    const detector = makeDetector(field, '   ');
    const toolbar = makeToolbar();
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(toolbar.showError).toHaveBeenCalledWith('Nothing to polish');
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(toolbar.showPreview).not.toHaveBeenCalled();
  });

  it('does nothing silently when there is no active field', async () => {
    const detector = makeDetector(null, '');
    const toolbar = makeToolbar();
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(toolbar.showError).not.toHaveBeenCalled();
  });

  it('shows the API error when the response is a failure', async () => {
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
    expect(toolbar.showPreview).not.toHaveBeenCalled();
    expect(readField(field)).toBe('hello');
  });

  it('shows a generic error when sendMessage rejects', async () => {
    const field = makeField('hello');
    const detector = makeDetector(field, 'hello');
    const toolbar = makeToolbar();
    (chrome.runtime.sendMessage as unknown as MockFn).mockRejectedValue(new Error('boom'));
    const handler = new PolishHandler(detector, toolbar);

    await handler.handleClick();

    expect(toolbar.showError).toHaveBeenCalled();
    expect(toolbar.showPreview).not.toHaveBeenCalled();
    expect(readField(field)).toBe('hello');
  });
});
