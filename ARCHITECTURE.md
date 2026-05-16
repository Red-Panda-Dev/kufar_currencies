# Architecture

## 1. High-Level Overview

This is a Manifest V3 WebExtension (Chrome + Firefox) that replaces BYN-denominated prices on Kufar.by pages with a user-chosen currency (USD, EUR, or RUB), using official exchange rates from the National Bank of the Republic of Belarus (NBRB). Observed: `manifest.json:1-3`, `manifest.json:7-9`.

The problem it solves: Kufar.by lists all prices in Belarusian rubles, but users often want to see equivalent amounts in more familiar currencies. The extension fetches daily NBRB rates, stores them in extension storage, and content scripts rewrite visible price text in-place on supported Kufar subdomains. Inferred: business intent from `manifest.json:5` description and Russian-language UI.

The architectural paradigm is a split-process browser extension with four isolated execution contexts (background service worker, content script, popup, and a shared pure-logic library). All inter-context communication flows through `browser.storage.local` and `browser.runtime.sendMessage` — there is no direct function call across contexts. Observed: `manifest.json:12-15`, `manifest.json:25-29`, `manifest.json:17-23`, `background.js:90-111`, `content/kufar.js:253`.

Evidence anchors: `manifest.json`, `background.js`, `lib/rates.js`, `content/kufar.js`, `popup/popup.js`, `popup/popup.html`.

## 2. System Architecture (Logical)

Four logical components, each mapping to a distinct extension execution context:

- **Background Service Worker** (`background.js`) — sole network authority. Fetches NBRB rates on install and on a 4-hour alarm, caches results in `browser.storage.local`, and responds to messages (`getRates`, `refreshRates`, `ensureRates`) from popup and content scripts. Intentionally does NOT touch the DOM or know about Kufar page structure.

- **Pure Logic Library** (`lib/rates.js`) — stateless functions for parsing NBRB API responses, BYN-to-target conversion, and price formatting. No browser APIs, no side effects. Imported by background and popup; deliberately duplicated into the content script.

- **Content Script** (`content/kufar.js`) — self-contained IIFE injected into Kufar pages. Scans DOM for BYN price text in safe containers, replaces with converted values, and preserves originals via `data-*` attributes. Reacts to storage changes and DOM mutations (debounced via rAF). Intentionally does NOT use `import`, `fetch`, or `innerHTML`.

- **Popup UI** (`popup/`) — HTML/CSS/JS panel for currency selection, domain toggles, rate display, and a BYN converter. Imports from `lib/rates.js` and sends messages to background for rate refresh. Intentionally does NOT fetch NBRB directly or touch page DOM.

Dependency direction:

```
popup.js ──imports──> lib/rates.js
background.js ──imports──> lib/rates.js
content/kufar.js ──duplicates──> lib/rates.js (parseBynPrice, convertFromBYN, formatDisplayPrice)

popup.js ──sendMessage──> background.js
content/kufar.js ──sendMessage──> background.js

popup.js ──reads/writes──> browser.storage.local <──reads── content/kufar.js
                                               <──writes── background.js
```

Key boundaries:

- Network access is exclusive to `background.js`. No other component may call `fetch` or `XMLHttpRequest`.
- `lib/rates.js` must contain zero browser APIs — testable in plain Node.
- `content/kufar.js` must remain a single IIFE with no module imports — content scripts run in an isolated world without ESM support.
- No `innerHTML` in content script or popup — only `textContent`, `createElement`, `appendChild`.

## 3. Code Map (Physical)

