# AGENTS.md

## Scope

`src/content/` — the content script injected into Kufar pages by the extension manifest.

## What lives here

```
content/
└── kufar.js   # Self-contained IIFE — DOM scanning, price conversion, MutationObserver
```

## Local boundaries and invariants

- **Self-contained IIFE only.** No `import`, no `fetch`, no `innerHTML`. Content scripts run in an isolated world without ESM support.
- **Duplicates from `src/lib/rates.js`.** `parseBynPrice`, `convertFromBYN`, `formatDisplayPrice` are intentionally duplicated. Changes to those functions in `lib/rates.js` must be mirrored here.
- **`DOMAIN_REGISTRY` must stay in sync with `src/popup/popup.js`.** Same hosts, same `supported` flags.
- **Only converts inside safe containers** — selectors defined in `applyConversion()` (ad cards, sidebar, main, footer).
- **Only converts leaf text nodes** (elements with `childElementCount === 0`) that pass the BYN marker regex.
- **`NEGATIVE_LABELS`** filter out "Договорная", "Бесплатно", "Обмен", "Цена не указана".
- **Always preserves original text** via `data-kufar-original-price-text` and `data-kufar-original-price-amount`. Restores when `selectedCurrency = BYN` or domain is disabled.

## Safe change rules

- **MutationObserver** must use `scheduleApply` (rAF debounce). Never synchronous recalculation.
- **No network calls.** Request rates via `browser.runtime.sendMessage({ action: 'ensureRates' })`.
- **No module imports.** Inline utilities or duplicate from `src/lib/`.
- **No `innerHTML`.** Use `textContent`, `createElement`, `appendChild`.
- **When adding price detection patterns**, update both `parseBynPrice` here and in `src/lib/rates.js`, plus add test cases to `tests/parse.test.js` and `tests/content.test.js`.

## Validation

```bash
npx vitest run tests/content.test.js
```

Tests use `examples/auto/index_page.html` as fixture and mock `browser` storage/messaging via JSDOM.
