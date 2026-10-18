# drender

An open-source renderer for the **`md-report/1`** format: a Markdown document plus declared SQLite/CSV datasets becomes a single, offline, interactive HTML report or dashboard.

The viewer theme and DSH adapter live in this workspace and consume only this project's packages plus DSH's published extension APIs.

## Workspace packages

- `@mdreport/viewer-theme` — accessible report styles and a full-screen dark dashboard theme.
- `@mdreport/renderer-core` — constrained YAML frontmatter, Markdown-It parsing with open-source heading anchors and table-of-contents plugins, safe links and image assets, diagnostics, dashboard containers, interactive ECharts charts, full Mermaid diagrams, AntV Infographic templates, official Excalidraw SVG export, AntV T8 narratives, virtualized Tabulator data tables, rendered KPI cards, SQL details, and self-contained HTML output.
- `@mdreport/data-sources` — CSV and read-only SQLite adapters that normalize datasets and Excalidraw scenes into renderer snapshots.
- `@drender/dsh-drender-plugin` — DeepSeek Harness `md_report_validate` / `md_report_render` tools, a runtime `md-report` Skill, and re-exports for the CSV/SQLite host adapters.

The host-neutral Agent Skill lives at [`.agents/skills/md-report/SKILL.md`](.agents/skills/md-report/SKILL.md), outside any host adapter so project agents can share it. The DSH package bundles a build-generated copy of that same source for runtime registration; edit only the shared Skill.

The renderer supports ordinary Markdown, automatic clickable tables of contents for reports with two or more H2–H4 headings, note/warning/success callouts, flat 12-column full-screen dashboard panels, frontmatter metric definitions referenced from prose, cards, charts, and tables, literal or SQLite-backed KPI cards, interactive line/bar/column/area/scatter/pie/funnel/combo/waterfall/candlestick/boxplot/heatmap/sankey/treemap/radar/gauge/map charts from declared datasets, ranked bar lists, cross-tabulated pivots, severity-coded findings, metric-definition and dataset-quality appendices, sortable virtualized data tables with two-axis scrolling and CSV/clipboard export, SQL formatted by `sql-formatter`, official Mermaid diagrams, AntV Infographic DSL and templates, official Excalidraw scene export, AntV T8 narratives, foldable details, split columns, and declared PNG/JPEG/WebP/GIF image assets. The TOC uses `markdown-it-anchor` and `markdown-it-toc-done-right`; charts use Apache ECharts; diagrams use Mermaid, AntV Infographic, and `@excalidraw/utils`; T8 syntax uses the official `@antv/t8` runtime. KPI queries return one summary row, with fields bound by each KPI item's `dataRef` and `field`; optional `changeField` and `periodField` bind the change and period from that same row. Each Markdown file that uses SQLite names a workspace-relative database path and declares datasets and Excalidraw scenes using a sidecar `.sql` file, a SQLite view, or a short inline query. Query files and database paths are resolved inside the active DSH workspace; optional image paths are also workspace-relative and declared under frontmatter `assets`. Mermaid and Infographic runtimes are embedded only when used, and Excalidraw scenes are exported to static SVG before HTML is produced; the resulting HTML works offline without CDN requests.

Named metrics are declared once under frontmatter `metrics` and rendered through `{{metric_id}}` tokens or component `metricRef`/`formatRef` references, so a single business number cannot have two values. Charts accept annotation layers (`targets`, `bands`, `points`) and stable `anchor` ids that `findings.evidence` can link to. Presentation keys (`eyebrow`, `deck`, `status`, `footer`, `toc`, `theme`) control the reader-facing chrome. Component specs and fence info strings are checked against an authoritative key table, so an unknown key or fence attribute is a hard error instead of a silently dropped field.

## Build

Requires Node.js 22+ and pnpm 11+ to build the workspace. SQLite source adapters require Node.js 22.13+.

```sh
pnpm install
pnpm build
node examples/render-examples.mjs
```

The examples command refreshes `examples/data/report-data.sqlite` from deterministic sample rows and renders the four Markdown examples that declare it: `examples/dashboard.md`, `examples/analysis-report.md`, `examples/data-table-1000.md`, and `examples/template-gallery.md`. `examples/data-table-1000.md` is a 1000-row, 15-column Tabulator table with a frozen order-number column, sortable headers, and independent horizontal and vertical scrollbars.

