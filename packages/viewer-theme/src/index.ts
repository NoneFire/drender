/** Self-contained visual system used by every md-report HTML export. */
export const viewerThemeCss = String.raw`
:root {
  color-scheme: light;
  --mdr-bg: #f4f6f8;
  --mdr-surface: #ffffff;
  --mdr-surface-muted: #f7f9fb;
  --mdr-ink: #17232f;
  --mdr-ink-muted: #586979;
  --mdr-ink-faint: #7b8996;
  --mdr-line: #e2e8ee;
  --mdr-line-strong: #cbd5df;
  --mdr-accent: #126a62;
  --mdr-accent-soft: #e5f3ef;
  --mdr-warning: #9b5b12;
  --mdr-warning-soft: #fff4df;
  --mdr-success: #18704b;
  --mdr-success-soft: #e8f5ed;
  --mdr-danger: #ad433b;
  --mdr-danger-soft: #fff0ed;
  --mdr-code-bg: #17232f;
  --mdr-code-ink: #e7edf2;
  --mdr-shadow: 0 18px 48px rgb(24 41 55 / 7%);
  --mdr-radius: 14px;
  /* Text floors are max()-guarded so a 12px report font never drops below readability. */
  --mdr-text-micro: max(0.6875rem, 10.5px);
  --mdr-text-aux: max(0.75rem, 11.5px);
  --mdr-text-label: max(0.8125rem, 12px);
  --mdr-font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mdr-font-serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
}

@media (prefers-color-scheme: dark) {
  [data-theme="auto"] {
    color-scheme: dark;
    --mdr-bg: #10171d;
    --mdr-surface: #172129;
    --mdr-surface-muted: #1c2933;
    --mdr-ink: #e8eef2;
    --mdr-ink-muted: #b2c0ca;
    --mdr-ink-faint: #899aa7;
    --mdr-line: #2c3a45;
    --mdr-line-strong: #43525e;
    --mdr-accent: #75cabb;
    --mdr-accent-soft: #1a3938;
    --mdr-warning: #e8b866;
    --mdr-warning-soft: #3d3020;
    --mdr-success: #81d2a8;
    --mdr-success-soft: #1d382d;
    --mdr-danger: #f09a8e;
    --mdr-danger-soft: #402725;
    --mdr-code-bg: #0c1217;
    --mdr-code-ink: #e7edf2;
    --mdr-shadow: 0 18px 48px rgb(0 0 0 / 22%);
  }
}

[data-theme="dark"] {
  color-scheme: dark;
  --mdr-bg: #10171d;
  --mdr-surface: #172129;
  --mdr-surface-muted: #1c2933;
  --mdr-ink: #e8eef2;
  --mdr-ink-muted: #b2c0ca;
  --mdr-ink-faint: #899aa7;
  --mdr-line: #2c3a45;
  --mdr-line-strong: #43525e;
  --mdr-accent: #75cabb;
  --mdr-accent-soft: #1a3938;
  --mdr-warning: #e8b866;
  --mdr-warning-soft: #3d3020;
  --mdr-success: #81d2a8;
  --mdr-success-soft: #1d382d;
  --mdr-danger: #f09a8e;
  --mdr-danger-soft: #402725;
  --mdr-code-bg: #0c1217;
  --mdr-code-ink: #e7edf2;
  --mdr-shadow: 0 18px 48px rgb(0 0 0 / 22%);
}

* { box-sizing: border-box; }
html { min-width: 320px; background: var(--mdr-bg); font-size: 14px; }
body {
  margin: 0;
  color: var(--mdr-ink);
  background: var(--mdr-bg);
  font-family: var(--mdr-font-sans);
  font-size: 1rem;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: var(--mdr-accent); text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { text-decoration-thickness: 2px; }
a:focus-visible, summary:focus-visible { outline: 3px solid var(--mdr-accent); outline-offset: 3px; border-radius: 4px; }
.mdr-shell { width: min(100% - 32px, 1120px); margin: 40px auto 64px; }
.mdr-report-layout { display: grid; grid-template-columns: 208px minmax(0, 1fr); align-items: start; gap: 18px; margin-top: 22px; }
.mdr-report-layout--without-toc { display: block; }
.mdr-report-layout > .mdr-content { min-width: 0; margin-top: 0; }
.mdr-toc { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow: hidden; border: 1px solid var(--mdr-line); border-radius: 10px; background: var(--mdr-surface); box-shadow: var(--mdr-shadow); }
.mdr-toc > summary { display: flex; align-items: center; gap: 8px; padding: 12px 14px; color: var(--mdr-ink); cursor: pointer; font-size: 0.8125rem; font-weight: 750; list-style: none; }
.mdr-toc > summary::-webkit-details-marker { display: none; }
.mdr-toc > summary::before { color: var(--mdr-accent); content: "☷"; font-size: 1rem; }
.mdr-toc nav { max-height: calc(100vh - 84px); overflow: auto; padding: 0 10px 10px; }
.mdr-toc ol, .mdr-toc ul { display: grid; gap: 2px; padding: 0; margin: 0; list-style: none; }
.mdr-toc li ol, .mdr-toc li ul { padding-left: 10px; }
.mdr-toc li { min-width: 0; margin: 0; padding: 0; }
.mdr-toc a { display: block; overflow: hidden; padding: 6px 8px; border-radius: 6px; color: var(--mdr-ink-muted); font-size: var(--mdr-text-aux); line-height: 1.45; text-decoration: none; text-overflow: ellipsis; }
.mdr-toc a:hover { background: var(--mdr-accent-soft); color: var(--mdr-accent); }
.mdr-header {
  position: relative;
  overflow: hidden;
  padding: clamp(28px, 5vw, 56px);
  border: 1px solid var(--mdr-line);
  border-radius: calc(var(--mdr-radius) + 4px);
  background: var(--mdr-surface);
  box-shadow: var(--mdr-shadow);
}
.mdr-header::before { position: absolute; inset: 0 0 auto; height: 4px; background: var(--mdr-accent); content: ""; }
.mdr-eyebrow { display: flex; align-items: center; gap: 10px; color: var(--mdr-ink-faint); font-size: var(--mdr-text-micro); font-weight: 750; letter-spacing: .16em; text-transform: uppercase; }
.mdr-eyebrow::before { width: 8px; height: 8px; border-radius: 50%; background: var(--mdr-accent); content: ""; }
.mdr-mode { padding: 4px 9px; border: 1px solid var(--mdr-line); border-radius: 999px; color: var(--mdr-ink-muted); font-size: var(--mdr-text-micro); letter-spacing: .08em; }
.mdr-title { max-width: 820px; margin: 21px 0 0; font-family: var(--mdr-font-serif); font-size: clamp(2.125rem, 6vw, 3.75rem); font-weight: 500; letter-spacing: -.04em; line-height: 1.08; }
.mdr-deck { margin: 18px 0 0; color: var(--mdr-ink-muted); font-size: 0.875rem; }
.mdr-content {
  margin-top: 22px;
  padding: clamp(24px, 5vw, 60px);
  border: 1px solid var(--mdr-line);
  border-radius: var(--mdr-radius);
  background: var(--mdr-surface);
  box-shadow: var(--mdr-shadow);
}
.mdr-content > :first-child { margin-top: 0; }
.mdr-content > :last-child { margin-bottom: 0; }
.mdr-content h1, .mdr-content h2, .mdr-content h3, .mdr-content h4 { color: var(--mdr-ink); line-height: 1.25; }
.mdr-content h1[id], .mdr-content h2[id], .mdr-content h3[id], .mdr-content h4[id] { scroll-margin-top: 18px; }
.mdr-content h1 { margin: 2.2em 0 .8em; font-family: var(--mdr-font-serif); font-size: clamp(1.875rem, 4vw, 2.625rem); font-weight: 500; letter-spacing: -.025em; }
.mdr-content h2 { margin: 2.2em 0 .8em; padding-bottom: .42em; border-bottom: 1px solid var(--mdr-line); font-family: var(--mdr-font-serif); font-size: clamp(1.5625rem, 3vw, 2rem); font-weight: 500; letter-spacing: -.02em; }
.mdr-content h3 { margin: 1.8em 0 .6em; font-size: 1.1875rem; font-weight: 700; }
.mdr-content h4 { margin: 1.5em 0 .5em; font-size: 0.9375rem; font-weight: 750; }
.mdr-content p { margin: 1em 0; }
.mdr-content strong { font-weight: 750; }
.mdr-content hr { height: 1px; margin: 2.5em 0; border: 0; background: var(--mdr-line); }
.mdr-content blockquote { margin: 1.5em 0; padding: 4px 0 4px 20px; border-left: 3px solid var(--mdr-accent); color: var(--mdr-ink-muted); }
.mdr-content blockquote > :first-child { margin-top: 0; }
.mdr-content blockquote > :last-child { margin-bottom: 0; }
.mdr-content ul, .mdr-content ol { padding-left: 1.5em; }
.mdr-content li { padding-left: .2em; margin: .28em 0; }
.mdr-content li::marker { color: var(--mdr-accent); }
.mdr-content img { display: block; max-width: 100%; height: auto; margin: 1.5em auto; border-radius: 10px; }
.mdr-content table { width: 100%; margin: 1.5em 0; border-collapse: collapse; font-size: 0.875rem; }
.mdr-content th, .mdr-content td { padding: 10px 13px; border: 1px solid var(--mdr-line); text-align: left; vertical-align: top; }
.mdr-content th { background: var(--mdr-surface-muted); font-size: 0.75rem; font-weight: 750; }
.mdr-content tr:nth-child(even) td { background: color-mix(in srgb, var(--mdr-surface-muted) 60%, transparent); }
.mdr-content :not(pre) > code { padding: .16em .42em; border: 1px solid var(--mdr-line); border-radius: 5px; background: var(--mdr-surface-muted); color: var(--mdr-ink); font-size: .88em; }
.mdr-content pre { overflow: auto; margin: 1.4em 0; padding: 20px 22px; border: 1px solid #273946; border-radius: 10px; background: var(--mdr-code-bg); color: var(--mdr-code-ink); font-size: 0.8125rem; line-height: 1.65; tab-size: 2; }
.mdr-content pre code { padding: 0; border: 0; background: none; color: inherit; font: inherit; }
.mdr-content .mdr-callout { margin: 1.35em 0; padding: 16px 19px; border: 1px solid var(--mdr-line); border-left: 4px solid var(--mdr-accent); border-radius: 8px; background: var(--mdr-accent-soft); }
.mdr-content .mdr-callout--warning { border-left-color: var(--mdr-warning); background: var(--mdr-warning-soft); }
.mdr-content .mdr-callout--success { border-left-color: var(--mdr-success); background: var(--mdr-success-soft); }
.mdr-content .mdr-callout > :first-child { margin-top: 0; }
.mdr-content .mdr-callout > :last-child { margin-bottom: 0; }
.mdr-content .mdr-dashboard { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; margin: 1.6em 0; }
.mdr-content .mdr-panel { min-width: 0; padding: 20px; border: 1px solid var(--mdr-line); border-radius: 12px; background: var(--mdr-surface-muted); }
.mdr-content .mdr-panel--span-1 { grid-column: span 1; }
.mdr-content .mdr-panel--span-2 { grid-column: span 2; }
.mdr-content .mdr-panel--span-3 { grid-column: span 3; }
.mdr-content .mdr-panel--span-4 { grid-column: span 4; }
.mdr-content .mdr-panel--span-5 { grid-column: span 5; }
.mdr-content .mdr-panel--span-6 { grid-column: span 6; }
.mdr-content .mdr-panel--span-7 { grid-column: span 7; }
.mdr-content .mdr-panel--span-8 { grid-column: span 8; }
.mdr-content .mdr-panel--span-9 { grid-column: span 9; }
.mdr-content .mdr-panel--span-10 { grid-column: span 10; }
.mdr-content .mdr-panel--span-11 { grid-column: span 11; }
.mdr-content .mdr-panel--span-12 { grid-column: span 12; }
.mdr-content .mdr-panel > :first-child { margin-top: 0; }
.mdr-content .mdr-panel > :last-child { margin-bottom: 0; }
.mdr-content .mdr-component { min-width: 0; margin: 0; padding: 18px; border: 1px solid var(--mdr-line); border-radius: 11px; background: var(--mdr-surface); }
.mdr-content .mdr-component-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.mdr-content .mdr-chart { padding: 14px; }
body.mdr-report-page .mdr-content .mdr-chart { margin: 1.25em 0; padding: 14px 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.mdr-content .mdr-chart .mdr-component-heading { margin-bottom: 8px; }
.mdr-content .mdr-component-heading h3 { margin: 2px 0 0; font-size: 1rem; line-height: 1.35; }
.mdr-content .mdr-component-kicker { color: var(--mdr-ink-faint); font-size: var(--mdr-text-micro); font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.mdr-content .mdr-component-meta { flex: 0 0 auto; align-self: center; color: var(--mdr-ink-faint); font-size: var(--mdr-text-aux); white-space: nowrap; }
.mdr-content .mdr-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.mdr-content .mdr-kpi-card { min-width: 0; padding: 15px; border: 1px solid var(--mdr-line); border-radius: 9px; background: var(--mdr-surface-muted); }
.mdr-content .mdr-kpi-label { color: var(--mdr-ink-muted); font-size: var(--mdr-text-label); font-weight: 650; }
.mdr-content .mdr-kpi-value { display: flex; align-items: baseline; gap: 5px; margin-top: 7px; font-size: clamp(1.375rem, 3vw, 1.875rem); font-weight: 760; letter-spacing: -.04em; line-height: 1.2; overflow-wrap: anywhere; }
.mdr-content .mdr-kpi-value span { color: var(--mdr-ink-muted); font-size: 0.75rem; font-weight: 550; letter-spacing: 0; }
.mdr-content .mdr-kpi-meta { display: flex; align-items: center; gap: 8px; margin-top: 9px; color: var(--mdr-ink-faint); font-size: var(--mdr-text-aux); }
.mdr-content .mdr-kpi-change { padding: 2px 7px; border-radius: 999px; background: var(--mdr-surface); font-weight: 750; }
.mdr-content .mdr-kpi-change--positive { color: var(--mdr-success); }
.mdr-content .mdr-kpi-change--negative { color: var(--mdr-danger); }
.mdr-content .mdr-kpi-change--neutral { color: var(--mdr-ink-muted); }
.mdr-content .mdr-mermaid-host, .mdr-content .mdr-excalidraw-host { overflow-x: auto; }
.mdr-content .mdr-echart { width: 100%; height: 250px; min-height: 180px; }
.mdr-content .mdr-chart-note { margin: 3px 0 0; color: var(--mdr-ink-faint); font-size: var(--mdr-text-aux); }
.mdr-content .mdr-table-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 10px; margin: -5px 0 9px; color: var(--mdr-ink-faint); font-size: var(--mdr-text-aux); }
.mdr-content .mdr-tabulator-host { width: 100%; max-width: 100%; min-height: 160px; overflow: hidden; border: 1px solid var(--mdr-line); border-radius: 8px; background: var(--mdr-surface); }
.mdr-content .mdr-tabulator-host > .mdr-tabulator { width: 100%; height: 100%; }
.mdr-content .mdr-tabulator-host .tabulator { width: 100%; border: 0; background: var(--mdr-surface); color: var(--mdr-ink); font-family: var(--mdr-font-sans); font-size: 0.75rem; }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-header,
.mdr-content .mdr-tabulator-host .tabulator .tabulator-header .tabulator-col { border-color: var(--mdr-line); background: var(--mdr-surface-muted); color: var(--mdr-ink); }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-header { border-bottom: 1px solid var(--mdr-line-strong); }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-header .tabulator-col { font-weight: 700; }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-col .tabulator-col-content { padding: 9px 10px; }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-tableholder { background: var(--mdr-surface); }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-row { border-bottom: 1px solid var(--mdr-line); background: var(--mdr-surface); color: var(--mdr-ink); }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-row.tabulator-row-even { background: color-mix(in srgb, var(--mdr-surface-muted) 66%, transparent); }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-row:hover { background: var(--mdr-accent-soft); }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-cell { border-right: 1px solid var(--mdr-line); padding: 8px 10px; font-variant-numeric: tabular-nums; }
.mdr-content .mdr-tabulator-host .tabulator .tabulator-placeholder { background: var(--mdr-surface); color: var(--mdr-ink-faint); }
.mdr-content .mdr-table-noscript { margin: 10px 0 0; color: var(--mdr-ink-faint); font-size: 0.75rem; }
.mdr-content .mdr-sql { overflow: hidden; padding: 0; }
.mdr-content .mdr-sql > summary { display: flex; align-items: center; gap: 10px; padding: 13px 16px; cursor: pointer; list-style: none; }
.mdr-content .mdr-sql > summary::-webkit-details-marker { display: none; }
.mdr-content .mdr-sql > summary::after { margin-left: auto; color: var(--mdr-accent); content: "展开"; font-size: 0.6875rem; font-weight: 700; }
.mdr-content .mdr-sql[open] > summary::after { content: "收起"; }
.mdr-content .mdr-sql-summary { font-size: 0.8125rem; font-weight: 750; }
.mdr-content .mdr-sql-meta { color: var(--mdr-ink-faint); font-size: var(--mdr-text-aux); }
.mdr-content .mdr-sql pre { overflow: auto; max-height: 520px; margin: 0; border: 0; border-radius: 0; }
.mdr-content .mdr-mermaid-host > svg { display: block; width: 100%; height: auto; min-width: 500px; margin-inline: auto; }
.mdr-content .mdr-infographic-host { min-height: 150px; overflow-x: auto; }
.mdr-content .mdr-infographic-host > svg { display: block; max-width: 100%; height: auto; margin-inline: auto; }
.mdr-content .mdr-component-error { overflow: auto; max-height: 420px; margin: 0; padding: 12px; border-radius: 8px; background: var(--mdr-surface-muted); color: var(--mdr-danger); font-size: 0.75rem; white-space: pre-wrap; }
.mdr-content .mdr-t8-host { min-width: 0; font-size: .9em; line-height: 1.55; }
.mdr-content .mdr-t8-host a { overflow-wrap: anywhere; }
.mdr-content .mdr-t8-fallback { overflow: auto; padding: 12px; border-radius: 8px; background: var(--mdr-surface-muted); white-space: pre-wrap; }
.mdr-content .mdr-excalidraw-host { display: grid; place-items: center; padding: 6px; }
/* Natural size, never upscaled: the scene's own dimensions decide the scale. */
.mdr-content .mdr-excalidraw-svg { display: block; max-width: 100%; height: auto; margin-inline: auto; background-color: var(--mdr-surface-muted); }
/* --- ranking ------------------------------------------------------------- */
.mdr-content .mdr-ranking-list { display: grid; gap: 6px; padding: 0; margin: 0; list-style: none; }
.mdr-content .mdr-ranking-item { display: grid; grid-template-columns: 1.5em minmax(0, 3fr) minmax(60px, 4fr) auto auto; align-items: center; gap: 10px; padding: 4px 0; }
.mdr-content .mdr-ranking-rank { color: var(--mdr-ink-faint); font-size: var(--mdr-text-aux); font-variant-numeric: tabular-nums; font-weight: 700; text-align: right; }
.mdr-content .mdr-ranking-label { overflow: hidden; font-size: var(--mdr-text-aux); text-overflow: ellipsis; white-space: nowrap; }
.mdr-content .mdr-ranking-track { height: 9px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--mdr-line) 65%, transparent); }
.mdr-content .mdr-ranking-bar { display: block; height: 100%; border-radius: 999px; background: var(--mdr-accent); }
.mdr-content .mdr-ranking-value { font-size: var(--mdr-text-aux); font-variant-numeric: tabular-nums; font-weight: 700; text-align: right; white-space: nowrap; }
.mdr-content .mdr-ranking-share { min-width: 3.4em; color: var(--mdr-ink-faint); font-size: var(--mdr-text-aux); font-variant-numeric: tabular-nums; text-align: right; }

/* --- pivot / provenance tables ------------------------------------------- */
.mdr-content .mdr-table-scroll, .mdr-content .mdr-pivot-scroll { overflow-x: auto; }
.mdr-content .mdr-pivot-table, .mdr-content .mdr-provenance-table { width: 100%; border-collapse: collapse; font-size: var(--mdr-text-aux); }
.mdr-content .mdr-pivot-table th, .mdr-content .mdr-pivot-table td,
.mdr-content .mdr-provenance-table th, .mdr-content .mdr-provenance-table td { padding: 8px 10px; border: 1px solid var(--mdr-line); text-align: right; white-space: nowrap; }
.mdr-content .mdr-pivot-table thead th, .mdr-content .mdr-pivot-table tbody th, .mdr-content .mdr-pivot-table tfoot th,
.mdr-content .mdr-provenance-table thead th, .mdr-content .mdr-provenance-table tbody th { background: var(--mdr-surface-muted); font-weight: 700; text-align: left; }
.mdr-content .mdr-pivot-table td { font-variant-numeric: tabular-nums; }
.mdr-content .mdr-pivot-total { font-weight: 750; background: color-mix(in srgb, var(--mdr-accent-soft) 70%, transparent); }
.mdr-content .mdr-provenance-table td:first-of-type { text-align: left; white-space: normal; }

/* --- findings ------------------------------------------------------------ */
.mdr-content .mdr-findings-list { display: grid; gap: 10px; padding: 0; margin: 0; list-style: none; }
.mdr-content .mdr-finding { padding: 13px 15px; border: 1px solid var(--mdr-line); border-left: 3px solid var(--mdr-ink-faint); border-radius: 9px; background: var(--mdr-surface-muted); }
.mdr-content .mdr-finding--risk { border-left-color: var(--mdr-danger); background: var(--mdr-danger-soft); }
.mdr-content .mdr-finding--opportunity { border-left-color: var(--mdr-accent); background: var(--mdr-accent-soft); }
.mdr-content .mdr-finding--positive { border-left-color: var(--mdr-success); background: var(--mdr-success-soft); }
.mdr-content .mdr-finding-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.mdr-content .mdr-finding-severity { padding: 2px 7px; border: 1px solid currentColor; border-radius: 999px; font-size: var(--mdr-text-micro); font-weight: 750; letter-spacing: .04em; }
.mdr-content .mdr-finding--risk .mdr-finding-severity { color: var(--mdr-danger); }
.mdr-content .mdr-finding--opportunity .mdr-finding-severity { color: var(--mdr-accent); }
.mdr-content .mdr-finding--positive .mdr-finding-severity { color: var(--mdr-success); }
.mdr-content .mdr-finding-title { font-size: 0.9375rem; font-weight: 750; }
.mdr-content .mdr-finding-value { margin-left: auto; font-size: 1rem; font-variant-numeric: tabular-nums; font-weight: 750; }
.mdr-content .mdr-finding-detail { margin: 6px 0 0; color: var(--mdr-ink-muted); font-size: var(--mdr-text-aux); }
.mdr-content .mdr-finding-action, .mdr-content .mdr-finding-evidence { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin: 6px 0 0; font-size: var(--mdr-text-aux); }
.mdr-content .mdr-finding-action span, .mdr-content .mdr-finding-evidence span { color: var(--mdr-ink-faint); font-weight: 700; }
.mdr-content .mdr-finding-action em { margin-left: auto; color: var(--mdr-ink-faint); font-style: normal; }
.mdr-content .mdr-finding-link { padding: 2px 7px; border: 1px solid var(--mdr-line-strong); border-radius: 999px; font-size: var(--mdr-text-micro); text-decoration: none; }
.mdr-content .mdr-finding-link:hover { border-color: var(--mdr-accent); color: var(--mdr-accent); }

/* --- quality ------------------------------------------------------------- */
.mdr-content .mdr-quality-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; padding: 0; margin: 0; list-style: none; }
.mdr-content .mdr-quality-item { padding: 11px 13px; border: 1px solid var(--mdr-line); border-radius: 9px; background: var(--mdr-surface-muted); }
.mdr-content .mdr-quality-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; }
.mdr-content .mdr-quality-id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: var(--mdr-text-aux); font-weight: 700; }
.mdr-content .mdr-quality-size { color: var(--mdr-ink-faint); font-size: var(--mdr-text-aux); }
.mdr-content .mdr-quality-meta { display: grid; gap: 4px; margin: 7px 0 0; font-size: var(--mdr-text-aux); }
.mdr-content .mdr-quality-meta > div { display: flex; gap: 8px; }
.mdr-content .mdr-quality-meta dt { flex: 0 0 auto; color: var(--mdr-ink-faint); }
.mdr-content .mdr-quality-meta dd { min-width: 0; margin: 0; color: var(--mdr-ink-muted); overflow-wrap: anywhere; }
.mdr-content .mdr-quality-notes { padding-left: 1.3em; margin: 10px 0 0; color: var(--mdr-ink-muted); font-size: var(--mdr-text-aux); }

/* --- KPI sparkline ------------------------------------------------------- */
.mdr-content .mdr-sparkline { display: block; width: 100%; max-width: 100%; height: 26px; margin-top: 6px; overflow: visible; }
.mdr-content .mdr-sparkline path { fill: none; stroke: var(--mdr-accent); stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
.mdr-content .mdr-sparkline--down path { stroke: var(--mdr-danger); }
.mdr-content .mdr-excalidraw-svg text { font-family: var(--mdr-font-sans); }

.mdr-content .mdr-empty { padding: 24px 12px; border: 1px dashed var(--mdr-line-strong); border-radius: 8px; color: var(--mdr-ink-faint); font-size: 0.75rem; text-align: center; }
.mdr-content .mdr-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin: 1.4em 0; }
.mdr-content .mdr-columns--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.mdr-content .mdr-columns--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.mdr-content .mdr-columns--5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.mdr-content .mdr-columns--6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.mdr-content .mdr-column { min-width: 0; padding: 18px; border: 1px solid var(--mdr-line); border-radius: 10px; background: var(--mdr-surface-muted); }
.mdr-content .mdr-column > :first-child { margin-top: 0; }
.mdr-content .mdr-column > :last-child { margin-bottom: 0; }
.mdr-content .mdr-details { margin: 1.25em 0; border: 1px solid var(--mdr-line); border-radius: 9px; background: var(--mdr-surface-muted); }
.mdr-content .mdr-details > summary { padding: 12px 15px; color: var(--mdr-ink); cursor: pointer; font-size: 0.8125rem; font-weight: 700; }
.mdr-content .mdr-details-content { padding: 0 15px 14px; color: var(--mdr-ink-muted); }
.mdr-content .mdr-details-content > :first-child { margin-top: 0; }
.mdr-content .mdr-details-content > :last-child { margin-bottom: 0; }
.mdr-content .mdr-image-missing { display: block; padding: 12px; border: 1px dashed var(--mdr-line-strong); border-radius: 8px; color: var(--mdr-ink-faint); font-size: 0.8125rem; text-align: center; }
/* Screen-reader-only content (chart data tables, table captions). */
.mdr-visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); border: 0; white-space: nowrap; }
.mdr-content .mdr-table-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.mdr-content .mdr-table-action {
  padding: 6px 10px; min-height: 28px; border: 1px solid var(--mdr-line-strong); border-radius: 7px;
  background: var(--mdr-surface); color: var(--mdr-ink-muted); cursor: pointer;
  font-family: inherit; font-size: var(--mdr-text-aux); font-weight: 650;
}
.mdr-content .mdr-table-action:hover { border-color: var(--mdr-accent); color: var(--mdr-accent); }
.mdr-content .mdr-table-action:focus-visible { outline: 3px solid var(--mdr-accent); outline-offset: 2px; }
.mdr-content .mdr-table-status { min-height: 1.2em; margin: 6px 0 0; color: var(--mdr-success); font-size: var(--mdr-text-aux); }
.mdr-theme-toggle {
  position: absolute; top: clamp(18px, 4vw, 34px); right: clamp(18px, 4vw, 34px);
  padding: 7px 12px; min-height: 32px; border: 1px solid var(--mdr-line-strong); border-radius: 999px;
  background: var(--mdr-surface-muted); color: var(--mdr-ink-muted); cursor: pointer;
  font-family: inherit; font-size: var(--mdr-text-aux); font-weight: 650;
}
.mdr-theme-toggle:hover { border-color: var(--mdr-accent); color: var(--mdr-accent); }
.mdr-theme-toggle:focus-visible { outline: 3px solid var(--mdr-accent); outline-offset: 2px; }
.mdr-content .tabulator-col:focus-visible { outline: 3px solid var(--mdr-accent); outline-offset: -3px; }
.mdr-footer { padding: 18px 4px; color: var(--mdr-ink-faint); font-size: var(--mdr-text-aux); text-align: center; }

body.mdr-dashboard-page {
  --mdr-bg: #08111d;
  --mdr-surface: #101c2a;
  --mdr-surface-muted: #132337;
  --mdr-ink: #e8f2f7;
  --mdr-ink-muted: #a9bfce;
  --mdr-ink-faint: #7792a6;
  --mdr-line: #20374a;
  --mdr-line-strong: #34536a;
  --mdr-accent: #59d6bd;
  --mdr-accent-soft: #163b3d;
  --mdr-success: #62d79e;
  --mdr-success-soft: #123a31;
  --mdr-danger: #ff8d82;
  --mdr-danger-soft: #452a31;
  color-scheme: dark;
  overflow: hidden;
}
body.mdr-dashboard-page .mdr-dashboard-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
  width: 100%;
  height: 100vh;
  min-height: 680px;
  margin: 0;
  padding: 18px clamp(18px, 2.1vw, 38px) 20px;
  background:
    radial-gradient(ellipse at 50% -25%, rgb(40 102 120 / 24%), transparent 52%),
    var(--mdr-bg);
}
body.mdr-dashboard-page .mdr-dashboard-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 0 2px 12px;
  border-bottom: 1px solid var(--mdr-line);
}
body.mdr-dashboard-page .mdr-dashboard-brand { min-width: 0; }
body.mdr-dashboard-page .mdr-dashboard-eyebrow { display: flex; align-items: center; gap: 8px; color: var(--mdr-accent); font-size: var(--mdr-text-micro); font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
body.mdr-dashboard-page .mdr-dashboard-eyebrow::before { width: 7px; height: 7px; border-radius: 50%; background: var(--mdr-accent); box-shadow: 0 0 14px rgb(89 214 189 / 70%); content: ""; }
body.mdr-dashboard-page .mdr-dashboard-title { overflow: hidden; margin: 3px 0 0; color: var(--mdr-ink); font-size: clamp(1.3125rem, 2vw, 1.875rem); font-weight: 700; letter-spacing: -.035em; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
body.mdr-dashboard-page .mdr-dashboard-status { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 9px; padding: 8px 12px; border: 1px solid var(--mdr-line); border-radius: 999px; background: rgb(19 35 55 / 75%); color: var(--mdr-ink-muted); font-size: var(--mdr-text-aux); font-weight: 650; }
body.mdr-dashboard-page .mdr-dashboard-status::before { width: 7px; height: 7px; border-radius: 50%; background: #62d79e; content: ""; }
/* A short viewport scrolls the wallboard rather than squashing plots below legibility. */
body.mdr-dashboard-page .mdr-dashboard-content { min-width: 0; min-height: 0; height: 100%; margin: 0; padding: 0; overflow: auto; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
body.mdr-dashboard-page .mdr-dashboard { height: 100%; min-height: 0; margin: 0; grid-template-rows: minmax(200px, auto) minmax(225px, 1.6fr) minmax(180px, 1fr); gap: 14px; }
body.mdr-dashboard-page .mdr-panel { min-height: 0; padding: 0; overflow: hidden; border: 0; background: transparent; }
body.mdr-dashboard-page .mdr-panel--span-12 { min-height: 150px; }
body.mdr-dashboard-page .mdr-panel > .mdr-component { height: 100%; padding: 14px 16px; border-color: rgb(65 98 121 / 55%); background: linear-gradient(145deg, rgb(18 34 51 / 96%), rgb(13 26 41 / 98%)); box-shadow: 0 10px 30px rgb(0 0 0 / 15%); }
body.mdr-dashboard-page .mdr-component-heading { margin-bottom: 8px; }
body.mdr-dashboard-page .mdr-component-heading h3 { color: #edf7fb; font-size: 0.875rem; }
body.mdr-dashboard-page .mdr-component-kicker { color: #79a3b8; }
/* The KPI row sizes to its content. A fixed row height is what clipped the comparison
   badge; the card floor is label + value + sparkline + comparison, so nothing is cut. */
body.mdr-dashboard-page .mdr-kpi { display: flex; flex-direction: column; height: auto; min-height: 200px; }
body.mdr-dashboard-page .mdr-kpi-card { min-height: 132px; }
body.mdr-dashboard-page .mdr-kpi-grid { flex: 1; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
body.mdr-dashboard-page .mdr-kpi-card { display: flex; flex-direction: column; justify-content: center; padding: 12px 16px; border-color: #233d52; background: linear-gradient(145deg, #152b3d, #102235); }
body.mdr-dashboard-page .mdr-kpi-label { color: #a9c0ce; font-size: var(--mdr-text-label); }
body.mdr-dashboard-page .mdr-kpi-value { margin-top: 3px; color: #f0f8fa; font-size: clamp(1.5rem, 2.3vw, 2.25rem); }
body.mdr-dashboard-page .mdr-kpi-value span { color: #88a8b9; }
body.mdr-dashboard-page .mdr-kpi-meta { margin-top: 5px; color: #8da7b6; }
body.mdr-dashboard-page .mdr-kpi-change { background: #1b3447; }
body.mdr-dashboard-page .mdr-chart { display: flex; flex-direction: column; }
body.mdr-dashboard-page .mdr-echart { flex: 1; height: auto; min-height: 0; }
body.mdr-dashboard-page .mdr-chart-note { margin-top: 2px; }
body.mdr-dashboard-page .mdr-chart .mdr-component-heading { flex: 0 0 auto; }
body.mdr-dashboard-page .mdr-data-table { display: flex; flex-direction: column; }
body.mdr-dashboard-page .mdr-data-table .mdr-tabulator-host { flex: 1; min-height: 0; height: auto !important; }
body.mdr-dashboard-page .mdr-table-summary { margin-bottom: 6px; }
body.mdr-dashboard-page .mdr-footer { display: none; }

@media (max-width: 900px) {
  .mdr-shell { width: min(100% - 24px, 760px); margin-top: 20px; }
  .mdr-report-layout { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .mdr-toc { position: static; max-height: none; }
  .mdr-toc nav { max-height: min(32vh, 240px); }
  .mdr-content .mdr-dashboard { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .mdr-content .mdr-panel--span-1, .mdr-content .mdr-panel--span-2, .mdr-content .mdr-panel--span-3 { grid-column: span 3; }
  .mdr-content .mdr-panel--span-4, .mdr-content .mdr-panel--span-5, .mdr-content .mdr-panel--span-6,
  .mdr-content .mdr-panel--span-7, .mdr-content .mdr-panel--span-8, .mdr-content .mdr-panel--span-9,
  .mdr-content .mdr-panel--span-10, .mdr-content .mdr-panel--span-11, .mdr-content .mdr-panel--span-12 { grid-column: span 6; }
}
@media (max-width: 900px) {
  body.mdr-dashboard-page { overflow: auto; }
  body.mdr-dashboard-page .mdr-dashboard-shell { height: auto; min-height: 100vh; padding: 16px; }
  body.mdr-dashboard-page .mdr-dashboard-content { height: auto; overflow: visible; }
  body.mdr-dashboard-page .mdr-dashboard { height: auto; grid-template-rows: auto; }
  body.mdr-dashboard-page .mdr-dashboard-content { overflow: visible; }
  body.mdr-dashboard-page .mdr-panel { min-height: 250px; grid-column: 1 / -1; }
  body.mdr-dashboard-page .mdr-panel--span-12 { min-height: 140px; }
  body.mdr-dashboard-page .mdr-kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  body.mdr-dashboard-page .mdr-echart { height: 320px; min-height: 260px; }
}
@media (max-height: 820px) and (min-width: 901px) {
  body.mdr-dashboard-page .mdr-dashboard-shell { min-height: 0; padding-top: 10px; padding-bottom: 12px; gap: 9px; }
  body.mdr-dashboard-page .mdr-dashboard-topbar { padding-bottom: 7px; }
  body.mdr-dashboard-page .mdr-dashboard { grid-template-rows: minmax(190px, auto) minmax(205px, 1.5fr) minmax(168px, 1fr); gap: 9px; }
  body.mdr-dashboard-page .mdr-panel > .mdr-component { padding: 10px 12px; }
  body.mdr-dashboard-page .mdr-kpi-value { font-size: clamp(1.25rem, 1.9vw, 1.875rem); }
  body.mdr-dashboard-page .mdr-kpi-card { min-height: 122px; }
  body.mdr-dashboard-page .mdr-sparkline { height: 22px; margin-top: 4px; }
}
@media (max-width: 620px) {
  body { font-size: 0.9375rem; }
  .mdr-shell { width: min(100% - 20px, 560px); margin-top: 10px; }
  .mdr-header, .mdr-content { padding: 22px 20px; }
  .mdr-report-layout { gap: 10px; margin-top: 12px; }
  .mdr-toc > summary { padding: 10px 12px; }
  .mdr-toc nav { max-height: 30vh; padding: 0 8px 8px; }
  .mdr-header { border-radius: 12px; }
  .mdr-content .mdr-dashboard { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .mdr-content .mdr-panel { grid-column: 1 / -1; }
  .mdr-content .mdr-columns { grid-template-columns: 1fr; }
  body.mdr-dashboard-page .mdr-dashboard-shell { padding: 12px; }
  body.mdr-dashboard-page .mdr-dashboard-status { padding: 7px 9px; font-size: var(--mdr-text-micro); }
  body.mdr-dashboard-page .mdr-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  body.mdr-dashboard-page .mdr-panel { min-height: 240px; }
  body.mdr-dashboard-page .mdr-panel--span-12 { min-height: 250px; }
  body.mdr-dashboard-page .mdr-echart { height: 280px; min-height: 240px; }
  .mdr-content table { display: block; overflow-x: auto; white-space: nowrap; }
  .mdr-content th, .mdr-content td { padding: 8px 10px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; }
}
@media (prefers-contrast: more) {
  :root { --mdr-line: #8d9aa6; --mdr-line-strong: #5d6a76; --mdr-ink-muted: #3f4c58; --mdr-ink-faint: #4a5763; }
}
@media print {
  @page { margin: 14mm 12mm; }
  /* Declared after the dashboard block, so the light palette wins at equal specificity. */
  body.mdr-dashboard-page {
    color-scheme: light;
    overflow: visible;
    --mdr-bg: #fff; --mdr-surface: #fff; --mdr-surface-muted: #f7f9fb;
    --mdr-ink: #17232f; --mdr-ink-muted: #586979; --mdr-ink-faint: #7b8996;
    --mdr-line: #d7dfe5; --mdr-line-strong: #b6c2cc; --mdr-accent: #126a62; --mdr-accent-soft: #e5f3ef;
    --mdr-shadow: none;
  }
  :root, [data-theme="dark"], [data-theme="auto"] { color-scheme: light; --mdr-bg: #fff; --mdr-surface: #fff; --mdr-ink: #17232f; --mdr-ink-muted: #586979; --mdr-line: #d7dfe5; --mdr-shadow: none; }
  html, body { background: #fff !important; }
  .mdr-theme-toggle, .mdr-table-actions { display: none !important; }
  .mdr-shell { width: 100%; margin: 0; }
  .mdr-report-layout { display: block; margin: 0; }
  .mdr-toc { display: none; }
  .mdr-header, .mdr-content { padding: 18px 0; border: 0; border-radius: 0; box-shadow: none; }
  .mdr-header { border-bottom: 1px solid #ccd5dc; }
  .mdr-content { margin: 0; }
  /* Keeping the grid keeps flex-sized chart containers measurable; display:block collapsed them to 0.
     Twelve print columns preserve each panel's declared span. */
  .mdr-content .mdr-dashboard { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-template-rows: none; height: auto; gap: 10px; }
  .mdr-content .mdr-panel { margin: 0; break-inside: avoid; }
  body.mdr-dashboard-page .mdr-dashboard-shell { height: auto; min-height: 0; padding: 0; gap: 10px; }
  body.mdr-dashboard-page .mdr-dashboard-content { height: auto; overflow: visible; }
  body.mdr-dashboard-page .mdr-panel > .mdr-component { height: auto; background: var(--mdr-surface); box-shadow: none; }
  body.mdr-dashboard-page .mdr-echart,
  .mdr-content .mdr-echart { height: 260px; min-height: 220px; }
  body.mdr-dashboard-page .mdr-tabulator-host { height: 420px !important; }
  body.mdr-dashboard-page .mdr-kpi-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  body.mdr-dashboard-page .mdr-kpi-card { background: var(--mdr-surface-muted); }
  body.mdr-dashboard-page .mdr-kpi-value, body.mdr-dashboard-page .mdr-kpi-label, body.mdr-dashboard-page .mdr-component-heading h3 { color: var(--mdr-ink); }
  .mdr-content h2, .mdr-content h3 { break-after: avoid; }
  .mdr-content .mdr-component, .mdr-content .mdr-kpi-card, .mdr-content .mdr-callout { break-inside: avoid; }
  a { color: inherit; text-decoration: none; }
  pre, blockquote, table, img { break-inside: avoid; }
  .mdr-footer { display: none; }
}
`;
