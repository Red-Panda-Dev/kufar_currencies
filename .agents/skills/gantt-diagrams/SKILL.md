---
name: gantt-diagrams
description: Create, update, and review repository-style Highcharts Gantt diagrams for bond event timelines, emission lifecycles, portfolio calendars, and financial schedule visualizations.
---

# Gantt Diagrams Skill

## When to use this skill

Use this skill when asked to:

- create a Gantt chart for bond events, emission timelines, or portfolio calendars
- add a new Gantt visualization to an SSR page or dashboard
- update an existing Gantt chart's data, layers, colors, or interactions
- convert financial schedule data (coupon payouts, buybacks, emission periods) into a timeline diagram
- review an existing Gantt chart for consistency with repository conventions
- add date filtering, fullscreen export, or responsive behavior to a Gantt chart

## Repository conventions

### Primary format

**Highcharts Gantt** (`Highcharts.ganttChart`). This is the only Gantt format used in the repository.

- Mermaid Gantt and PlantUML Gantt are **not used**.
- The Highcharts Gantt module is loaded via CDN: `highcharts@12.5.0/modules/gantt.js`
- The `highcharts-more` and `stock` modules are loaded before `gantt.js`.
- The custom burger-menu utility (`highcharts_burger_menu.min.js`) is the only allowed fullscreen/export UI source.
- Charts must not implement their own export menu objects, fullscreen handlers, or custom `exportChart()` menu callbacks.

### Source examples

| Path | Purpose | Y-axis rows |
|------|---------|-------------|
| `src/tbel/static/js/securities/bond_events_gantt.js` | Bond detail page: coupon payment periods + emission lifetime | 2 categories |
| `src/tbel/static/js/emission/timeline_gantt_chart.js` | Emission detail page: selling period, interest payments, buyback requests/payments, token lifetime | 4 fixed Y layers |
| `src/tbel/static/js/portfolio/calendar_gantt_chart.js` | Portfolio detail: multi-row per-emission calendar | N rows sorted by emission end date |
| `src/tbel/static/js/profile/emissions_calendar.js` | Profile favorites calendar: same structure as portfolio | N rows |
| `src/tbel/templates/company/calendar.html` (inline) | Company emission calendar: same structure as portfolio | N rows |

### Label language

**Russian** for all user-facing text:

- Section names: `Выплаты процента`, `Срок эмиссии`, `Период продажи`
- Tooltip labels: `Начало:`, `Окончание:`, `Длительность:`
- Button labels: `Полноэкранный режим`, `Скачать SVG`
- Error messages: `Недостаточно данных для построения календаря`
- Axis categories: `Выплаты процента`, `Срок эмиссии`
- Today marker: `Сегодня`

English for internal identifiers and IDs.

### Date format

- **Input**: `YYYY-MM-DD` or ISO `YYYY-MM-DDTHH:MM:SS.sssZ`
- **Display**: `DD.MM.YYYY` via `Highcharts.dateFormat('%d.%m.%Y', timestamp)`
- **Compact display** (narrow ranges): `DD.MM`
- **Month-only display** (wide ranges): `MM.YYYY`
- **Month axis labels** (portfolio/company calendars): `Январь 2026` — Russian month name + year via `RUSSIAN_MONTHS` mapping

### Color palette

All Gantt charts use the same consistent palette:

| Role | Hex | Usage |
|------|-----|-------|
| Emission lifetime | `#2563eb` | Dark blue — token/bond lifetime bar |
| Selling/placement period | `#059669` | Green — sales period bar |
| Interest payments | `#36a2eb` | Light blue — coupon/payout period bars |
| Buyback requests | `#ff9f40` | Orange — buyback request window bars |
| Buyback payments | `#c16b00` | Dark orange — buyback payment bars |
| Today plot line | `red` (CSS) | Vertical line marking current date |
| Grid lines | `#d0d0d0` | X-axis grid |
| Background (chart) | `transparent` | Embedded; `#ffffff` in fullscreen |

### Chart structure

- `title.text: null` — titles are in the HTML section heading, not the chart
- `credits.enabled: false`
- `navigator.enabled: false` — date range controlled by external `<input type="date">` filters
- `rangeSelector.enabled: false`
- `exporting` comes from `getHighchartsBurgerExportingOptions(containerId)` — custom per-chart export logic is forbidden
- Embedded chart background is `transparent`
- Fullscreen chart background is always `#ffffff`
- PNG export background is always `#ffffff`
- JPEG export background is always `#ffffff`
- SVG export background is always `transparent`

