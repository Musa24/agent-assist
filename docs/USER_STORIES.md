# Insystem — User Stories & Acceptance Criteria

User stories for all 5 features. Format: **As a [CS agent], I want [action], so that [benefit].** Each story carries testable acceptance criteria. Edge cases are called out per feature. A global Definition of Done applies to every story.

---

## F1 — Text Polish

### US-1.1 — Polish a rough English draft
**As a** CS agent, **I want** to polish my draft reply with one click, **so that** my message is grammatically correct and professional before sending.

- [ ] A "Polish" button is visible next to any focused text field on supported pages
- [ ] Clicking the button replaces the draft with a polished version in under 3 seconds
- [ ] Polished output preserves the original meaning
- [ ] Original draft is recoverable via undo (Ctrl/Cmd+Z)

### US-1.2 — Polish a Swahili-only draft
**As a** Swahili-speaking CS agent, **I want** to polish a Swahili-only message, **so that** I do not have to switch to English to get help.

- [ ] Pure Swahili input returns Swahili output (no translation to English)
- [ ] Common Swahili betting terms are preserved (e.g. "akaunti", "betslip")
- [ ] Tone is professional in Swahili register

### US-1.3 — Polish mixed-language (Swahili + English) draft
**As a** CS agent who code-switches, **I want** to polish a mixed-language draft, **so that** the result reads naturally in both languages.

- [ ] Mixed-language input returns mixed-language output (no forced single language)
- [ ] Code-switch boundaries remain natural
- [ ] Grammar is corrected in both languages

### US-1.4 — Edge case: empty text field
**As a** CS agent who clicked Polish accidentally, **I want** the extension to fail gracefully on empty input, **so that** I don't see a confusing error.

- [ ] Clicking Polish on an empty field shows an inline hint: "Type something first"
- [ ] No API call is made
- [ ] No console error

### US-1.5 — Edge case: very long text (5000+ characters)
**As a** CS agent writing a long incident summary, **I want** Polish to handle long input, **so that** I can clean up multi-paragraph replies.

- [ ] Input up to 5000 characters is accepted
- [ ] Inputs over 5000 characters show a warning and offer to truncate
- [ ] Polished output retains paragraph structure

---

## F2 — Screenshot Analyzer

### US-2.1 — Explain a betslip screenshot
**As a** CS agent, **I want** to capture a betslip and get a plain-language explanation, **so that** I can answer the customer faster.

- [ ] "Analyze Screenshot" button in popup captures the active tab
- [ ] Explanation appears in popup within 5 seconds
- [ ] Bet type (Single, Accumulator, System, etc.) is correctly named
- [ ] Stake, odds, and potential payout are surfaced when visible

### US-2.2 — Explain an unfamiliar market screen
**As a** CS agent, **I want** the analyzer to describe market types like Over/Under and Cashout, **so that** I can explain them to the customer.

- [ ] Common markets (Over/Under, 1X2, BTTS, Accumulator, Cashout) are recognized
- [ ] Output uses customer-friendly language (no jargon without definition)

### US-2.3 — Copy explanation to chat
**As a** CS agent, **I want** to copy the explanation with one click, **so that** I can paste it into chat.

- [ ] A "Copy" button is visible next to the explanation
- [ ] Clicking copies plain text to clipboard
- [ ] Toast confirms the copy

### US-2.4 — Edge case: API failure / timeout
**As a** CS agent, **I want** clear feedback when the API fails, **so that** I know to retry or fall back manually.

- [ ] On HTTP error or timeout (>10s), a friendly error message is shown
- [ ] A "Retry" button is offered
- [ ] Error is logged with `[INSYSTEM]` prefix

---

## F3 — Sentiment Alert

### US-3.1 — See a sentiment badge for incoming messages
**As a** CS agent, **I want** a color-coded badge on the extension icon, **so that** I can spot frustrated customers at a glance.

- [ ] Badge color updates within 2 seconds of a new customer message
- [ ] Green = positive/neutral, Yellow = negative, Red = frustrated
- [ ] Badge resets when conversation ends

