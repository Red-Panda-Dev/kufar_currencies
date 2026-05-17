# Architecture

## 1. High-Level Overview

Kufar Currencies is a Manifest V3 browser extension (Chrome + Firefox) that replaces BYN-denominated prices on Kufar.by classifieds pages with equivalent amounts in a user-chosen currency (USD, EUR, or RUB), using official exchange rates from the National Bank of the Republic of Belarus (NBRB). Observed: `manifest.json:2`, `manifest.json:5`, `manifest.json:7`.

The extension follows a classic WebExtension three-part architecture: a background service worker for network and state, a content script for DOM manipulation, and a popup for user configuration. The architectural paradigm is strict separation of concerns — network access is exclusive to the background script, DOM manipulation is exclusive to the content script, and shared conversion logic lives in a pure library module. Observed: `src/background.js`, `src/content/kufar.js:1`, `src/lib/rates.js`, `src/popup/popup.js`.

A key architectural constraint is that content scripts cannot use ES module imports, so the pure logic from `src/lib/rates.js` is intentionally duplicated inline within the self-contained content script IIFE. Observed: `src/content/kufar.js:61-146` duplicates `parseBynPrice`, `convertFromBYN`, `formatDisplayPrice` from `src/lib/rates.js`. The `DOMAIN_REGISTRY` constant is similarly duplicated between the content script and popup. Observed: `src/content/kufar.js:4`, `src/popup/popup.js:16`.

Evidence anchors: `manifest.json`, `src/background.js:1-5`, `src/content/kufar.js:1`, `src/lib/rates.js:1`, `src/popup/popup.js:1-10`, `scripts/build-chrome.mjs`.

## 2. System Architecture (Logical)

Four logical components with strict boundaries:

- **Rates Library** (`src/lib/rates.js`) — Pure, side-effect-free parsing, conversion, and formatting. No browser APIs, no network. Importable by background and popup. Not importable by content script (MV3 limitation).
- **Background Service Worker** (`src/background.js`) — Owns all network access (NBRB API fetch), caching via `browser.storage.local`, alarm-based periodic refresh, and message handling. Depends on Rates Library. Does not touch the DOM.
- **Content Script** (`src/content/kufar.js`) — Self-contained IIFE injected into Kufar pages. Scans DOM for BYN prices, converts and replaces text, uses MutationObserver with rAF debounce. Reads storage directly, requests rates via messaging. Duplicates conversion logic from Rates Library.
- **Popup UI** (`src/popup/`) — ES module with HTML/CSS/JS. Imports from Rates Library. Communicates with background via `browser.runtime.sendMessage`. Manages currency selection, domain toggles, and a converter widget.

Dependency direction:

```
popup.js ──imports──► lib/rates.js ◄──imports── background.js
    │                                          │
    └──sendMessage──► background.js ◄──sendMessage── content/kufar.js
                           │
                     browser.storage.local ◄──direct read── content/kufar.js
```

Key boundaries:

- Content script has **no imports** and **no network access**. It communicates with background only via `browser.runtime.sendMessage` and `browser.storage.local`.
- Background has **no DOM access** and is the sole network-accessing component.
- Rates Library has **zero browser API dependencies** — testable in plain Node.
- Popup never fetches NBRB directly; it goes through background messaging.

## 3. Code Map (Physical)

