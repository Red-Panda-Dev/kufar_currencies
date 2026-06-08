# Architecture

## 1. High-Level Overview

This is a Manifest V3 browser extension ("Kufar.by Валюты") that replaces BYN (Belarusian ruble) prices displayed on Kufar.by listing pages with a user-selected currency (USD, EUR, or RUB). Exchange rates are sourced from the National Bank of the Republic of Belarus (NBRB) API. Observed from `manifest.json` name/description fields and `src/lib/rates.js` currency constants.

The extension follows a classic WebExtension multi-context architecture: a background service worker owns the network and cache layer, a content script performs in-page DOM manipulation, and a popup provides user settings. Communication between contexts uses `browser.runtime.sendMessage` and `browser.storage.local`. Observed from `manifest.json` permissions (`alarms`, `storage`, `host_permissions` on NBRB API), background message handler at `src/background.js:111`, and content script message call at `src/content/kufar.js:287`.

Evidence anchors:
- `manifest.json` — MV3 manifest, permissions, content script injection, background entrypoint
- `src/lib/rates.js` — pure rate parsing/conversion/formatting, `TARGET_CURRENCIES` = ["USD", "EUR", "RUB"]
- `src/background.js` — NBRB fetch, storage, alarm-based refresh, message handler
- `src/content/kufar.js` — self-contained IIFE, DOM scanning, MutationObserver
- `src/popup/popup.html` + `popup.js` — settings UI, imports `lib/rates.js`
- `vitest.config.js` — coverage scope confirms architectural boundary of tested modules

## 2. System Architecture (Logical)

Four components with strict dependency rules:

```
┌─────────────────────────────────────────────────┐
│                  Popup UI                        │
│  (src/popup/)                                    │
│  Imports: lib/rates.js                           │
│  Talks to: background via sendMessage            │
│  Never: fetch, direct DOM on pages               │
└──────────────┬──────────────────────────────────┘
               │ browser.runtime.sendMessage
               │ browser.storage.local
┌──────────────▼──────────────────────────────────┐
│            Background Service Worker              │
│  (src/background.js)                             │
│  Imports: lib/rates.js                           │
│  Owns: network (NBRB fetch), cache, alarms       │
│  Never: DOM, page interaction                    │
└──────────────┬──────────────────────────────────┘
               │ browser.storage.local (shared state)
               │ browser.runtime.sendMessage (responds)
┌──────────────▼──────────────────────────────────┐
│            Content Script (IIFE)                  │
│  (src/content/kufar.js)                          │
│  No imports. Duplicates helpers from rates.js.    │
│  Owns: DOM scanning, price replacement            │
│  Never: fetch, innerHTML, module imports          │
└──────────────────────────────────────────────────┘

       ┌────────────────────────┐
       │   Pure Library         │
       │   (src/lib/rates.js)   │
       │   No browser APIs.     │
       │   Shared by background │
       │   and popup.           │
       └────────────────────────┘
```

**Dependency direction:**
- `popup.js` → `lib/rates.js` (import), → `background.js` (messaging)
- `background.js` → `lib/rates.js` (import)
- `content/kufar.js` → nothing (self-contained; duplicates `parseBynPrice`, `convertFromBYN`, `formatDisplayPrice` from `lib/rates.js`)
- `lib/rates.js` → nothing (no browser APIs, no side effects)

**Key boundaries:**
- **Network boundary:** only `src/background.js` calls `fetch`. No other module makes network requests. Observed: `fetch` only in `src/background.js:46`.
- **Browser API boundary:** `src/lib/rates.js` uses no browser APIs (no `browser`, `document`, `fetch`, `storage`). Pure computation. Observed: no browser globals in `src/lib/rates.js`.
- **Module boundary:** `src/content/kufar.js` is an IIFE with zero `import` statements. Content scripts in MV3 cannot use ES modules in all browsers. Observed: `src/content/kufar.js:1` wraps everything in `(function initKufarCurrencyContentScript() { ... })()`.
- **DOM safety boundary:** `src/content/kufar.js` and `src/popup/popup.js` never use `innerHTML`. Observed: only `textContent`, `createElement`, `appendChild` throughout both files.

## 3. Code Map (Physical)