The same command verifies the examples as documentation. Every ` ```sql ` fence with `dialect=sqlite` is executed read-only against that example's declared database, and the run fails if a query errors or returns no rows, so a quoted check query cannot drift from the data it claims to verify. The script closes by printing the examples it did not regenerate (`stock-dashboard`, `data-source-csv`, `data-source-sqlite`) with the command that owns each one, so a partial run is never mistaken for a full one.

The DSH adapter is compiled against DSH's published `0.2.1-alpha.5` tool, skill, and attachment contracts. For a profile to mount it, `tools` and `skills` services must be available; the `dsh-tool-skill` consumer must also be enabled for the agent to load the bundled Skill. HTML exports are saved with `ctx.attachments.saveFile` when that public service is available; otherwise the tool returns Markdown source as a bounded fallback.

## Stock data-source example

`node examples/sync-stock-example.mjs` fetches AAPL.US daily end-of-day bars from EOD Historical Data (EODHD), upserts them into the stock dashboard's SQLite file, and renders `examples/stock-dashboard.md` plus its standalone interactive HTML. The default EODHD demo token is limited to sample symbols; use your own token for other symbols:

```sh
EODHD_API_TOKEN=your-token STOCK_SYMBOL=MSFT.US node examples/sync-stock-example.mjs
```

The example refreshes a snapshot after 18 hours, or immediately with `--force`. `--offline` renders from the existing SQLite cache without a network request. `STOCK_CACHE_TTL_HOURS` and `STOCK_LOOKBACK_DAYS` tune the cache window and overlapping fetch range. Schedule the command after the relevant exchange's close if the dashboard should be refreshed automatically; it is a pull-on-render example, not a background service.

Bars use `(provider, symbol, interval, trade_date)` as their primary key. Every refresh re-fetches an overlapping date range and uses SQLite UPSERT, so reruns do not duplicate sessions and can correct recent bars. The generated Markdown records the database path and source tables and references reusable SQL files under `examples/queries`; DSH resolves those files through its workspace filesystem service. The renderer and exported HTML never query SQLite or the market-data API. Keep API credentials in environment variables. Node's built-in SQLite support is still marked as active development in Node 22, so this adapter keeps the example dependency-free but should be revisited before treating that driver as a long-lived production contract.

## CSV and SQLite source adapters

For report-owned data, frontmatter explicitly maps `dataRef` and `sceneRef` IDs to one workspace-relative SQLite path and a source table for SQL queries or a named SQLite view. Each source uses a `.sql` file, view, or read-only inline query. The DSH adapter resolves database and query file paths from frontmatter inside the active session workspace before calling the renderer. Raster images can be declared in the same frontmatter under `assets`, each with a workspace-relative file path and MIME type; exported HTML embeds the image bytes. External hosts can use the same loader or pass materialized snapshots and image bytes directly. CSV remains a convenient source for one-off imports:

```js
import { loadSqliteDataset, readCsvDataset } from '@mdreport/data-sources';

const datasets = {
  daily_bars: loadSqliteDataset({
    databasePath: './market.sqlite',
    sql: 'SELECT trade_date, close FROM stock_bars WHERE symbol = ? ORDER BY trade_date',
    parameters: ['AAPL.US'],
    columns: [{ name: 'trade_date', type: 'date' }, { name: 'close', type: 'number', unit: 'USD' }],
    source: 'Local market cache',
    updatedAt: '2026-10-16',
  }),
  imported_file: await readCsvDataset('./imports/data.csv', {
    columns: [{ name: 'trade_date', type: 'date' }, { name: 'close', type: 'number' }],
    source: 'Uploaded CSV',
  }),
};
```

Use SQLite for recurring data, incremental UPSERTs, history, indexes, joins, and repeatable queries. Use CSV for one-off imports, handoff, quick inspection, or a small static file. Both produce the same dataset contract; only sources explicitly declared in frontmatter are materialized by a host-side read-only loader. The browser never opens SQLite. The exported HTML embeds a snapshot. Updating the source requires rendering again. The renderer limits a report's declared snapshots to 1 MB and each dataset source to 5,000 rows; SQLite does not turn the offline HTML into a live database viewer.

Run `node examples/compare-csv-sqlite-sources.mjs` to generate equivalent 1,000-row CSV and SQLite snapshots, verify they normalize to the same columns and values, and render the same dashboard from each source as `examples/data-source-csv.html` and `examples/data-source-sqlite.html`.

## Global font size

The exported page defaults to a 14 px base font size. Set the renderer option to scale report/dashboard text, Tabulator text, and ECharts labels consistently; valid values are 12–20 px:

```js
const result = await renderReport(document, { fontSize: 14 });
```

`renderReport` is asynchronous because Excalidraw scenes are exported with the official `@excalidraw/utils` renderer before the standalone HTML is returned. The theme keeps its smallest text legible at any allowed base size: micro labels, auxiliary text, and KPI labels are `max()`-guarded so a 12 px base never renders them below 10.5 px, 11.5 px, and 12 px respectively.

The DSH `md_report_render` tool accepts the same optional `fontSize` argument. The frontmatter stays focused on report content and does not need a visual-size setting.
The example generator also accepts `--font-size=14` or `MDREPORT_FONT_SIZE=14`:

```sh
node examples/render-examples.mjs --font-size=14
```

## Report envelope

The transport object contains the source Markdown and optional data/resource maps. Format metadata lives only in the required frontmatter:

```yaml
---
format: md-report/1
mode: report
title: Monthly operating review
sqlite:
  path: data/monthly-review.sqlite
  datasets:
    monthly_revenue:
      table: monthly_revenue
      queryFile: queries/monthly-revenue.sql