```
kufar_currencies/
├── manifest.json              # Extension manifest (MV3), entrypoints, permissions
├── background.js              # Background service worker — network, cache, alarms, messages
├── lib/
│   └── rates.js               # Pure functions: parseRates, convertFromBYN, parseBynPrice, formatting
├── content/
│   └── kufar.js               # IIFE content script — DOM scanning, price conversion, MutationObserver
├── popup/
│   ├── popup.html             # Popup markup
│   ├── popup.css              # Popup styles (light/dark via prefers-color-scheme)
│   └── popup.js               # Popup logic, imports lib/rates.js, domain toggles, converter
├── scripts/
│   └── build-chrome.mjs       # Chrome build: strips Gecko keys, transforms background to service_worker
├── tests/
│   ├── parse.test.js          # Unit tests for lib/rates.js
│   └── content.test.js        # JSDOM integration tests for content script
├── examples/
│   ├── auto/                  # HTML fixtures from auto.kufar.by
│   ├── real_estate/           # HTML fixtures from re.kufar.by
│   ├── nbrb_response.json    # Sample NBRB API response
│   └── screenshots/           # Extension screenshots
├── icons/                     # Extension icons (SVG + PNG)
├── vitest.config.js           # Test config, 80% coverage threshold for lib/
├── Makefile                   # Build targets: test, format, lint, package, build
└── build/                     # Build output (generated, not checked in)
    ├── firefox/
    └── chrome/
```

Where is X?

- **Network/fetch logic**: `background.js`
- **Rate parsing and conversion math**: `lib/rates.js`
- **DOM price replacement**: `content/kufar.js`
- **User-facing settings UI**: `popup/`
- **Domain registry (supported subdomains)**: `content/kufar.js:4-10` and `popup/popup.js:16-48` (kept in sync)
- **Chrome packaging**: `scripts/build-chrome.mjs`
- **Test fixtures**: `examples/`
- **Browser compatibility shim** (`browser ??= chrome`): `background.js:3`, `content/kufar.js:2`, `popup/popup.js:12`

## 4. Life of a Request / Primary Data Flow

**Rate acquisition (background-driven):**

1. `background.js:78` — `onInstalled` listener creates a 4-hour alarm and triggers initial `refreshRates()`.
2. `background.js:22-56` — `fetchRatesFromNbrb()` calls NBRB API, passes raw JSON to `parseRates()` from `lib/rates.js`, writes `ratesData` and `lastError` to `browser.storage.local`.
3. `background.js:83-88` — `onAlarm` listener periodically calls `refreshRates()`.

**Page price conversion (content-script-driven):**

1. `content/kufar.js:298-320` — IIFE `start()` reads `ratesData`, `selectedCurrency`, `domainSettings` from storage; if host is active and no rates cached, sends `ensureRates` message to background (`content/kufar.js:244-257`).
2. `content/kufar.js:185-226` — `applyConversion()` scans safe DOM containers for leaf text nodes matching BYN patterns via `parseBynPrice()`, stores original text/amount in `data-kufar-original-price-text` and `data-kufar-original-price-amount`, then overwrites `textContent` with `convertFromBYN()` + `formatDisplayPrice()`.
3. `content/kufar.js:228-242` — `scheduleApply()` debounces DOM recalculation via `requestAnimationFrame`.
4. `content/kufar.js:279-296` — `MutationObserver` on `document.body` triggers `scheduleApply()` on any mutation.
5. `content/kufar.js:259-277` — Storage change listener updates local state and triggers `scheduleApply()`.

**Popup interaction:**

1. `popup/popup.js:422-428` — `init()` reads storage, renders rates/domain toggles/converter.
2. Currency or domain changes are written to `browser.storage.local`, which propagates to content script via the storage change listener.
3. Refresh button sends `refreshRates` message to background (`popup/popup.js:399-401`), then re-reads storage.

## 5. Architectural Invariants & Constraints

- **Rule:** Network access is exclusive to `background.js`. No `fetch`/`XMLHttpRequest` in any other file.
  - **Rationale:** Content scripts and popup cannot make cross-origin requests to NBRB without the background's `host_permissions`.
  - **Enforcement / Signals (Observed):** `manifest.json:7-9` grants `host_permissions` only to the background context. No `fetch` calls exist in `content/kufar.js`, `popup/popup.js`, or `lib/rates.js`.

- **Rule:** `lib/rates.js` must contain no browser APIs — no `window`, `document`, `browser`, `chrome`, `fetch`, or DOM.
  - **Rationale:** Enables unit testing in plain Node without mocks.
  - **Enforcement / Signals (Observed):** `vitest.config.js:11` coverage is configured only for `lib/**/*.js`. Code inspection shows pure functions only.