### Export and fullscreen

Use the built-in repository burger-menu helpers for every Highcharts Gantt chart. Do not rely on chart defaults, and do not duplicate export/fullscreen logic inside the chart file.

- PNG: export with `chart.backgroundColor: '#ffffff'` and `plotBackgroundColor: '#ffffff'`
- JPEG: export with `chart.backgroundColor: '#ffffff'` and `plotBackgroundColor: '#ffffff'`
- SVG: export with `chart.backgroundColor: 'transparent'` and `plotBackgroundColor: 'transparent'`
- Fullscreen: set chart background to `#ffffff` while fullscreen is open, then restore the embedded background after exit

Required implementation: include `src/tbel/static/js/utils/highcharts_burger_menu.js` / `highcharts_burger_menu.min.js`, then configure the chart with the global helpers it exposes:

```js
chart: {
    backgroundColor: 'transparent',
    events: getHighchartsFullscreenEvents('yourChartContainerId', 350),
},
exporting: {
    ...getHighchartsBurgerExportingOptions('yourChartContainerId'),
}
```

If helpers are unavailable, fix script ordering or include `highcharts_burger_menu.min.js`; do not add fallback export menu implementations to the chart.

### Series data shape

Each data point follows this shape:

```js
{
    id: 'unique_string_id',      // Required for plot lines and debugging
    name: 'Выплата #1',          // Russian label
    start: Date.UTC(y, m, d),    // UTC timestamp from toTimestamp()
    end: Date.UTC(y, m, d),      // UTC timestamp
    y: 0,                        // Fixed row index (layer-based) or dynamic
    color: '#36a2eb',            // From palette above
    description: 'Описание',     // Used in tooltip
}
```

### Y-axis conventions

Two patterns exist:

1. **Categorical** (bond detail): `yAxis.type: 'category'` with named categories like `['Выплаты процента', 'Срок эмиссии']`
2. **Fixed Y-index with custom labels** (emission/portfolio): explicit `y` values per data point, categories built from emission names

### Date range strategy

Default visible range:

- **Start**: `today - 10 days` (bond events) or `today - 30 days` (portfolio/emission)
- **End**: `today + 4 months` (bond events) or `today + 90 days` (portfolio/emission)
- **Minimum range**: 30 days; if range is smaller, extend to 60 days
- Range is clamped to `[globalMin, globalMax]`

### Responsive rules

Bond events chart uses a responsive rule at `maxWidth: 600`:

- Height drops to 300px
- X-axis labels rotate 45 degrees
- Data labels are disabled on all series

### Alpine.js integration pattern

Gantt charts integrate with the template via Alpine.js:

```js
window.bondEventsGantt = function (config) {
    return {
        loading: true,
        error: null,
        chart: null,
        async init() { /* fetch data, call initXxxGantt() */ },
    };
};
```

Template wiring:

```html
<section x-data="getBondEventsState(window.bondEventChartData)" x-init="init()" x-cloak>
    <div x-show="loading">Загрузка графика...</div>
    <div x-show="error" x-text="error"></div>
    <div id="bondEventsGanttChart"></div>
</section>
```

### Shared data via Alpine store

When multiple charts share data (e.g., Gantt + payout bar chart), use an Alpine store:

```js
Alpine.store('bondDetailSchedule', { payments: null });
```

The first chart to load populates the store; subsequent charts read from it.

## Required inputs

Before creating a Gantt chart, identify or request:

- **Chart container ID**: unique DOM id (e.g., `bondEventsGanttChart`, `portfolioCalendarGantt`)
- **Data source**: API endpoint(s) or template-injected data
- **Row semantics**: what each Y-axis row represents (payment periods, emission lifetimes, company timelines)
- **Series/layers**: which event types to display (payments, buybacks, lifetime, selling period)
- **Start and end dates**: for each data point, or date range fields in the data
- **Initial visible range**: or use the default strategy (today-centered window)
- **Date filter inputs**: whether the template already has `<input type="date">` elements for range control
- **Audience**: public SSR page vs. internal dashboard

If any required field is missing, do not invent it. Return a list of missing inputs.

## Creating a new diagram

