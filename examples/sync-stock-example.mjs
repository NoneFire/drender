import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { loadMarkdownSqliteSources } from '../packages/data-sources/dist/index.js';
import { extractSqliteSourceConfig, renderReport, validateReport } from '../packages/renderer-core/dist/index.js';

const nodeVersion = process.versions.node.split('.').map(Number);
if (nodeVersion[0] < 22 || (nodeVersion[0] === 22 && nodeVersion[1] < 13)) {
  throw new Error('This example requires Node.js 22.13+ for the built-in node:sqlite module.');
}

const exampleDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(exampleDirectory, '..');
const sourceMarkdownPath = resolve(exampleDirectory, 'stock-dashboard.md');
const sourceMarkdown = await readFile(sourceMarkdownPath, 'utf8');
const declaredSource = extractSqliteSourceConfig(sourceMarkdown);
if (!declaredSource?.path || declaredSource.path.startsWith('/') || /^[A-Za-z]:/.test(declaredSource.path)
  || /[\\\u0000-\u001f\u007f]/.test(declaredSource.path) || declaredSource.path.split('/').some((part) => !part || part === '.' || part === '..')) {
  throw new Error('stock-dashboard.md must explicitly declare a workspace-relative SQLite path in its frontmatter.');
}
const databaseRelativePath = declaredSource.path;
const databasePath = resolve(workspaceRoot, databaseRelativePath);
const symbol = (process.env.STOCK_SYMBOL || 'AAPL.US').toUpperCase();
const apiToken = process.env.EODHD_API_TOKEN || 'demo';
const refreshTtlHours = Number(process.env.STOCK_CACHE_TTL_HOURS || 18);
const lookbackDays = Math.max(30, Math.min(3650, Number(process.env.STOCK_LOOKBACK_DAYS || 180)));
const forceRefresh = process.argv.includes('--force');
const offline = process.argv.includes('--offline');
const provider = 'eodhd';
const interval = '1d';
const sourceLabel = 'EOD Historical Data · 日线 EOD API';

if (!/^[A-Z0-9.^=-]+$/.test(symbol)) throw new Error(`Unsupported stock symbol: ${symbol}`);
if (!Number.isFinite(refreshTtlHours) || refreshTtlHours <= 0) throw new Error('STOCK_CACHE_TTL_HOURS must be a positive number.');
if (forceRefresh && offline) throw new Error('Use either --force or --offline, not both.');

