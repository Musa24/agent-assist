# CLAUDE.md

Single source of truth for Claude Code and developers working on this project. Read this file before starting any ticket.

## 1. Project Overview

**Agent Assist** (also referenced as "Insystem" in early docs) is an AI-powered Chrome Extension that helps betting customer support agents work faster and deliver higher-quality replies.

- **Target market:** betting operators (22bet, Helabet, Paripesa, Linebet, Melbet)
- **Target user:** customer support agents handling English and Swahili queries about betting markets, betslips, payments, and platform issues
- **Goal:** improve agent efficiency and CSAT scores by embedding Claude directly in the browser workflow

## 2. Features

The extension will ship five features. Current build status is tracked here — keep it up to date.

| | Feature | Status | Notes |
| --- | --- | --- | --- |
| F1 | **Text Polish** | **Shipped** | Pill-bar UI, preview + Accept/Reject flow, API-wired, prompt on V4 |
| F2 | **Screenshot Analyzer** | Not started | Prompt template exists (`SCREENSHOT_PROMPT_V1`) |
| F3 | **Sentiment Alert** | Not started | Prompt template exists (`SENTIMENT_PROMPT_V1`) |
| F4 | **Quick Term Lookup** | Not started | Prompt template exists (`LOOKUP_PROMPT_V1`); local glossary pending |
| F5 | **Response Quality Scorer** | Not started | Prompt template exists (`SCORER_PROMPT_V1`); removed from UI during Phase 1 |

### Feature descriptions

- **F1 — Text Polish:** agent clicks the ✨ icon on the right-edge pill bar of a focused text field → service worker calls Claude → polished result is shown in a **preview card with Accept / Reject** before anything is written to the field. Handles English, Swahili, and mixed-language. No inline text labels — icon + native tooltip only.
- **F2 — Screenshot Analyzer:** agent captures a screenshot of a betslip or betting page; the AI explains the visible markets (Over/Under, Accumulator, Cashout, etc.) in customer-friendly language.
- **F3 — Sentiment Alert:** extension monitors incoming customer messages, classifies sentiment, shows a color-coded badge on the extension icon, and suggests de-escalation responses when frustration is detected.
- **F4 — Quick Term Lookup:** agent highlights a betting term, right-clicks "Explain this term", and gets an instant definition from a local glossary (30+ terms) or Claude API fallback.
- **F5 — Response Quality Scorer:** agent clicks "Score" to get a CSAT prediction with sub-scores for Clarity, Empathy, and Completeness (1–10 each), plus improvement suggestions.

## 3. Tech Stack

- Chrome Extension **Manifest V3** (service worker, `type: module`)
- **TypeScript** strict mode — no `any`, explicit return types
- **Vite** for building the extension (**two-pass build** — see Architecture)
- **Vitest** (jsdom) for unit + integration tests
- **Claude API** — model `claude-sonnet-4-20250514`
- API key stored in `chrome.storage.local` under `agent_assist_api_key`; feature toggles under `agent_assist_features`
- `anthropic-dangerous-direct-browser-access: true` header is set on all Claude API calls (required because options page and service worker are treated as browser contexts)

## 4. Architecture

```
src/
  content/
    index.ts              # Content script entry, starts detector + toolbar
    text-detector.ts      # Tracks focused editable text fields
    floating-toolbar.ts   # Shadow-DOM pill bar, preview card, status line
    polish-handler.ts     # F1: sendMessage(POLISH_TEXT) + preview/accept/reject
  popup/
    index.{html,ts}       # Extension popup (placeholder, future F2/F3/Stats tabs)
  background/
    index.ts              # Service worker entry
    message-handler.ts    # Routes POLISH_TEXT → ClaudeApiClient, returns FeatureResponse
  shared/
    api-client.ts         # ClaudeApiClient — ONLY module that talks to Anthropic
    types.ts              # Response types, typed ApiError hierarchy, Message union
    prompts.ts            # Versioned prompt templates (POLISH_PROMPT_V1..V4, etc.)
    constants.ts          # Storage keys, feature IDs, default toggles, UI labels
  options/
    index.{html,ts}       # API key form, Test connection, feature toggles
tests/                    # Vitest — shared/api-client + content/polish-handler
docs/                     # PRD, ARCHITECTURE, PROMPTS, UI_DESIGN, API_DESIGN, etc.
public/
  manifest.json           # MV3 manifest, copied verbatim to dist/
  icons/                  # 16 / 48 / 128 PNG icons (generated via scripts/)
scripts/
  generate-icons.mjs      # Produces solid-color placeholder PNG icons (no deps)
```

### Build pipeline (two-pass)

