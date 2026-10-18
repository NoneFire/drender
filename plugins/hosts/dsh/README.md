# @drender/dsh-drender-plugin

DeepSeek Harness adapter for the independent `md-report/1` renderer. It registers two tools (`md_report_validate` and `md_report_render`) and a runtime Skill named `md-report`.

The reusable, host-neutral Agent Skill source is [`../../../.agents/skills/md-report/SKILL.md`](../../../.agents/skills/md-report/SKILL.md). The workspace build copies it into `lib/skills/md-report/SKILL.md` for DSH runtime registration; do not maintain a second DSH-specific Skill source.

## Requirements

- Node.js 22.13 or newer (for the bundled SQLite dataset adapter without an experimental CLI flag).
- DeepSeek Harness with the public `@deepseek-ai/dsh-tools` and `@deepseek-ai/dsh-skill` services mounted, plus the model-facing `@deepseek-ai/dsh-tool-skill` consumer enabled so the agent can load the bundled Skill.
- A DSH workspace filesystem service for Markdown-declared SQLite files. Without it, reports that declare SQLite sources fail closed; reports using inline snapshots can still render.
- For the clickable sidebar preview, the DSH filesystem service and a Session workspace (`session.header.cwd`) must be available; the Web profile also needs DSH's `ui-tool`, `ui-slots`, `ui-renderer`, and `ui-primitives` modules. The attachment provider is optional. Both storage paths degrade independently; if neither can save the HTML, render returns a bounded Markdown fallback.

The plugin uses DSH's published Cordis, tools, skill, attachment, and client UI contracts. It does not import DSH application files or private packages.

## Install

Build and publish this workspace package together with `@mdreport/renderer-core` and `@mdreport/viewer-theme`, then install the DSH package in the selected profile:

```sh
dsh plugin --profile web add @drender/dsh-drender-plugin
```

For source development, add the plugin row from `cordis.patch.yml` to the profile's patch configuration. Keep its stable `id` as `md-report-dsh`; its `name` must match the installed package name and `src/index.ts` export.

## Tools

- `md_report_validate`: validates required frontmatter, dashboard/panel structure, component specs, dataset references, safe links, and image asset references. Diagnostics include a line number and a report path.
- `md_report_render`: renders a self-contained interactive HTML file with the bundled viewer theme, table-of-contents plugins, and the ECharts, Tabulator, AntV T8, Mermaid, and AntV Infographic runtimes when needed; Excalidraw scenes use the official SVG exporter during report generation. It saves a Session workspace copy for DSH's right-sidebar HTML preview, saves the Markdown source in the workspace, and saves a downloadable HTML attachment when available. Its result card has an **Open right-sidebar preview** action and shows the saved source path. If either HTML storage path is unavailable, the other is still used; only when both are unavailable does it return a bounded Markdown fallback.

The sidebar uses DSH's built-in HTML document preview. Its interactive sandbox follows the host's Coding Tools / interactive-preview setting; when that setting is disabled, DSH presents a safe static preview and report JavaScript such as interactive charts and T8 narratives does not run. The sidebar file and downloadable attachment contain the same rendered HTML.

Both tools accept the host-neutral report envelope as `markdown`, plus optional inline `assets` and `datasets` maps for one-off reports. Markdown may declare one workspace-relative SQLite file in frontmatter and name each dataset or Excalidraw scene using source tables plus either a `.sql` sidecar, a named SQLite view, or a short inline query. Query files and database files are resolved through DSH's filesystem service; paths outside the session workspace are rejected. The adapter opens SQLite read-only, materializes all declared sources in one snapshot, and reads only declared image files before validation/rendering. Query output is capped at 5,000 rows per dataset, query files at 100 KB, image inputs at 8 MB total, and the renderer applies its 1 MB snapshot limit. After a successful render, the adapter saves the input Markdown under a call-scoped name in the session workspace and returns that path. Preserve its declared database, `.sql` files, and images with the Markdown when archiving or moving a report. Inline data supplied in tool arguments is not saved into Markdown and produces a portability warning; use declared source files for reusable reports. Exported HTML embeds the resulting data and images and does not require those source files at view time. CSV helpers remain available for one-off imports and static snapshots.

## Component coverage

Standard Markdown with generated TOCs, callouts, 12-column full-screen dashboard panels, literal or SQLite-backed KPI cards, interactive ECharts charts, sortable virtualized Tabulator data tables with horizontal and vertical scrolling, SQL formatted by `sql-formatter`, official Mermaid diagrams, AntV Infographic templates, official Excalidraw SVG exports, AntV T8 narratives, split columns, foldable details, and declared raster assets are supported. Chart, table, and Excalidraw data comes from a declared SQLite query or an explicit inline snapshot. A KPI can bind its value, change, and period to fields in a single-row SQLite summary query, so those indicators update whenever the report is rendered. ECharts, Tabulator, T8, Mermaid, and AntV Infographic runtimes are embedded in exports when referenced; Excalidraw scenes are converted to official static SVG during rendering. All visual components work offline.

HTML includes all CSS, required open-source visualization runtimes, and referenced asset bytes, uses a restrictive hash-based Content Security Policy, and runs only bundled library runtimes and renderer initializers. It is an offline snapshot and does not protect embedded report data from inspection.
