/**
 * Routes messages from content scripts and the popup to the Claude API
 * client. Owns the only instance of `ClaudeApiClient` — content scripts
 * must never call the API directly.
 */
import { ClaudeApiClient } from '../shared/api-client';
import { ApiError } from '../shared/types';

const LOG_PREFIX = '[AGENT-ASSIST]';

export type FeatureResponse<T> = { success: true; result: T } | { success: false; error: string };

const client = new ClaudeApiClient();

async function handlePolish(text: string): Promise<FeatureResponse<string>> {
  try {
    const polished = await client.polishText(text);
    return { success: true, result: polished };
  } catch (err) {
    const message = err instanceof ApiError ? err.userMessage : 'Something went wrong.';
    console.error(LOG_PREFIX, 'Polish failed', err);
    return { success: false, error: message };
  }
}

export function registerMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;
    const typed = message as { type?: unknown; text?: unknown };

    if (typed.type === 'POLISH_TEXT') {
      if (typeof typed.text !== 'string') {
        sendResponse({ success: false, error: 'Missing text' } satisfies FeatureResponse<string>);
        return false;
      }
      void handlePolish(typed.text).then(sendResponse);
      return true; // keep the message channel open for async sendResponse
    }

    return false;
  });
}
