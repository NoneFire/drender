import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import type { ReportDataset, ReportScene, SqliteDatasetSource, SqliteSceneSource, SqliteSourceConfig } from '@mdreport/renderer-core';

export interface DatasetColumn {
  name: string;
  type?: string;
  unit?: string;
}

export interface DatasetSourceMetadata {
  source?: string;
  fetchedAt?: string;
  updatedAt?: string;
}

const DEFAULT_MAX_ROWS = 5000;
const READ_ONLY_SQL_PREFIX = /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(?:select|with|values)\b/i;

function isReadOnlySqlQuery(sql: string): boolean {
  return READ_ONLY_SQL_PREFIX.test(sql);
}

function validateMaxRows(maxRows: number): void {
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > DEFAULT_MAX_ROWS) {
    throw new RangeError(`maxRows must be an integer from 1 to ${DEFAULT_MAX_ROWS}.`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Replace comments, string literals, quoted identifiers, and bracket identifiers with inert text so placeholders and statement breaks can be counted reliably. */
function stripSqlNoise(sql: string): string {
  let output = '';
  let index = 0;
  while (index < sql.length) {
    const character = sql[index] ?? '';
    const next = sql[index + 1] ?? '';
    if (character === '-' && next === '-') {
      while (index < sql.length && sql[index] !== '\n') index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      index += 2;
      while (index < sql.length && !(sql[index] === '*' && sql[index + 1] === '/')) index += 1;
      index += 2;
      output += ' ';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === character) {
          if (sql[index + 1] === character) { index += 2; continue; }
          index += 1;
          break;
        }
        index += 1;
      }
      output += '""';
      continue;
    }
    if (character === '[') {
      while (index < sql.length && sql[index] !== ']') index += 1;
      index += 1;
      output += '""';
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

/**
 * Reject extra statements and placeholder mismatches before node:sqlite silently ignores a second
 * statement or NULL-binds missing parameters; named parameters are unsupported by this positional path.
 */
function validateSqlStatement(sql: string, parameterCount: number, id: string): void {
  const stripped = stripSqlNoise(sql);
  const statements = stripped.split(';').filter((part) => part.trim().length > 0);
  if (statements.length > 1) {
    throw new TypeError(`SQLite source "${id}" must contain exactly one statement; found ${statements.length}, and anything after the first statement would be ignored.`);
  }
  const named = [...new Set(stripped.match(/(?<![A-Za-z0-9_$])[:@$][A-Za-z_][A-Za-z0-9_]*/g) ?? [])];
  if (named.length > 0) {
    throw new TypeError(`SQLite source "${id}" uses named parameter${named.length === 1 ? '' : 's'} ${named.slice(0, 5).join(', ')}; only positional "?" placeholders are supported by parameters.`);
  }
  let nextIndex = 1;
  let required = 0;
  for (const match of stripped.matchAll(/\?(\d*)/g)) {
    if (match[1]) {
      required = Math.max(required, Number(match[1]));
    } else {
      required = Math.max(required, nextIndex);
      nextIndex += 1;
    }
  }
  if (required !== parameterCount) {
    throw new TypeError(`SQLite source "${id}" has ${required} positional "?" placeholder${required === 1 ? '' : 's'} but ${parameterCount} parameter${parameterCount === 1 ? '' : 's'} were supplied.`);
  }
}

function parseCsvRows(input: string, delimiter: string): { fields: string[]; blankLine: boolean }[] {
  if (delimiter.length !== 1 || delimiter === '"' || delimiter === '\r' || delimiter === '\n') {
    throw new TypeError('CSV delimiter must be one character other than a quote or newline.');
  }

  const source = input.replace(/^\uFEFF/, '');
  const records: { fields: string[]; blankLine: boolean }[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let justClosedQuote = false;

  const pushRecord = (fromLineBreak: boolean) => {
    row.push(cell);
    records.push({ fields: row, blankLine: fromLineBreak && !justClosedQuote && row.length === 1 && row[0] === '' });
    row = [];
    cell = '';
    justClosedQuote = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          justClosedQuote = true;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      if (cell.length !== 0 || justClosedQuote) throw new SyntaxError(`Unexpected quote in CSV at character ${index + 1}.`);
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell);
      cell = '';
      justClosedQuote = false;
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      pushRecord(true);
    } else if (justClosedQuote) {
      // RFC4180-ish tolerance: whitespace between a closing quote and the next delimiter is separational, not data.
      if (character !== ' ' && character !== '\t') throw new SyntaxError(`Unexpected character after a quoted CSV field at character ${index + 1}.`);
    } else {
      cell += character;
    }
  }

  if (quoted) throw new SyntaxError('CSV ended inside a quoted field.');
  if (row.length > 0 || cell.length > 0 || justClosedQuote) pushRecord(false);
  // Only the empty line produced by trailing line breaks at EOF is dropped; interior empty rows are kept and validated.
  while (records.length > 0 && records[records.length - 1]!.blankLine) records.pop();
  return records;
}

const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function convertCsvValue(value: string, column: DatasetColumn): string | number | boolean | null {
  if (value === '') return null;
  const type = (column.type ?? 'string').toLowerCase();
  if (['number', 'numeric', 'integer', 'int', 'real', 'float'].includes(type)) {
    const trimmed = value.trim();
    // Leave anything that is not a plain decimal (hex, thousands separators, blank) as text; the renderer flags it in numeric contexts.
    if (!DECIMAL_NUMBER.test(trimmed)) return value;
    const parsed = Number(trimmed);
    if (['integer', 'int'].includes(type) && !Number.isInteger(parsed)) throw new TypeError(`CSV field "${column.name}" must contain integers: ${value}`);
    return parsed;
  }
  if (type === 'boolean' || type === 'bool') {
    if (/^(true|1)$/i.test(value)) return true;
    if (/^(false|0)$/i.test(value)) return false;
    throw new TypeError(`CSV field "${column.name}" has an invalid boolean value: ${value}`);
  }
  return value;
}

/** Parse a CSV payload into the same row/column dataset envelope consumed by the renderer. */
export function parseCsvDataset(
  input: string,
  options: DatasetSourceMetadata & {
    columns?: readonly DatasetColumn[];
    delimiter?: string;
    hasHeader?: boolean;
    maxRows?: number;
  } = {},
): ReportDataset {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  validateMaxRows(maxRows);
  const records = parseCsvRows(input, options.delimiter ?? ',');
  const hasHeader = options.hasHeader ?? true;
  const header = hasHeader ? records.shift()?.fields : undefined;
  const columns = options.columns ?? (header?.map((name) => ({ name })) ?? []);
  if (columns.length === 0) throw new TypeError('CSV needs a header row or an explicit columns schema.');
  if (header && header.length !== columns.length) throw new TypeError(`CSV header has ${header.length} fields; the declared columns schema has ${columns.length}.`);
  if (header) {
    const mismatches = columns
      .map((column, index) => header[index] === column.name ? undefined : `column ${index + 1} is "${header[index] ?? ''}" in the file but "${column.name}" in the schema`)
      .filter((message): message is string => message !== undefined);
    if (mismatches.length > 0) throw new TypeError(`CSV header does not match the declared columns: ${mismatches.join('; ')}.`);
  }
  if (records.length > maxRows) throw new RangeError(`CSV has ${records.length} data rows; the configured limit is ${maxRows}.`);

  const rows = records.map((record, rowIndex) => {
    if (record.fields.length !== columns.length) throw new TypeError(`CSV row ${rowIndex + 1 + (hasHeader ? 1 : 0)} has ${record.fields.length} fields; expected ${columns.length}.`);
    return columns.map((column, index) => convertCsvValue(record.fields[index] ?? '', column));
  });

  return {
    columns: columns.map((column) => ({ ...column })),
    rows,
    ...(options.source ? { source: options.source } : {}),
    ...(options.fetchedAt ? { fetchedAt: options.fetchedAt } : {}),
    ...(options.updatedAt ? { updatedAt: options.updatedAt } : {}),
  };
}

/** Read a trusted host-selected CSV file and normalize it with the same parser as uploaded CSV text. */
export async function readCsvDataset(
  path: string | URL,
  options: DatasetSourceMetadata & {
    columns?: readonly DatasetColumn[];
    delimiter?: string;
    hasHeader?: boolean;
    maxRows?: number;
  } = {},
): Promise<ReportDataset> {
  return parseCsvDataset(await readFile(path, 'utf8'), options);
}

type SqliteBindParameter = null | number | bigint | string | Uint8Array;
type DatasetValue = string | number | boolean | null;

function normalizeSqliteParameter(value: unknown): SqliteBindParameter {
  if (typeof value === 'boolean') return Number(value);
  if (value === null || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string' || value instanceof Uint8Array) return value;
  throw new TypeError(`SQLite parameters must be JSON scalar values; received ${typeof value}.`);
}

function bindSqliteParameters(parameters: readonly unknown[]): SqliteBindParameter[] {
  return parameters.map(normalizeSqliteParameter);
}

function sqliteScalar(value: unknown): DatasetValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('SQLite query returned a non-finite number.');
    return value;
  }
  if (typeof value === 'bigint') return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  throw new TypeError(`SQLite query returned an unsupported value of type ${typeof value}.`);
}

function readRows(
  database: DatabaseSyncType,
  sql: string,
  parameters: readonly SqliteBindParameter[],
  configuredColumns: readonly DatasetColumn[] | undefined,
  maxRows: number,
  id: string,
): { columns: DatasetColumn[]; rows: DatasetValue[][] } {
  if (!isReadOnlySqlQuery(sql)) {
    throw new TypeError(`SQLite source "${id}" must start with SELECT, WITH, or VALUES.`);
  }
  validateSqlStatement(sql, parameters.length, id);
  let statement: ReturnType<DatabaseSyncType['prepare']>;
  try {
    statement = database.prepare(sql);
  } catch (error) {
    throw new TypeError(`SQLite source "${id}" could not prepare its query: ${errorMessage(error)}`);
  }
  statement.setReadBigInts(true);
  const resultRows: Record<string, unknown>[] = [];
  try {
    for (const row of statement.iterate(...parameters)) {
      if (resultRows.length >= maxRows) throw new RangeError(`SQLite query for source "${id}" returned more than ${maxRows} rows; add a LIMIT or lower the configured row count.`);
      resultRows.push(row);
    }
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new TypeError(`SQLite source "${id}" could not run its query: ${errorMessage(error)}`);
  }
  // A declared columns schema supplies metadata (type/unit) and order; it is not a
  // projection. Columns the query returns but the schema omits are appended instead of
  // being silently dropped.
  const resultNames = Object.keys(resultRows[0] ?? {});
  const columns = configuredColumns
    ? [
        ...configuredColumns.map((column) => ({ ...column })),
        ...resultNames.filter((name) => !configuredColumns.some((column) => column.name === name)).map((name) => ({ name })),
      ]
    : resultNames.map((name) => ({ name }));
  const rows = resultRows.map((row, rowIndex) => columns.map((column) => {
    if (!Object.hasOwn(row, column.name)) throw new TypeError(`SQLite source "${id}" result row ${rowIndex + 1} has no field named "${column.name}".`);
    return sqliteScalar(row[column.name]);
  }));
  return { columns, rows };
}

type SqliteSourceDeclaration = SqliteDatasetSource | SqliteSceneSource;

function validateQueryDeclaration(source: SqliteSourceDeclaration, query: string): void {
  const hasTable = typeof source.table === 'string' && source.table.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(source.table);
  const hasTables = Array.isArray(source.tables) && source.tables.length > 0 && source.tables.every((table) => typeof table === 'string' && table.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(table));
  if (source.view === undefined && !hasTable && !hasTables) throw new TypeError('SQLite query sources must document their source table or tables.');
  if (!isReadOnlySqlQuery(query) || query.length > 100_000) {
    throw new TypeError('SQLite source queries must be a SELECT, WITH, or VALUES statement no longer than 100,000 characters.');
  }
  if (source.view !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(source.view)) {
    throw new TypeError('SQLite view names must use only letters, digits, and underscores, and start with a letter or underscore.');
  }
  if (source.queryFile !== undefined && (typeof source.queryFile !== 'string' || !source.queryFile || source.queryFile.startsWith('/')
    || /^[A-Za-z]:/.test(source.queryFile) || /[\\\u0000-\u001f\u007f]/.test(source.queryFile)
    || source.queryFile.split('/').some((part) => !part || part === '.' || part === '..') || !/\.sql$/i.test(source.queryFile))) {
    throw new TypeError('SQLite queryFile must be an explicit workspace-relative .sql path.');
  }
  if (source.parameters && !source.parameters.every((item) => item === null || typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)))) {
    throw new TypeError('SQLite query parameters must be JSON scalar values.');
  }
  if (source.view !== undefined && source.parameters && source.parameters.length > 0) {
    throw new TypeError('SQLite views do not accept query parameters; use a parameterized query or queryFile instead.');
  }
}