```
manifest.json                  # MV3 manifest (Firefox-primary); Chrome build transforms it
src/
├── background.js              # Service worker: fetch, cache, alarms, message handler
├── lib/
│   └── rates.js               # Pure: parseRates, convert, formatDisplayPrice, etc.
├── content/
│   └── kufar.js               # Self-contained IIFE: DOM scanning, price conversion, observer
└── popup/
    ├── popup.html             # Popup markup
    ├── popup.css              # Light/dark theme via prefers-color-scheme
    └── popup.js               # Popup logic: currency/domain controls, converter widget
tests/
├── parse.test.js              # Unit tests for lib/rates.js
└── content.test.js            # JSDOM integration tests for content script
scripts/
├── build-chrome.mjs           # Chrome packaging: strips gecko keys, converts to service_worker
├── build-firefox.mjs          # Firefox packaging
└── build-utils.mjs            # Shared: createZip, removeAgentsFiles
examples/
├── auto/                      # HTML fixtures from auto.kufar.by
├── real_estate/               # HTML fixtures from re.kufar.by
├── travel/                    # HTML fixtures from travel.kufar.by
└── nbrb_response.json         # Sample NBRB API response fixture
icons/                         # Extension icons (SVG + PNG)
vitest.config.js               # Test config; coverage threshold 80% for src/lib/**/*.js
Makefile                       # build = lint + test + package both browsers
```

Where is X?

- **NBRB API fetch logic**: `src/background.js:22-56`
- **Rate parsing and conversion math**: `src/lib/rates.js`
- **DOM price replacement**: `src/content/kufar.js:193-236` (`applyConversion`)
- **MutationObserver setup**: `src/content/kufar.js:289-306`
- **DOMAIN_REGISTRY (content)**: `src/content/kufar.js:4`
- **DOMAIN_REGISTRY (popup)**: `src/popup/popup.js:16`
- **Currency selection persistence**: `browser.storage.local` key `selectedCurrency`
- **Chrome/Firefox manifest differences**: `scripts/build-chrome.mjs:30-39`

## 4. Life of a Request / Primary Data Flow

### Rate fetching (background-initiated)

```
browser.alarms "refreshRates" (every 240 min)
  → src/background.js:83  onAlarm listener
  → refreshRates()  →  fetchRatesFromNbrb()
  → fetch(NBRB_URL)  →  parseRates(data) from lib/rates.js
  → browser.storage.local.set({ ratesData, lastError })
```

### Page load (content script)

```
manifest.json content_scripts "document_idle"
  → src/content/kufar.js IIFE executes → start()
  → browser.storage.local.get(["ratesData","selectedCurrency","domainSettings"])
  → isHostActive() check against DOMAIN_REGISTRY + domainSettings
  → if active: ensureRatesIfNeeded() → browser.runtime.sendMessage({ action: "ensureRates" })
  → background returns ratesData from storage or fetches fresh
  → setupStorageListener() + setupObserver()
  → scheduleApply() → requestAnimationFrame → applyConversion()
  → getPriceNodes() scans safe container selectors
  → parseBynPrice() on leaf text nodes, stores data-kufar-original-price-*
  → convertFromBYN() + formatDisplayPrice() → node.textContent updated
```

### User config change (popup)

```
User selects currency in popup
  → popup.js writes to browser.storage.local
  → storage.onChanged fires in content script
  → content script updates local state + scheduleApply()
  → applyConversion() re-runs on stored original amounts (never re-converts)
```

### Rate refresh (user-triggered)

```
User clicks "Refresh" in popup
  → popup.js: browser.runtime.sendMessage({ action: "refreshRates" })
  → background.js: refreshRates({ force: true })
  → fetch → parseRates → storage.local.set
  → storage.onChanged propagates to content script
```

## 5. Architectural Invariants & Constraints

- **Rule:** Network access is exclusive to `src/background.js`. No `fetch` or `XMLHttpRequest` in any other source file.
  - **Rationale:** Security and caching control; content scripts and popup must not bypass the service worker.
  - **Enforcement / Signals (Observed):** `manifest.json:7` grants `host_permissions` only to background; no fetch calls in `src/content/kufar.js` or `src/popup/popup.js`.

- **Rule:** `src/content/kufar.js` must be a self-contained IIFE with no `import` statements.
  - **Rationale:** MV3 content scripts run in an isolated world without ESM import support.
  - **Enforcement / Signals (Observed):** File begins with `(function initKufarCurrencyContentScript() {` and contains zero `import` statements.

