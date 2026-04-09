# Insystem — API Client & Error Handling Design

Technical design for `src/shared/api-client.ts`, the **only** module in the extension that talks to the Claude API. Read [`CLAUDE.md`](../CLAUDE.md), [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md), and [`docs/PROMPTS.md`](./PROMPTS.md) for context.

> **Hard rule.** The API client only ever runs inside the **service worker**. Content scripts and the popup never import it directly — they message the service worker, which calls the client.

---

## 1. TypeScript Interfaces

All types live in `src/shared/types.ts`. The client itself is the small interface below.

```ts
// ----- Response payloads -----

export interface ScreenshotMarket {
  name: string;
  explanation: string;
  odds_info?: string;
}

export interface ScreenshotAnalysis {
  markets: ScreenshotMarket[];
  summary: string;
}

export type Sentiment = "positive" | "neutral" | "frustrated" | "angry";

export interface SentimentResult {
  sentiment: Sentiment;
  confidence: number;          // 0..1
  suggestedResponse: string;
}

export interface TermDefinition {
  term: string;
  definition_en: string;
  definition_sw: string;
  example?: string;
}

export interface QualityScore {
  clarity: number;             // 1..10
  empathy: number;             // 1..10
  completeness: number;        // 1..10
  overall: number;             // 1..10
  suggestions: string[];       // up to 3
}

// ----- Client -----

export interface ClaudeApiClient {
  polishText(text: string): Promise<string>;
  analyzeScreenshot(base64Image: string): Promise<ScreenshotAnalysis>;
  classifySentiment(text: string): Promise<SentimentResult>;
  lookupTerm(term: string): Promise<TermDefinition>;
  scoreReply(text: string, customerMessage?: string): Promise<QualityScore>;
}
```

JSON-returning methods (every one except `polishText`) are validated with **Zod schemas** before being returned. A schema mismatch throws `ParseError`.

---

## 2. Request Flow

Every method in the client follows the same pipeline:

1. **Read API key** from `chrome.storage.local` (`getApiKey()`).
2. **Build the request body** from the prompt template (`src/shared/prompts/`) plus the user content.
3. **POST** to `https://api.anthropic.com/v1/messages` with headers:
   - `x-api-key: <key>`
   - `anthropic-version: 2023-06-01`
   - `content-type: application/json`
4. **Wait** for the response, with a **30-second timeout** (via `AbortController`).
5. **Map HTTP status → typed error** (see §3).
6. **Extract** `response.content[0].text`.
7. **For JSON features:** parse with `JSON.parse`, then validate with the matching Zod schema. On failure → `ParseError`.
8. **Return** the typed result.

Pseudocode:

```ts
async function callClaude<T>(
  prompt: PromptTemplate,
  userContent: ContentBlock[],
  parse: (raw: string) => T,
): Promise<T> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new AuthError("No API key set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: prompt.maxTokens,
        system: prompt.system,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) throw mapHttpError(res.status);

    const data = await res.json();
    const text = data.content?.[0]?.text;
    if (typeof text !== "string") throw new ParseError("Empty content");

    return parse(text);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new TimeoutError();
    }
    if (err instanceof TypeError) {
      // fetch network failure
      throw new NetworkError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

---

## 3. Error Handling Strategy

A small hierarchy of typed errors lives in `src/shared/errors.ts`. Each has a stable `code` and a user-facing `message`.

```ts
export class ApiError extends Error {
  code: string;
  userMessage: string;
}

