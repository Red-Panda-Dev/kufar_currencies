# AGENTS.md

## Repository overview

Manifest V3 WebExtension (Chrome + Firefox) that replaces BYN prices on Kufar pages with user-chosen currency (USD/EUR/RUB) using NBRB exchange rates.

## Repo shape

```
background.js             # Network layer, cache, message handler
lib/
└── rates.js              # Pure parsing/conversion/formatting logic
content/
└── kufar.js              # Self-contained IIFE — DOM price conversion
popup/
├── popup.html            # Popup markup
├── popup.css             # Popup styles
└── popup.js              # Popup logic, imports lib/rates.js
tests/
├── parse.test.js         # Unit tests for lib/rates.js
└── content.test.js       # JSDOM integration tests for content script
scripts/
└── build-chrome.mjs      # Chrome build script (strips gecko keys, copies files)
examples/
├── auto/                 # HTML fixtures from auto.kufar.by
├── real_estate/          # HTML fixtures from re.kufar.by (future domain)
├── nbrb_response.json    # Sample NBRB API response fixture
└── screenshots/          # Extension screenshots
icons/                    # Extension icons (SVG + PNG)
manifest.json             # Extension manifest (MV3)
```

## Architecture and boundaries

- **Network is exclusive to `background.js`.** No `fetch`/`XMLHttpRequest` anywhere else.
- **`content/kufar.js` is self-contained.** No `import`, no `fetch`, no `innerHTML`. Runs as IIFE injected by the content_scripts manifest entry.
- **`lib/rates.js` is pure.** No side effects, no browser APIs. Safe to import from `background.js` and `popup.js`.
- **`popup.js`** imports from `lib/rates.js` and communicates with `background.js` via `browser.runtime.sendMessage`.
- **Data flow:** background fetches NBRB → stores `ratesData` → popup reads storage → content reads storage + requests `ensureRates` via message.
- **No `innerHTML`** in production code (`content/` and `popup/`). Use `textContent`, `createElement`, `appendChild`.

## Where to change

| Concern | Location |
|---|---|
| Rates parsing, conversion, formatting | `lib/rates.js` |
| Network, caching, alarms, messages | `background.js` |
| DOM scanning and price replacement | `content/kufar.js` |
| Popup UI, domain toggles, converter | `popup/` |
| Test coverage | `tests/` |
| Chrome build packaging | `scripts/build-chrome.mjs` |
| Domain registry (content + popup) | `content/kufar.js` and `popup/popup.js` (kept in sync manually) |

## Change rules

- **`content/kufar.js` must stay self-contained.** Duplicated helpers from `lib/rates.js` are intentional — content scripts cannot import modules. Changes to `lib/rates.js` parse/format logic must be mirrored in `content/kufar.js`.
- **Conversion always from original BYN amount.** Never re-convert an already-converted value. The content script stores `data-kufar-original-price-text` and `data-kufar-original-price-amount` on each node.
- **MutationObserver must use the rAF debounce scheduler** (`scheduleApply`). Never do synchronous full recalculation on every mutation.
- **Adding a new supported domain** requires: updating `DOMAIN_REGISTRY` in both `content/kufar.js` and `popup/popup.js`, and adding HTML fixtures to `examples/`.
- **Do not add browser APIs to `lib/rates.js`.** It must remain testable in plain Node.

## Validation

```bash
npx vitest run tests/parse.test.js     # Unit tests for lib/rates.js
npx vitest run tests/content.test.js    # JSDOM tests for content script
npm test                                # All tests
npm run format:check                    # Prettier check
npm run build:chrome                    # Chrome build
```

Coverage thresholds: 80% lines/functions/branches/statements for `lib/**/*.js` (see `vitest.config.js`).

## Key docs

- `README.md` — user-facing overview, dev commands
- `ARCHITECTURE.md` — component diagram, data flow, invariants
- `content/AGENTS.md` — content script local rules (IIFE, DOM scanning, duplication)
- `tests/AGENTS.md` — test file split, fixture usage, coverage boundaries
- `popup/AGENTS.md` — popup-specific conventions (DOMAIN_REGISTRY, CSS, converter)

## Repository-specific gotchas

- MVP supports only `auto.kufar.by`. Other Kufar domains are registered but marked `supported: false`.
- `content/kufar.js` duplicates `parseBynPrice`, `convertFromBYN`, `formatDisplayPrice` from `lib/rates.js` because content scripts cannot use ES module imports. Keep these in sync.
- `DOMAIN_REGISTRY` exists in two files (`content/kufar.js:4` and `popup/popup.js:13`). Changes must be applied to both.
- `NEGATIVE_LABELS` in content script ("Договорная", "Бесплатно", etc.) prevent conversion of non-price text that coincidentally matches BYN patterns.
- `browser ??= chrome` shim appears in `background.js`, `content/kufar.js`, and `popup/popup.js` for Chrome compatibility.