1. **Define the init function**: `window.initXxxGantt = function (data) { ... }` or a factory like `window.xxxGantt = function (config) { return { ... } }`
2. **Parse dates with `Date.UTC`**: always use `Date.UTC(year, month - 1, day)` for timezone-safe timestamps
3. **Build data points**: each point must have `id`, `name` (Russian), `start`, `end`, `y`, `color` (from palette), `description`
4. **Set initial range**: use the today-centered strategy (`today - 10..30 days` to `today + 3..4 months`), clamp to data bounds
5. **Configure xAxis**: `type: 'datetime'`, adaptive `dateTimeLabelFormats` based on visible span
6. **Configure yAxis**: category-based or fixed-index, with Russian labels
7. **Add today plot line**: `xAxis.addPlotLine({ value: Date.now(), color: 'red', width: 3, label: { text: 'Сегодня' } })`
8. **Configure export menu**: use `getHighchartsBurgerExportingOptions(containerId)` and `getHighchartsFullscreenEvents(containerId, defaultHeight)` from the burger-menu utility; never write chart-local export/fullscreen handlers
9. **Add date filter binding**: bind external `<input type="date">` elements to `xAxis.setExtremes()`
10. **Handle Highcharts loading**: use a poll/wait pattern (`waitForHighcharts`) since scripts load with `defer`
11. **Add Alpine.js state**: return an object with `loading`, `error`, `chart`, `init()` for template wiring
12. **Responsive**: add a responsive rule for `maxWidth: 600` if the chart appears in mobile-capable pages

### Template integration

Include these scripts in `{% block head_extras %}`:

```html
<script src="https://cdn.jsdelivr.net/npm/highcharts@12.5.0/highcharts.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/highcharts@12.5.0/highcharts-more.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/highcharts@12.5.0/modules/stock.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/highcharts@12.5.0/modules/gantt.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/highcharts@12.5.0/modules/exporting.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/highcharts@12.5.0/modules/full-screen.js" defer></script>
<script src="https://static.tokenbel.info/static/js/utils/highcharts_burger_menu.min.js" defer></script>
<script src="https://static.tokenbel.info/static/js/your/new/chart.min.js"></script>
```

Chart container in the template:

```html
<section class="flex flex-col gap-2 p-4 bg-white rounded-lg border border-gray-300 shadow-md"
         x-data="getYourChartState(config)"
         x-init="init()"
         x-cloak>
    <h2 class="text-base font-semibold">Заголовок секции</h2>
    <p class="text-sm text-gray-700">Описание графика.</p>
    <div class="relative w-full">
        <div x-show="loading" class="flex absolute inset-0 z-10 justify-center items-center bg-gray-100">
            <span class="text-gray-700">Загрузка графика...</span>
        </div>
        <div x-show="error" class="flex absolute inset-0 z-10 justify-center items-center bg-gray-100">
            <span class="font-medium text-red-600" x-text="error"></span>
        </div>
        <div id="yourChartContainer" role="img" aria-label="Описание графика"></div>
    </div>
</section>
```

## Updating an existing diagram

- Preserve the existing chart container ID
- Preserve existing naming style and language (Russian labels, English IDs)
- Change only the requested data points, dates, colors, or interactions
- Do not reformat the entire file unless asked
- Keep unchanged timeline data intact
- Do not change the color palette unless explicitly asked
- Do not change the Alpine.js integration pattern unless explicitly asked
- Flag conflicting or impossible dates instead of silently "fixing" them
- If adding a new series/layer, use the next available Y-index and a color from the palette

## Highcharts Gantt rules

- Use `Highcharts.ganttChart(containerId, config)` — not `Highcharts.chart()`
- All dates must be UTC timestamps via `Date.UTC()`, never local `new Date().getTime()` for input data
- Use `type: 'gantt'` for series
- `title.text` must be `null` — titles belong in HTML
- `credits.enabled` must be `false`
- Use the standard color palette — do not introduce arbitrary colors
- Use Russian for all user-visible strings
- Add stable `id` values on every data point (needed for plot lines and debugging)
- Use the `defer` attribute on all Highcharts `<script>` tags
- Wait for Highcharts to load before calling `ganttChart()` — use a polling pattern
- Minified source goes to `static.tokenbel.info`; non-minified source stays in `src/tbel/static/js/`
- Use `getHighchartsBurgerExportingOptions(containerId)` for export options; do not write chart-local export menu logic
- Use `getHighchartsFullscreenEvents(containerId, defaultHeight)` for fullscreen events; do not write chart-local fullscreen logic

### Adaptive date labels

Adjust `dateTimeLabelFormats` based on visible range span:

| Span | Day format | Week format | Month format |
|------|-----------|-------------|--------------|
| <= 70 days | `%d.%m.%Y` | `%d.%m.%Y` | `%d.%m.%Y` |
| <= 180 days | `%d.%m` | `%d.%m` | `%m.%Y` |
| > 180 days | `%m.%Y` | `%m.%Y` | `%m.%Y` |

