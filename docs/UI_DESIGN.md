# Insystem — UI/UX Design

UI/UX design for every user-facing surface of the Insystem Chrome Extension. Read [`CLAUDE.md`](../CLAUDE.md) and [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) for project context.

> **Style isolation:** every component injected into a host page (Floating Toolbar, Tooltip, Score Badge, De-escalation card) is rendered inside a **shadow root** so page CSS cannot leak in and page scripts cannot read our DOM. Popup and Options page run in their own extension contexts and do not need shadow DOM.

---

## 1. Floating Toolbar (content script overlay)

A small toolbar that appears next to whichever text field the agent is editing. Hosts the Polish (F1) and Score (F5) actions.

### Position & behavior

- Anchored above the focused text field; if there is no room above, flips below.
- Follows the field on scroll/resize using a `ResizeObserver` + `IntersectionObserver`.
- Hides when no editable field is focused for 2 seconds.
- Rendered inside a shadow root attached to a top-level host element.

### Layout (idle)

```
┌────────────────────────────┐
│  ✨ Polish     📊 Score   │
└────────────────────────────┘
            ▼
   [ focused text field ]
```

### States

| State | Visual |
| --- | --- |
| **Idle** | White background, blue icons, subtle shadow |
| **Loading** | The clicked button's icon is replaced by a small spinner; the button is disabled |
| **Success** | Brief 400 ms green flash on the button background; toolbar then returns to idle |
| **Error** | Button background turns red with a "Retry" label; click to re-run the action |

### After Polish completes — Undo affordance

```
┌────────────────────────────────────┐
│  ✨ Polished  ↶ Undo   📊 Score    │
└────────────────────────────────────┘
```

- "Undo" appears for 8 seconds after a successful Polish, then auto-dismisses.
- Clicking Undo restores the original draft (kept in memory, never persisted).

---

## 2. Extension Popup (`src/popup/`)

The popup is the home for actions that need a larger surface than a content-script overlay: Screenshot Analyzer (F2), Sentiment dashboard (F3), and basic stats.

### Layout

- Fixed width: **380 px**, height grows with content (max 600 px).
- Three top tabs: **Screenshot · Sentiment · Stats**.
- Header shows the Insystem logo and a small connection-status dot (green = API key valid, red = invalid/missing).

```
┌──────────────────────────────────────┐
│  Insystem                       ● ON │
├──────────────────────────────────────┤
│  [ Screenshot ] [ Sentiment ] [ … ]  │
├──────────────────────────────────────┤
│                                      │
│           ( tab content )            │
│                                      │
└──────────────────────────────────────┘
```

### Screenshot tab (F2)

```
┌──────────────────────────────────────┐
│  📸  Capture screenshot               │
├──────────────────────────────────────┤
│   [ image preview, 360×200 ]          │
│   [   Crop  ]                         │
├──────────────────────────────────────┤
│   [   Analyze   ]                     │
├──────────────────────────────────────┤
│   Markets:                            │
│   • Over 2.5 — bet on 3+ goals        │
│   • BTTS Yes  — both teams to score   │
│   Summary: 3-leg Accumulator…         │
│                            [📋 Copy]  │
└──────────────────────────────────────┘
```

States: **idle → captured → cropping (optional) → analyzing → done / error**.

### Sentiment tab (F3)

```
┌──────────────────────────────────────┐
│   Current sentiment:   🟡 Frustrated  │
├──────────────────────────────────────┤
│   Last 5 readings                     │
│   1. 🟢 Neutral    — 12:01            │
│   2. 🟢 Neutral    — 12:03            │
│   3. 🟡 Frustrated — 12:05            │
│   4. 🔴 Angry      — 12:06            │
│   5. 🟡 Frustrated — 12:08            │
├──────────────────────────────────────┤
│   Suggested de-escalation             │
│   "I understand your frustration…"    │
│                            [📋 Copy]  │
└──────────────────────────────────────┘
```

### Stats tab

```
┌──────────────────────────────────────┐
│   Today                               │
│   ✨ Polish        42 uses            │
│   📸 Screenshot    11 uses            │
│   🔍 Lookup        27 uses            │
│   📊 Score         18 uses            │
│   🎯 Sentiment     auto                │
├──────────────────────────────────────┤
│   Avg response time   7.4 s           │
└──────────────────────────────────────┘
```

---

## 3. Tooltip (F4 — Quick Term Lookup)

A small floating card that appears near the cursor after the agent right-clicks a selected term.

```
┌─────────────────────────────────┐
│  Asian Handicap              ✕  │
├─────────────────────────────────┤
│  EN  A market that gives one    │
│      team a goal advantage…     │
│                                 │
│  SW  Soko linalompa timu moja   │
│      faida ya magoli…            │
└─────────────────────────────────┘
```

- Width: 280 px, max height 200 px (scrolls inside).
- Term name in **bold**, then English then Swahili definitions.
- Dismiss: click outside, press **Escape**, or click the **✕**.
- Shadow DOM isolated.

### States