---
```

The `.sql` file contains the read-only `SELECT`/`WITH`/`VALUES` statement. Bind values such as `symbol` or date ranges with `parameters` in the frontmatter. Use `view: monthly_revenue_report` when the database already contains a reusable SQLite view. A short one-off query can stay inline as `query: SELECT ...`; each source must declare exactly one of `queryFile`, `view`, or `query`.

The HTML renderer disables raw HTML, rejects unsafe links, only embeds declared raster assets, and executes no user-provided script. SQL in body fences is display-only; declared inline queries, query files, and SQLite views are read-only in the host before rendering. The HTML includes CSS, required ECharts, Tabulator, T8, Mermaid, and AntV Infographic runtimes, dataset snapshots, static Excalidraw SVGs, and referenced image bytes for offline use. A strict Content Security Policy permits only the renderer's hash-pinned library runtimes and initializers.

## Declared metrics

Frontmatter `metrics` declares each business number once; components and prose then reference it. A metric ID must match `[A-Za-z][A-Za-z0-9._-]{0,127}`. A metric takes either a literal `value` or a `dataRef` + `field` binding, never both, and the binding reads the first row of that dataset:

```yaml
metrics:
  oct_revenue:
    label: October revenue
    dataRef: summary
    field: revenue_total
    format: currency
    currency: CNY
    compact: true
    goodDirection: up
    comparison:
      kind: mom
      dataRef: summary
      field: revenue_prev
      period: MoM
    definition: Paid order amount for the month
    numerator: Paid order amount
    denominator: Total monthly revenue
    source: transactions.regional_revenue
    asOf: '2026-10-31'
    owner: Analytics
