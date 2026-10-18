import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { loadSqliteDataset, readCsvDataset } from '../packages/data-sources/dist/index.js';
import { renderReport, validateReport } from '../packages/renderer-core/dist/index.js';

const nodeVersion = process.versions.node.split('.').map(Number);
if (nodeVersion[0] < 22 || (nodeVersion[0] === 22 && nodeVersion[1] < 13)) {
  throw new Error('This example requires Node.js 22.13+ for the built-in node:sqlite module.');
}

const exampleDirectory = dirname(fileURLToPath(import.meta.url));
const cacheDirectory = resolve(exampleDirectory, '.cache');
const databasePath = resolve(cacheDirectory, 'source-comparison.sqlite');
const csvPath = resolve(cacheDirectory, 'source-comparison.csv');
const now = new Date().toISOString();
const rowCount = 1000;
const columns = [
  { name: 'trade_date', type: 'date' },
  { name: 'close', type: 'number', unit: 'USD' },
  { name: 'volume', type: 'integer', unit: 'shares' },
  { name: 'sector', type: 'string' },
];
const sectors = ['Technology', 'Healthcare', 'Finance', 'Energy'];
const rows = Array.from({ length: rowCount }, (_, index) => {
  const date = new Date(Date.UTC(2023, 0, 1 + index)).toISOString().slice(0, 10);
  const close = Number((100 + index * 0.035 + Math.sin(index / 17) * 4).toFixed(2));
  const volume = 800_000 + ((index * 79_331) % 3_500_000);
  return [date, close, volume, sectors[index % sectors.length]];
});

await mkdir(cacheDirectory, { recursive: true });
const database = new DatabaseSync(databasePath);
try {
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS comparison_bars (
      trade_date TEXT PRIMARY KEY,
      close REAL NOT NULL,
      volume INTEGER NOT NULL,
      sector TEXT NOT NULL
    ) STRICT;
    DELETE FROM comparison_bars;
  `);
  const insert = database.prepare(`
    INSERT INTO comparison_bars (trade_date, close, volume, sector) VALUES (?, ?, ?, ?)
  `);
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) insert.run(...row);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
} finally {
  database.close();
}

const csv = [columns.map((column) => column.name).join(','), ...rows.map((row) => row.join(','))].join('\n');
await writeFile(csvPath, csv, 'utf8');

const csvDataset = await readCsvDataset(csvPath, {
  columns,
  source: '本地 CSV 文件',
  fetchedAt: now,
  updatedAt: rows.at(-1)?.[0],
});
const sqliteDataset = loadSqliteDataset({
  databasePath,
  sql: 'SELECT trade_date, close, volume, sector FROM comparison_bars ORDER BY trade_date ASC',
  columns,
  maxRows: rowCount,
  source: '本地 SQLite 查询',
  fetchedAt: now,
  updatedAt: rows.at(-1)?.[0],
});

if (JSON.stringify(csvDataset.columns) !== JSON.stringify(sqliteDataset.columns)
  || JSON.stringify(csvDataset.rows) !== JSON.stringify(sqliteDataset.rows)) {
  throw new Error('CSV and SQLite adapters produced different dataset snapshots.');
}

const fence = '\x60\x60\x60';
const markdown = `---
format: md-report/1
mode: dashboard
title: CSV 与 SQLite 数据源对照
---

:::: dashboard columns=12
::: panel span=12
${fence}kpi
{"title":"同一份数据快照","items":[{"label":"记录数","value":${rowCount},"unit":"行"},{"label":"数据字段","value":${columns.length},"unit":"列"},{"label":"来源适配器","value":2,"unit":"种"},{"label":"快照一致","value":"是","period":"CSV 与 SQLite 的行列值一致"}]}
${fence}
:::

::: panel span=8
${fence}chart
{"kind":"line","title":"收盘价趋势（两种来源同一结果）","dataRef":"daily_bars","x":"trade_date","y":"close","unit":"USD"}
${fence}
:::

::: panel span=4
${fence}chart
{"kind":"bar","title":"行业样本构成","dataRef":"sector_totals","x":"sector","y":"rows","unit":"行"}
${fence}
:::

::: panel span=12
${fence}data-table
{"dataRef":"daily_bars","title":"1000 行交互式明细（Tabulator）","columns":[{"field":"trade_date","label":"日期","width":130},{"field":"close","label":"收盘价","format":"currency:USD","width":140},{"field":"volume","label":"成交量","width":150},{"field":"sector","label":"行业","width":180}],"defaultSort":{"field":"trade_date","direction":"desc"},"viewportHeight":420}
${fence}
:::
::::
`;

const sectorCounts = sectors.map((sector) => [sector, rows.filter((row) => row[3] === sector).length]);
const sectorDataset = {
  columns: [{ name: 'sector', type: 'string' }, { name: 'rows', type: 'integer' }],
  rows: sectorCounts,
  source: '相同的内存聚合结果',
  fetchedAt: now,
  updatedAt: rows.at(-1)?.[0],
};

for (const [name, dailyDataset] of [['csv', csvDataset], ['sqlite', sqliteDataset]]) {
  const document = { markdown, datasets: { daily_bars: dailyDataset, sector_totals: sectorDataset } };
  const validation = validateReport(document);
  if (!validation.valid) {
    throw new Error(`${name} dashboard failed validation:\n${validation.diagnostics.map((item) => `${item.code} line ${item.line}: ${item.message}`).join('\n')}`);
  }
  const rendered = await renderReport(document);
  await writeFile(resolve(exampleDirectory, `data-source-${name}.html`), rendered.html, 'utf8');
}

await writeFile(resolve(exampleDirectory, 'data-source-comparison.md'), markdown, 'utf8');
console.log(`Rendered the same ${rowCount}-row dashboard from equivalent CSV and SQLite snapshots.`);
console.log('Wrote examples/data-source-comparison.md, examples/data-source-csv.html, and examples/data-source-sqlite.html.');