| State | Visual |
| --- | --- |
| **Loading** | Skeleton shimmer for the two definition rows |
| **Local hit** | Definitions appear instantly (<100 ms) |
| **API fallback** | Definitions appear in <2 s, with a small "via Claude" subtitle |
| **Error / not found** | "No definition available — try searching manually" |

---

## 4. Score Badge (F5 inline)

A small circular badge that appears next to the text field after F5 runs.

### Collapsed

```
   ┌────┐
   │  8 │   ← circle, color = score band
   └────┘
```

- Diameter: **28 px**
- Color bands: **🔴 1–4**, **🟡 5–7**, **🟢 8–10**

### Expanded (click)

```
┌──────────────────────────────────┐
│   Overall      🟢 8 / 10    ▲    │
├──────────────────────────────────┤
│   Clarity        9                │
│   Empathy        6                │
│   Completeness   8                │
├──────────────────────────────────┤
│   Suggestions                     │
│   • Open with a brief apology…    │
│   • Tell the customer the ETA…    │
└──────────────────────────────────┘
```

- Toggles between collapsed/expanded on click.
- Auto-collapses after the agent edits the field, so re-scoring can run cleanly.
- Shadow DOM isolated.

### States

| State | Visual |
| --- | --- |
| **Idle (collapsed)** | Colored circle with the overall number |
| **Loading** | Spinner inside the circle |
| **Expanded** | Card with per-dimension scores + suggestions |
| **Error** | Grey circle with `!`; click reveals a "Retry" button |

---

## 5. Options Page (`src/options/`)

The options page is the only place the agent ever enters their Claude API key, toggles features, and inspects feedback.

### Layout

```
┌──────────────────────────────────────────────┐
│  Insystem · Settings                          │
├──────────────────────────────────────────────┤
│  Claude API key                               │
│  [ ••••••••••••••••••••• ]   [ Save ]         │
│  [ Test connection ]    ✅ Connected           │
├──────────────────────────────────────────────┤
│  Features                                     │
│   ✨  Text Polish                  ●─── ON    │
│   📸  Screenshot Analyzer          ●─── ON    │
│   🎯  Sentiment Alert              ●─── ON    │
│   🔍  Quick Term Lookup            ●─── ON    │
│   📊  Quality Scorer               ●─── ON    │
├──────────────────────────────────────────────┤
│  Feedback log                  [ Export CSV ] │
│  • 2026-04-08  Polish — 👍                    │
│  • 2026-04-08  Score  — 👎  "missed empathy"  │
│  • 2026-04-07  Lookup — 👍                    │
└──────────────────────────────────────────────┘
```

### States

| Element | States |
| --- | --- |
| **API key input** | empty / filled (masked) / invalid format |
| **Save button** | disabled (no change) → idle → saving → saved (green check 1.5 s) |
| **Test Connection** | idle → testing (spinner) → ✅ green / ❌ red with error message |
| **Feature toggles** | on / off (immediately persisted to `chrome.storage.local`) |
| **Feedback log** | empty state ("No feedback yet") / populated / exporting |

---

## 6. Design Tokens

These tokens are exported from `src/shared/design-tokens.ts` and consumed by every UI surface.

### Color palette

| Token | Value | Use |
| --- | --- | --- |
| `--primary` | `#2563EB` | Buttons, links, focus rings |
| `--success` | `#16A34A` | Green flash, success badges, score band 8–10 |
| `--warning` | `#EAB308` | Score band 5–7, frustrated sentiment |
| `--danger`  | `#DC2626` | Errors, score band 1–4, angry sentiment |
| `--neutral-900` | `#111827` | Body text |
| `--neutral-700` | `#374151` | Secondary text |
| `--neutral-300` | `#D1D5DB` | Borders |
| `--neutral-100` | `#F3F4F6` | Surfaces / cards |
| `--neutral-0`   | `#FFFFFF` | Page background |

### Typography

- **Font stack:** `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Body:** 14 px / 1.45 line-height
- **Small / caption:** 12 px
- **Heading (popup, options):** 16 px semibold

### Spacing

4 px base unit. Allowed values: **4, 8, 12, 16, 24, 32**.

### Border radius

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | `6 px` | Buttons, inputs |
| `--radius-md` | `8 px` | Cards, popup tabs |
| `--radius-full` | `50%` | Score badge, sentiment dots |

### Shadow

Used **only on floating elements** (toolbar, tooltip, score-badge expanded card):

```
box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
```

### Iconography

- Emoji for primary actions (✨ 📸 🎯 🔍 📊) for instant recognition without an icon font.
- All icons have a text label or `aria-label` for accessibility.

---

## Accessibility checklist (applies to every component)

- [ ] Keyboard reachable: every action has a tab stop and visible focus ring
- [ ] `aria-label` on every icon-only button
- [ ] Color is never the only signal — pair with text or shape
- [ ] Minimum 4.5:1 contrast for body text against background
- [ ] Escape closes any floating UI (Tooltip, expanded Score Badge, popup tabs)
