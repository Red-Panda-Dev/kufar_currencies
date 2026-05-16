# AGENTS.md

## Scope

`content/` — the content script injected into Kufar pages by the extension manifest.

## What lives here

```
content/
└── kufar.js   # Self-contained IIFE, DOM price conversion
```

## Local boundaries and invariants

- **Self-contained IIFE only.** No `import`, no `fetch`, no `innerHTML`. This is a hard constraint — content scripts run in an isolated world without module support.
- **Duplicates from `lib/rates.js`.** `parseBynPrice`, `convertFromBYN`, `formatDisplayPrice` are intentionally duplicated here. Changes to those functions in `lib/rates.js` must be mirrored here.
- **`DOMAIN_REGISTRY` must stay in sync with `popup/popup.js`.** Same structure, same hosts.
- **Only converts inside safe containers** (`a[data-testid='kufar-ad']`, `[data-name='ad-view-fixed-footer']`, `[data-name='ad-view-sidebar']`, `main`, `section`).
- **Only converts leaf text nodes** (elements with no children) that pass the BYN marker regex.
- **`NEGATIVE_LABELS`** filter out "Договорная", "Бесплатно", "Обмен", "Цена не указана" — these look like prices but are not.
- **Always preserves original text** via `data-kufar-original-price-text` and `data-kufar-original-price-amount` on each converted node.
- **Restores original text** when `selectedCurrency = BYN` or domain is disabled.

## Safe change rules

- **MutationObserver** must use `scheduleApply` (rAF debounce). Never replace with synchronous recalculation.
- **Do not add network calls.** Request rates via `browser.runtime.sendMessage({ action: 'ensureRates' })`.
- **Do not add module imports.** If a new utility is needed, inline it or duplicate from `lib/`.
- **Do not use `innerHTML`.** Use `textContent`, `createElement`, `appendChild`.
- **When adding price detection patterns**, update both `parseBynPrice` here and in `lib/rates.js`, plus add test cases to `tests/parse.test.js` and `tests/content.test.js`.

## Validation

```bash
npx vitest run tests/content.test.js
```

Tests use `examples/auto/index_page.html` as fixture and mock `browser` storage/messaging via JSDOM.
