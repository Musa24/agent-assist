/**
 * Content script entry point.
 * Injected into supported web pages. Wires the text-field detector to the
 * floating toolbar and honors the user's feature toggles from storage.
 */
import { TextDetector } from './text-detector';
import { FloatingToolbar } from './floating-toolbar';
import { PolishHandler } from './polish-handler';
import { DEFAULT_FEATURES, FeatureToggles, STORAGE_KEY_FEATURES } from '../shared/constants';

const LOG_PREFIX = '[AGENT-ASSIST]';

let detector: TextDetector | null = null;
let toolbar: FloatingToolbar | null = null;
let polishHandler: PolishHandler | null = null;

async function loadFeatures(): Promise<FeatureToggles> {
  const result = await chrome.storage.local.get(STORAGE_KEY_FEATURES);
  const stored = (result as Record<string, unknown>)[STORAGE_KEY_FEATURES];
  if (stored && typeof stored === 'object') {
    return { ...DEFAULT_FEATURES, ...(stored as Partial<FeatureToggles>) };
  }
  return { ...DEFAULT_FEATURES };
}

function startToolbar(): void {
  if (detector && toolbar && polishHandler) return;

  toolbar = new FloatingToolbar({
    onPolishClick: () => {
      if (polishHandler) void polishHandler.handleClick();
    },
    onScoreClick: () => {
      console.log(`${LOG_PREFIX} Score clicked (handler lands in a later ticket)`);
    },
  });

  detector = new TextDetector();
  polishHandler = new PolishHandler(detector, toolbar);

  const activeToolbar = toolbar;
  detector.onChange((field) => {
    if (field) {
      activeToolbar.show(field);
    } else {
      activeToolbar.hide();
    }
  });
  detector.start();
}

function stopToolbar(): void {
  detector?.stop();
  detector = null;
  toolbar?.destroy();
  toolbar = null;
  polishHandler = null;
}

async function syncWithFeatures(): Promise<void> {
  const features = await loadFeatures();
  const anyEnabled = features.polish || features.scorer;
  if (anyEnabled) {
    startToolbar();
  } else {
    stopToolbar();
  }
}

console.log(`${LOG_PREFIX} Content script loaded on: ${window.location.hostname}`);

void syncWithFeatures();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && STORAGE_KEY_FEATURES in changes) {
    void syncWithFeatures();
  }
});