### US-3.2 — Get a de-escalation suggestion when sentiment is red
**As a** CS agent, **I want** a suggested de-escalation phrase when a customer is angry, **so that** I can respond calmly under pressure.

- [ ] Red sentiment opens a popup card with 1–3 suggested phrases
- [ ] Suggestions are tone-appropriate and non-condescending
- [ ] Suggestions can be copied with one click

### US-3.3 — Code-switching customer message (Swahili + English)
**As a** CS agent in a bilingual market, **I want** sentiment to work for code-switched messages, **so that** I am not blind on mixed-language tickets.

- [ ] Mixed Swahili-English input is classified correctly (verified against labeled test set)
- [ ] Suggested de-escalation phrases match the dominant language of the customer message

### US-3.4 — Edge case: API failure
**As a** CS agent, **I want** sentiment to fail silently when the API is down, **so that** my workflow is not interrupted.

- [ ] On API error, badge falls back to neutral/grey
- [ ] No blocking modal is shown
- [ ] Error logged with `[INSYSTEM]` prefix

---

## F4 — Quick Term Lookup

### US-4.1 — Look up a term from the local glossary
**As a** CS agent, **I want** to right-click a betting term and get an instant definition, **so that** I do not break flow searching the web.

- [ ] Right-click context menu shows "Explain this term"
- [ ] Local-glossary lookup returns in under 100ms
- [ ] Definition appears in a tooltip near the cursor

### US-4.2 — Fall back to Claude for unknown terms
**As a** CS agent encountering a new term, **I want** the extension to ask Claude when the glossary misses, **so that** I am never left without an answer.

- [ ] Terms not in the local glossary trigger an API call
- [ ] API fallback returns in under 2 seconds
- [ ] Fallback definition is cached for the session

### US-4.3 — Look up a multi-word phrase
**As a** CS agent, **I want** to highlight a phrase like "Asian Handicap" and get one definition, **so that** multi-word terms work too.

- [ ] Highlighted phrases (up to 50 chars) are passed verbatim
- [ ] Multi-word glossary entries match correctly

### US-4.4 — Edge case: term not in glossary AND API fails
**As a** CS agent, **I want** a clear "no result" message when both lookups fail, **so that** I know to look elsewhere.

- [ ] Tooltip shows "No definition available — try searching manually"
- [ ] Error is logged with `[INSYSTEM]` prefix

---

## F5 — Response Quality Scorer

### US-5.1 — Score a draft reply
**As a** CS agent, **I want** to score my reply before sending, **so that** I catch quality issues early.

- [ ] "Score" button appears next to reply fields on supported pages
- [ ] Clicking returns Clarity, Empathy, and Completeness scores (1–10 each) in under 3 seconds
- [ ] An overall CSAT prediction is shown
- [ ] At least one improvement suggestion is provided

### US-5.2 — See concrete improvement suggestions
**As a** CS agent, **I want** suggestions to be specific, **so that** I know exactly what to change.

- [ ] Suggestions reference concrete sentences or omissions, not generic advice
- [ ] Suggestions are actionable in under a minute

### US-5.3 — Re-score after editing
**As a** CS agent, **I want** to re-run the scorer after edits, **so that** I can confirm improvements.

- [ ] Re-scoring works without page reload
- [ ] New scores replace old scores in place

### US-5.4 — Edge case: empty draft
**As a** CS agent, **I want** Score to refuse empty input, **so that** I do not waste an API call.

- [ ] Clicking Score on empty field shows: "Write a draft first"
- [ ] No API call is made

### US-5.5 — Edge case: very long draft (5000+ characters)
**As a** CS agent writing a detailed reply, **I want** Score to handle long drafts, **so that** I can self-check long replies too.

- [ ] Drafts up to 5000 characters are scored
- [ ] Drafts over 5000 characters show a warning and offer to truncate

---

## Definition of Done (applies to every story)

- [ ] Code reviewed via Pull Request
- [ ] All tests passing in CI
- [ ] ESLint clean — zero warnings
- [ ] Feature verified on at least **3 different websites**
- [ ] Swahili input/output verified where applicable
- [ ] Commit follows conventional commit format and references the Jira ticket (e.g. `feat: add floating toolbar (SUPT-015)`)