MV3 content scripts cannot be loaded as ES modules and cannot share chunks with other ES-module entries, so the build runs **two Vite passes chained** in the `build` npm script:

1. **`vite.config.ts`** — multi-entry ES build for `popup`, `options`, `background`. Produces `dist/{background,popup,options}/index.js` (background is an ES-module service worker declared with `type: module`).
2. **`vite.config.content.ts`** — single-entry `build.lib` **IIFE** build for the content script. Produces `dist/content/index.js` as a self-contained classic script with all dependencies inlined.

`dist/` layout after build:

```
dist/
  manifest.json
  icons/icon-{16,48,128}.png
  background/index.js
  content/index.js      (IIFE)
  popup/index.{html,js}
  options/index.{html,js}
```

### Key patterns

- **API key isolation.** `ClaudeApiClient` is the only module that reads the API key and makes HTTP requests. Content scripts and popup **never** call the API directly — they message the service worker (`chrome.runtime.sendMessage({ type: 'POLISH_TEXT', ... })`).
- **Shadow DOM UI.** All injected UI (pill bar, preview card, status line) lives inside a single shadow root on a fixed-position host with `pointer-events: none`. Children re-enable `pointer-events: auto`.
- **Retry policy.** `api-client.ts` retries on `NetworkError` and `RateLimitError` with exponential backoff (1s / 2s / 4s). Does NOT retry on `AuthError`, `ParseError`, `TimeoutError`.
- **Versioned prompts.** `src/shared/prompts.ts` holds every prompt version. Never edit a shipped prompt in place — bump the version (e.g. `POLISH_PROMPT_V4`), then update `api-client.ts` to import the new constant. Older versions stay in the file for rollback.

## 5. Coding Conventions

- **Conventional commits:** `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `perf:` — reference the ticket when applicable, e.g. `feat: wire polish button to Claude API with undo (SUPT-014)`
- **Branch naming:** `feature/SUPT-XXX-short-description` for ticketed work; `improvement/<slug>`, `fix/<slug>`, `chore/<slug>` for untracked work
- **File naming:** camelCase for `.ts` files, kebab-case for directories
- **Explicit return types** on all functions (enforced by ESLint)
- **No `any`** (enforced by ESLint)
- **Error handling:** always handle errors with user-friendly messages and log to console with the `[AGENT-ASSIST]` prefix
- **No premature optimisation** — simplicity first
- **Incremental development** — small commits, each one working, all checks passing before push

## 6. Workflow (Jira + GitHub)

- Most work maps to a Jira ticket in the **SUPT** project; standalone improvements can use `improvement/*` branches
- Workflow states: **To Do → In Progress → Done**
- For each ticket:
  1. Read `CLAUDE.md`
  2. Fetch the ticket from Jira
  3. Create a branch (`feature/SUPT-XXX-...`)
  4. Implement
  5. Commit
  6. Push
  7. Open a PR
  8. Move the ticket to **In Progress**
- PRs are reviewed by the developer before merging
- After merge, the developer moves the ticket to **Done** in Jira
- Convenience slash command: `/implement-ticket SUPT-XX` (project-scoped, in `.claude/commands/`)

## 7. Testing Requirements

- Write tests **alongside** code, not after
- Use **Vitest** (jsdom environment, setup file mocks `chrome.*` APIs)
- Mock Chrome APIs (`chrome.storage`, `chrome.tabs`, `chrome.contextMenus`, `chrome.action`, `chrome.runtime.sendMessage`) via `tests/setup.ts`
- Mock `fetch` for Claude API calls via `vi.fn()` overrides per-test
- Use fake timers (`vi.useFakeTimers()`) when exercising retry delays
- Coverage target: **80%+** for `src/shared/`, reasonable coverage for UI modules
- Current suite: **31 tests passing** (`api-client.test.ts`, `polish-handler.test.ts`)

## 8. Chrome Extension Permissions

Declared in `public/manifest.json`:

- `activeTab` — capture screenshots, access current tab
- `storage` — store API key and feature toggles
- `contextMenus` — right-click term lookup (F4)
- `tabs` — tab capture for F2 screenshot analyzer
- `host_permissions`: `<all_urls>` on the content script for broad chat-tool support

## 9. Build & Run

```sh
npm install            # install deps
npm run build          # two-pass build → dist/
npm run dev            # watch mode (rebuild on change)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src tests
npm run test           # vitest run
npm run test:watch     # vitest watch
```

Load the extension in `chrome://extensions`: enable Developer mode → **Load unpacked** → select the `dist/` folder. After any code change, `npm run build` → click the **↻ reload** icon on the Agent Assist card → reload the test tab (content scripts only attach on page load).
