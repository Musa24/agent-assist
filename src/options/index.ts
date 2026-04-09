/**
 * Options page controller.
 * Loads/saves the Claude API key and feature toggles from chrome.storage.local
 * and runs a minimal live "Test connection" call against the Claude API.
 */
import {
  DEFAULT_FEATURES,
  FEATURE_IDS,
  FEATURE_LABELS,
  FeatureId,
  FeatureToggles,
  STORAGE_KEY_API_KEY,
  STORAGE_KEY_FEATURES,
} from '../shared/constants';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const TEST_MODEL = 'claude-sonnet-4-20250514';
const LOG_PREFIX = '[AGENT-ASSIST]';

type StatusKind = 'success' | 'error' | 'info';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element not found: #${id}`);
  return el as T;
}

function setStatus(kind: StatusKind, message: string): void {
  const el = $<HTMLParagraphElement>('status');
  el.className = `status visible ${kind}`;
  el.textContent = message;
}

function clearStatus(): void {
  const el = $<HTMLParagraphElement>('status');
  el.className = 'status';
  el.textContent = '';
}

function renderFeatureToggles(current: FeatureToggles): void {
  const container = $<HTMLDivElement>('features');
  container.innerHTML = '';
  for (const id of FEATURE_IDS) {
    const label = FEATURE_LABELS[id];
    const row = document.createElement('label');
    row.className = 'feature';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.feature = id;
    checkbox.checked = current[id];
    checkbox.addEventListener('change', () => {
      void onToggleChange(id, checkbox.checked);
    });

    const meta = document.createElement('div');
    meta.className = 'meta';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = label.name;

    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = label.description;

    meta.append(name, desc);
    row.append(checkbox, meta);
    container.append(row);
  }
}

async function loadSettings(): Promise<void> {
  const result = await chrome.storage.local.get([STORAGE_KEY_API_KEY, STORAGE_KEY_FEATURES]);
  const record = result as Record<string, unknown>;

  const apiKey = record[STORAGE_KEY_API_KEY];
  if (typeof apiKey === 'string') {
    $<HTMLInputElement>('api-key').value = apiKey;
  }

  const storedFeatures = record[STORAGE_KEY_FEATURES];
  const features: FeatureToggles = { ...DEFAULT_FEATURES };
  if (storedFeatures && typeof storedFeatures === 'object') {
    for (const id of FEATURE_IDS) {
      const value = (storedFeatures as Record<string, unknown>)[id];
      if (typeof value === 'boolean') features[id] = value;
    }
  }
  renderFeatureToggles(features);
}

async function saveApiKey(): Promise<void> {
  const input = $<HTMLInputElement>('api-key');
  const key = input.value.trim();
  if (!key) {
    setStatus('error', 'Enter an API key first.');
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY_API_KEY]: key });
  setStatus('success', 'API key saved.');
}

async function testConnection(): Promise<void> {
  const key = $<HTMLInputElement>('api-key').value.trim();
  if (!key) {
    setStatus('error', 'Enter an API key first.');
    return;
  }

  const testBtn = $<HTMLButtonElement>('test-btn');
  const saveBtn = $<HTMLButtonElement>('save-btn');
  testBtn.disabled = true;
  saveBtn.disabled = true;
  setStatus('info', 'Testing connection…');

  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: TEST_MODEL,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Say hi' }],
      }),
    });

    if (res.ok) {
      setStatus('success', 'Connected! Your API key works.');
      return;
    }
    if (res.status === 401 || res.status === 403) {
      setStatus('error', 'Invalid API key. Check the key and try again.');
      return;
    }
    if (res.status === 429) {
      setStatus('error', 'Rate limited. Wait a moment and try again.');
      return;
    }
    setStatus('error', `Unexpected error from Claude API (HTTP ${res.status}).`);
  } catch (err) {
    console.error(LOG_PREFIX, 'Test connection failed', err);
    setStatus('error', 'Network error. Check your connection and try again.');
  } finally {
    testBtn.disabled = false;
    saveBtn.disabled = false;
  }
}

async function onToggleChange(id: FeatureId, enabled: boolean): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY_FEATURES);
  const current = (result as Record<string, unknown>)[STORAGE_KEY_FEATURES];
  const features: FeatureToggles =
    current && typeof current === 'object'
      ? { ...DEFAULT_FEATURES, ...(current as Partial<FeatureToggles>) }
      : { ...DEFAULT_FEATURES };
  features[id] = enabled;
  await chrome.storage.local.set({ [STORAGE_KEY_FEATURES]: features });
}

function wireHandlers(): void {
  $<HTMLButtonElement>('save-btn').addEventListener('click', () => {
    clearStatus();
    void saveApiKey();
  });
  $<HTMLButtonElement>('test-btn').addEventListener('click', () => {
    clearStatus();
    void testConnection();
  });
  $<HTMLInputElement>('api-key').addEventListener('input', clearStatus);
}

async function init(): Promise<void> {
  try {
    await loadSettings();
    wireHandlers();
    console.log(LOG_PREFIX, 'Options page loaded');
  } catch (err) {
    console.error(LOG_PREFIX, 'Failed to load options page', err);
    setStatus('error', 'Failed to load settings. Please reload this page.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void init();
});