function sourceQuery(
  database: DatabaseSyncType,
  source: SqliteSourceDeclaration,
  queryFiles: Readonly<Record<string, string>>,
  id: string,
): string {
  const modes = [source.query !== undefined, source.queryFile !== undefined, source.view !== undefined].filter(Boolean).length;
  if (modes !== 1) throw new TypeError(`SQLite source "${id}" must declare exactly one of query, queryFile, or view.`);
  if (source.query !== undefined) return source.query;
  if (source.queryFile !== undefined) {
    if (!Object.hasOwn(queryFiles, source.queryFile)) {
      throw new TypeError(`SQLite source "${id}" declares queryFile "${source.queryFile}", but the host did not provide that file.`);
    }
    const query = queryFiles[source.queryFile];
    if (typeof query !== 'string') {
      throw new TypeError(`SQLite source "${id}" queryFile "${source.queryFile}" must contain SQL text.`);
    }
    const bytes = Buffer.byteLength(query, 'utf8');
    if (bytes > 100_000) {
      throw new TypeError(`SQLite source "${id}" queryFile "${source.queryFile}" is ${bytes} bytes; the limit is 100,000 bytes.`);
    }
    return query.replace(/^\uFEFF/, '').trim();
  }
  const view = source.view!;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(view)) throw new TypeError(`SQLite view "${view}" has an invalid name.`);
  let exists: unknown;
  try {
    exists = database.prepare("SELECT 1 AS present FROM sqlite_schema WHERE type = 'view' AND name = ? COLLATE NOCASE LIMIT 1").get(view);
  } catch (error) {
    throw new TypeError(`SQLite source "${id}" could not check view "${view}": ${errorMessage(error)}`);
  }
  if (!exists) throw new TypeError(`SQLite view "${view}" was not found in the declared database.`);
  return `SELECT * FROM "${view}"`;
}

