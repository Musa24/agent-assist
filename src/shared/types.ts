/**
 * Shared TypeScript types for the Agent Assist extension.
 * Response shapes, typed errors, and chrome.runtime message types.
 */

// ----- Feature response payloads -----

export interface ScreenshotMarket {
  name: string;
  explanation: string;
  odds_info?: string;
}

export interface ScreenshotAnalysis {
  markets: ScreenshotMarket[];
  summary: string;
}

export type Sentiment = 'positive' | 'neutral' | 'frustrated' | 'angry';

export interface SentimentResult {
  sentiment: Sentiment;
  confidence: number;
  suggestedResponse: string;
}

export interface TermDefinition {
  term: string;
  definition_en: string;
  definition_sw: string;
  example?: string;
}

export interface QualityScore {
  clarity: number;
  empathy: number;
  completeness: number;
  overall: number;
  suggestions: string[];
}

// ----- Typed errors -----

export type ApiErrorCode = 'NETWORK' | 'AUTH' | 'RATE_LIMIT' | 'TIMEOUT' | 'PARSE';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly userMessage: string;

  constructor(code: ApiErrorCode, userMessage: string, message?: string) {
    super(message ?? userMessage);
    this.name = 'ApiError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

export class NetworkError extends ApiError {
  constructor(message?: string) {
    super('NETWORK', 'Check your internet connection.', message);
    this.name = 'NetworkError';
  }
}

export class AuthError extends ApiError {
  constructor(message?: string) {
    super(
      'AUTH',
      'Your Claude API key is invalid. Open Agent Assist options to update it.',
      message,
    );
    this.name = 'AuthError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message?: string) {
    super('RATE_LIMIT', 'Too many requests right now — please wait a moment and try again.', message);
    this.name = 'RateLimitError';
  }
}

export class TimeoutError extends ApiError {
  constructor(message?: string) {
    super('TIMEOUT', 'The request timed out. Try again.', message);
    this.name = 'TimeoutError';
  }
}

export class ParseError extends ApiError {
  constructor(message?: string) {
    super(
      'PARSE',
      'Something went wrong reading the response. Please try again.',
      message,
    );
    this.name = 'ParseError';
  }
}

// ----- chrome.runtime message types -----

export type Message =
  | { type: 'POLISH_TEXT'; text: string }
  | { type: 'ANALYZE_SCREENSHOT'; imageBase64: string; mediaType?: string }
  | { type: 'CLASSIFY_SENTIMENT'; text: string }
  | { type: 'LOOKUP_TERM'; term: string }
  | { type: 'SCORE_REPLY'; draft: string; customerMessage?: string };

export type MessageType = Message['type'];

export type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: { code: ApiErrorCode; userMessage: string } };