```
kufar_currencies/
├── manifest.json              # Extension manifest (Firefox-primary MV3)
├── src/
│   ├── background.js          # Service worker: NBRB fetch, storage, alarms, message router
│   ├── lib/
│   │   └── rates.js           # Pure functions: parse NBRB response, convert, format prices
│   ├── content/
│   │   ├── kufar.js           # IIFE content script: DOM scan, price replacement, MutationObserver
│   │   └── AGENTS.md          # Content script local rules
│   └── popup/
│       ├── popup.html         # Popup markup (BEM, ARIA, semantic sections)
│       ├── popup.css          # Popup styles (light/dark via prefers-color-scheme)
│       ├── popup.js           # Popup logic: imports rates.js, domain toggles, converter
│       └── AGENTS.md          # Popup local rules
├── tests/
│   ├── parse.test.js          # Unit tests for lib/rates.js
│   ├── background.test.js     # Unit tests for background.js (mocked browser APIs)
│   ├── content.test.js        # JSDOM integration tests for content script
│   └── AGENTS.md              # Test conventions
├── scripts/
│   ├── build-chrome.mjs       # Chrome build: strips gecko keys, converts to service_worker
│   ├── build-firefox.mjs      # Firefox build: copies as-is
│   └── build-utils.mjs        # Shared: createZip, removeAgentsFiles, buildCopyFilter
├── examples/                  # HTML fixtures from live Kufar pages (auto, main, real_estate, travel)
├── icons/                     # Extension icons (SVG + PNG at 16/32/48/128)
├── vitest.config.js           # Test config: 80% coverage thresholds for lib/ + background.js
├── Makefile                   # build = lint + test + package both browsers
└── package.json               # Dev dependencies only (vitest, jsdom, prettier)
```

**Where is X?**

| Concern | Location |
|---|---|
| NBRB API integration | `src/background.js` — `fetchRatesFromNbrb()` |
| Rate parsing from JSON | `src/lib/rates.js` — `parseRates()` |
| BYN price detection regex | `src/lib/rates.js:95` and duplicated at `src/content/kufar.js:81` |
| Currency conversion math | `src/lib/rates.js` — `convert()`, `convertFromBYN()` |
| DOM price replacement | `src/content/kufar.js` — `applyConversion()` |
| MutationObserver setup | `src/content/kufar.js` — `setupObserver()` |
| User settings (currency, domains) | `browser.storage.local` — keys: `selectedCurrency`, `domainSettings` |
| Domain registry (content) | `src/content/kufar.js:4` |
| Domain registry (popup) | `src/popup/popup.js:16` |
| Chrome/Firefox manifest transform | `scripts/build-chrome.mjs:34-43` |
| Test fixtures | `examples/` — HTML pages from kufar.by subdomains |

## 4. Life of a Request / Primary Data Flow

### Rate refresh flow (background-initiated)

```
browser.runtime.onInstalled / browser.alarms.onAlarm
  → src/background.js:99-109
  → refreshRates() → fetchRatesFromNbrb()
  → fetch(NBRB_URL) → parseRates(data) (from lib/rates.js)
  → mergeCustomRates() with user overrides from storage
  → browser.storage.local.set({ ratesData, lastError })
```

### Page load conversion flow (content script)

```
Content script injected by manifest on *.kufar.by
  → src/content/kufar.js start() (line 332)
  → browser.storage.local.get([ratesData, selectedCurrency, domainSettings])
  → isHostActive() — check domain registry + user toggle
  → ensureRatesIfNeeded() — send { action: "ensureRates" } to background
  → setupStorageListener() — react to storage changes
  → setupObserver() — MutationObserver on document.body
  → scheduleApply() — rAF-debounced → applyConversion()
  → getPriceNodes() — query safe containers, filter leaf text nodes
  → parseBynPrice(node.textContent) — regex match BYN amounts
  → convertFromBYN(originalAmount, targetRate)
  → formatDisplayPrice(converted, currency)
  → node.textContent = prefix + formatted + unitSuffix
  → store data-kufar-original-price-text / amount / unit / prefix on node
```

### Popup interaction flow

```
User opens popup → popup.js loads
  → browser.runtime.sendMessage({ action: "getRates" })
  → background responds with { ratesData, lastError }
  → Renders rates list, converter, currency selector, domain toggles
  → User changes currency → browser.storage.local.set({ selectedCurrency })
  → Storage change fires → content script storage listener → scheduleApply()
```

### Build flow

```
make build (= lint + test + package)
  → npm run format:check
  → npm test (vitest with 80% coverage thresholds)
  → node scripts/build-firefox.mjs → build/firefox/ → kufar-currencies-firefox.zip
  → node scripts/build-chrome.mjs  → build/chrome/  → kufar-currencies-chrome.zip
     (strips browser_specific_settings, converts background.scripts → service_worker)
```

## 5. Architectural Invariants & Constraints

- **Rule:** `src/lib/rates.js` must not use any browser APIs (`fetch`, `browser`, `document`, `storage`).
  - **Rationale:** Keeps the core conversion logic testable in plain Node without mocks. Coverage enforcement at 80% in `vitest.config.js:12`.
  - **Enforcement / Signals (Observed):** No browser globals in `src/lib/rates.js`. Coverage thresholds enforced in CI via `vitest.config.js`.