function queryDataset(database: DatabaseSyncType, source: SqliteDatasetSource, databasePath: string, id: string, query: string): ReportDataset {
  validateQueryDeclaration(source, query);
  const maxRows = source.maxRows ?? DEFAULT_MAX_ROWS;
  validateMaxRows(maxRows);
  const result = readRows(database, query, bindSqliteParameters(source.parameters ?? []), source.columns, maxRows, id);
  const provenance = source.view ? `view ${source.view}` : source.tables?.join(', ') ?? source.table ?? 'query';
  return {
    columns: result.columns,
    rows: result.rows,
    source: source.source ?? `SQLite ${databasePath} · ${provenance}`,
    ...(source.fetchedAt ? { fetchedAt: source.fetchedAt } : {}),
    ...(source.updatedAt ? { updatedAt: source.updatedAt } : {}),
  };
}

function queryScene(database: DatabaseSyncType, source: SqliteSceneSource, id: string, query: string): ReportScene {
  validateQueryDeclaration(source, query);
  const parameters = bindSqliteParameters(source.parameters ?? []);
  const maxRows = (source as SqliteSceneSource & { maxRows?: number }).maxRows ?? DEFAULT_MAX_ROWS;
  validateMaxRows(maxRows);
  validateSqlStatement(query, parameters.length, id);
  let statement: ReturnType<DatabaseSyncType['prepare']>;
  try {
    statement = database.prepare(query);
  } catch (error) {
    throw new TypeError(`SQLite source "${id}" could not prepare its query: ${errorMessage(error)}`);
  }
  statement.setReadBigInts(true);
  let first: Record<string, unknown> | undefined;
  let secondFound = false;
  let rowsRead = 0;
  const iterator = statement.iterate(...parameters);
  try {
    for (const row of iterator) {
      if (rowsRead >= maxRows) throw new RangeError(`SQLite scene query "${id}" returned more than ${maxRows} rows; a scene query must return exactly one row.`);
      rowsRead += 1;
      if (rowsRead === 1) first = row;
      else { secondFound = true; break; }
    }
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new TypeError(`SQLite source "${id}" could not run its query: ${errorMessage(error)}`);
  } finally {
    iterator.return?.();
  }
  if (secondFound) throw new TypeError(`SQLite scene query "${id}" must return exactly one row.`);
  if (first === undefined) throw new TypeError(`SQLite scene query "${id}" returned no rows.`);
  const column = source.column ?? Object.keys(first)[0];
  if (!column || !Object.hasOwn(first, column)) throw new TypeError(`SQLite scene query "${id}" has no result column named "${column ?? ''}".`);
  const rawScene = first[column];
  if (typeof rawScene !== 'string' || Buffer.byteLength(rawScene, 'utf8') > 2_000_000) {
    throw new TypeError(`SQLite scene query "${id}" must return one JSON string no larger than 2 MB.`);
  }
  const scene = JSON.parse(rawScene) as unknown;
  if (!scene || typeof scene !== 'object' || Array.isArray(scene) || (scene as Record<string, unknown>).type !== 'excalidraw' || !Array.isArray((scene as Record<string, unknown>).elements)) {
    throw new TypeError(`SQLite scene query "${id}" did not return an Excalidraw scene object.`);
  }
  return scene as ReportScene;
}