- **Rule:** `content/kufar.js` must remain a self-contained IIFE with no `import` statements.
  - **Rationale:** Content scripts execute in an isolated world without ESM support; `import` would fail at runtime.
  - **Enforcement / Signals (Observed):** `manifest.json:25-29` injects `content/kufar.js` as a plain script. The file is wrapped in `(function initKufarCurrencyContentScript() { ... })()`.

- **Rule:** No `innerHTML` in content script or popup.
  - **Rationale:** Prevents XSS from untrusted page content.
  - **Enforcement / Signals (Observed):** All DOM mutations use `textContent`, `createElement`, `appendChild`. No `innerHTML` assignment found in `content/kufar.js` or `popup/popup.js`.

- **Rule:** Conversion always operates on the original BYN amount stored in `data-kufar-original-price-amount`. Never re-convert an already-converted value.
  - **Rationale:** Re-converting would accumulate floating-point error and produce wrong prices.
  - **Enforcement / Signals (Observed):** `content/kufar.js:202-209` stores original on first encounter and reads from `data-kufar-original-price-amount` on subsequent passes.

- **Rule:** `DOMAIN_REGISTRY` must be kept in sync between `content/kufar.js` and `popup/popup.js`.
  - **Rationale:** Both contexts need the same host list but cannot share modules.
  - **Enforcement / Signals (Inferred):** No automated check exists. Manual sync required, as documented in `AGENTS.md`.

- **Rule:** `parseBynPrice`, `convertFromBYN`, `formatDisplayPrice` in `content/kufar.js` must mirror their `lib/rates.js` counterparts.
  - **Rationale:** Content script cannot import from `lib/`; duplicated logic is the only option.
  - **Enforcement / Signals (Inferred):** No automated sync check. Changes to `lib/rates.js` must be manually propagated to `content/kufar.js`, per `AGENTS.md`.

- **Rule:** MutationObserver must use `scheduleApply` (rAF debounce), never synchronous full recalculation.
  - **Rationale:** Synchronous recalculation on every mutation would freeze the page on DOM-heavy Kufar listings.
  - **Enforcement / Signals (Observed):** `content/kufar.js:287-289` observer callback calls `scheduleApply()`; `content/kufar.js:228-242` uses `requestAnimationFrame`.

- **Rule:** Price conversion is scoped to safe containers and leaf text nodes only.
  - **Rationale:** Prevents accidentally converting non-price text or corrupting element structure.
  - **Enforcement / Signals (Observed):** `content/kufar.js:140-168` limits scanning to specific container selectors and elements with `childElementCount === 0`.

- **Rule:** `NEGATIVE_LABELS` ("Договорная", "Бесплатно", "Обмен", "Цена не указана") prevent conversion of non-price text matching BYN patterns.
  - **Rationale:** These labels appear where prices normally go but are not monetary amounts.
  - **Enforcement / Signals (Observed):** `content/kufar.js:17-22` defines the list; `content/kufar.js:75-77` checks it in `parseBynPrice`.

- **Rule:** Chrome build must strip `browser_specific_settings` and convert `background.scripts` to `background.service_worker`.
  - **Rationale:** Chrome MV3 requires service workers, not background scripts; Gecko-specific keys cause lint errors.
  - **Enforcement / Signals (Observed):** `scripts/build-chrome.mjs:26-34` performs the transform at build time.

## 6. Documentation Strategy

`ARCHITECTURE.md` (this file) is the global map and invariant reference for the repository. It answers "where is X?" and "what must never change?" at the structural level.

Module-level `AGENTS.md` files provide local detail for specific areas:

- `AGENTS.md` (root) — repository overview, validation commands, change rules, domain-registry sync requirements.
- `content/AGENTS.md` — content-script boundaries, safe change rules, local invariants.
- `tests/AGENTS.md` — test conventions and fixture guidance.
- `popup/AGENTS.md` — popup-specific conventions, DOMAIN_REGISTRY, CSS, converter.

Existing docs by path:

- `README.md` — user-facing overview and development commands.
- `AGENTS.md` — root-level developer guide with change rules and gotchas.

What belongs globally vs. locally: architectural boundaries, invariant rules, component data flow, and the code map belong here. Per-module gotchas, specific function contracts, and local test instructions belong in module-level `AGENTS.md` files.
