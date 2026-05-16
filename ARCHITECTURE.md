# Architecture

## 1. High-Level Overview

This repository is a Manifest V3 browser extension (Firefox-primary, Chrome-compatible) that replaces Belarusian Ruble (BYN) prices on Kufar.by marketplace pages with a user-chosen target currency (USD, EUR, or RUB). Exchange rates are fetched from the National Bank of the Republic of Belarus (NBRB) API and cached locally.

The extension consists of three runtime contexts: a background service worker that owns all network I/O and caching, a content script injected into Kufar pages that scans the DOM for prices and replaces them in-place, and a popup UI for configuration (currency selection, domain toggles, manual rate refresh, and a BYN converter).

Evidence anchors: `manifest.json` (MV3, `browser_specific_settings` for Firefox, `content_scripts` targeting `*.kufar.by`), `src/background.js` (network layer with `fetch` to `api.nbrb.by`), `src/content/kufar.js` (IIFE content script), `src/popup/popup.js` (ES module popup UI), `package.json` (build scripts for both browsers).

## 2. System Architecture (Logical)

```
┌─────────────────────────────────────────────────────┐
│                    Popup UI (popup/)                 │
│  - Currency selector, domain toggles, converter      │
│  - Imports lib/rates.js for formatting               │
│  - Communicates with background via runtime messages │
└──────────────┬──────────────────────────┬────────────┘
               │ browser.storage.local    │ browser.runtime.sendMessage
               ▼                          ▼
┌─────────────────────────────────────────────────────┐
│              Background Service Worker               │
│              (src/background.js)                     │
│  - Fetches NBRB API (exclusive network layer)        │
│  - Caches ratesData in browser.storage.local         │
│  - Refreshes on alarm (every 4 hours)                │
│  - Handles messages: getRates, refreshRates, ensure  │
│  - Imports lib/rates.js for parsing                  │
└──────────────┬──────────────────────────────────────┘
               │ browser.storage.local (read/write)
               │ browser.runtime.onMessage (request/response)
               ▼
┌─────────────────────────────────────────────────────┐
│              Content Script (content/)               │
│  - Self-contained IIFE, no imports                   │
│  - Reads storage for rates + selected currency       │
│  - Scans DOM for BYN prices, replaces in-place       │
│  - MutationObserver with rAF debounce                │
│  - Duplicates parse/convert/format from lib/rates.js │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              Pure Logic (lib/rates.js)               │
│  - No side effects, no browser APIs                  │
│  - Shared by background.js and popup.js via ESM      │
│  - parseRates, convert, convertFromBYN, format*      │
└─────────────────────────────────────────────────────┘
```

**Dependency direction:** `popup.js` → `lib/rates.js`, `background.js` → `lib/rates.js`. Content script has no imports — it duplicates the pure logic it needs. Both popup and content script depend on `background.js` only via `browser.runtime.sendMessage` (loose coupling, no direct imports).

**Intentionally not depended upon:** `lib/rates.js` has zero dependencies on browser APIs or other modules. The content script intentionally does not import from `lib/rates.js` (content scripts cannot use ESM). The popup never fetches NBRB directly — it always goes through the background script.

## 3. Code Map (Physical)

```
src/
├── background.js          # Service worker: network, alarms, storage, message router
├── lib/
│   └── rates.js           # Pure functions: parsing, conversion, formatting
├── content/
│   └── kufar.js           # IIFE content script: DOM scanning, price replacement
└── popup/
    ├── popup.html         # Popup markup (BEM, ARIA)
    ├── popup.css          # Styles (custom properties, prefers-color-scheme)
    └── popup.js           # Popup logic: ESM import of lib/rates.js
tests/
├── parse.test.js          # Unit tests for lib/rates.js (pure functions)
└── content.test.js        # JSDOM integration tests for content script
scripts/
├── build-chrome.mjs       # Chrome build: manifest transform, copy, zip
├── build-firefox.mjs      # Firefox build: copy, zip
└── build-utils.mjs        # Shared: zip creation, AGENTS.md stripping
examples/
├── auto/                  # HTML fixtures from auto.kufar.by
├── real_estate/           # HTML fixtures from re.kufar.by
├── travel/                # HTML fixtures from travel.kufar.by
└── nbrb_response.json     # Sample NBRB API response
icons/                     # Extension icons (PNG, multiple sizes)
manifest.json              # Firefox-primary MV3 manifest
```

- **Where is network logic?** `src/background.js` — the only file with `fetch`.
- **Where is price parsing/conversion?** `src/lib/rates.js` (canonical), duplicated in `src/content/kufar.js` (content script cannot import).
- **Where is DOM manipulation?** `src/content/kufar.js` — injected into Kufar pages.
- **Where is the user interface?** `src/popup/` — extension popup opened via browser action.
- **Where are tests?** `tests/` — `parse.test.js` for pure logic, `content.test.js` for DOM behavior.
- **Where are build scripts?** `scripts/` — `build-chrome.mjs` and `build-firefox.mjs` produce `build/` directories and `.zip` archives.

## 4. Life of a Request / Primary Data Flow

The extension has no single request lifecycle. Instead, it has three independent execution contexts with distinct flows.

### Background: Rate Fetch & Cache

```
Extension install (onInstalled)
  → Create alarm (refreshRates, every 240 min)
  → Initial fetchRatesFromNbrb()
  → fetch(api.nbrb.by/exrates/rates?periodicity=0)
  → parseRates() from lib/rates.js
  → Store ratesData in browser.storage.local

Alarm fires / Manual refresh
  → refreshRates({ force: true })
  → Same fetch → parse → store cycle
```