/** Materialize Markdown-declared sources from one read-only SQLite snapshot. queryFiles maps declared workspace paths to text already resolved by the host. */
export function loadMarkdownSqliteSources(
  config: SqliteSourceConfig,
  databasePath: string,
  options: { queryFiles?: Readonly<Record<string, string>> } = {},
): { datasets: Record<string, ReportDataset>; scenes: Record<string, ReportScene> } {
  if (!config || typeof config.path !== 'string' || !/\.(?:db|sqlite|sqlite3)$/i.test(config.path)) {
    throw new TypeError('SQLite source configuration must point to a .db, .sqlite, or .sqlite3 file.');
  }
  const database = new DatabaseSync(databasePath, {
    readOnly: true,
    allowExtension: false,
  });
  const datasets: Record<string, ReportDataset> = {};
  const scenes: Record<string, ReportScene> = {};
  let transactionStarted = false;
  try {
    database.exec('PRAGMA busy_timeout = 5000');
    database.exec('BEGIN');
    transactionStarted = true;
    for (const [id, source] of Object.entries(config.datasets ?? {})) {
      datasets[id] = queryDataset(database, source, config.path, id, sourceQuery(database, source, options.queryFiles ?? {}, id));
    }
    for (const [id, source] of Object.entries(config.scenes ?? {})) {
      scenes[id] = queryScene(database, source, id, sourceQuery(database, source, options.queryFiles ?? {}, id));
    }
    database.exec('COMMIT');
    transactionStarted = false;
    return { datasets, scenes };
  } catch (error) {
    if (transactionStarted) {
      try { database.exec('ROLLBACK'); } catch { /* Keep the original query failure. */ }
    }
    throw error;
  } finally {
    database.close();
  }
}

