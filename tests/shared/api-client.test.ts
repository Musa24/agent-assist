/**
 * Unit tests for the shared Claude API client.
 * fetch and chrome.storage.local are both mocked. Fake timers are used so
 * retry delays do not slow the suite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeApiClient } from '../../src/shared/api-client';
import {
  AuthError,
  NetworkError,
  ParseError,
  RateLimitError,
  TimeoutError,
} from '../../src/shared/types';

type MockFetch = ReturnType<typeof vi.fn>;

function mockFetchResponse(status: number, body: unknown): void {
  (globalThis.fetch as unknown as MockFetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function mockTextResponse(text: string): void {
  mockFetchResponse(200, { content: [{ type: 'text', text }] });
}

describe('ClaudeApiClient', () => {
  let client: ClaudeApiClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new ClaudeApiClient();
    (chrome.storage.local.get as unknown as MockFetch).mockResolvedValue({
      INSYSTEM_API_KEY: 'test-key',
    });
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ----- happy paths -----

  it('polishText returns the polished text', async () => {
    mockTextResponse('Hi, your bet was voided.');
    const result = await client.polishText('hi ur bet was voided');
    expect(result).toBe('Hi, your bet was voided.');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('polishText sends the API key in headers', async () => {
    mockTextResponse('ok');
    await client.polishText('hi');
    const fetchMock = globalThis.fetch as unknown as MockFetch;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('classifySentiment parses JSON response', async () => {
    mockTextResponse(
      JSON.stringify({ sentiment: 'frustrated', confidence: 0.9, suggestedResponse: 'sorry' }),
    );
    const result = await client.classifySentiment('this is bad');
    expect(result.sentiment).toBe('frustrated');
    expect(result.confidence).toBe(0.9);
  });

  it('lookupTerm parses JSON response', async () => {
    mockTextResponse(
      JSON.stringify({ term: 'Cashout', definition_en: 'early settle', definition_sw: 'maliza mapema' }),
    );
    const result = await client.lookupTerm('Cashout');
    expect(result.term).toBe('Cashout');
  });

  it('scoreReply parses JSON response', async () => {
    mockTextResponse(
      JSON.stringify({
        clarity: 8,
        empathy: 6,
        completeness: 7,
        overall: 7,
        suggestions: ['apologize first'],
      }),
    );
    const result = await client.scoreReply('my draft');
    expect(result.clarity).toBe(8);
    expect(result.suggestions).toHaveLength(1);
  });

  it('analyzeScreenshot parses JSON response', async () => {
    mockTextResponse(JSON.stringify({ markets: [], summary: 'empty' }));
    const result = await client.analyzeScreenshot('base64data');
    expect(result.summary).toBe('empty');
    expect(result.markets).toEqual([]);
  });

  // ----- error paths -----

  it('throws AuthError on 401 and does not retry', async () => {
    mockFetchResponse(401, { error: 'unauthorized' });
    await expect(client.polishText('hi')).rejects.toBeInstanceOf(AuthError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws AuthError when no API key is stored', async () => {
    (chrome.storage.local.get as unknown as MockFetch).mockResolvedValueOnce({});
    await expect(client.polishText('hi')).rejects.toBeInstanceOf(AuthError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('throws ParseError when the response has no content', async () => {
    mockFetchResponse(200, { content: [] });
    await expect(client.polishText('hi')).rejects.toBeInstanceOf(ParseError);
  });

  it('throws ParseError when JSON feature returns invalid JSON', async () => {
    mockTextResponse('not json at all');
    await expect(client.classifySentiment('hi')).rejects.toBeInstanceOf(ParseError);
  });

  it('throws ParseError when JSON response is missing required keys', async () => {
    mockTextResponse(JSON.stringify({ sentiment: 'neutral' }));
    await expect(client.classifySentiment('hi')).rejects.toBeInstanceOf(ParseError);
  });

  // ----- retry logic -----

  it('retries on 429 up to 3 times then throws RateLimitError (4 attempts total)', async () => {
    mockFetchResponse(429, {});
    mockFetchResponse(429, {});
    mockFetchResponse(429, {});
    mockFetchResponse(429, {});

    const promise = client.polishText('hi');
    const settled = promise.catch((err: unknown) => err);
    await vi.runAllTimersAsync();
    const result = await settled;

    expect(result).toBeInstanceOf(RateLimitError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  it('retries after a network failure and succeeds on the second attempt', async () => {
    (globalThis.fetch as unknown as MockFetch).mockRejectedValueOnce(new TypeError('fetch failed'));
    mockTextResponse('Hello');

    const promise = client.polishText('hi');
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('Hello');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on ParseError', async () => {
    mockTextResponse('not json');
    await expect(client.classifySentiment('hi')).rejects.toBeInstanceOf(ParseError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('maps 5xx to NetworkError and retries', async () => {
    mockFetchResponse(500, {});
    mockTextResponse('recovered');

    const promise = client.polishText('hi');
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('recovered');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws TimeoutError when fetch is aborted by the 30s timer', async () => {
    (globalThis.fetch as unknown as MockFetch).mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit).signal;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const promise = client.polishText('hi');
    const settled = promise.catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await settled;

    expect(result).toBeInstanceOf(TimeoutError);
  });

  it('does not retry on TimeoutError', async () => {
    (globalThis.fetch as unknown as MockFetch).mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit).signal;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const promise = client.polishText('hi');
    const settled = promise.catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await settled;

    expect(result).toBeInstanceOf(TimeoutError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('exposes NetworkError when fetch rejects with TypeError after exhausting retries', async () => {
    (globalThis.fetch as unknown as MockFetch)
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(new TypeError('offline'));

    const promise = client.polishText('hi');
    const settled = promise.catch((err: unknown) => err);
    await vi.runAllTimersAsync();
    const result = await settled;

    expect(result).toBeInstanceOf(NetworkError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });
});