### Popup: User Configuration

```
Popup opens (popup.js init)
  → Read browser.storage.local (ratesData, selectedCurrency, domainSettings)
  → If no rates: sendMessage({ action: "ensureRates" }) → background fetches
  → Render rates table, converter, domain toggles
  → User changes currency → browser.storage.local.set({ selectedCurrency })
  → User refreshes rates → sendMessage({ action: "refreshRates" })
```

### Content Script: DOM Price Replacement

```
Page loads on *.kufar.by (kufar.js IIFE)
  → Read browser.storage.local (ratesData, selectedCurrency, domainSettings)
  → If host not supported or disabled: restore all prices to original
  → If active and rates missing: sendMessage({ action: "ensureRates" })
  → scheduleApply() → scan DOM for leaf text nodes matching BYN patterns
  → For each match: parseBynPrice → convertFromBYN → formatDisplayPrice
  → Store data-kufar-original-price-text on node for restoration
  → MutationObserver fires → scheduleApply() (rAF debounce)
  → Storage changes (currency/domain/rates) → scheduleApply()
```

## 5. Architectural Invariants & Constraints

- **Rule:** All network I/O (`fetch`, `XMLHttpRequest`) must live exclusively in `src/background.js`.
  - **Rationale:** Single point of control for caching, error handling, and rate refresh scheduling.
  - **Enforcement / Signals (Observed):** `src/content/kufar.js` is a self-contained IIFE with no `fetch` or `import`. `src/lib/rates.js` has no side effects. `src/popup/popup.js` communicates via `browser.runtime.sendMessage`, never `fetch`.

- **Rule:** `src/lib/rates.js` must remain pure — no browser APIs, no side effects, no imports from other project modules.
  - **Rationale:** Enables unit testing in plain Node.js (Vitest) and safe sharing between background and popup.
  - **Enforcement / Signals (Observed):** Coverage thresholds in `vitest.config.js` apply only to `src/lib/**/*.js` (80% lines/functions/branches/statements). Tests in `tests/parse.test.js` run without browser mocks.

- **Rule:** `src/content/kufar.js` must be self-contained — no `import`, no `fetch`, no `innerHTML`.
  - **Rationale:** Content scripts run in an isolated world without ESM support. `innerHTML` is a security risk and breaks the restoration invariant.
  - **Enforcement / Signals (Observed):** File is wrapped in an IIFE. Uses `textContent` for all DOM writes. Duplicates `parseBynPrice`, `convertFromBYN`, `formatDisplayPrice` from `lib/rates.js`.

- **Rule:** Price conversion always uses the original BYN amount, never a previously converted value.
  - **Rationale:** Prevents cumulative rounding errors and allows switching currencies without page reload.
  - **Enforcement / Signals (Observed):** Content script stores `data-kufar-original-price-text` and `data-kufar-original-price-amount` on each node. `restoreAll()` reads from these attributes. `applyConversion()` always reads `data-kufar-original-price-amount`.

- **Rule:** MutationObserver DOM updates must use the rAF debounce scheduler (`scheduleApply`), never synchronous full recalculation.
  - **Rationale:** Prevents performance degradation on dynamic pages with frequent DOM mutations.
  - **Enforcement / Signals (Observed):** `scheduleApply()` gates on `applyScheduled` flag, defers to `requestAnimationFrame`.

- **Rule:** `DOMAIN_REGISTRY` must be kept in sync between `src/content/kufar.js` and `src/popup/popup.js`.
  - **Rationale:** Content script and popup must agree on which domains are supported and enabled.
  - **Enforcement / Signals (Inferred):** No automated sync exists. Manual coordination required. `AGENTS.md` in both `src/content/` and `src/popup/` documents this requirement.

- **Rule:** `manifest.json` is Firefox-primary. Chrome build transforms it at build time.
  - **Rationale:** Firefox requires `browser_specific_settings`; Chrome requires `service_worker` instead of `background.scripts`.
  - **Enforcement / Signals (Observed):** `scripts/build-chrome.mjs` deletes `browser_specific_settings` and converts `background.scripts` to `background.service_worker`. `scripts/build-firefox.mjs` copies manifest as-is.

- **Rule:** No `innerHTML` in production code (`content/` and `popup/`).
  - **Rationale:** Security (XSS prevention) and consistency with the restoration mechanism.
  - **Enforcement / Signals (Observed):** `AGENTS.md` in root and module-level docs explicitly forbid it. All DOM writes use `textContent`, `createElement`, `appendChild`.

## 6. Documentation Strategy

`ARCHITECTURE.md` (this file) is the global map: high-level component layout, dependency direction, execution flows, and cross-cutting invariants. It answers "where is X?" and "what rules must I preserve?".

Module-level `AGENTS.md` files are for local detail: file-by-file boundaries, local conventions, and validation commands. They live at:

- `AGENTS.md` — root-level repository conventions (change rules, validation, gotchas)
- `src/content/AGENTS.md` — content script local rules (IIFE constraints, duplicated logic, safe containers)
- `src/popup/AGENTS.md` — popup conventions (ESM imports, CSS custom properties, DOMAIN_REGISTRY)
- `tests/AGENTS.md` — test file organization, fixture usage, coverage boundaries

When changing a module, read its local `AGENTS.md` first. When adding a new component or changing cross-module boundaries, update this document.
