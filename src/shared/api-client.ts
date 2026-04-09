/**
 * Claude API client. Only runs inside the service worker — content scripts
 * and the popup must never import this module directly. They message the
 * service worker, which owns the API key and calls this client.
 */
import {
  ApiError,
  ApiErrorCode,
  AuthError,
  NetworkError,
  ParseError,
  QualityScore,
  RateLimitError,
  ScreenshotAnalysis,
  SentimentResult,
  TermDefinition,
  TimeoutError,
} from './types';
import {
  LOOKUP_PROMPT_V1,
  POLISH_PROMPT_V2,
  PromptTemplate,
  SCORER_PROMPT_V1,
  SCREENSHOT_PROMPT_V1,
  SENTIMENT_PROMPT_V1,
} from './prompts';
import { STORAGE_KEY_API_KEY } from './constants';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-20250514';
const TIMEOUT_MS = 30_000;

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
const RETRYABLE_CODES = new Set<ApiErrorCode>(['NETWORK', 'RATE_LIMIT']);

// ----- Claude content blocks -----

interface TextBlock {
  type: 'text';
  text: string;
}

interface ImageBlock {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}

type ContentBlock = TextBlock | ImageBlock;

// ----- Public client -----

export class ClaudeApiClient {
  async polishText(text: string): Promise<string> {
    return this._callApi(POLISH_PROMPT_V2, [{ type: 'text', text }], (raw) => raw.trim());
  }

  async analyzeScreenshot(
    base64Image: string,
    mediaType: string = 'image/png',
  ): Promise<ScreenshotAnalysis> {
    return this._callApi(
      SCREENSHOT_PROMPT_V1,
      [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
        { type: 'text', text: 'Analyze this screenshot.' },
      ],
      (raw) => parseShape<ScreenshotAnalysis>(raw, ['markets', 'summary']),
    );
  }

  async classifySentiment(text: string): Promise<SentimentResult> {
    return this._callApi(SENTIMENT_PROMPT_V1, [{ type: 'text', text }], (raw) =>
      parseShape<SentimentResult>(raw, ['sentiment', 'confidence', 'suggestedResponse']),
    );
  }

  async lookupTerm(term: string): Promise<TermDefinition> {
    return this._callApi(LOOKUP_PROMPT_V1, [{ type: 'text', text: term }], (raw) =>
      parseShape<TermDefinition>(raw, ['term', 'definition_en', 'definition_sw']),
    );
  }

  async scoreReply(draft: string, customerMessage?: string): Promise<QualityScore> {
    const userText = customerMessage
      ? `Customer said: ${customerMessage}\n\nAgent draft: ${draft}`
      : draft;
    return this._callApi(SCORER_PROMPT_V1, [{ type: 'text', text: userText }], (raw) =>
      parseShape<QualityScore>(raw, [
        'clarity',
        'empathy',
        'completeness',
        'overall',
        'suggestions',
      ]),
    );
  }

  // ----- Internals -----

  private async _callApi<T>(
    prompt: PromptTemplate,
    content: ContentBlock[],
    parse: (raw: string) => T,
  ): Promise<T> {
    return withRetry(() => this._doFetch(prompt, content, parse));
  }

  private async _doFetch<T>(
    prompt: PromptTemplate,
    content: ContentBlock[],
    parse: (raw: string) => T,
  ): Promise<T> {
    const apiKey = await getApiKey();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: prompt.maxTokens,
          system: prompt.system,
          messages: [{ role: 'user', content }],
        }),
      });

      if (!res.ok) {
        throw mapHttpError(res.status);
      }

      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = data.content?.[0]?.text;
      if (typeof text !== 'string' || text.length === 0) {
        throw new ParseError('Empty content from API');
      }
      return parse(text);
    } catch (err) {
      throw normalizeError(err);
    } finally {
      clearTimeout(timer);
    }
  }
}

// ----- Helpers -----

async function getApiKey(): Promise<string> {
  const result = await chrome.storage.local.get(STORAGE_KEY_API_KEY);
  const key = (result as Record<string, unknown>)[STORAGE_KEY_API_KEY];
  if (typeof key !== 'string' || key.length === 0) {
    throw new AuthError('No API key set');
  }
  return key;
}

function mapHttpError(status: number): ApiError {
  if (status === 401 || status === 403) return new AuthError(`HTTP ${status}`);
  if (status === 429) return new RateLimitError(`HTTP ${status}`);
  if (status >= 500) return new NetworkError(`HTTP ${status}`);
  return new NetworkError(`HTTP ${status}`);
}

function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new TimeoutError('Request aborted after timeout');
  }
  if (err instanceof TypeError) {
    return new NetworkError(err.message);
  }
  return new ParseError(err instanceof Error ? err.message : String(err));
}

function parseShape<T>(raw: string, requiredKeys: ReadonlyArray<string>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ParseError('Response was not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ParseError('Response was not a JSON object');
  }
  for (const key of requiredKeys) {
    if (!(key in (parsed as Record<string, unknown>))) {
      throw new ParseError(`Response missing required key: ${key}`);
    }
  }
  return parsed as T;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = err instanceof ApiError ? err.code : null;
      if (!code || !RETRYABLE_CODES.has(code) || attempt >= RETRY_DELAYS_MS.length) {
        throw err;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  // Unreachable: the loop either returns or throws.
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
