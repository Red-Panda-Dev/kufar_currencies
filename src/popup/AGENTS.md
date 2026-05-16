# AGENTS.md

## Scope

`popup/` — the extension popup UI opened via browser action. Separate entrypoint with its own HTML/CSS/JS, lifecycle, and import graph.

## What lives here

```
popup/
├── popup.html    # Markup with BEM classes, ARIA attributes, semantic sections
├── popup.css     # Light/dark via prefers-color-scheme, custom properties, 320px min
└── popup.js      # ES module: imports lib/rates.js, talks to background via messaging
```

## Local boundaries and invariants

- **ES module that imports from `lib/rates.js`.** Unlike content script, popup has full import support. Uses `convert`, `formatDisplayPrice`, `formatRate`, `formatRateLabel`, `convert`, `formatDate`, `formatTime`.
- **Communicates with background via `browser.runtime.sendMessage`.** Message actions: `getRates`, `refreshRates`, `ensureRates`. Never fetches directly.
- **`DOMAIN_REGISTRY` is a superset** of `content/kufar.js`: includes a "Везде" master toggle with `controlsSupportedDomains: true`. Must stay in sync with `content/kufar.js`.
- **No `innerHTML`.** Use `textContent`, `createElement`, `appendChild`.
- **CSS uses custom properties** (`--bg`, `--text`, `--accent`, etc.) — both light and dark variants via `prefers-color-scheme`. Never hardcode colors.
- **Converter does direct conversion** (`convert(amount, from, to, rates)`) — popup has fresh rates from background, unlike content script which reads stored original amounts.

## Safe change rules

- **Event handlers via `addEventListener`**, never inline `onclick` in HTML.
- **Currency/domain changes persist to `browser.storage.local`.** Respect existing keys: `selectedCurrency`, `domainSettings`.
- **`converterInput` uses `inputmode="decimal"` and `type="number"`** — preserve accessibility attributes.
- **Domain toggles**: adding a new domain requires updating `DOMAIN_REGISTRY` in both `popup/popup.js` and `content/kufar.js`, plus adding HTML fixtures to `examples/`.
- **Sections use `[hidden]` attribute** for show/hide (loading, error, rates). Don't remove elements from DOM.

## Validation

```bash
npx vitest run tests/parse.test.js
```

Popup has no dedicated test file — its core logic reuses `lib/rates.js` which is covered by `parse.test.js`. Manual testing via extension popup is current practice. If adding significant popup logic, consider adding `tests/popup.test.js`.
