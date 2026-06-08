# DESIGN.md

## Purpose

Design rules for AI agents changing UI in this browser extension popup. Use when editing `src/popup/` HTML, CSS, or JS — the only user-facing UI in this project.

For architecture and data flow, see `ARCHITECTURE.md`. For module boundaries and change rules, see `AGENTS.md` and `src/popup/AGENTS.md`.

## Product feel

- Compact utility panel — 320px fixed-width browser extension popup.
- Dark-first, data-dense, scannable. No illustrations, no onboarding.
- Financial tool personality: precise numbers, tabular alignment, muted surrounding UI.
- Restrained interaction — no animations beyond `transition` on button hover/focus. Respects `prefers-reduced-motion`.
- Russian-language UI. All labels, buttons, statuses in Russian.
- Trust through clarity: rate sources labeled, stale data flagged, custom rates visually distinct.

## Canonical UI examples

- `src/popup/popup.html` — entire popup shell: semantic `<section>` blocks, `[hidden]` toggling, BEM class structure, ARIA attributes.
- `src/popup/popup.css:1–19` — custom property palette, typography, dimensions.
- `src/popup/popup.css:102–136` — rate row pattern: flex layout, flag + code + value alignment.
- `src/popup/popup.css:220–288` — converter widget: input + select row, result display.
- `src/popup/popup.css:290–332` — settings section: label + select, domain checkbox list.
- `src/popup/popup.js:158–194` — programmatic DOM construction for rate rows (createElement + textContent pattern).

## Layout rules

- Fixed 320px width (`html`, `body`, `.popup` all `width: 320px; max-width: 320px`).
- Single-column vertical stack. No sidebars, no grids, no multi-column layouts.
- Sections separated by `margin-bottom: 12px` on `.header`, `.rates`, `.error`, `.converter`, `.settings`.
- Popup padding: `16px` (`12px` below 380px via media query).
- Card-style sections (`.rates`, `.settings`): `border-radius: var(--radius)`, `background: var(--bg-card)`, `box-shadow: var(--shadow)`.
- Content order: header → rates → loading/error → converter → currency setting → domain settings → footer.

## Visual language

### Colors (Kanagawa Wave Palette)

