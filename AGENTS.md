# AGENTS.md

## Repository overview

Manifest V3 WebExtension (Chrome + Firefox) that replaces BYN prices on Kufar pages with user-chosen currency (USD/EUR/RUB) using NBRB exchange rates.

## Repo shape

```
src/
├── background.js              # Network layer, cache, message handler
├── lib/
│   └── rates.js               # Pure parsing/conversion/formatting logic
├── content/
│   └── kufar.js               # Self-contained IIFE — DOM price conversion
└── popup/
    ├── popup.html             # Popup markup
    ├── popup.css              # Popup styles
    └── popup.js               # Popup logic, imports lib/rates.js
tests/
├── parse.test.js              # Unit tests for lib/rates.js
└── content.test.js            # JSDOM integration tests for content script
scripts/
├── build-chrome.mjs           # Chrome build (strips gecko keys, copies files)
├── build-firefox.mjs          # Firefox build
└── build-utils.mjs            # Shared build helpers
examples/
├── auto/                      # HTML fixtures from auto.kufar.by
├── real_estate/               # HTML fixtures from re.kufar.by
├── travel/                    # HTML fixtures from travel.kufar.by
├── nbrb_response.json         # Sample NBRB API response fixture
└── screenshots/               # Extension screenshots
icons/                         # Extension icons (SVG + PNG)
manifest.json                  # Extension manifest (MV3, Firefox primary)
```

## Architecture and boundaries

- **Network is exclusive to `src/background.js`.** No `fetch`/`XMLHttpRequest` anywhere else.
- **`src/content/kufar.js` is self-contained.** No `import`, no `fetch`, no `innerHTML`. Runs as IIFE injected by the content_scripts manifest entry.
- **`src/lib/rates.js` is pure.** No side effects, no browser APIs. Safe to import from `background.js` and `popup.js`.
- **`popup/popup.js`** imports from `lib/rates.js` and communicates with `background.js` via `browser.runtime.sendMessage`.
- **Data flow:** background fetches NBRB → stores `ratesData` → popup reads storage → content reads storage + requests `ensureRates` via message.
- **No `innerHTML`** in production code (`content/` and `popup/`). Use `textContent`, `createElement`, `appendChild`.

## Where to change

| Concern | Location |
|---|---|
| Rates parsing, conversion, formatting | `src/lib/rates.js` |
| Network, caching, alarms, messages | `src/background.js` |
| DOM scanning and price replacement | `src/content/kufar.js` |
| Popup UI, domain toggles, converter | `src/popup/` |
| Test coverage | `tests/` |
| Chrome/Firefox build packaging | `scripts/` |
| Domain registry (content + popup) | `src/content/kufar.js` and `src/popup/popup.js` (kept in sync manually) |

## Change rules

- **`src/content/kufar.js` must stay self-contained.** Duplicated helpers from `src/lib/rates.js` are intentional — content scripts cannot import modules. Changes to `lib/rates.js` parse/format logic must be mirrored in `content/kufar.js`.
- **Conversion always from original BYN amount.** Never re-convert an already-converted value. The content script stores `data-kufar-original-price-text` and `data-kufar-original-price-amount` on each node.
- **MutationObserver must use the rAF debounce scheduler** (`scheduleApply`). Never do synchronous full recalculation on every mutation.
- **Adding a new supported domain** requires: updating `DOMAIN_REGISTRY` in both `src/content/kufar.js` and `src/popup/popup.js`, and adding HTML fixtures to `examples/`.
- **Do not add browser APIs to `src/lib/rates.js`.** It must remain testable in plain Node.

## Validation

```bash
npm test                                # All tests + coverage
npx vitest run tests/parse.test.js     # Unit tests for lib/rates.js
npx vitest run tests/content.test.js    # JSDOM tests for content script
npm run format:check                    # Prettier check
npm run format                          # Auto-fix formatting
make build                              # lint + test + package both browsers
make build-chrome                       # lint + test + package Chrome only
make build-firefox                      # lint + test + package Firefox only
```

Coverage thresholds: 80% lines/functions/branches/statements for `src/lib/**/*.js` (see `vitest.config.js`).

## Key docs

- `README.md` — user-facing overview, dev commands
- `ARCHITECTURE.md` — component diagram, data flow, invariants with evidence anchors
- `src/content/AGENTS.md` — content script local rules (IIFE, DOM scanning, duplication)
- `tests/AGENTS.md` — test file split, fixture usage, coverage boundaries
- `src/popup/AGENTS.md` — popup-specific conventions (DOMAIN_REGISTRY, CSS, converter)

## Repository-specific gotchas

- MVP supports only `auto.kufar.by`. Other Kufar domains are registered but marked `supported: false`.
- `src/content/kufar.js` duplicates `parseBynPrice`, `convertFromBYN`, `formatDisplayPrice` from `src/lib/rates.js` because content scripts cannot use ES module imports. Keep these in sync.
- `DOMAIN_REGISTRY` exists in two files (`src/content/kufar.js:4` and `src/popup/popup.js:13`). Changes must be applied to both.
- `NEGATIVE_LABELS` in content script ("Договорная", "Бесплатно", etc.) prevent conversion of non-price text that coincidentally matches BYN patterns.
- `browser ??= chrome` shim appears in `src/background.js`, `src/content/kufar.js`, and `src/popup/popup.js` for Chrome compatibility.
- `manifest.json` is Firefox-primary. Chrome build transforms it at build time (strips `browser_specific_settings`, converts `background.scripts` → `background.service_worker`).
