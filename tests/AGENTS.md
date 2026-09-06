# AGENTS.md

## Scope and inheritance

Applies to: `tests/` — unit and integration tests for the extension.

Inherits repository-wide guidance from `../AGENTS.md`. This file defines only local differences for this subtree.

## What lives here

```text
tests/
├── parse.test.js        # Unit tests for src/lib/rates.js (pure functions)
├── background.test.js   # Unit tests for src/background.js (mocked browser APIs)
└── content.test.js      # JSDOM integration tests for src/content/kufar.js
```

## Local boundaries and invariants

- **`parse.test.js`** tests pure logic from `src/lib/rates.js`. No browser mocks, no DOM. Loads `examples/nbrb_response.json` as the NBRB API response fixture.
- **`background.test.js`** tests `src/background.js` with globalThis mocks for `browser`, `fetch`, `alarms`, `storage`. Uses `vi.mock` for `parseRates`. NBRB responses are inline mocks, not fixtures. No DOM.
- **`content.test.js`** reads `src/content/kufar.js` source, bootstraps it in JSDOM with a full `browser` mock (storage, runtime messaging). Tests behavior, not internals.
- **HTML fixtures** are real pages loaded via `readFileSync(resolve(process.cwd(), "examples", ...))` from `examples/auto/`, `examples/real_estate/`, `examples/travel/`, and `examples/main/` (index/item/filter pages). Use real fixtures for content tests, not inline HTML strings.
- **`content.test.js` evals the content script** (`dom.window.eval(contentSource)`) — it does not import it. This matches how the browser injects content scripts.

## Safe change rules

- When adding tests for `src/lib/rates.js`, add them to `parse.test.js`.
- When adding tests for `src/background.js`, add them to `background.test.js`.
- When adding tests for content script behavior, add them to `content.test.js`. Use `bootstrapContentScript()` and `createBrowserMock()`.
- Coverage thresholds require 80% for `src/lib/**/*.js` and `src/background.js`. Content script coverage is not enforced but should be improved when feasible.

## Validation

```bash
npx vitest run tests/parse.test.js
npx vitest run tests/background.test.js
npx vitest run tests/content.test.js
npm test
```