- Defined as custom properties on `:root` in `src/popup/popup.css:1–20`. Always use variables, never raw hex.
- Base palette:
  - `--bg` (#1F1F28) — Sumi Dark (main background)
  - `--bg-card` (#2A2A37) — Sumi Lighter (card background)
  - `--text` (#DCD7BA) — Fuji (primary text)
  - `--text-muted` (#C8C093) — Old White (secondary text)
  - `--border` (#363646) — Sumi Lightest (borders)
- Accent palette:
  - `--accent` (#7E9CD8) — Wave Blue (interactive highlights)
  - `--accent-hover` (#7FB4CA) — Spring Blue (hover states)
- Semantic colors:
  - `--success` (#95C561) — Dragon Green (accept buttons)
  - `--danger` (#E82424) — Samurai Red (cancel buttons)
  - `--error-bg` (#2A1E1E) / `--error-text` (#E82424) — Error states
  - `--warning-bg` (#4A3D2A) / `--warning-text` (#FF9E3B) — Warning states
  - `--custom-rate` (#FF9E3B) — Ronin Yellow (custom rates)

### Typography

- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- Base: `14px`, `line-height: 1.5`.
- Title: `16px`, `font-weight: 700`.
- Section titles: `13px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.5px`, `color: var(--text-muted)`.
- Status/footer: `11px`.
- All number displays use `font-variant-numeric: tabular-nums` for alignment.

### Spacing and radius

- `--radius: 8px` for cards, inputs, buttons, result display.
- Inner card padding: `12px`.
- Input padding: `10px 12px`.
- Minimum touch target: `min-height: 44px` on all inputs, selects, and buttons.
- Checkbox labels: `min-height: 44px` with `gap: 8px`.

## Components and patterns

### Rate row (`src/popup/popup.css:102–136`)

- Horizontal flex: `[flag 28px] [code 36px] [value flex:1 right] [edit button]`.
- Bottom border separator between rows, none on last child.
- Custom rate rows get `.rate-row--custom` → amber value color.
- Edit mode replaces value + edit button with input + accept/deny buttons.

### Converter (`src/popup/popup.css:205–288`)

- Input + select in a flex row with `gap: 8px`. Select is fixed `80px`.
- Result: right-aligned, `font-weight: 600`, `font-size: 15px`, card background.
- Select hover: fills accent color, white text.

### Settings section (`src/popup/popup.css:290–332`)

- Card container with `padding: 12px`.
- Label: `12px`, muted color, `font-weight: 600`.
- Select: full-width, same styling as converter select.

### Domain list (`src/popup/popup.css:302–337`)

- Unstyled list, items separated by `margin-top: 4px`.
- Each item: `<label>` wrapping checkbox + text span + meta span.
- Disabled entries show "планируется" note in muted `11px`.
- Master toggle ("Везде") controls all supported domains simultaneously.

### Error section (`src/popup/popup.css:379–385`)

- Red-tinted card (`--error-bg` / `--error-text`), `font-size: 13px`, uses `role="alert"`.

### Loading (`src/popup/popup.css:387–391`)

- Centered muted text, `padding: 24px 0`.

### Footer (`src/popup/popup.css:339–377`)

- Flex row: updated timestamp (left, muted 11px) + refresh button (right).
- Button: card-style, accent-colored text, hover fills accent + Fuji text.
- Disabled state: `opacity: 0.5`, `cursor: not-allowed`.
- `transition: background 0.15s, border-color 0.15s, color 0.15s` (disabled via `prefers-reduced-motion`).

## Interaction rules

- Show/hide sections via `[hidden]` attribute — never remove elements from DOM (`setHidden()` in `popup.js:106`).
- No `innerHTML`. Build DOM with `createElement`, `textContent`, `appendChild` (see `createRateRow` in `popup.js:158`).
- No inline event handlers. Use `addEventListener` exclusively.
- Inline editing (custom rates): click edit → input replaces value, Enter to save, Escape to cancel, blur cancels.
- Button hover states use `transition` (0.15s). No other animations.
- Disabled refresh button during loading prevents double-fetch.
- Select hover fills accent color as clear interactive signal.

## Data display rules

- Rates formatted with `formatRate()` + `formatRateLabel()` (scale suffix like "за 100 единиц").
- Custom rates shown in amber (`--custom-rate`) to distinguish from official rates.
- Converter result: `formatConverterResult()`, right-aligned, tabular-nums.
- Last updated: date + time via `formatDate()` / `formatTime()`, format "Обновлено: DD.MM HH:MM".
- Empty/missing values display as "—" dash, never empty space.
- Stale data: status shows "Показаны сохраненные данные" with warning styling.

## Forms, filters, and validation

- Currency select: full-width in settings section. Changing it persists to `browser.storage.local` and updates converter currency.
- Converter input: `type="number"`, `inputmode="decimal"`, `step="any"`, `min="0"`. Preserves accessibility attributes.
- Custom rate input: `type="number"`, `step="any"`, `min="0.001"`. Invalid/non-positive values silently cancel (revert to previous).
- Domain checkboxes: clicking "Везде" toggles all supported domains. Individual toggles sync "Везде" checkbox state.
- All form controls inherit `font: inherit` from reset. No custom fonts.

## User-facing text

- Language: Russian throughout.
- Button labels: "Обновить" (refresh), "✎" (edit rate), "✓" (accept), "✕" (cancel).
- Status messages: "Загрузка...", "Обновление...", "Показаны сохраненные данные".
- Placeholder: "Сумма" on converter input.
- Unavailable domain: "планируется".
- ARIA labels in Russian: `aria-label="Сумма в выбранной валюте"`, `aria-label="Валюта"`, `aria-label="Изменить курс USD"`.
- Section headings: "Курсы НБРБ" (visually hidden), "Конвертер", "Сайты Kufar".

## Accessibility basics

- Semantic HTML: `<header>`, `<main>`, `<section>`, `<footer>`, `<h1>`, `<h2>`.
- All sections use `aria-labelledby` or `aria-live` or `role="alert"`.
- Screen-reader-only headings: `.visually-hidden` class (clip + 1px + overflow:hidden).
- All inputs and selects have explicit `aria-label`.
- Edit buttons have `aria-label` describing action + currency code.
- 44px minimum touch targets on all interactive elements.
- Focus state: `border-color: var(--accent)` + `box-shadow: 0 0 0 2px rgba(126, 156, 216, 0.25)`.
- `prefers-reduced-motion` disables transitions.
- `color-scheme: dark` set on `:root` for native form controls.

## Do / Don't

Do:
- Use CSS custom properties from `:root` for every color decision.
- Use **Kanagawa Wave palette** colors for all new UI elements.
- Follow the BEM naming pattern: `block__element` and `block--modifier`.
- Build DOM programmatically with `createElement` + `textContent` + `appendChild`.
- Preserve `[hidden]` show/hide pattern for state changes.
- Keep `min-height: 44px` on all interactive elements.
- Use `font-variant-numeric: tabular-nums` for any numeric display.
- Update `DOMAIN_REGISTRY` in both `src/popup/popup.js:16` and `src/content/kufar.js:4` when adding domains.

Don't:
- Use `innerHTML` anywhere in popup code.
- Add inline `onclick` or other event handler attributes in HTML.
- Introduce new colors without adding a custom property to `:root`.
- Hardcode colors — always reference `--bg`, `--text`, `--accent`, etc.
- Change the 320px fixed width without updating all three width declarations (`html`, `body`, `.popup`).
- Add animations beyond simple `transition` on interactive state changes.
- Use `fetch` or `XMLHttpRequest` in popup — route all network through `browser.runtime.sendMessage`.

## When unsure

- Inspect the nearest existing component in `src/popup/popup.css` for spacing, sizing, and color patterns.
- Read `src/popup/AGENTS.md` for popup-specific boundaries and invariants.
- Keep diffs minimal — match surrounding style rather than introducing new patterns.
- For new UI elements, prefer the card pattern (`border-radius`, `bg-card`, `shadow`) already used by `.rates` and `.settings`.
- Ask before introducing new visual elements, icons, or layout structures not present in the current popup.
