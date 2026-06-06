# AGENTS.md

## Scope

`tests/` — unit and integration tests for the extension.

## What lives here

```
tests/
├── parse.test.js        # Unit tests for src/lib/rates.js (pure functions)
├── background.test.js   # Unit tests for src/background.js (mocked browser APIs)
└── content.test.js      # JSDOM integration tests for src/content/kufar.js
```

## Local boundaries and invariants

- **`parse.test.js`** tests pure logic from `src/lib/rates.js`. No browser mocks, no DOM.
- **`background.test.js`** tests `src/background.js` with globalThis mocks for `browser`, `fetch`, `alarms`, `storage`. Uses `vi.mock` for `parseRates`. No DOM.
- **`content.test.js`** reads `src/content/kufar.js` source, bootstraps it in JSDOM with a full `browser` mock (storage, runtime messaging). Tests behavior, not internals.
- **Fixtures:** `examples/nbrb_response.json` for NBRB API responses, `examples/auto/index_page.html` for DOM content.
- **`content.test.js` evals the content script** (`dom.window.eval(contentSource)`) — it does not import it. This matches how the browser injects content scripts.

## Safe change rules

- When adding tests for `src/lib/rates.js`, add them to `parse.test.js`.
- When adding tests for `src/background.js`, add them to `background.test.js`.
- When adding tests for content script behavior, add them to `content.test.js`. Use `bootstrapContentScript()` and `createBrowserMock()`.
- Use real HTML fixtures from `examples/` for content tests, not inline HTML strings.
- Coverage thresholds require 80% for `src/lib/**/*.js` and `src/background.js`. Content script coverage is not enforced but should be improved when feasible.

## Validation

```bash
npx vitest run tests/parse.test.js
npx vitest run tests/background.test.js
npx vitest run tests/content.test.js
npm test
```