/**
 * Read a trusted, host-configured query from SQLite and materialize a renderer-ready snapshot.
 * The connection is opened read-only; SQL and database paths should come from host configuration,
 * never from Markdown or model-generated tool arguments.
 */
export function loadSqliteDataset(options: DatasetSourceMetadata & {
  databasePath: string;
  sql: string;
  parameters?: readonly SqliteBindParameter[];
  columns?: readonly DatasetColumn[];
  maxRows?: number;
}): ReportDataset {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  validateMaxRows(maxRows);
  const id = options.source ?? options.databasePath;
  if (!isReadOnlySqlQuery(options.sql)) {
    throw new TypeError(`SQLite source "${id}" must start with SELECT, WITH, or VALUES.`);
  }

  const database = new DatabaseSync(options.databasePath, {
    readOnly: true,
    allowExtension: false,
  });
  try {
    database.exec('PRAGMA busy_timeout = 5000');
    const result = readRows(database, options.sql, bindSqliteParameters(options.parameters ?? []), options.columns, maxRows, id);

    return {
      columns: result.columns,
      rows: result.rows,
      ...(options.source ? { source: options.source } : {}),
      ...(options.fetchedAt ? { fetchedAt: options.fetchedAt } : {}),
      ...(options.updatedAt ? { updatedAt: options.updatedAt } : {}),
    };
  } finally {
    database.close();
  }
}