- **Rule:** `src/content/kufar.js` must be a self-contained IIFE with zero `import` statements and zero `fetch` calls.
  - **Rationale:** Content scripts in MV3 run in an isolated world without ESM support; network access is restricted to the background context.
  - **Enforcement / Signals (Observed):** File opens with `(function initKufarCurrencyContentScript() {` at line 1. No `import` or `fetch` in the file. Rates requested via `browser.runtime.sendMessage({ action: "ensureRates" })` at line 287.

- **Rule:** `parseBynPrice`, `convertFromBYN`, and `formatDisplayPrice` must be kept in sync between `src/lib/rates.js` and `src/content/kufar.js`.
  - **Rationale:** Content script cannot import from `lib/`, so these functions are duplicated. Divergence causes different parsing behavior between popup converter and in-page conversion.
  - **Enforcement / Signals (Inferred):** Documented in `src/content/AGENTS.md` and `AGENTS.md`. No automated sync check observed — relies on developer discipline.

- **Rule:** `DOMAIN_REGISTRY` must be kept in sync between `src/content/kufar.js:4` and `src/popup/popup.js:16`.
  - **Rationale:** Both files independently maintain their own registry of supported Kufar subdomains. Mismatch causes popup toggles that don't correspond to content script behavior.
  - **Enforcement / Signals (Inferred):** Documented in `AGENTS.md`. No automated sync check observed.

- **Rule:** Only `src/background.js` may call `fetch` / make network requests.
  - **Rationale:** Centralizes network access for caching, error handling, and permission scoping (`host_permissions` in manifest).
  - **Enforcement / Signals (Observed):** `manifest.json:7` grants `host_permissions` only on NBRB API. `fetch` appears only in `src/background.js:46`.

- **Rule:** No use of `innerHTML` in content script or popup code.
  - **Rationale:** Prevents XSS and maintains CSP compliance for extension contexts.
  - **Enforcement / Signals (Observed):** No `innerHTML` in `src/content/kufar.js` or `src/popup/popup.js`. Documented in `AGENTS.md` and module-level `AGENTS.md` files.

- **Rule:** Price conversion always uses the original BYN amount stored in `data-kufar-original-price-amount`, never a previously converted value.
  - **Rationale:** Re-converting an already-converted value would compound rounding errors and produce incorrect prices.
  - **Enforcement / Signals (Observed):** `applyConversion()` at `src/content/kufar.js:234-240` stores original on first encounter and reads `data-kufar-original-price-amount` on subsequent passes.

- **Rule:** MutationObserver must use the rAF-debounced `scheduleApply` scheduler, never synchronous full recalculation.
  - **Rationale:** Synchronous recalculation on every mutation causes jank on dynamic pages like Kufar.
  - **Enforcement / Signals (Observed):** `scheduleApply()` at `src/content/kufar.js:262` uses `requestAnimationFrame`. Documented in `src/content/AGENTS.md`.

- **Rule:** `manifest.json` is Firefox-primary; Chrome build transforms it at build time.
  - **Rationale:** Firefox MV3 uses `background.scripts` + `browser_specific_settings.gecko`; Chrome uses `background.service_worker` and lacks `browser_specific_settings`.
  - **Enforcement / Signals (Observed):** `scripts/build-chrome.mjs:35-43` deletes `browser_specific_settings` and converts `background.scripts` to `background.service_worker`. Firefox build at `scripts/build-firefox.mjs` copies manifest as-is.

- **Rule:** Build scripts strip `AGENTS.md` files from release packages.
  - **Rationale:** Agent documentation files are development-only and should not ship to users.
  - **Enforcement / Signals (Observed):** `removeAgentsFiles` in `scripts/build-utils.mjs`, called by both build scripts.

## 6. Documentation Strategy

`ARCHITECTURE.md` (this file) is the global map: component boundaries, dependency direction, data flows, and invariants.

Module-level `AGENTS.md` files provide local detail for each component:
- `src/content/AGENTS.md` — content script boundaries, safe change rules, DOM scanning invariants
- `src/popup/AGENTS.md` — popup conventions, CSS patterns, domain toggle behavior
- `tests/AGENTS.md` — test file split, fixture usage, coverage boundaries

The root `AGENTS.md` serves as the developer quick-reference: repo shape, "where to change" table, validation commands, and gotchas. It complements this architecture document with implementation-adjacent guidance.

`README.md` is user-facing: extension description, installation instructions, and development commands.

Global architecture docs cover structural boundaries and stable rules. Local module docs cover conventions, specific change procedures, and test commands relevant to that module.