- **Rule:** `src/lib/rates.js` must have zero browser API dependencies.
  - **Rationale:** Pure testability in plain Node without jsdom or browser mocks.
  - **Enforcement / Signals (Observed):** No `browser`, `chrome`, `document`, `window`, or `fetch` references in the file. Coverage enforced at 80% thresholds in `vitest.config.js:13-18`.

- **Rule:** Conversion always operates from the original BYN amount, never from an already-converted value.
  - **Rationale:** Re-conversion compounds rounding errors. The content script stores the original amount on first parse.
  - **Enforcement / Signals (Observed):** `data-kufar-original-price-amount` is set once per node in `src/content/kufar.js:216` and read on subsequent passes; `restoreAll()` reverts to original text.

- **Rule:** `DOMAIN_REGISTRY` must stay in sync between `src/content/kufar.js:4` and `src/popup/popup.js:16`.
  - **Rationale:** Content script checks host activation; popup renders domain toggles. Mismatch causes broken UI or silent skipping.
  - **Enforcement / Signals (Inferred):** No automated sync mechanism exists; convention enforced by `AGENTS.md` documentation. Popup version is a superset (includes master toggle).

- **Rule:** Duplicated functions (`parseBynPrice`, `convertFromBYN`, `formatDisplayPrice`) in content script must mirror `src/lib/rates.js`.
  - **Rationale:** Content script cannot import modules, so logic is duplicated. Behavioral divergence causes different conversion results in popup converter vs. page display.
  - **Enforcement / Signals (Inferred):** Convention enforced by `src/content/AGENTS.md`. No build-time check for parity.

- **Rule:** MutationObserver must use `scheduleApply` (rAF debounce), never synchronous full recalculation on every mutation.
  - **Rationale:** Synchronous recalculation on high-frequency DOM mutations causes jank and potential infinite loops.
  - **Enforcement / Signals (Observed):** `src/content/kufar.js:238-252` implements the debounce guard; `observer.observe` callback calls `scheduleApply()` not `applyConversion()` directly.

- **Rule:** No `innerHTML` in production code (`src/content/` and `src/popup/`).
  - **Rationale:** XSS prevention in extension contexts.
  - **Enforcement / Signals (Inferred):** Convention documented in `AGENTS.md`. Code uses `textContent`, `createElement`, `appendChild`.

- **Rule:** `manifest.json` is Firefox-primary; Chrome build transforms it at package time.
  - **Rationale:** Firefox requires `browser_specific_settings.gecko` and `background.scripts`; Chrome requires `background.service_worker`.
  - **Enforcement / Signals (Observed):** `scripts/build-chrome.mjs:31-39` deletes `browser_specific_settings` and converts `background.scripts` → `background.service_worker`.

- **Rule:** Build packages must not contain `AGENTS.md` files.
  - **Rationale:** Developer-facing metadata should not ship to users.
  - **Enforcement / Signals (Observed):** `scripts/build-utils.mjs:8-18` recursively removes `AGENTS.md` files from build output.

## 6. Documentation Strategy

`ARCHITECTURE.md` (this file) is the global map and invariant reference. It answers "where is X?" and "what must never change?".

Module-level `AGENTS.md` files provide local detail — boundary rules, safe change patterns, and validation commands for specific areas:

- `src/content/AGENTS.md` — content script IIFE constraints, duplication rules, DOM scanning patterns
- `src/popup/AGENTS.md` — popup conventions, DOMAIN_REGISTRY superset, CSS custom properties, converter behavior
- `tests/AGENTS.md` — test file split, fixture usage, coverage boundaries

`README.md` provides user-facing overview, installation, and development commands.

Global architecture docs belong here: component boundaries, dependency direction, invariants, data flow, build pipeline. Local docs belong in `AGENTS.md`: function-level constraints, per-module change rules, test commands. When code and docs disagree, observable code and config take precedence.