## Handling uncertainty

- **Unknown dates**: do not invent them. If `period_start_date` or `period_end_date` is missing, skip that data point entirely (filter it out with `.filter(Boolean)`)
- **Missing end dates**: do not estimate unless the user asked for a draft
- **Dependencies**: this codebase does not use task dependencies (`after` syntax) — all data is time-period based
- **Status**: payment/period status comes from the API; do not assign status client-side
- **If the chart cannot be created**: set `this.error` to a Russian error message and `this.loading = false`
- **Draft plans**: if the user asks for estimated dates, label them clearly in the chart or tooltip

## Readability rules

- Use concise Russian task names: `Выплата #1`, `Срок эмиссии`, `Период продажи`
- One chart per page section — do not stack multiple Gantt charts in one container
- Keep series count manageable (5 or fewer per chart)
- Use consistent Y-axis labeling across similar chart types
- Provide a brief HTML description above the chart container
- Use `x-cloak` on the section to prevent FOUC
- Use `role="img"` and `aria-label` on the chart container div

## Validation checklist

Before finalizing a Gantt chart:

- [ ] All dates use `Date.UTC()` (not `new Date().getTime()` for input data)
- [ ] Colors match the standard palette
- [ ] All labels are in Russian
- [ ] `title.text` is `null`, `credits.enabled` is `false`
- [ ] Every data point has a stable `id`
- [ ] Today plot line is present with `Сегодня` label
- [ ] Date filter inputs are bound to `xAxis.setExtremes()`
- [ ] Loading and error states are handled in Alpine.js
- [ ] Export menu uses `getHighchartsBurgerExportingOptions(containerId)` from `highcharts_burger_menu.min.js`
- [ ] Fullscreen events use `getHighchartsFullscreenEvents(containerId, defaultHeight)` from `highcharts_burger_menu.min.js`
- [ ] PNG and JPEG exports use white chart and plot backgrounds
- [ ] SVG export uses transparent chart and plot backgrounds
- [ ] Fullscreen uses a white chart background and restores embedded background on exit
- [ ] No chart-local export menu objects, fullscreen handlers, or custom `exportChart()` menu callbacks exist
- [ ] Chart background is `transparent` when embedded
- [ ] `waitForHighcharts()` pattern is used before calling `ganttChart()`
- [ ] Invalid dates are filtered out, not passed to Highcharts
- [ ] Responsive rule exists if the page is mobile-capable
- [ ] No schedule data is invented or estimated silently

## Examples

### Bond events Gantt (2 categories, single entity)

```js
window.initBondEventsGantt = function (data) {
    var admissionTs = toTimestamp(data.admissionDate);
    var maturityTs = toTimestamp(data.maturityDate);
    if (!admissionTs || !maturityTs || maturityTs < admissionTs) return null;

    var paymentPoints = (data.payments || []).map(function (p) {
        var start = toTimestamp(p.period_start_date);
        var end = toTimestamp(p.period_end_date);
        if (!start || !end || end < start) return null;
        return {
            id: 'bond_payment_' + p.coupon_number,
            name: 'Выплата #' + p.coupon_number,
            start: start,
            end: end,
            y: 0,
            color: '#36a2eb',
            description: 'Период выплаты процента',
        };
    }).filter(Boolean);

    var chart = Highcharts.ganttChart('bondEventsGanttChart', {
        chart: { backgroundColor: 'transparent' },
        title: { text: null },
        credits: { enabled: false },
        xAxis: {
            type: 'datetime',
            min: initialRange.min,
            max: initialRange.max,
        },
        yAxis: {
            type: 'category',
            categories: ['Выплаты процента', 'Срок эмиссии'],
        },
        series: [
            { name: 'Выплаты процента', data: paymentPoints, color: '#36a2eb' },
            {
                name: 'Срок эмиссии',
                color: '#2563eb',
                data: [{
                    id: 'bond_lifetime',
                    name: 'Срок эмиссии',
                    start: admissionTs,
                    end: maturityTs,
                    y: 1,
                    color: '#2563eb',
                }],
            },
        ],
    });

    if (chart && chart.xAxis && chart.xAxis[0]) {
        chart.xAxis[0].addPlotLine({
            value: Date.now(),
            color: 'red',
            width: 3,
            label: { text: 'Сегодня' },
            zIndex: 5,
        });
    }
    return chart;
};
```