export class NetworkError    extends ApiError { code = "NETWORK"; }
export class AuthError       extends ApiError { code = "AUTH"; }
export class RateLimitError  extends ApiError { code = "RATE_LIMIT"; }
export class TimeoutError    extends ApiError { code = "TIMEOUT"; }
export class ParseError      extends ApiError { code = "PARSE"; }
```

### Mapping table

| Trigger | Error class | User-facing message |
| --- | --- | --- |
| `fetch` `TypeError` (offline / DNS) | `NetworkError` | "Check your internet connection." |
| HTTP **401** | `AuthError` | "Your Claude API key is invalid. Open Insystem options to update it." |
| HTTP **429** | `RateLimitError` | "Too many requests right now — please wait a moment and try again." |
| `AbortError` after 30 s | `TimeoutError` | "The request timed out. Try again." |
| HTTP **5xx** | `NetworkError` | "Claude is temporarily unavailable. Please retry." |
| Bad JSON / schema mismatch | `ParseError` | "Something went wrong reading the response. Please try again." |

All errors are logged with the `[INSYSTEM]` prefix and the prompt version, so we can correlate failures to a prompt revision.

```ts
console.error("[INSYSTEM]", err.code, { promptVersion });
```

### Where errors surface

- **Service worker** catches the error from `api-client`, includes the `code` + `userMessage` in the message reply, and forwards to the caller (content script / popup).
- **UI components** read `userMessage` and render it in the matching error state defined in `docs/UI_DESIGN.md` (red toolbar button, red badge, popup error banner, etc.).

---

## 4. Retry Logic

Exponential backoff, applied **inside** `callClaude` for retryable errors only.

| Attempt | Delay before attempt |
| --- | --- |
| 1 | 0 ms |
| 2 | **1 s** |
| 3 | **2 s** |
| 4 | **4 s** |
| → | give up, throw the last error |

Rules:

- **Max retries:** 3 (so up to 4 total attempts).
- **Retry on:** `NetworkError`, `RateLimitError` (`429`), HTTP `5xx`.
- **Do not retry on:** `AuthError` (`401`), `ParseError`, `TimeoutError`.
- For `RateLimitError`, if the response includes `retry-after`, that value overrides the backoff for that attempt.
- Each retry adds ±20% jitter to avoid synchronized retries from multiple tabs.

```ts
const RETRYABLE = new Set(["NETWORK", "RATE_LIMIT"]);
const DELAYS_MS = [1000, 2000, 4000];

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as ApiError).code;
      if (!RETRYABLE.has(code) || attempt >= DELAYS_MS.length) throw err;
      await sleep(jitter(DELAYS_MS[attempt]));
    }
  }
}
```

---

## 5. API Key Security

- **Storage:** the key lives in `chrome.storage.local`, which Chrome encrypts at rest. Key: `INSYSTEM_API_KEY`.
- **Read site:** the **service worker only**. Content scripts and the popup do not have a direct reader for the key.
- **No DOM exposure:** the key is never written to the DOM, never put in a window message, never logged.
- **No network exposure beyond Anthropic:** the only `fetch` destination in the entire codebase is `api.anthropic.com`. CSP and host permissions enforce this.
- **Options page** is the only UI that can write the key. It writes through a typed setter and never echoes the value back to the input after save.
- **Removal:** clicking "Remove key" in options calls `chrome.storage.local.remove("INSYSTEM_API_KEY")` and the next API call throws `AuthError`.
- **Why this works:** even if a malicious page tries to invoke our content script's APIs, it cannot reach the key — content scripts can only ask the service worker for results, never for the key itself.

---

## 6. Rate Limiting Awareness

The Claude API enforces per-minute and per-day limits. We track local usage to stay safely below them.

### Local counter

Stored in memory in the service worker (lost on worker termination, which is fine — it self-rebuilds):

```ts
class RateTracker {
  private requests: number[] = []; // timestamps in ms

  record(): void {
    this.requests.push(Date.now());
    this.prune();
  }

  requestsLastMinute(): number {
    this.prune();
    return this.requests.length;
  }

  private prune(): void {
    const cutoff = Date.now() - 60_000;
    this.requests = this.requests.filter(t => t > cutoff);
  }
}
```

### Thresholds (configurable in `src/shared/constants.ts`)

| Constant | Default | Behavior |
| --- | --- | --- |
| `SOFT_LIMIT_RPM` | 40 | At ≥ soft limit, new calls are queued and a "throttled" status is sent to the popup. |
| `HARD_LIMIT_RPM` | 50 | At ≥ hard limit, calls reject with `RateLimitError` immediately (no API call made). |
| `QUEUE_TIMEOUT_MS` | 10_000 | Queued calls that wait longer than this also reject with `RateLimitError`. |

### User feedback when throttled

- The popup header dot turns **yellow** with tooltip "Throttled — slowing down to respect API limits".
- Floating toolbar buttons stay enabled but show a small "Queued…" hint until the call runs.
- After 30 s of no throttling, the indicator returns to green automatically.

### Reactive backoff

If the API itself responds with `429` (the authoritative signal), we additionally:

1. Set an in-memory `nextAllowedAt` timestamp from the `retry-after` header.
2. Reject all queued calls scheduled before that time.
3. Resume normal flow once the cooldown passes.
