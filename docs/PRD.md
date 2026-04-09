# Insystem — Product Requirements Document

## 1. Product Vision

Insystem is an AI-powered Chrome Extension that turns betting customer support agents into faster, more consistent, and more empathetic responders. By embedding Claude directly into the agent's existing browser-based workflow, Insystem helps agents polish replies, decode betslips, catch frustrated customers early, look up betting jargon instantly, and self-check the quality of every response — all without leaving the chat tool they already use.

## 2. Problem Statement

Betting customer support agents face several recurring frictions that hurt both throughput and CSAT:

- **Slow typing under pressure** — agents juggle 50+ tickets/day and lose minutes to typos and rewrites.
- **Grammar and tone inconsistency** — replies vary in professionalism, especially when switching between English and Swahili.
- **Hard-to-explain betting markets** — customers ask "what does Over/Under 2.5 mean?" or share confusing betslip screenshots; agents struggle to explain quickly in plain language.
- **Missed frustration signals** — angry customers are sometimes detected only after they escalate, when de-escalation is much harder.
- **Inconsistent quality** — there is no objective check on whether a reply is clear, empathetic, and complete before it is sent.

## 3. Target User Persona

**"Amina" — Betting Customer Support Agent**

- Handles **50+ chat tickets per day** across betting markets, betslips, deposits/withdrawals, and account issues
- Speaks **English and Swahili**, often code-switching mid-conversation
- Works in a **web-based chat tool** (browser-only, no native app)
- **Measured on CSAT and average response time** — both are reported weekly
- Comfortable with browser extensions, but has no time to learn complex tools — anything Insystem ships must be one click away

## 4. Feature Requirements

### F1 — Text Polish

- **What it does:** rewrites the agent's draft reply to fix grammar, format, and professionalize tone. Handles English, Swahili, and mixed-language text.
- **Who uses it:** any agent drafting a reply.
- **Trigger:** agent clicks the "Polish" button rendered next to a focused text field.
- **Input:** raw draft text from the field.
- **Output:** polished version inserted back into the field (replacing the draft).
- **Success criteria:** polished output preserves meaning, fixes grammar, keeps the original language(s), and returns in under 3 seconds.

### F2 — Screenshot Analyzer

- **What it does:** explains what is visible on a betslip or betting page in customer-friendly language (markets like Over/Under, Accumulator, Cashout, etc.).
- **Who uses it:** agents handling questions about a customer's betslip or a market screen.
- **Trigger:** agent clicks "Analyze Screenshot" in the popup, which captures the active tab.
- **Input:** screenshot of the current tab.
- **Output:** plain-language explanation rendered in the popup, ready to paste into chat.
- **Success criteria:** explanation correctly identifies the bet type and key terms in 90%+ of test screenshots; returns in under 5 seconds.

### F3 — Sentiment Alert

- **What it does:** monitors incoming customer messages, classifies sentiment, shows a color-coded badge on the extension icon, and suggests de-escalation phrases when frustration is detected.
- **Who uses it:** every agent, passively — runs in the background on supported chat pages.
- **Trigger:** new incoming customer message detected on the page.
- **Input:** the latest customer message text.
- **Output:** badge color (green / yellow / red) on the extension icon, plus a suggested de-escalation reply when red.
- **Success criteria:** correctly flags frustration in 80%+ of labeled test cases; suggested de-escalation phrases are tone-appropriate.

### F4 — Quick Term Lookup

- **What it does:** gives an instant definition of a highlighted betting term, from a local glossary of 30+ terms or a Claude API fallback.
- **Who uses it:** agents who encounter unfamiliar jargon (their own or the customer's).
- **Trigger:** agent highlights a term and right-clicks "Explain this term".
- **Input:** highlighted text.
- **Output:** definition rendered in a tooltip near the cursor.
- **Success criteria:** local-glossary lookups return in under 100ms; API fallback returns in under 2 seconds.

### F5 — Response Quality Scorer

- **What it does:** before sending a reply, scores it for **Clarity**, **Empathy**, and **Completeness** (1–10 each), gives a CSAT prediction, and suggests improvements.
- **Who uses it:** any agent wanting a self-check before sending.
- **Trigger:** agent clicks the "Score" button next to the reply field.
- **Input:** the agent's drafted reply (and optionally the customer's last message for context).
- **Output:** three sub-scores, an overall CSAT prediction, and a short list of improvement suggestions.
- **Success criteria:** scores returned in under 3 seconds; suggestions are concrete and actionable.

## 5. Out of Scope for v1

The following are explicitly **not** part of v1:

- Admin dashboard or analytics console
- Team management, roles, or permissions
- CRM integration (Zendesk, Intercom, Salesforce, etc.)
- Auto-reply or autonomous agents — **the human agent is always in control**
- Mobile app (iOS / Android)
- Multi-browser support beyond Chrome
- Voice / phone channel support

## 6. Success Metrics

- **Response time reduction:** target **−30%** average handle time per ticket vs. baseline
- **CSAT improvement:** target **+15%** weekly CSAT score vs. baseline
- **Agent adoption rate:** target **80%** of agents using Insystem at least daily within 4 weeks of rollout
- **Feature usage distribution:** every feature used by at least **40%** of active agents weekly (no dead features)

## 7. Technical Constraints

- **Claude API dependency** — all AI features require a working Claude API key; offline mode is not supported (except local-glossary lookup in F4).
- **Chrome-only** — built on Manifest V3; no Firefox / Safari / Edge port in v1.
- **Per-agent API key** — each agent supplies their own Claude API key, stored in `chrome.storage.local`. No central proxy in v1.
- **Network dependency** — features F1, F2, F3, and F5 require network access; degraded experience offline.
