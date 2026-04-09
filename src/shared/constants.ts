/**
 * Shared constants: storage keys, feature identifiers, defaults.
 */

export const STORAGE_KEY_API_KEY = 'agent_assist_api_key';
export const STORAGE_KEY_FEATURES = 'agent_assist_features';

export const FEATURE_IDS = ['polish', 'screenshot', 'sentiment', 'lookup', 'scorer'] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export type FeatureToggles = Record<FeatureId, boolean>;

export const DEFAULT_FEATURES: FeatureToggles = {
  polish: true,
  screenshot: true,
  sentiment: true,
  lookup: true,
  scorer: true,
};

export const FEATURE_LABELS: Record<FeatureId, { name: string; description: string }> = {
  polish: {
    name: 'Text Polish',
    description: 'One-click grammar and tone polish for draft replies (English, Swahili, mixed).',
  },
  screenshot: {
    name: 'Screenshot Analyzer',
    description: 'Explain betslips and betting markets from a captured screenshot.',
  },
  sentiment: {
    name: 'Sentiment Alert',
    description: 'Detect frustrated customers and suggest de-escalation replies.',
  },
  lookup: {
    name: 'Quick Term Lookup',
    description: 'Right-click any betting term for an instant English + Swahili definition.',
  },
  scorer: {
    name: 'Response Quality Scorer',
    description: 'Score a draft reply for clarity, empathy, and completeness before sending.',
  },
};
