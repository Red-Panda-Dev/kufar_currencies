# AGENTS.md

## Scope

`src/popup/` — the extension popup UI opened via browser action. Separate entrypoint with its own HTML/CSS/JS lifecycle and full ESM import support.

## What lives here

```
popup/
├── popup.html    # BEM classes, ARIA attributes, semantic sections
├── popup.css     # Light/dark via prefers-color-scheme, custom properties, 320px min-width
└── popup.js      # ES module: imports lib/rates.js, communicates with background via messaging
```

## Local boundaries and invariants

- **ES module with imports from `src/lib/rates.js`.** Unlike content script, popup has full ESM support. Uses `convert`, `formatDisplayPrice`, `formatRate`, `formatRateLabel`, `formatDate`, `formatTime`.
- **Communicates with background via `browser.runtime.sendMessage`.** Actions: `getRates`, `refreshRates`, `ensureRates`. Never fetches NBRB directly.
- **`DOMAIN_REGISTRY` is a superset** of `src/content/kufar.js`: includes a "Везде" master toggle with `controlsSupportedDomains: true`. Must stay in sync.
- **No `innerHTML`.** Use `textContent`, `createElement`, `appendChild`.
- **CSS uses custom properties** (`--bg`, `--text`, `--accent`, etc.) with light/dark variants via `prefers-color-scheme`. Never hardcode colors.
- **Converter uses direct `convert(amount, from, to, rates)`** — popup has fresh rates from background, unlike content script which reads stored original amounts.

## Safe change rules

- **Event handlers via `addEventListener`**, never inline `onclick` in HTML.
- **Currency/domain changes persist to `browser.storage.local`.** Keys: `selectedCurrency`, `domainSettings`.
- **`converterInput` uses `inputmode="decimal"` and `type="number"`** — preserve accessibility attributes.
- **Adding a new domain** requires updating `DOMAIN_REGISTRY` in both `popup/popup.js` and `src/content/kufar.js`, plus HTML fixtures in `examples/`.
- **Sections use `[hidden]` attribute** for show/hide (loading, error, rates). Don't remove elements from DOM.

## Validation

```bash
npx vitest run tests/parse.test.js
```

Popup has no dedicated test file — core logic reuses `src/lib/rates.js` covered by `parse.test.js`. Manual testing via extension popup is current practice.