await mkdir(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS stock_bars (
    provider TEXT NOT NULL,
    symbol TEXT NOT NULL,
    interval TEXT NOT NULL,
    trade_date TEXT NOT NULL,
    open REAL,
    high REAL,
    low REAL,
    close REAL NOT NULL,
    adjusted_close REAL,
    volume INTEGER,
    PRIMARY KEY (provider, symbol, interval, trade_date)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS stock_sync_state (
    provider TEXT NOT NULL,
    symbol TEXT NOT NULL,
    interval TEXT NOT NULL,
    last_success_at TEXT NOT NULL,
    fetched_from TEXT NOT NULL,
    fetched_to TEXT NOT NULL,
    fetched_rows INTEGER NOT NULL,
    PRIMARY KEY (provider, symbol, interval)
  ) STRICT;
`);

const getSyncState = database.prepare(`
  SELECT last_success_at FROM stock_sync_state
  WHERE provider = ? AND symbol = ? AND interval = ?
`);
const getBars = database.prepare(`
  SELECT trade_date, open, high, low, close, adjusted_close, volume
  FROM stock_bars WHERE provider = ? AND symbol = ? AND interval = ?
  ORDER BY trade_date ASC
`);

async function fetchDailyBars(from, to) {
  const url = new URL(`https://eodhd.com/api/eod/${encodeURIComponent(symbol)}`);
  url.searchParams.set('api_token', apiToken);
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`EODHD returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    const detail = typeof payload?.message === 'string' ? payload.message : typeof payload?.error === 'string' ? payload.error : 'unexpected response';
    throw new Error(`EODHD did not return a daily price series: ${detail}`);
  }

  const bars = payload.flatMap((item) => {
    if (!item || typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return [];
    const close = Number(item.close);
    if (!Number.isFinite(close)) return [];
    const optionalNumber = (value) => value === null || value === undefined ? null : Number.isFinite(Number(value)) ? Number(value) : null;
    return [{
      date: item.date,
      open: optionalNumber(item.open),
      high: optionalNumber(item.high),
      low: optionalNumber(item.low),
      close,
      adjustedClose: optionalNumber(item.adjusted_close) ?? close,
      volume: optionalNumber(item.volume),
    }];
  }).sort((left, right) => left.date.localeCompare(right.date));
  if (!bars.length) throw new Error('EODHD returned no usable daily bars.');
  return bars;
}

function upsertBars(bars, from, to) {
  const upsert = database.prepare(`
    INSERT INTO stock_bars (provider, symbol, interval, trade_date, open, high, low, close, adjusted_close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, symbol, interval, trade_date) DO UPDATE SET
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      adjusted_close = excluded.adjusted_close,
      volume = excluded.volume
  `);
  const updateState = database.prepare(`
    INSERT INTO stock_sync_state (provider, symbol, interval, last_success_at, fetched_from, fetched_to, fetched_rows)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, symbol, interval) DO UPDATE SET
      last_success_at = excluded.last_success_at,
      fetched_from = excluded.fetched_from,
      fetched_to = excluded.fetched_to,
      fetched_rows = excluded.fetched_rows
  `);

  database.exec('BEGIN IMMEDIATE');
  try {
    for (const bar of bars) {
      upsert.run(provider, symbol, interval, bar.date, bar.open, bar.high, bar.low, bar.close, bar.adjustedClose, bar.volume);
    }
    updateState.run(provider, symbol, interval, new Date().toISOString(), from, to, bars.length);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

try {
  const existingBars = getBars.all(provider, symbol, interval);
  const syncState = getSyncState.get(provider, symbol, interval);
  const fetchedAtMs = syncState?.last_success_at ? Date.parse(syncState.last_success_at) : 0;
  const cacheIsFresh = existingBars.length > 0 && Date.now() - fetchedAtMs < refreshTtlHours * 60 * 60 * 1000;

  if (!offline && (forceRefresh || !cacheIsFresh)) {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const bars = await fetchDailyBars(from, to);
    upsertBars(bars, from, to);
    console.log(`Fetched ${bars.length} ${symbol} daily bars from EODHD (${from} to ${to}).`);
  } else {
    console.log(`${offline ? 'Offline mode' : 'Cache is fresh'}: using ${existingBars.length} cached ${symbol} daily bars.`);
  }

  const storedBars = getBars.all(provider, symbol, interval);
  if (!storedBars.length) throw new Error(`No cached price data exists for ${symbol}; remove --offline or configure a valid EODHD_API_TOKEN.`);
  const latest = storedBars.at(-1);
  const fetchedAt = getSyncState.get(provider, symbol, interval)?.last_success_at ?? 'unknown';
  const fence = '\x60\x60\x60';
  const markdown = `---
format: md-report/1
mode: dashboard
title: ${symbol} 股价大屏
sqlite:
  path: ${databaseRelativePath}
  datasets:
    stock_daily:
      table: stock_bars
      queryFile: examples/queries/stock-daily.sql
      parameters: [${JSON.stringify(provider)}, ${JSON.stringify(symbol)}, ${JSON.stringify(interval)}]
      columns:
        - name: trade_date
          type: date
        - name: open
          type: number
          unit: USD
        - name: high
          type: number
          unit: USD
        - name: low
          type: number
          unit: USD
        - name: close
          type: number
          unit: USD
        - name: adjusted_close
          type: number
          unit: USD
        - name: volume
          type: number
          unit: shares
      source: ${JSON.stringify(sourceLabel)}
      fetchedAt: '${fetchedAt}'
      updatedAt: '${latest.trade_date}'
    stock_summary:
      table: stock_bars
      queryFile: examples/queries/stock-summary.sql
      parameters: [${JSON.stringify(provider)}, ${JSON.stringify(symbol)}, ${JSON.stringify(interval)}]
      maxRows: 1
      columns:
        - name: latest_adjusted_close
          type: number
          unit: USD
        - name: daily_return
          type: number
        - name: twenty_session_return_pct
          type: number
          unit: '%'
        - name: latest_volume
          type: number
          unit: shares
        - name: sample_days
          type: number
        - name: sample_start_date
          type: date
        - name: sample_end_date
          type: date
        - name: sample_period
          type: string
      source: ${JSON.stringify(sourceLabel)}
      fetchedAt: '${fetchedAt}'
      updatedAt: '${latest.trade_date}'
    stock_recent:
      table: stock_bars
      queryFile: examples/queries/stock-recent.sql
      parameters: [${JSON.stringify(provider)}, ${JSON.stringify(symbol)}, ${JSON.stringify(interval)}]
      columns:
        - name: trade_date
          type: date
        - name: open
          type: number
          unit: USD
        - name: high
          type: number
          unit: USD
        - name: low
          type: number
          unit: USD
        - name: close
          type: number
          unit: USD
        - name: adjusted_close
          type: number
          unit: USD
        - name: volume
          type: number
          unit: shares
      source: ${JSON.stringify(sourceLabel)}
      fetchedAt: '${fetchedAt}'
      updatedAt: '${latest.trade_date}'
---

:::: dashboard columns=12
::: panel span=12
${fence}kpi
{"title":"${symbol} 核心行情","items":[{"label":"最新调整收盘价","dataRef":"stock_summary","field":"latest_adjusted_close","unit":"USD","changeField":"daily_return","period":"较前一交易日"},{"label":"近 20 个交易日收益","dataRef":"stock_summary","field":"twenty_session_return_pct","unit":"%","period":"近 20 个交易日"},{"label":"最新成交量","dataRef":"stock_summary","field":"latest_volume","unit":"股","period":"最新交易日"},{"label":"样本交易日","dataRef":"stock_summary","field":"sample_days","unit":"日","periodField":"sample_period"}]}
${fence}
:::

::: panel span=8
${fence}chart
{"kind":"line","title":"${symbol} 调整收盘价趋势","dataRef":"stock_daily","x":"trade_date","y":"adjusted_close","unit":"USD"}
${fence}
:::

::: panel span=4
${fence}chart
{"kind":"bar","title":"日成交量","dataRef":"stock_daily","x":"trade_date","y":"volume","unit":"股"}
${fence}
:::

::: panel span=12
${fence}data-table
{"dataRef":"stock_recent","title":"最近 20 个交易日","columns":[{"field":"trade_date","label":"交易日"},{"field":"open","label":"开盘价","format":"currency:USD"},{"field":"high","label":"最高价","format":"currency:USD"},{"field":"low","label":"最低价","format":"currency:USD"},{"field":"close","label":"收盘价","format":"currency:USD"},{"field":"adjusted_close","label":"调整收盘价","format":"currency:USD"},{"field":"volume","label":"成交量"}],"defaultSort":{"field":"trade_date","direction":"desc"},"viewportHeight":320}
${fence}
:::
::::
`;

  const sourceConfig = extractSqliteSourceConfig(markdown);
  if (!sourceConfig) throw new Error('Stock dashboard Markdown is missing its SQLite source declaration.');
  const queryFilePaths = [...new Set(Object.values(sourceConfig.datasets ?? {})
    .map((source) => source.queryFile).filter((path) => typeof path === 'string'))];
  const queryFiles = Object.fromEntries(await Promise.all(queryFilePaths.map(async (path) => [path, await readFile(resolve(workspaceRoot, path), 'utf8')])));
  const snapshots = loadMarkdownSqliteSources(sourceConfig, databasePath, { queryFiles });
  const document = { markdown, ...snapshots };
  const validation = validateReport(document);
  if (!validation.valid) {
    throw new Error(`Stock dashboard failed validation:\n${validation.diagnostics.map((item) => `${item.code} line ${item.line}: ${item.message}`).join('\n')}`);
  }
  const rendered = await renderReport(document);
  await writeFile(resolve(exampleDirectory, 'stock-dashboard.md'), markdown, 'utf8');
  await writeFile(resolve(exampleDirectory, 'stock-dashboard.html'), rendered.html, 'utf8');
  console.log(`Rendered ${storedBars.length} cached bars; data through ${latest.trade_date}, fetched at ${fetchedAt}.`);
  console.log(`Wrote examples/stock-dashboard.md and examples/stock-dashboard.html (${rendered.bytes.toLocaleString('en-US')} bytes).`);
} finally {
  database.close();
}
