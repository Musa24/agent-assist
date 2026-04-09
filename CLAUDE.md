# CLAUDE.md

Single source of truth for Claude Code and developers working on this project. Read this file before starting any ticket.

## 1. Project Overview

**Insystem** is an AI-powered Chrome Extension that helps betting customer support agents work faster and deliver higher-quality replies.

- **Company:** Insystem (simulated betting company focused on CS tooling)
- **Target user:** customer support agents handling English and Swahili queries about betting markets, betslips, and platform issues
- **Goal:** improve agent efficiency and CSAT scores

## 2. Features

The extension ships five features:

- **F1 — Text Polish:** agent clicks a button near any text field to format, fix grammar, and professionalize their reply. Handles English, Swahili, and mixed-language text.
- **F2 — Screenshot Analyzer:** agent captures a screenshot of a betslip or betting page; the AI explains the visible betting markets (Over/Under, Accumulator, Cashout, etc.) in customer-friendly language.
- **F3 — Sentiment Alert:** the extension monitors incoming customer messages, classifies sentiment, shows a color-coded badge on the extension icon, and suggests de-escalation responses when frustration is detected.
- **F4 — Quick Term Lookup:** agent highlights a betting term, right-clicks "Explain this term", and gets an instant definition from a local glossary (30+ terms) or Claude API fallback. Displayed in a tooltip.
- **F5 — Response Quality Scorer:** before sending a reply, agent clicks "Score" to get a CSAT prediction with scores for Clarity, Empathy, and Completeness (each 1–10), plus improvement suggestions.

## 3. Tech Stack

- Chrome Extension **Manifest V3** (service worker, not background page)
- **TypeScript** (strict mode, no `any`)
- **Vite** for building the extension
- **Vitest** for unit and integration tests
- **Claude API** for all AI calls
- API key stored securely in `chrome.storage.local`

## 4. Architecture

```
src/
  content/      # content scripts injected into all pages
  popup/        # extension popup UI
  background/   # service worker (handles API calls, manages state)
  shared/       # shared modules (API client, types, utilities, glossary)
  options/      # options page (API key setup, feature toggles)
tests/          # unit and integration tests
docs/           # project documentation
public/         # static assets (manifest.json, icons)
```

## 5. Coding Conventions

- **Conventional commits:** `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `perf:` — always reference the ticket, e.g. `feat: add floating toolbar (SUPT-015)`
- **Branch naming:** `feature/SUPT-XXX-short-description`
- **File naming:** camelCase for `.ts` files, kebab-case for directories
- **Explicit return types** on all functions
- **Error handling:** always handle errors with user-friendly messages and log to console with the `[INSYSTEM]` prefix
- **No premature optimisation** — simplicity first
- **Incremental development** — small commits, each one working

## 6. Workflow (Jira + GitHub)

- Every task maps to a Jira ticket in the **SUPT** project
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

## 7. Testing Requirements

- Write tests **alongside** code, not after
- Use **Vitest**
- Mock Chrome APIs (`chrome.storage`, `chrome.tabs`, `chrome.contextMenus`, `chrome.action`)
- Mock `fetch` for Claude API calls
- Coverage target: **80%+** for `src/shared/`, reasonable coverage for UI modules

## 8. Chrome Extension Permissions

- `activeTab` — capture screenshots, access current tab
- `storage` — store API key and settings
- `contextMenus` — right-click term lookup
- `tabs` — tab capture for screenshots