```

| Metric key | Type | Meaning |
| --- | --- | --- |
| `label` | string | Display name; defaults to the metric ID. |
| `value` | finite number or string | Literal value. Mutually exclusive with `dataRef`/`field`. |
| `dataRef` + `field` | dataset ID + column | Read the value from the first row of a materialized dataset. |
| `format` | `number`, `currency`, `percent`, `percentage-points`, `ratio`, `date`, `text` | Display format. |
| `currency` | three-letter ISO 4217 code | Currency for `format: currency`; defaults to `CNY`. |
| `decimals` | integer 0–6 | Fraction digits; format-specific defaults apply (percent and percentage points 1, currency 0 or 1 when compact, ratio 2). |
| `unit` | string | Appended to the value; CJK units render without a space. |
| `compact` | boolean | Compact notation: `1007000` renders as `100.7万`. |
| `scale` | finite number | Multiplies the value before display. |
| `goodDirection` | `up`, `down`, `neutral` | Which sign counts as good; `down` makes a falling refund rate read as positive. |
| `comparison` | mapping | Baseline and period; see below. |
| `definition`, `numerator`, `denominator`, `source`, `asOf`, `owner` | string | Reader-facing provenance, rendered by the `provenance` component. |

`comparison` accepts `kind` (`mom`, `yoy`, `target`, `none`), either a literal `value` or a `dataRef` + `field` baseline, `asPercent`, `pointsDelta`, and `period`. The change is a ratio (`value / baseline − 1`) rendered as a percentage by default; `pointsDelta: true` switches to an absolute difference in percentage points and renders `pp`, which is the correct reading for a share or rate that moved. The period label defaults to `环比`, `同比`, or `较目标` for `mom`, `yoy`, and `target`. `asPercent` is accepted; a ratio is already the default, so `pointsDelta` is the key that changes the comparison math. Declared shares that name the same `denominator` string must sum to 1 within ±0.005, or validation fails with `metric.share-sum`.

`format: percent` renders the ratio itself, and `format: percentage-points` renders the difference and appends `pp`. Body prose resolves `{{metric_id}}` to the formatted value with its unit, and the same substitution runs inside `antv-t8`, `infographic`, and `mermaid` fences. An unresolved token is an error, and an `antv-t8` narrative that references no token only warns that its numbers are hard-coded.

## Charts, components, and references

`kpi` items accept a `metricRef` plus an optional `label`; a `metricRef` must not be combined with `value`, `dataRef`, `field`, or `changeField`. `chart` and `ranking` also accept `metricRef`, and `data-table` columns accept `formatRef`, which names a declared metric. A table column `format` accepts `currency:CNY` (or another ISO code), `percent`, `percentage-points`, `compact`, and `number`. `kpi` items additionally accept `sparkline`, `{"dataRef","x","y","title"}`, which draws an inline SVG trend inside the card. `exportable` on `data-table` defaults to true and renders 导出 CSV and 复制表格 buttons that write into a polite live region; `exportable: false` hides them.

The new components each answer one question, and the examples show working syntax for every one:

| Component | Question it answers | Minimal shape |
| --- | --- | --- |
| `ranking` | Who leads, without needing an axis? | `{"dataRef":"regional_revenue","x":"region","y":"revenue","limit":5}` — `limit` is 1–50 (default 10), `share` toggles the percentage. |
| `pivot` | How do two categories cross? | `{"dataRef":"region_month","rows":"region","columns":"month","value":"revenue","agg":"sum","columnTotal":true}` — `agg` is `sum`, `avg`, `min`, `max`, `count`, or `first`. |
| `findings` | What should the reader act on? | `{"items":[{"severity":"risk","title":"...","detail":"...","metricRef":"oct_revenue","evidence":["revenue-trend"],"action":"...","owner":"..."}]}` — `severity` is `risk`, `opportunity`, `info`, or `positive`. |
| `provenance` | Where does each number come from? | `{"title":"Metric definitions"}` — omitting `items` lists every declared metric. |
| `quality` | Is the dataset complete and fresh? | `{"dataRefs":["summary","regional_revenue"],"notes":["..."]}` — rows, columns, missing values, source, and as-of are computed. |

`chart` supports `line`, `bar`, `column`, `area`, `scatter`, and `pie`, plus `funnel`, `combo`, `waterfall`, `candlestick`, `boxplot`, `heatmap`, `sankey`, `treemap`, `radar`, `gauge`, and `map`. A `combo` chart declares 1–6 `series` entries (`field`, `type` of `line`/`bar`/`area`, `axis` 0 or 1, `name`, `stack`, `format`, `decimals`, `compact`). `waterfall` marks total rows with `totalField`; `candlestick` takes `open`/`high`/`low`/`close` and an optional `volume`; `boxplot` computes quantiles in the browser; `heatmap` takes `x`, `y`, and `value`; `sankey` takes `source`, `target`, and `y`; `gauge` takes `y` or `value` with `min` and `max`; `map` takes `name`, `value`, and an inline GeoJSON `geo` object. The geometry travels with the document, which is what keeps the export offline — a real deployment supplies its own GeoJSON instead of the placeholder polygons in the gallery example.

Cartesian, `combo`, and `waterfall` charts also accept annotation layers: `targets` (up to 20 × `value`, `label`, `axis`, `color`), `bands` (up to 20 × `from`, `to`, `axis`, `label`), and `points` (up to 20 × `x`, `y`, `text`).

`anchor` on `chart`, a `kpi` item, `data-table`, `ranking`, `pivot`, `findings`, `provenance`, and `quality` gives a stable in-page id. `findings.evidence` lists those ids, so a finding links to the exact chart that proves it. A chart container is 250 px tall in report mode; inside a dashboard panel the chart fills the panel instead.

## Presentation frontmatter

`eyebrow`, `deck`, `status`, and `footer` are reader-facing text of at most 200 characters each and are omitted when empty; `eyebrow` falls back to a built-in label. `status` renders in the dashboard top bar. `toc` is `auto`, `open`, or `collapsed`: `auto` (the default) expands the table of contents at 900 px and wider and collapses it on narrow screens through a hash-pinned inline script. `theme` is `auto`, `light`, or `dark`: `auto` follows the reader's system and renders an in-page toggle whose choice persists in `localStorage`. A dashboard is always dark and does not render the toggle.

## Strict component validation

Every component spec is checked against an authoritative allowed-key table for `kpi` (and its items), `chart` (and `axisFormat`, `series`, `targets`, `bands`, `points`), `data-table` (and its columns and `defaultSort`), `ranking`, `pivot`, `findings`, `provenance`, `quality`, and the `excalidraw` `sceneRef` form. Any other key is rejected with `component.unknown-key`. Unknown fence attributes are rejected too; the accepted attributes are `dialect=`, `title="..."`, `kicker="..."`, and `engine`. This is a deliberate safety change: a typo can no longer silently drop a field.

## License

MIT — see [LICENSE](LICENSE).
