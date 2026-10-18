import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import { format as formatSql } from 'sql-formatter';

export interface ComponentDataset {
  columns?: readonly { name: string; type?: string; unit?: string }[];
  rows?: readonly (readonly (string | number | boolean | null)[])[];
  format?: 'json' | 'csv';
  data?: string;
  source?: string;
  fetchedAt?: string;
  updatedAt?: string;
}

export type ComponentDatasets = Record<string, ComponentDataset>;

type RecordRow = Record<string, string | number | boolean | null>;
type JsonObject = Record<string, unknown>;
export type ComponentScenes = Record<string, JsonObject>;

const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character] ?? character);
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;
const object = (value: unknown): JsonObject | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined;

function parseJson(source: string): JsonObject | undefined {
  try { return object(JSON.parse(source)); } catch { return undefined; }
}

/**
 * Display semantics for one business metric. Declared once in frontmatter `metrics`
 * so a KPI card, a chart, a table column, the prose, and the T8 narrative all render
 * the same number with the same unit and the same sense of "good".
 */
export type MetricFormat = 'number' | 'currency' | 'percent' | 'percentage-points' | 'ratio' | 'date' | 'text';
export type MetricGoodDirection = 'up' | 'down' | 'neutral';

export interface MetricComparisonSpec {
  kind?: 'mom' | 'yoy' | 'target' | 'none';
  /** Literal baseline value. Mutually exclusive with dataRef/field. */
  value?: number;
  /** Baseline read from one summary row of another declared dataset. */
  dataRef?: string;
  field?: string;
  /** Compare as a ratio (value/baseline−1). Default true. */
  asPercent?: boolean;
  /** Compare as an absolute difference in percentage points. Overrides asPercent. */
  pointsDelta?: boolean;
  period?: string;
}

export interface MetricSpec {
  label?: string;
  value?: number | string;
  dataRef?: string;
  field?: string;
  format?: MetricFormat;
  currency?: string;
  decimals?: number;
  unit?: string;
  compact?: boolean;
  scale?: number;
  goodDirection?: MetricGoodDirection;
  comparison?: MetricComparisonSpec;
  definition?: string;
  numerator?: string;
  denominator?: string;
  source?: string;
  asOf?: string;
  owner?: string;
}

export type MetricRegistry = Record<string, MetricSpec>;

export const METRIC_FORMATS: readonly MetricFormat[] = ['number', 'currency', 'percent', 'percentage-points', 'ratio', 'date', 'text'];

/**
 * Accept both `format: currency` + `currency: CNY` and the table-column spelling
 * `format: currency:CNY`. Two spellings for one concept invited invalid documents.
 */
export function normalizeMetricFormat(format: unknown, currency: unknown): { format: MetricFormat; currency: string } {
  const raw = typeof format === 'string' ? format.trim() : '';
  const [base, suffix] = raw.split(':', 2);
  const declaredCurrency = typeof currency === 'string' ? currency : '';
  const resolvedCurrency = suffix && /^[A-Za-z]{3}$/.test(suffix) ? suffix.toUpperCase() : declaredCurrency;
  if (suffix && !/^[A-Za-z]{3}$/.test(suffix)) return { format: base as MetricFormat, currency: declaredCurrency };
  return { format: (base || 'number') as MetricFormat, currency: resolvedCurrency };
}

/** True when a declared format string is one of the supported formats (with or without a currency suffix). */
export function isMetricFormat(value: unknown): boolean {
  const { format, currency } = normalizeMetricFormat(value, undefined);
  if (!METRIC_FORMATS.includes(format)) return false;
  if (typeof value === 'string' && value.includes(':') && !currency) return false;
  return true;
}
export const METRIC_GOOD_DIRECTIONS: readonly MetricGoodDirection[] = ['up', 'down', 'neutral'];
export const COMPARISON_KINDS = ['mom', 'yoy', 'target', 'none'] as const;

const PERIOD_LABELS: Record<string, string> = { mom: '环比', yoy: '同比', target: '较目标', none: '' };

function decimalPlaces(value: number, format: MetricFormat, metric: MetricSpec): number {
  if (metric.decimals !== undefined) return Math.max(0, Math.min(6, Math.trunc(metric.decimals)));
  if (format === 'percent' || format === 'percentage-points') return 1;
  if (format === 'currency') return metric.compact === true ? 1 : 0;
  if (format === 'ratio') return 2;
  // Compact notation is a rounding display: keep one decimal so 1,007,000 reads as 100.7万, not 101万.
  if (metric.compact === true) return 1;
  return Number.isInteger(value) ? 0 : 2;
}

function numberFormatOptions(value: number, metric: MetricSpec, format: MetricFormat): Intl.NumberFormatOptions {
  return {
    notation: metric.compact === true ? 'compact' : 'standard',
    maximumFractionDigits: decimalPlaces(value, format, metric),
    minimumFractionDigits: 0,
  };
}

/** Render one metric value using its declared display semantics. Returns '—' for missing values. */
export function formatMetricValue(value: unknown, metric: MetricSpec = {}, options: { withUnit?: boolean } = {}): string {
  if (value === null || value === undefined || value === '') return '—';
  const normalized = normalizeMetricFormat(metric.format, metric.currency);
  const format = normalized.format;
  const numeric = number(value);
  if (numeric === undefined || format === 'date' || format === 'text') return String(value);
  const scaled = numeric * (metric.scale ?? 1);
  const base = numberFormatOptions(scaled, metric, format);
  let text: string;
  if (format === 'percent' || format === 'percentage-points') {
    text = `${new Intl.NumberFormat('zh-CN', base).format(scaled * 100)}${format === 'percent' ? '%' : 'pp'}`;
  } else if (format === 'currency') {
    const currency = normalized.currency || 'CNY';
    try {
      text = new Intl.NumberFormat('zh-CN', { ...base, style: 'currency', currency }).format(scaled);
    } catch {
      text = `${new Intl.NumberFormat('zh-CN', base).format(scaled)} ${currency}`;
    }
  } else {
    text = new Intl.NumberFormat('zh-CN', base).format(scaled);
  }
  if (!options.withUnit || !metric.unit) return text;
  // CJK units read better without a space: 100.7万元, but 100.7 USD.
  return /^[\u2e80-\u9fff\uff00-\uffef]/.test(metric.unit) ? `${text}${metric.unit}` : `${text} ${metric.unit}`;
}

/** Render a signed change using the metric's declared change format. */
export function formatMetricChange(change: number, metric: MetricSpec, format: 'percent' | 'percentage-points'): string {
  const text = formatMetricValue(change, { ...metric, format, unit: undefined, compact: false }, {});
  return change > 0 ? `+${text}` : text;
}

export interface MetricComparisonResult {
  change?: number;
  format: 'percent' | 'percentage-points';
  period: string;
  direction: 'positive' | 'negative' | 'neutral';
}

/** Derive change, period label, and business direction for one metric. */
export function metricComparison(value: number | undefined, baseline: number | undefined, metric: MetricSpec): MetricComparisonResult {
  const spec = metric.comparison ?? {};
  const kind = spec.kind ?? (spec.value !== undefined || spec.field !== undefined ? 'mom' : 'none');
  const asPoints = spec.pointsDelta === true;
  const format: 'percent' | 'percentage-points' = asPoints ? 'percentage-points' : 'percent';
  const period = spec.period ?? PERIOD_LABELS[kind] ?? '';
  let change: number | undefined;
  if (value !== undefined && baseline !== undefined) {
    if (asPoints) change = value - baseline;
    else if (baseline !== 0) change = value / baseline - 1;
  }
  const good = metric.goodDirection ?? 'up';
  const delta = change;
  const neutral = kind === 'none' || delta === undefined || delta === 0 || good === 'neutral';
  const direction: MetricComparisonResult['direction'] = neutral || delta === undefined
    ? 'neutral'
    : (delta > 0) === (good === 'up') ? 'positive' : 'negative';
  return { ...(change === undefined ? {} : { change }), format, period, direction };
}

/** Resolve a metric binding to a concrete value, format context, and comparison. */
export interface ResolvedMetric {
  label: string;
  value: unknown;
  metric: MetricSpec;
  comparison: MetricComparisonResult;
}

export function resolveMetricRow(datasets: ComponentDatasets, dataRef: string, field: string): RecordRow | undefined {
  const dataset = datasets[dataRef];
  if (!dataset || !field) return undefined;
  return datasetRecords(dataset)[0];
}

export function resolveMetric(metricRef: string, metrics: MetricRegistry, datasets: ComponentDatasets): ResolvedMetric | undefined {
  const metric = metrics[metricRef];
  if (!metric) return undefined;
  const row = typeof metric.dataRef === 'string' && typeof metric.field === 'string'
    ? resolveMetricRow(datasets, metric.dataRef, metric.field)
    : undefined;
  const value = typeof metric.field === 'string' ? row?.[metric.field] : metric.value;
  const baselineRow = metric.comparison?.dataRef && metric.comparison.field
    ? resolveMetricRow(datasets, metric.comparison.dataRef, metric.comparison.field)
    : undefined;
  const baseline = metric.comparison?.value !== undefined
    ? metric.comparison.value
    : metric.comparison?.field
      ? number(baselineRow?.[metric.comparison.field])
      : undefined;
  return {
    label: metric.label ?? metricRef,
    value,
    metric,
    comparison: metricComparison(number(value), baseline, metric),
  };
}

const METRIC_TOKEN = /\{\{\s*([A-Za-z][A-Za-z0-9._-]{0,127})\s*\}\}/g;

/** Replace `{{metric_id}}` tokens with the metric's formatted value. */
export function substituteMetricTokens(source: string, metrics: MetricRegistry, datasets: ComponentDatasets): string {
  if (!source.includes('{{')) return source;
  return source.replace(METRIC_TOKEN, (whole, id: string) => {
    const resolved = resolveMetric(id, metrics, datasets);
    if (!resolved) return whole;
    return formatMetricValue(resolved.value, resolved.metric, { withUnit: true });
  });
}

/** Ids referenced by `{{...}}` tokens. Used by validation to report unresolved references. */
export function metricTokenIds(source: string): string[] {
  return [...source.matchAll(METRIC_TOKEN)].map((match) => match[1] ?? '').filter(Boolean);
}

function csvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((part) => part.length > 0)) rows.push(row);
      row = [];
    } else cell += character;
  }
  row.push(cell);
  if (row.some((part) => part.length > 0)) rows.push(row);
  return rows;
}

export function datasetRecords(dataset: ComponentDataset | undefined): RecordRow[] {
  if (!dataset) return [];
  if (dataset.rows !== undefined || dataset.columns !== undefined) {
    if (dataset.data !== undefined || !Array.isArray(dataset.columns) || (dataset.rows !== undefined && !Array.isArray(dataset.rows))) {
      throw new TypeError('A materialized dataset needs a columns array and rows array, and cannot also declare data.');
    }
    const names = dataset.columns.map((column, index) => {
      const record = object(column);
      if (!record || typeof record.name !== 'string' || record.name.trim() === '') {
        throw new TypeError(`Dataset column ${index + 1} needs a non-empty name.`);
      }
      return record.name;
    });
    if (new Set(names).size !== names.length) throw new TypeError('Dataset column names must be unique.');
    const rows = dataset.rows ?? [];
    return rows.map((row, rowIndex) => {
      if (!Array.isArray(row) || row.length !== names.length) {
        throw new TypeError(`Dataset row ${rowIndex + 1} must contain exactly ${names.length} values.`);
      }
      if (row.some((value) => value !== null && typeof value !== 'string' && typeof value !== 'boolean' && !(typeof value === 'number' && Number.isFinite(value)))) {
        throw new TypeError(`Dataset row ${rowIndex + 1} contains a value that is not a finite JSON scalar.`);
      }
      return Object.fromEntries(names.map((name, index) => [name, row[index] ?? null]));
    });
  }
  if (dataset.data === undefined) return [];
  if (typeof dataset.data !== 'string') throw new TypeError('Dataset data must be a string.');
  if (dataset.format !== undefined && dataset.format !== 'csv' && dataset.format !== 'json') {
    throw new TypeError('Dataset format must be "csv" or "json".');
  }
  if (dataset.format === 'csv') {
    if (dataset.data === '') return [];
    const [headers, ...rows] = csvRows(dataset.data);
    if (new Set(headers ?? []).size !== (headers ?? []).length) throw new TypeError('CSV header names must be unique.');
    const expected = headers?.length ?? 0;
    for (const [rowIndex, row] of rows.entries()) {
      if (row.length !== expected) throw new TypeError(`CSV row ${rowIndex + 2} must contain exactly ${expected} fields.`);
    }
    return rows.map((row) => Object.fromEntries((headers ?? []).map((header, index) => [header, row[index] ?? ''])));
  }
  if (dataset.data === '') throw new TypeError('JSON dataset data cannot be empty.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataset.data) as unknown;
  } catch {
    throw new TypeError('JSON dataset data must contain a valid JSON array of records.');
  }
  if (!Array.isArray(parsed)) throw new TypeError('JSON dataset data must contain an array of records.');
  return parsed.map((row, rowIndex) => {
    const record = object(row);
    if (!record) throw new TypeError(`JSON dataset row ${rowIndex + 1} must be an object.`);
    for (const [name, value] of Object.entries(record)) {
      if (value !== null && typeof value !== 'string' && typeof value !== 'boolean' && !(typeof value === 'number' && Number.isFinite(value))) {
        throw new TypeError(`JSON dataset field "${name}" in row ${rowIndex + 1} must be a finite JSON scalar.`);
      }
    }
    return record as RecordRow;
  });
}

function dataReference(spec: JsonObject, datasets: ComponentDatasets): { name: string; rows: RecordRow[] } | undefined {
  const name = typeof spec.dataRef === 'string' ? spec.dataRef : '';
  const dataset = datasets[name];
  if (!dataset) return undefined;
  return { name, rows: datasetRecords(dataset) };
}

function titleBar(title: unknown, kind: string, kicker?: unknown): string {
  const label = typeof kicker === 'string' && kicker.trim() ? kicker.trim() : kind;
  return `<div class="mdr-component-heading"><div><span class="mdr-component-kicker">${escape(label)}</span><h3>${escape(title || kind)}</h3></div></div>`;
}

/** Read `title="..."` / `kicker="..."` / `engine` from a fence info string. */
function fenceAttributes(info: string): { title?: string; kicker?: string; engine: boolean } {
  const read = (name: string): string | undefined => {
    const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(info);
    return match?.[1] ?? match?.[2];
  };
  return { title: read('title'), kicker: read('kicker'), engine: /(?:^|\s)engine(?:\s|$)/.test(info) };
}

function renderKpi(source: string, datasets: ComponentDatasets, metrics: MetricRegistry = {}): string | undefined {
  const spec = parseJson(source);
  if (!spec || !Array.isArray(spec.items)) return undefined;
  const cards = spec.items.slice(0, 12).map((itemValue) => {
    const item = object(itemValue);
    if (!item) return '';
    const metricRef = typeof item.metricRef === 'string' ? item.metricRef : '';
    const resolved = metricRef ? resolveMetric(metricRef, metrics, datasets) : undefined;
    const dataRef = typeof item.dataRef === 'string' ? item.dataRef : '';
    const row = dataRef ? datasetRecords(datasets[dataRef])[0] : undefined;
    const itemFormat = normalizeMetricFormat(item.format, item.currency);
    const metric: MetricSpec = resolved?.metric ?? {
      ...(item.format === undefined ? {} : { format: itemFormat.format }),
      ...(itemFormat.currency ? { currency: itemFormat.currency } : {}),
      ...(number(item.decimals) === undefined ? {} : { decimals: number(item.decimals) }),
      ...(item.compact === true ? { compact: true } : {}),
      ...(number(item.scale) === undefined ? {} : { scale: number(item.scale) }),
      ...(typeof item.goodDirection === 'string' ? { goodDirection: item.goodDirection as MetricGoodDirection } : {}),
    };
    const value = resolved ? resolved.value : typeof item.field === 'string' ? row?.[item.field] : item.value;

    let change: number | undefined;
    let changeFormat: 'percent' | 'percentage-points' = 'percent';
    let direction: string;
    let period: string;
    if (resolved) {
      ({ change, direction, period } = resolved.comparison);
      changeFormat = resolved.comparison.format;
    } else {
      const rawChange = typeof item.changeField === 'string' ? row?.[item.changeField] : item.change;
      change = number(rawChange);
      changeFormat = item.changeFormat === 'percentage-points' ? 'percentage-points' : 'percent';
      const good = typeof item.goodDirection === 'string' ? item.goodDirection : 'up';
      const explicit = item.direction;
      direction = explicit === 'positive' || explicit === 'negative' || explicit === 'neutral'
        ? explicit
        : change === undefined || change === 0 || good === 'neutral'
          ? 'neutral'
          : (change > 0) === (good === 'up') ? 'positive' : 'negative';
      const periodField = typeof item.periodField === 'string' ? item.periodField : '';
      period = String(periodField ? row?.[periodField] ?? '环比' : item.period ?? '环比');
    }

    const displayValue = formatMetricValue(value, metric);
    const unit = typeof item.unit === 'string' ? item.unit : resolved?.metric.unit ?? '';
    const changeText = change === undefined ? '' : formatMetricChange(change, metric, changeFormat);
    const label = String(item.label || resolved?.label || '指标');
    const sparkline = renderSparkline(item, datasets);
    return `<article class="mdr-kpi-card"><div class="mdr-kpi-label">${escape(label)}</div><div class="mdr-kpi-value">${displayValue}<span>${escape(unit)}</span></div>${sparkline}<div class="mdr-kpi-meta"><span class="mdr-kpi-change mdr-kpi-change--${escape(direction)}">${escape(changeText)}</span><span>${escape(period || '')}</span></div></article>`;
  }).join('');
  return `<section class="mdr-component mdr-kpi"${anchorAttribute(spec)}>${titleBar(spec.title || '关键指标', '指标摘要', spec.kicker)}<div class="mdr-kpi-grid">${cards}</div></section>`;
}

/** CSS-variable placeholders resolved by the chart bootstrap against the active theme. */
const SURFACE_SENTINEL = '__mdr_surface__';
const LINE_SENTINEL = '__mdr_ink_faint__';

/** Declarative number formatting handed to the browser-side chart runtime. */
function chartValueFormat(spec: JsonObject, metric: MetricSpec | undefined): JsonObject {
  const override = object(spec.axisFormat) ?? {};
  const normalized = normalizeMetricFormat(override.format ?? metric?.format, override.currency ?? metric?.currency);
  const format = normalized.format;
  const decimals = number(override.decimals) ?? metric?.decimals;
  return {
    format,
    ...(decimals === undefined ? {} : { decimals }),
    compact: override.compact === true || metric?.compact === true,
    currency: normalized.currency || 'CNY',
    scale: number(override.scale) ?? metric?.scale ?? 1,
    unit: typeof spec.unit === 'string' ? spec.unit : metric?.unit ?? '',
  };
}

const CARTESIAN_KINDS = ['line', 'bar', 'column', 'area', 'scatter'] as const;
const SPECIAL_CHART_KINDS = ['funnel', 'combo', 'waterfall', 'candlestick', 'boxplot', 'heatmap', 'sankey', 'treemap', 'radar', 'gauge', 'map'] as const;
export const CHART_KINDS: readonly string[] = [...CARTESIAN_KINDS, 'pie', ...SPECIAL_CHART_KINDS];

interface ChartContext {
  spec: JsonObject;
  rows: RecordRow[];
  datasets: ComponentDatasets;
  metrics: MetricRegistry;
  title: string;
  unit: string;
  valueFormat: JsonObject;
}

const PALETTE_LIGHT = ['#126a62', '#5479a6', '#c88637', '#9a6bb1', '#4d906d', '#c05c54', '#4e9caa'];
const PALETTE_DARK = ['#58d6bd', '#67a8ff', '#f7b955', '#bd8cff', '#66d89a', '#ff8478', '#52c9d5'];

function fieldOf(spec: JsonObject, key: string): string {
  return typeof spec[key] === 'string' ? String(spec[key]) : '';
}

/** Annotation layers shared by every cartesian-style chart. */
function applyAnnotations(option: JsonObject, spec: JsonObject, seriesNames: string[]): void {
  const targets = Array.isArray(spec.targets) ? spec.targets.map(object).filter((item): item is JsonObject => !!item) : [];
  const bands = Array.isArray(spec.bands) ? spec.bands.map(object).filter((item): item is JsonObject => !!item) : [];
  const points = Array.isArray(spec.points) ? spec.points.map(object).filter((item): item is JsonObject => !!item) : [];
  if (!targets.length && !bands.length && !points.length) return;
  const markLines = targets.flatMap((target) => {
    const value = number(target.value);
    if (value === undefined) return [];
    return [{
      ...(target.axis === 'x' ? { xAxis: value } : { yAxis: value }),
      label: {
        formatter: String(target.label ?? (target.axis === 'x' ? '' : value)),
        position: target.axis === 'x' ? 'insideEndTop' : 'insideEndTop',
        color: LINE_SENTINEL,
        fontSize: 11,
      },
      lineStyle: { type: 'dashed', width: 1.5, color: target.color ? String(target.color) : LINE_SENTINEL },
    }];
  });
  const markAreas = bands.map((band) => [
    { ...(band.axis === 'x' ? { xAxis: band.from } : { yAxis: band.from }) },
    { ...(band.axis === 'x' ? { xAxis: band.to } : { yAxis: band.to }) },
  ]);
  const markPoints = points.flatMap((point) => {
    const value = number(point.y);
    if (value === undefined) return [];
    return [{ coord: [point.x ?? '', value], value: String(point.text ?? ''), symbolSize: 8, label: { show: true, position: 'top', fontSize: 11 } }];
  });
  if (!Array.isArray(option.series) || option.series.length === 0) return;
  const host = (option.series as JsonObject[])[0];
  if (!host) return;
  if (markLines.length) host.markLine = { silent: true, symbol: 'none', data: markLines };
  if (markAreas.length) host.markArea = { silent: true, itemStyle: { color: 'rgba(88, 214, 189, 0.1)' }, data: markAreas };
  if (markPoints.length) host.markPoint = { data: markPoints };
  void seriesNames;
}

/** Build the option for a chart kind that is not a plain cartesian/pie plot. */
function buildSpecialChart(kind: string, context: ChartContext): { option: JsonObject; head: string[]; rows: string[][]; unitNote?: string } | undefined {
  const { spec, rows, title, unit } = context;
  const xField = fieldOf(spec, 'x');
  const yField = fieldOf(spec, 'y') || fieldOf(spec, 'value');
  if (kind === 'gauge') {
    const value = number(spec.value) ?? number(rows[0]?.[yField]);
    const max = number(spec.max) ?? 100;
    const min = number(spec.min) ?? 0;
    if (value === undefined) return undefined;
    return {
      option: {
        series: [{
          type: 'gauge', min, max, startAngle: 210, endAngle: -30, radius: '92%', center: ['50%', '58%'],
          progress: { show: true, width: 14, roundCap: true },
          axisLine: { lineStyle: { width: 14, color: [[1, 'rgba(120,140,160,.28)']] } },
          axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: true, distance: 16, fontSize: 10 },
          pointer: { width: 4, length: '58%' },
          detail: { valueAnimation: false, fontSize: 20, offsetCenter: [0, '38%'] },
          data: [{ value, name: title }],
        }],
      },
      head: ['项目', '数值'],
      rows: [[title, String(value)]],
      ...(unit ? { unitNote: unit } : {}),
    };
  }
  if (kind === 'funnel') {
    const data = rows.flatMap((row) => {
      const value = number(row[yField]);
      return value === undefined ? [] : [{ name: String(row[xField] ?? ''), value }];
    });
    if (!data.length) return undefined;
    return {
      option: {
        tooltip: { trigger: 'item', formatter: '{b}: {c}' },
        legend: { type: 'scroll', bottom: 0, left: 'center' },
        series: [{
          type: 'funnel', left: '6%', right: '6%', top: 12, bottom: 34, minSize: '22%',
          sort: spec.sort === 'none' ? 'none' : 'descending', gap: 2,
          label: { position: 'inside', formatter: '{b}  {c}' },
          itemStyle: { borderWidth: 0, borderRadius: 4 },
          emphasis: { label: { fontWeight: 'bold' } },
          data,
        }],
      },
      head: ['阶段', '数值'],
      rows: data.map((slice) => [slice.name, String(slice.value)]),
    };
  }
  if (kind === 'combo') {
    const declared = Array.isArray(spec.series) ? spec.series.map(object).filter((item): item is JsonObject => !!item) : [];
    if (!declared.length) return undefined;
    const categories = [...new Set(rows.map((row) => String(row[xField] ?? '')))];
    const doubleAxis = declared.some((entry) => Number(entry.axis) === 1);
    const series = declared.flatMap((entry) => {
      const field = fieldOf(entry, 'field');
      if (!field) return [];
      const type = fieldOf(entry, 'type') || 'line';
      const data = categories.map((category) => {
        const row = rows.find((candidate) => String(candidate[xField] ?? '') === category);
        return row === undefined ? null : number(row[field]) ?? null;
      });
      const stacked = entry.stack === true || typeof entry.stack === 'string';
      return [{
        name: String(entry.name || field), type,
        ...(type === 'bar' ? { barMaxWidth: 34, itemStyle: { borderRadius: [5, 5, 0, 0] } } : {}),
        ...(type === 'line' ? { smooth: true, symbolSize: 7 } : {}),
        ...(type === 'area' ? { areaStyle: { opacity: 0.16 }, smooth: true } : {}),
        ...(doubleAxis ? { yAxisIndex: Number(entry.axis) === 1 ? 1 : 0 } : {}),
        ...(stacked ? { stack: typeof entry.stack === 'string' ? String(entry.stack) : 'total' } : {}),
        data,
      }];
    });
    if (!series.length) return undefined;
    return {
      option: {
        mdrFormat: context.valueFormat ?? undefined,
        tooltip: { trigger: 'axis' },
        legend: { type: series.length > 5 ? 'scroll' : 'plain', top: 2, left: 8 },
        grid: { left: 54, right: doubleAxis ? 56 : 30, top: 36, bottom: 28, containLabel: true },
        xAxis: { type: 'category', data: categories, boundaryGap: series.some((entry) => entry.type === 'bar') },
        yAxis: [
          { type: 'value', name: unit, splitLine: { show: true }, mdrFormat: context.valueFormat },
          ...(doubleAxis ? [{ type: 'value', name: '', splitLine: { show: false }, mdrFormat: axisFormat(declared.find((entry) => Number(entry.axis) === 1)) }] : []),
        ],
        series,
        toolbox: { right: 4, top: 0, feature: { restore: {}, saveAsImage: { pixelRatio: 2 } } },
      },
      head: ['类别', ...series.map((entry) => String(entry.name))],
      rows: categories.map((category) => [category, ...series.map((entry) => {
        const value = (entry.data as Array<number | null>)[categories.indexOf(category)];
        return value === null || value === undefined ? '—' : String(value);
      })]),
    };
  }
  if (kind === 'waterfall') {
    const totalField = fieldOf(spec, 'totalField');
    const items = rows.flatMap((row) => {
      const delta = number(row[yField]);
      if (delta === undefined) return [];
      const isTotal = totalField ? Boolean(row[totalField]) : /\u5408\u8ba1|\u603b\u8ba1|\u671f\u672b|\u671f\u521d|total/i.test(String(row[xField] ?? ''));
      return [{ label: String(row[xField] ?? ''), delta, isTotal }];
    });
    if (!items.length) return undefined;
    const bases: number[] = []; const rises: number[] = []; const falls: number[] = []; const totals: number[] = [];
    let running = 0;
    let totalIndex = -1;
    for (const item of items) {
      if (item.isTotal) { totalIndex += 1; bases.push(0); rises.push(null as never); falls.push(null as never); totals.push(running + item.delta); running += item.delta; continue; }
      const base = item.delta >= 0 ? running : running + item.delta;
      bases.push(base); rises.push(item.delta >= 0 ? item.delta : null as never); falls.push(item.delta < 0 ? item.delta : null as never); totals.push(null as never);
      running += item.delta;
    }
    void totalIndex;
    const bar = (name: string, data: unknown[], color: string) => ({ name, type: 'bar', stack: 'wf', barMaxWidth: 34, itemStyle: { color }, data, emphasis: { focus: 'series' } });
    return {
      option: {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 2, left: 8 },
        grid: { left: 54, right: 30, top: 36, bottom: 28, containLabel: true },
        xAxis: { type: 'category', data: items.map((item) => item.label), axisLabel: { hideOverlap: true, showMaxLabel: true } },
        yAxis: { type: 'value', name: unit, mdrFormat: context.valueFormat },
        series: [
          { name: 'base', type: 'bar', stack: 'wf', silent: true, itemStyle: { color: 'transparent' }, data: bases, emphasis: { disabled: true } },
          bar('增加', rises, '#4d906d'),
          bar('减少', falls, '#c05c54'),
          bar('合计', totals, '#5479a6'),
        ],
        toolbox: { right: 4, top: 0, feature: { restore: {}, saveAsImage: { pixelRatio: 2 } } },
      },
      head: ['项目', '增减', '累计'],
      rows: items.reduce<{ out: string[][]; running: number }>((acc, item) => {
        const next = item.isTotal ? acc.running + item.delta : acc.running + item.delta;
        acc.out.push([item.label, String(item.delta), String(next)]);
        acc.running = next;
        return acc;
      }, { out: [], running: 0 }).out,
    };
  }
  if (kind === 'candlestick') {
    const open = fieldOf(spec, 'open'); const high = fieldOf(spec, 'high'); const low = fieldOf(spec, 'low'); const close = fieldOf(spec, 'close');
    const bars = rows.flatMap((row) => {
      const values = [open, high, low, close].map((field) => number(row[field]));
      if (values.some((value) => value === undefined)) return [];
      return [{ label: String(row[xField] ?? ''), values: values as number[] }];
    });
    if (!bars.length) return undefined;
    const labels = bars.map((bar) => bar.label);
    // candlestick data order is [open, close, low, high]
    const candles = bars.map((bar) => [bar.values[0] as number, bar.values[3] as number, bar.values[2] as number, bar.values[1] as number]);
    const volumeField = fieldOf(spec, 'volume');
    const volumes = volumeField ? rows.map((row) => number(row[volumeField]) ?? 0) : [];
    const withVolume = Boolean(volumeField);
    return {
      option: {
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        // Volume needs its own grid; a second y-axis without a matching grid leaves
        // the series without a coordinate system and breaks ECharts' reset phase.
        grid: withVolume
          ? [
              { left: 54, right: 30, top: 26, height: '54%', containLabel: true },
              { left: 54, right: 30, top: '70%', height: '18%', containLabel: true },
            ]
          : [{ left: 54, right: 30, top: 26, bottom: 34, containLabel: true }],
        xAxis: withVolume
          ? [
              { type: 'category', gridIndex: 0, data: labels, boundaryGap: true, axisLabel: { hideOverlap: true, showMaxLabel: true } },
              { type: 'category', gridIndex: 1, data: labels, boundaryGap: true, axisLabel: { show: false } },
            ]
          : { type: 'category', data: labels, boundaryGap: true, axisLabel: { hideOverlap: true, showMaxLabel: true } },
        yAxis: withVolume
          ? [
              { type: 'value', gridIndex: 0, scale: true, mdrFormat: context.valueFormat },
              { type: 'value', gridIndex: 1, splitLine: { show: false }, axisLabel: { show: false } },
            ]
          : [{ type: 'value', scale: true, mdrFormat: context.valueFormat }],
        series: [
          {
            name: title, type: 'candlestick', xAxisIndex: 0, yAxisIndex: 0, data: candles,
            itemStyle: { color: '#c05c54', color0: '#4d906d', borderColor: '#c05c54', borderColor0: '#4d906d' },
          },
          ...(withVolume ? [{
            name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: volumes,
            barMaxWidth: 6, itemStyle: { color: 'rgba(120,140,160,.45)' },
          }] : []),
        ],
        ...(withVolume ? { dataZoom: [
          { type: 'inside', xAxisIndex: [0, 1], filterMode: 'filter' },
          { type: 'slider', xAxisIndex: [0, 1], height: 16, bottom: 6, borderColor: 'transparent' },
        ] } : {}),
        toolbox: { right: 4, top: 0, feature: { restore: {}, saveAsImage: { pixelRatio: 2 } } },
      },
      head: ['日期', '开', '高', '低', '收'],
      rows: bars.map((bar) => [bar.label, ...bar.values.map(String)]),
    };
  }
  if (kind === 'boxplot') {
    const groups = new Map<string, number[]>();
    for (const row of rows) {
      const value = number(row[yField]);
      if (value === undefined) continue;
      const key = String(row[xField] ?? '');
      groups.set(key, [...(groups.get(key) ?? []), value]);
    }
    if (!groups.size) return undefined;
    const quantile = (sorted: number[], q: number): number => {
      if (!sorted.length) return 0;
      const position = (sorted.length - 1) * q;
      const base = Math.floor(position);
      const rest = position - base;
      const next = sorted[base + 1];
      return next === undefined ? sorted[base] as number : (sorted[base] as number) + rest * (next - (sorted[base] as number));
    };
    const categories = [...groups.keys()];
    const boxes = categories.map((category) => {
      const sorted = [...(groups.get(category) ?? [])].sort((a, b) => a - b);
      return [quantile(sorted, 0.05), quantile(sorted, 0.25), quantile(sorted, 0.5), quantile(sorted, 0.75), quantile(sorted, 0.95)];
    });
    return {
      option: {
        tooltip: { trigger: 'item' },
        grid: { left: 54, right: 30, top: 24, bottom: 34, containLabel: true },
        xAxis: { type: 'category', data: categories },
        yAxis: { type: 'value', scale: true, name: unit, mdrFormat: context.valueFormat },
        series: [{ name: title, type: 'boxplot', data: boxes, itemStyle: { borderColor: '#4d906d', color: 'rgba(77,144,109,.18)' } }],
        toolbox: { right: 4, top: 0, feature: { restore: {}, saveAsImage: { pixelRatio: 2 } } },
      },
      head: ['分组', 'P5', 'P25', 'P50', 'P75', 'P95'],
      rows: categories.map((category, index) => [category, ...(boxes[index] ?? []).map((value) => String(Math.round(value * 100) / 100))]),
    };
  }
  if (kind === 'heatmap') {
    const yFieldName = fieldOf(spec, 'y');
    const valueField = fieldOf(spec, 'value') || fieldOf(spec, 'y2');
    const xs = [...new Set(rows.map((row) => String(row[xField] ?? '')))];
    const ys = [...new Set(rows.map((row) => String(row[yFieldName] ?? '')))];
    const data = rows.flatMap((row) => {
      const value = number(row[valueField]);
      if (value === undefined) return [];
      return [[xs.indexOf(String(row[xField] ?? '')), ys.indexOf(String(row[yFieldName] ?? '')), value]];
    });
    if (!data.length) return undefined;
    const values = data.map((entry) => entry[2] as number);
    return {
      option: {
        tooltip: { position: 'top' },
        grid: { left: 54, right: 30, top: 16, bottom: 62, containLabel: true },
        xAxis: { type: 'category', data: xs, splitArea: { show: true } },
        yAxis: { type: 'category', data: ys, splitArea: { show: true } },
        visualMap: { min: Math.min(...values), max: Math.max(...values), calculable: true, orient: 'horizontal', left: 'center', bottom: 6, itemHeight: 90, mdrFormat: context.valueFormat },
        series: [{ name: title, type: 'heatmap', data, label: { show: xs.length * ys.length <= 60 }, emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,.3)' } } }],
        toolbox: { right: 4, top: 0, feature: { saveAsImage: { pixelRatio: 2 } } },
      },
      head: ['X', 'Y', '数值'],
      rows: data.map((entry) => [String(xs[entry[0] as number]), String(ys[entry[1] as number]), String(entry[2])]),
    };
  }
  if (kind === 'sankey') {
    const sourceField = fieldOf(spec, 'source'); const targetField = fieldOf(spec, 'target');
    const links = rows.flatMap((row) => {
      const value = number(row[yField]);
      const source = String(row[sourceField] ?? ''); const target = String(row[targetField] ?? '');
      if (value === undefined || !source || !target) return [];
      return [{ source, target, value }];
    });
    if (!links.length) return undefined;
    const names = [...new Set([...links.map((link) => link.source), ...links.map((link) => link.target)])];
    return {
      option: {
        tooltip: { trigger: 'item', triggerOn: 'mousemove' },
        series: [{ type: 'sankey', left: 8, right: 8, top: 12, bottom: 12, nodeWidth: 14, nodeGap: 10, emphasis: { focus: 'adjacency' }, lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.4 }, data: names.map((name) => ({ name })), links }],
        toolbox: { right: 4, top: 0, feature: { saveAsImage: { pixelRatio: 2 } } },
      },
      head: ['来源', '去向', '数值'],
      rows: links.map((link) => [link.source, link.target, String(link.value)]),
    };
  }
  if (kind === 'treemap') {
    const data = rows.flatMap((row) => {
      const value = number(row[yField]);
      return value === undefined ? [] : [{ name: String(row[xField] ?? ''), value }];
    });
    if (!data.length) return undefined;
    return {
      option: {
        tooltip: { trigger: 'item', formatter: '{b}: {c}' },
        series: [{ type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false }, upperLabel: { show: false }, itemStyle: { borderWidth: 1 }, label: { show: true, formatter: '{b}\n{c}' }, data }],
        toolbox: { right: 4, top: 0, feature: { saveAsImage: { pixelRatio: 2 } } },
      },
      head: ['分类', '数值'],
      rows: data.map((slice) => [slice.name, String(slice.value)]),
    };
  }
  if (kind === 'radar') {
    const dimensionField = fieldOf(spec, 'x');
    const scoreField = fieldOf(spec, 'y');
    const seriesField = fieldOf(spec, 'series');
    const dimensions = [...new Set(rows.map((row) => String(row[dimensionField] ?? '')))];
    const groups = [...new Set(rows.map((row) => String(row[seriesField] ?? '总计')))];
    if (!dimensions.length || !groups.length) return undefined;
    const max = Math.max(...rows.map((row) => number(row[scoreField]) ?? 0), 1);
    return {
      option: {
        tooltip: { trigger: 'item' },
        legend: { type: seriesField ? 'scroll' : 'plain', bottom: 0, left: 'center' },
        radar: { indicator: dimensions.map((name) => ({ name, max: Math.ceil(max * 1.1) })), radius: '62%', center: ['50%', '46%'], axisName: { fontSize: 11 } },
        series: [{
          type: 'radar',
          data: groups.map((group) => ({
            name: group,
            value: dimensions.map((dimension) => {
              const row = rows.find((candidate) => String(candidate[dimensionField] ?? '') === dimension && String(candidate[seriesField] ?? '总计') === group);
              return row ? number(row[scoreField]) ?? 0 : 0;
            }),
          })),
        }],
        toolbox: { right: 4, top: 0, feature: { saveAsImage: { pixelRatio: 2 } } },
      },
      head: ['维度', ...groups],
      rows: dimensions.map((dimension) => [dimension, ...groups.map((group) => {
        const row = rows.find((candidate) => String(candidate[dimensionField] ?? '') === dimension && String(candidate[seriesField] ?? '总计') === group);
        return row ? String(number(row[scoreField]) ?? '—') : '—';
      })]),
    };
  }
  if (kind === 'map') {
    const geo = object(spec.geo);
    if (!geo) return undefined;
    const nameField = fieldOf(spec, 'name') || xField;
    const valueField = fieldOf(spec, 'value') || yField;
    const data = rows.flatMap((row) => {
      const value = number(row[valueField]);
      const name = String(row[nameField] ?? '');
      return value === undefined || !name ? [] : [{ name, value }];
    });
    if (!data.length) return undefined;
    const values = data.map((slice) => slice.value);
    const mapName = fieldOf(spec, 'mapName') || 'mdr-map';
    return {
      option: {
        mdrMap: { name: mapName, geo },
        tooltip: { trigger: 'item', formatter: '{b}: {c}' },
        visualMap: { min: Math.min(...values), max: Math.max(...values), calculable: true, orient: 'horizontal', left: 'center', bottom: 4, itemHeight: 80, mdrFormat: context.valueFormat },
        series: [{ name: title, type: 'map', map: mapName, roam: false, label: { show: true, fontSize: 10 }, emphasis: { label: { show: true } }, select: { disabled: true }, data }],
        toolbox: { right: 4, top: 0, feature: { saveAsImage: { pixelRatio: 2 } } },
      },
      head: ['区域', '数值'],
      rows: data.map((slice) => [slice.name, String(slice.value)]),
    };
  }
  return undefined;
}

function axisFormat(entry: JsonObject | undefined): JsonObject | undefined {
  if (!entry) return undefined;
  const format = fieldOf(entry, 'format');
  if (!format) return undefined;
  return { format, ...(number(entry.decimals) === undefined ? {} : { decimals: number(entry.decimals) }), ...(entry.compact === true ? { compact: true } : {}) };
}

function renderChart(source: string, datasets: ComponentDatasets, chartId: string, metrics: MetricRegistry = {}): string | undefined {
  const spec = parseJson(source);
  if (!spec) return undefined;
  const reference = dataReference(spec, datasets);
  if (!reference) return undefined;
  const metricRef = typeof spec.metricRef === 'string' ? spec.metricRef : '';
  const metric = metricRef ? metrics[metricRef] : undefined;
  const xField = typeof spec.x === 'string' ? spec.x : '';
  const yField = typeof spec.y === 'string' ? spec.y : typeof metric?.field === 'string' ? metric.field : '';
  const rows = reference.rows;
  const kind = typeof spec.kind === 'string' ? spec.kind : 'line';
  if (!CHART_KINDS.includes(kind)) {
    throw new TypeError(`Unsupported chart kind "${kind}". Use ${CHART_KINDS.join(', ')}.`);
  }
  const title = String(spec.title || metric?.label || '数据图表');
  const unit = typeof spec.unit === 'string' ? spec.unit : metric?.unit ?? '';
  const valueFormat = chartValueFormat(spec, metric);
  let accessibleHead: string[] = [];
  let accessibleRows: string[][] = [];
  let unitNote = unit;

  if (SPECIAL_CHART_KINDS.includes(kind as never)) {
    const built = buildSpecialChart(kind, { spec, rows, datasets, metrics, title, unit, valueFormat });
    if (!built) {
      return `<section class="mdr-component mdr-chart">${titleBar(title, '统计图', spec.kicker)}<div class="mdr-empty">没有可绘制的数据</div></section>`;
    }
    if (['combo', 'waterfall'].includes(kind)) applyAnnotations(built.option, spec, []);
    const serializedSpecial = escape(JSON.stringify(built.option));
    const dataId = `${chartId}-data`;
    const accessible = built.rows.length > 0 && built.rows.length <= 400
      ? `<div class="mdr-visually-hidden" id="${escape(dataId)}"><table><caption>${escape(title)} 数据</caption><thead><tr>${built.head.map((cell) => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${built.rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : '';
    const noteText = built.unitNote ?? unitNote;
    const note = noteText ? `<p class="mdr-chart-note">单位：${escape(noteText)}</p>` : '';
    const describedBy = accessible ? ` aria-describedby="${escape(dataId)}"` : '';
    const anchorId = typeof spec.anchor === 'string' && /^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(spec.anchor) ? spec.anchor : chartId;
    return `<section class="mdr-component mdr-chart">${titleBar(title, '统计图', spec.kicker)}<div id="${escape(anchorId)}" class="mdr-echart" data-option="${serializedSpecial}" role="img" aria-label="${escape(title)}"${describedBy}></div>${note}${accessible}</section>`;
  }
  let option: JsonObject;
  if (kind === 'pie') {
    const data = rows.flatMap((row) => {
      const value = number(row[yField]);
      return value === undefined ? [] : [{ name: String(row[xField] ?? ''), value }];
    });
    if (!data.length) return `<section class="mdr-component mdr-chart">${titleBar(title, '统计图')}<div class="mdr-empty">没有可绘制的数据</div></section>`;
    accessibleHead = ['分类', '数值'];
    accessibleRows = data.map((slice) => [slice.name, String(slice.value)]);
    option = {
      mdrFormat: valueFormat,
      tooltip: { trigger: 'item' },
      legend: { type: data.length > 5 ? 'scroll' : 'plain', bottom: 2, left: 'center' },
      series: [{
        name: String(title), type: 'pie', radius: ['38%', '62%'], center: ['50%', '46%'],
        avoidLabelOverlap: true, itemStyle: { borderRadius: 6, borderColor: SURFACE_SENTINEL, borderWidth: 2 },
        label: {
          formatter: '{b}  {d}%',
          width: 104, overflow: 'truncate', alignTo: 'edge', edgeDistance: 4,
          minMargin: 6, lineHeight: 14, color: LINE_SENTINEL,
        },
        labelLine: { length: 8, length2: 8, maxSurfaceAngle: 80 },
        emphasis: { scale: true, scaleSize: 8 }, data,
      }],
      toolbox: { right: 4, top: 0, feature: { saveAsImage: { pixelRatio: 2 } } },
    };
  } else {
    const points: Array<{ x: string; xNumeric?: number; y: number; series: string }> = rows.flatMap((row) => {
      const y = number(row[yField]);
      if (y === undefined) return [];
      const rawX = row[xField]; const xNumeric = number(rawX);
      return [{ x: String(rawX ?? ''), ...(xNumeric === undefined ? {} : { xNumeric }), y, series: String(row[String(spec.series || '')] ?? '总计') }];
    });
    if (points.length === 0) return `<section class="mdr-component mdr-chart">${titleBar(title, '统计图')}<div class="mdr-empty">没有可绘制的数据</div></section>`;
    const numericScatter = kind === 'scatter' && points.every((point) => point.xNumeric !== undefined);
    const categories = [...new Set(points.map((point) => point.x))];
    const seriesNames = [...new Set(points.map((point) => point.series))];
    const series = seriesNames.map((name) => {
      const values = points.filter((point) => point.series === name);
      const data = numericScatter
        ? values.map((point) => [point.xNumeric, point.y])
        : categories.map((category) => {
          const point = values.find((candidate) => candidate.x === category);
          return point?.y ?? null;
        });
      const type = kind === 'bar' || kind === 'column' ? 'bar' : kind === 'scatter' ? 'scatter' : 'line';
      return {
        name, type, data,
        ...(type === 'line' ? { smooth: true, showSymbol: categories.length < 40, symbolSize: 8 } : {}),
        ...(kind === 'area' ? { areaStyle: { opacity: 0.18 } } : {}),
        ...(type === 'bar' ? { barMaxWidth: 34, itemStyle: { borderRadius: [5, 5, 0, 0] } } : {}),
        ...(type === 'scatter' ? { symbolSize: 12 } : {}),
        emphasis: { focus: 'series' },
      };
    });
    const canZoom = kind !== 'scatter' || numericScatter;
    const banded = kind === 'bar' || kind === 'column';
    accessibleHead = numericScatter ? [xField, yField] : ['类别', ...seriesNames];
    accessibleRows = numericScatter
      ? points.map((point) => [String(point.x), String(point.y)])
      : categories.map((category) => [
          category,
          ...seriesNames.map((name) => {
            const point = points.find((candidate) => candidate.x === category && candidate.series === name);
            return point === undefined ? '—' : String(point.y);
          }),
        ]);
    option = {
      mdrFormat: valueFormat,
      tooltip: { trigger: 'axis', axisPointer: { type: banded ? 'shadow' : 'cross' } },
      legend: { type: seriesNames.length > 5 ? 'scroll' : 'plain', top: 2, left: 8 },
      grid: { left: 54, right: 30, top: 36, bottom: canZoom && categories.length > 8 ? 46 : 28, containLabel: true },
      xAxis: numericScatter
        ? { type: 'value', name: xField, nameLocation: 'middle', nameGap: 28, splitLine: { show: false }, mdrFormat: valueFormat }
        : {
            type: 'category', data: categories,
            boundaryGap: banded ? true : ['2%', '2%'],
            axisLabel: { hideOverlap: true, showMaxLabel: true },
          },
      yAxis: { type: 'value', name: unit, nameGap: 12, scale: kind === 'scatter', splitLine: { show: true }, mdrFormat: valueFormat },
      series,
      toolbox: {
        right: 4, top: 0,
        feature: {
          ...(canZoom ? { dataZoom: { yAxisIndex: 'none' } } : {}),
          restore: {}, saveAsImage: { pixelRatio: 2 },
        },
      },
      ...(canZoom ? { dataZoom: [{ type: 'inside', filterMode: 'filter' }, ...(categories.length > 8 ? [{ type: 'slider', height: 14, bottom: 4, borderColor: 'transparent', fillerColor: 'rgba(85,214,190,.18)' }] : [])] } : {}),
    };
    applyAnnotations(option, spec, seriesNames);
  }
  const serialized = escape(JSON.stringify(option));
  const note = unitNote ? `<p class="mdr-chart-note">单位：${escape(unitNote)}</p>` : '';
  // A canvas chart is opaque to assistive tech; a visually hidden data table keeps the numbers reachable.
  const dataId = `${chartId}-data`;
  const accessible = accessibleRows.length > 0 && accessibleRows.length <= 400
    ? `<div class="mdr-visually-hidden" id="${escape(dataId)}"><table><caption>${escape(title)} 数据</caption><thead><tr>${accessibleHead.map((cell) => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${accessibleRows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : '';
  const describedBy = accessible ? ` aria-describedby="${escape(dataId)}"` : '';
  const anchorId = typeof spec.anchor === 'string' && /^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(spec.anchor) ? spec.anchor : chartId;
  return `<section class="mdr-component mdr-chart">${titleBar(title, '统计图', spec.kicker)}<div id="${escape(anchorId)}" class="mdr-echart" data-option="${serialized}" role="img" aria-label="${escape(title)}"${describedBy}></div>${note}${accessible}</section>`;
}

function renderTable(source: string, datasets: ComponentDatasets, metrics: MetricRegistry = {}): string | undefined {
  const spec = parseJson(source); if (!spec) return undefined;
  const reference = dataReference(spec, datasets); if (!reference) return undefined;
  const dataset = datasets[reference.name];
  const columns: JsonObject[] = Array.isArray(spec.columns)
    ? spec.columns.map(object).filter((column): column is JsonObject => !!column)
    : Object.keys(reference.rows[0] ?? {}).length > 0
      ? Object.keys(reference.rows[0] ?? {}).map((field): JsonObject => ({ field, label: field }))
      : (dataset?.columns ?? []).map((column): JsonObject => ({ field: column.name, label: column.name }));
  const sort = object(spec.defaultSort);
  const height = Math.max(160, Math.min(1200, number(spec.viewportHeight) ?? 480));
  const rows = reference.rows.slice(0, 5000);
  // Cell formats travel in a side map: Tabulator rejects unknown column definition options.
  const formats: Record<string, string> = {};
  const tableColumns = columns.map((column) => {
    const field = String(column.field ?? '');
    const sample = rows.find((row) => row[field] !== null && row[field] !== undefined)?.[field];
    const metricFormat = typeof column.formatRef === 'string' ? metrics[column.formatRef]?.format : undefined;
    const explicit = typeof column.format === 'string' ? column.format : undefined;
    const resolved = explicit ?? (typeof metricFormat === 'string' ? metricFormat : undefined);
    if (resolved) formats[field] = resolved;
    return {
      field,
      title: String(column.label || field),
      minWidth: Math.max(72, Math.min(600, number(column.minWidth) ?? 112)),
      ...(number(column.width) === undefined ? {} : { width: number(column.width) }),
      ...(typeof column.frozen === 'boolean' ? { frozen: column.frozen } : {}),
      ...(typeof column.sorter === 'string' ? { sorter: column.sorter } : { sorter: typeof sample === 'number' ? 'number' : 'string' }),
      ...(typeof sample === 'number' ? { hozAlign: 'right' } : {}),
    };
  });
  const data = rows.map((row) => Object.fromEntries(tableColumns.map((column) => [column.field, row[column.field] ?? null])));
  const initialSort = typeof sort?.field === 'string'
    ? [{ column: sort.field, dir: sort.direction === 'desc' ? 'desc' : 'asc' }]
    : [];
  const exportable = spec.exportable !== false;
  const tableConfig = escape(JSON.stringify({ data, columns: tableColumns, formats, initialSort, height, exportable, title: spec.title || '数据明细' }));
  const updatedAt = spec.updatedAt || dataset?.updatedAt;
  const rowSummary = reference.rows.length > rows.length
    ? `显示 ${rows.length.toLocaleString('zh-CN')} / ${reference.rows.length.toLocaleString('zh-CN')} 行`
    : `${reference.rows.length.toLocaleString('zh-CN')} 行`;
  const provenance = [
    updatedAt ? `<span>数据截至 ${escape(updatedAt)}</span>` : '',
    dataset?.source ? `<span>来源 ${escape(dataset.source)}</span>` : '',
    dataset?.fetchedAt ? `<span>抓取于 ${escape(dataset.fetchedAt)}</span>` : '',
  ].filter(Boolean).join('');
  const actions = exportable
    ? `<div class="mdr-table-actions"><button type="button" class="mdr-table-action" data-mdr-export="csv">导出 CSV</button><button type="button" class="mdr-table-action" data-mdr-export="clipboard">复制表格</button></div>`
    : '';
  return `<section class="mdr-component mdr-data-table"${anchorAttribute(spec)}>${titleBar(spec.title || '数据明细', '数据表', spec.kicker)}<div class="mdr-table-summary"><span>${rowSummary}</span>${provenance}${actions}</div><div class="mdr-tabulator-host" style="height:${height}px" role="region" aria-label="${escape(spec.title || '数据明细')}" tabindex="0"><div class="mdr-tabulator" data-table="${tableConfig}"></div></div><p class="mdr-table-status" role="status" aria-live="polite"></p><noscript><p class="mdr-table-noscript">启用 JavaScript 后可查看交互式数据表。</p></noscript></section>`;
}

function renderSql(source: string, info: string): string {
  const dialect = /(?:^|\s)dialect=([A-Za-z0-9_-]+)/.exec(info)?.[1] ?? 'standard';
  const language = dialect === 'standard' ? 'sql' : dialect;
  let formatted = source;
  try {
    formatted = formatSql(source, { language: language as 'sql' | 'postgresql' | 'mysql' | 'bigquery' | 'duckdb' | 'sqlite', tabWidth: 2 });
  } catch {
    // Keep the author's source intact when the formatter does not understand a dialect feature.
  }
  const { title } = fenceAttributes(info);
  const lines = formatted.split('\n').length;
  return `<details class="mdr-component mdr-sql"><summary><span class="mdr-sql-summary">${escape(title || 'SQL 查询')}</span><span class="mdr-sql-meta">${escape(dialect)} · ${lines} 行</span></summary><pre><code>${escape(formatted)}</code></pre></details>`;
}

function renderMermaid(source: string, info: string): string | undefined {
  if (!source.trim()) return undefined;
  const { title, kicker } = fenceAttributes(info);
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return `<section class="mdr-component mdr-mermaid">${titleBar(title || '流程图', '流程图', kicker)}<div class="mdr-mermaid-host" data-mermaid="${encoded}"></div></section>`;
}

function renderInfographic(source: string, info: string): string | undefined {
  if (!source.trim()) return undefined;
  const { title, kicker } = fenceAttributes(info);
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return `<section class="mdr-component mdr-infographic">${titleBar(title || '信息图', '信息图', kicker)}<div class="mdr-infographic-host" data-infographic="${encoded}"></div></section>`;
}

function renderT8(source: string, info: string): string {
  const { title, kicker } = fenceAttributes(info);
  const encodedSource = escape(JSON.stringify(source));
  return `<section class="mdr-component mdr-t8">${titleBar(title || '分析叙述', '分析叙述', kicker)}<div class="mdr-t8-host" data-t8="${encodedSource}" aria-label="${escape(title || '分析叙述')}"></div><noscript><pre class="mdr-t8-fallback">${escape(source)}</pre></noscript></section>`;
}

function renderExcalidraw(source: string, info: string, scenes: ComponentScenes): string | undefined {
  const spec = parseJson(source);
  const scene = typeof spec?.sceneRef === 'string' ? scenes[spec.sceneRef] : spec;
  if (!scene || scene.type !== 'excalidraw' || !Array.isArray(scene.elements)) return undefined;
  const { title, kicker } = fenceAttributes(info);
  const encoded = Buffer.from(JSON.stringify(scene), 'utf8').toString('base64');
  return `<section class="mdr-component mdr-excalidraw">${titleBar(spec?.title || title || '业务关系图', '业务关系图', spec?.kicker ?? kicker)}<div class="mdr-excalidraw-host" data-excalidraw="${encoded}"></div></section>`;
}

const AGGREGATIONS = ['sum', 'avg', 'min', 'max', 'count', 'first'] as const;

function aggregate(values: number[], agg: string): number | undefined {
  if (agg === 'count') return values.length;
  if (!values.length) return undefined;
  if (agg === 'sum') return values.reduce((sum, value) => sum + value, 0);
  if (agg === 'avg') return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (agg === 'min') return Math.min(...values);
  if (agg === 'max') return Math.max(...values);
  return values[0];
}

/** Ranked bar list: readable where a bar chart would crowd its axis labels. */
function renderRanking(source: string, datasets: ComponentDatasets, metrics: MetricRegistry): string | undefined {
  const spec = parseJson(source);
  if (!spec) return undefined;
  const reference = dataReference(spec, datasets);
  if (!reference) return undefined;
  const metricRef = typeof spec.metricRef === 'string' ? spec.metricRef : '';
  const metric = metricRef ? metrics[metricRef] : undefined;
  const labelField = fieldOf(spec, 'x');
  const valueField = fieldOf(spec, 'y') || (typeof metric?.field === 'string' ? metric.field : '');
  const rankingFormat = normalizeMetricFormat(spec.format, spec.currency);
  const formatSpec: MetricSpec = metric ?? {
    ...(spec.format === undefined ? {} : { format: rankingFormat.format }),
    ...(rankingFormat.currency ? { currency: rankingFormat.currency } : {}),
    ...(typeof spec.unit === 'string' ? { unit: spec.unit } : {}),
    ...(number(spec.decimals) === undefined ? {} : { decimals: number(spec.decimals) }),
    ...(spec.compact === true ? { compact: true } : {}),
  };
  const limit = Math.max(1, Math.min(50, number(spec.limit) ?? 10));
  const points = reference.rows.flatMap((row) => {
    const value = number(row[valueField]);
    return value === undefined ? [] : [{ label: String(row[labelField] ?? ''), value }];
  }).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'zh-CN'));
  if (!points.length) return `<section class="mdr-component mdr-ranking"${anchorAttribute(spec)}>${titleBar(spec.title || '排行', '排行', spec.kicker)}<div class="mdr-empty">没有可绘制的数据</div></section>`;
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const shown = points.slice(0, limit);
  const max = shown[0]?.value ?? 1;
  const showShare = spec.share !== false;
  const rows = shown.map((point, index) => {
    const width = max === 0 ? 0 : Math.max(2, Math.round((point.value / max) * 100));
    const share = showShare && total !== 0 ? `<span class="mdr-ranking-share">${((point.value / total) * 100).toFixed(1)}%</span>` : '';
    return `<li class="mdr-ranking-item"><span class="mdr-ranking-rank">${index + 1}</span><span class="mdr-ranking-label">${escape(point.label)}</span><span class="mdr-ranking-track"><span class="mdr-ranking-bar" style="width:${width}%"></span></span><span class="mdr-ranking-value">${formatMetricValue(point.value, formatSpec)}</span>${share}</li>`;
  }).join('');
  const note = reference.rows.length > shown.length
    ? `<p class="mdr-chart-note">显示前 ${shown.length} 项，共 ${reference.rows.length} 项</p>`
    : '';
  return `<section class="mdr-component mdr-ranking"${anchorAttribute(spec)}>${titleBar(spec.title || '排行', '排行', spec.kicker)}<ol class="mdr-ranking-list">${rows}</ol>${note}</section>`;
}

/** Cross-tabulated matrix: rows x columns x one aggregated measure. */
function renderPivot(source: string, datasets: ComponentDatasets, metrics: MetricRegistry): string | undefined {
  const spec = parseJson(source);
  if (!spec) return undefined;
  const reference = dataReference(spec, datasets);
  if (!reference) return undefined;
  const rowField = fieldOf(spec, 'rows');
  const columnField = fieldOf(spec, 'columns');
  const valueField = fieldOf(spec, 'value');
  const agg = typeof spec.agg === 'string' && AGGREGATIONS.includes(spec.agg as never) ? spec.agg : 'sum';
  const formatSpec: MetricSpec = {
    ...(typeof spec.metricRef === 'string' && metrics[spec.metricRef] ? metrics[spec.metricRef] as MetricSpec : {}),
    ...(spec.format === undefined ? {} : { format: normalizeMetricFormat(spec.format, spec.currency).format }),
    ...(normalizeMetricFormat(spec.format, spec.currency).currency ? { currency: normalizeMetricFormat(spec.format, spec.currency).currency } : {}),
    ...(typeof spec.unit === 'string' ? { unit: spec.unit } : {}),
    ...(number(spec.decimals) === undefined ? {} : { decimals: number(spec.decimals) }),
    ...(spec.compact === true ? { compact: true } : {}),
  };
  const rowKeys = [...new Set(reference.rows.map((row) => String(row[rowField] ?? '')))];
  const columnKeys = [...new Set(reference.rows.map((row) => String(row[columnField] ?? '')))];
  if (!rowKeys.length || !columnKeys.length) {
    return `<section class="mdr-component mdr-pivot"${anchorAttribute(spec)}>${titleBar(spec.title || '交叉表', '交叉表', spec.kicker)}<div class="mdr-empty">没有可绘制的数据</div></section>`;
  }
  const cell = (rowKey: string, columnKey: string): number | undefined => aggregate(
    reference.rows.filter((row) => String(row[rowField] ?? '') === rowKey && String(row[columnField] ?? '') === columnKey)
      .flatMap((row) => { const value = number(row[valueField]); return value === undefined ? [] : [value]; }),
    agg,
  );
  const rowTotals = rowKeys.map((rowKey) => aggregate(reference.rows.filter((row) => String(row[rowField] ?? '') === rowKey)
    .flatMap((row) => { const value = number(row[valueField]); return value === undefined ? [] : [value]; }), agg));
  const columnTotals = columnKeys.map((columnKey) => aggregate(reference.rows.filter((row) => String(row[columnField] ?? '') === columnKey)
    .flatMap((row) => { const value = number(row[valueField]); return value === undefined ? [] : [value]; }), agg));
  const grandTotal = aggregate(reference.rows.flatMap((row) => { const value = number(row[valueField]); return value === undefined ? [] : [value]; }), agg);
  const rowTotal = spec.rowTotal !== false;
  const columnTotal = spec.columnTotal === true;
  const rowLabel = typeof spec.rowsLabel === 'string' ? spec.rowsLabel : rowField;
  const columnLabel = typeof spec.columnsLabel === 'string' ? spec.columnsLabel : columnField;
  const head = `<tr><th scope="col">${escape(rowLabel)} \\ ${escape(columnLabel)}</th>${columnKeys.map((key) => `<th scope="col">${escape(key)}</th>`).join('')}${rowTotal ? '<th scope="col">合计</th>' : ''}</tr>`;
  const body = rowKeys.map((rowKey, rowIndex) => `<tr><th scope="row">${escape(rowKey)}</th>${columnKeys.map((columnKey) => {
    const value = cell(rowKey, columnKey);
    return `<td>${value === undefined ? '—' : escape(formatMetricValue(value, formatSpec))}</td>`;
  }).join('')}${rowTotal ? `<td class="mdr-pivot-total">${rowTotals[rowIndex] === undefined ? '—' : escape(formatMetricValue(rowTotals[rowIndex], formatSpec))}</td>` : ''}</tr>`).join('');
  const footer = columnTotal
    ? `<tfoot><tr><th scope="row">合计</th>${columnTotals.map((value) => `<td>${value === undefined ? '—' : escape(formatMetricValue(value, formatSpec))}</td>`).join('')}${rowTotal ? `<td class="mdr-pivot-total">${grandTotal === undefined ? '—' : escape(formatMetricValue(grandTotal, formatSpec))}</td>` : ''}</tr></tfoot>`
    : '';
  return `<section class="mdr-component mdr-pivot"${anchorAttribute(spec)}>${titleBar(spec.title || '交叉表', '交叉表', spec.kicker)}<div class="mdr-pivot-scroll"><table class="mdr-pivot-table"><caption class="mdr-visually-hidden">${escape(spec.title || '交叉表')}</caption><thead>${head}</thead><tbody>${body}</tbody>${footer}</table></div></section>`;
}

/** Inline trend for a KPI card: a 12-point series is not worth a 250px chart. */
function renderSparkline(item: JsonObject, datasets: ComponentDatasets): string {
  const spec = object(item.sparkline);
  if (!spec) return '';
  const reference = dataReference(spec, datasets);
  if (!reference) return '';
  const xField = fieldOf(spec, 'x');
  const yField = fieldOf(spec, 'y');
  const points = reference.rows.flatMap((row) => {
    const value = number(row[yField]);
    return value === undefined ? [] : [value];
  });
  if (points.length < 2) return '';
  const width = 96; const height = 26; const padding = 2;
  const min = Math.min(...points); const max = Math.max(...points);
  const span = max - min || 1;
  const step = (width - padding * 2) / (points.length - 1);
  const path = points.map((value, index) => {
    const x = padding + index * step;
    const y = height - padding - ((value - min) / span) * (height - padding * 2);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const last = points[points.length - 1] as number;
  const trend = last >= (points[0] as number) ? 'up' : 'down';
  const label = String(spec.title || item.label || '趋势');
  return `<svg class="mdr-sparkline mdr-sparkline--${trend}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escape(label)} 迷你趋势图"><path d="${path}"/></svg>`;
}

/** Severity-coded findings that link to the chart that proves them. */
function renderFindings(source: string, datasets: ComponentDatasets, metrics: MetricRegistry): string | undefined {
  const spec = parseJson(source);
  if (!spec || !Array.isArray(spec.items)) return undefined;
  const severityLabels: Record<string, string> = { risk: '风险', opportunity: '机会', info: '说明', positive: '正常' };
  const cards = spec.items.slice(0, 12).map((raw) => {
    const item = object(raw);
    if (!item) return '';
    const severity = typeof item.severity === 'string' && severityLabels[item.severity] ? item.severity : 'info';
    const metricRef = typeof item.metricRef === 'string' ? item.metricRef : '';
    const resolved = metricRef ? resolveMetric(metricRef, metrics, datasets) : undefined;
    const evidence = Array.isArray(item.evidence) ? item.evidence.filter((entry): entry is string => typeof entry === 'string') : [];
    const links = evidence.map((entry) => `<a class="mdr-finding-link" href="#${escape(entry)}">${escape(entry)}</a>`).join('');
    const value = resolved ? `<span class="mdr-finding-value">${formatMetricValue(resolved.value, resolved.metric, { withUnit: true })}</span>` : '';
    const detail = typeof item.detail === 'string' && item.detail ? `<p class="mdr-finding-detail">${escape(item.detail)}</p>` : '';
    const action = typeof item.action === 'string' && item.action ? `<p class="mdr-finding-action"><span>行动</span>${escape(item.action)}${typeof item.owner === 'string' && item.owner ? `<em>${escape(item.owner)}</em>` : ''}</p>` : '';
    return `<li class="mdr-finding mdr-finding--${escape(severity)}"><div class="mdr-finding-head"><span class="mdr-finding-severity">${escape(severityLabels[severity] as string)}</span><span class="mdr-finding-title">${escape(item.title || '发现')}</span>${value}</div>${detail}${action}${links ? `<p class="mdr-finding-evidence"><span>证据</span>${links}</p>` : ''}</li>`;
  }).join('');
  return `<section class="mdr-component mdr-findings"${anchorAttribute(spec)}>${titleBar(spec.title || '关键发现', '发现', spec.kicker)}<ul class="mdr-findings-list">${cards}</ul></section>`;
}

/** Metric definitions rendered as a reader-facing appendix instead of prose. */
function renderProvenance(source: string, metrics: MetricRegistry): string | undefined {
  const spec = parseJson(source);
  if (!spec) return undefined;
  const requested = Array.isArray(spec.items)
    ? spec.items.flatMap((entry) => typeof entry === 'string' ? [entry] : [])
    : Object.keys(metrics);
  const rows = requested.flatMap((id) => {
    const metric = metrics[id];
    if (!metric) return [];
    const cells = [
      `<th scope="row">${escape(metric.label ?? id)}</th>`,
      `<td>${escape(metric.definition ?? '—')}</td>`,
      `<td>${metric.numerator || metric.denominator ? `${escape(metric.numerator ?? '—')} / ${escape(metric.denominator ?? '—')}` : '—'}</td>`,
      `<td>${metric.source ? escape(metric.source) : '—'}</td>`,
      `<td>${metric.asOf ? escape(metric.asOf) : '—'}</td>`,
      `<td>${metric.owner ? escape(metric.owner) : '—'}</td>`,
    ];
    return [`<tr>${cells.join('')}</tr>`];
  });
  if (!rows.length) return undefined;
  return `<section class="mdr-component mdr-provenance"${anchorAttribute(spec)}>${titleBar(spec.title || '口径与来源', '口径', spec.kicker)}<div class="mdr-table-scroll"><table class="mdr-provenance-table"><thead><tr><th scope="col">指标</th><th scope="col">口径</th><th scope="col">分子 / 分母</th><th scope="col">来源</th><th scope="col">数据截至</th><th scope="col">责任方</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`;
}

/** Dataset health: size, freshness, and columns with missing values. */
function renderQuality(source: string, datasets: ComponentDatasets): string | undefined {
  const spec = parseJson(source);
  if (!spec) return undefined;
  const ids = Array.isArray(spec.dataRefs) && spec.dataRefs.length
    ? spec.dataRefs.filter((entry): entry is string => typeof entry === 'string')
    : Object.keys(datasets);
  const cards = ids.flatMap((id) => {
    const dataset = datasets[id];
    if (!dataset) return [];
    let rows: RecordRow[] = [];
    try { rows = datasetRecords(dataset); } catch { rows = []; }
    const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : (dataset.columns ?? []).map((column) => column.name);
    const missing = columns.map((column) => ({
      column,
      count: rows.filter((row) => row[column] === null || row[column] === undefined || row[column] === '').length,
    })).filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count).slice(0, 4);
    const missingText = missing.length
      ? missing.map((entry) => `${escape(entry.column)} ${entry.count}`).join('、')
      : '无';
    const meta = [
      dataset.source ? `来源 ${escape(dataset.source.replace(/^\s*来源\s*/, ''))}` : '',
      dataset.updatedAt ? `截至 ${escape(dataset.updatedAt)}` : '',
      dataset.fetchedAt ? `抓取于 ${escape(dataset.fetchedAt)}` : '',
    ].filter(Boolean).join(' · ');
    return [`<li class="mdr-quality-item"><div class="mdr-quality-head"><span class="mdr-quality-id">${escape(id)}</span><span class="mdr-quality-size">${rows.length.toLocaleString('zh-CN')} 行 · ${columns.length} 列</span></div><dl class="mdr-quality-meta"><div><dt>缺失值</dt><dd>${missingText}</dd></div>${meta ? `<div><dt>来源</dt><dd>${meta}</dd></div>` : ''}</dl></li>`];
  });
  const notes = Array.isArray(spec.notes) ? spec.notes.filter((entry): entry is string => typeof entry === 'string') : [];
  const noteList = notes.length ? `<ul class="mdr-quality-notes">${notes.map((note) => `<li>${escape(note)}</li>`).join('')}</ul>` : '';
  if (!cards.length && !notes.length) return undefined;
  return `<section class="mdr-component mdr-quality"${anchorAttribute(spec)}>${titleBar(spec.title || '数据质量', '质量', spec.kicker)}<ul class="mdr-quality-list">${cards.join('')}</ul>${noteList}</section>`;
}

/** Stable in-page anchor so findings and prose can link to the exact evidence. */
function anchorAttribute(spec: JsonObject): string {
  return typeof spec.anchor === 'string' && /^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(spec.anchor)
    ? ` id="${escape(spec.anchor)}"`
    : '';
}

function renderComponent(
  language: string,
  source: string,
  info: string,
  datasets: ComponentDatasets,
  scenes: ComponentScenes,
  chartId = 'mdr-chart-1',
  metrics: MetricRegistry = {},
): string | undefined {
  switch (language.toLowerCase()) {
    case 'kpi': return renderKpi(source, datasets, metrics);
    case 'chart': return renderChart(source, datasets, chartId, metrics);
    case 'data-table': return renderTable(source, datasets, metrics);
    case 'ranking': return renderRanking(source, datasets, metrics);
    case 'pivot': return renderPivot(source, datasets, metrics);
    case 'findings': return renderFindings(source, datasets, metrics);
    case 'provenance': return renderProvenance(source, metrics);
    case 'quality': return renderQuality(source, datasets);
    case 'sql': return renderSql(source, info);
    case 'mermaid': return renderMermaid(source, info);
    case 'infographic': return renderInfographic(source, info);
    case 'antv-t8': return renderT8(source, info);
    case 'excalidraw': return renderExcalidraw(source, info, scenes);
    default: return undefined;
  }
}

interface BlockStateLines {
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  src: string;
}

function matchingCloseLine(state: BlockStateLines, startLine: number, endLine: number): number {
  let fenceChar = '';
  let fenceLength = 0;
  for (let line = startLine + 1; line < endLine; line += 1) {
    const start = state.bMarks[line] ?? 0; const end = state.eMarks[line] ?? start;
    const text = state.src.slice(start + (state.tShift[line] ?? 0), end).trim();
    const fence = /^(`{3,}|~{3,})/.exec(text);
    if (fence) {
      const marker = fence[1] ?? '';
      if (!fenceChar) { fenceChar = marker[0] ?? ''; fenceLength = marker.length; }
      else if (marker[0] === fenceChar && marker.length >= fenceLength) { fenceChar = ''; fenceLength = 0; }
      continue;
    }
    if (!fenceChar && text === ']') return line;
  }
  return -1;
}

function registerLayoutBlocks(md: MarkdownIt): void {
  md.block.ruler.before('paragraph', 'mdr_layout_blocks', (state, startLine, endLine, silent) => {
    const start = (state.bMarks[startLine] ?? 0) + (state.tShift[startLine] ?? 0);
    const end = state.eMarks[startLine] ?? start;
    const line = state.src.slice(start, end).trim();
    const column = /^\[column(?:\s+[^\]]*)?$/.test(line);
    const details = /^\[details(?:\s+([^\]]*))?\]?$/.exec(line);
    if (!column && !details) return false;
    const closeLine = matchingCloseLine(state, startLine, endLine);
    if (closeLine < 0) return false;
    if (silent) return true;
    const token = state.push(column ? 'mdr_column_open' : 'mdr_details_open', 'div', 1);
    token.block = true; token.map = [startLine, closeLine + 1]; token.markup = '[';
    if (details) {
      const summary = (details[1] ?? '').replace(/\s+open\s*$/, '').trim() || '详情';
      token.meta = { summary, open: /(?:^|\s)open(?:\s|$)/.test(details[1] ?? '') };
    }
    state.md.block.tokenize(state, startLine + 1, closeLine);
    const close = state.push(column ? 'mdr_column_close' : 'mdr_details_close', 'div', -1);
    close.block = true; close.markup = ']';
    state.line = closeLine + 1;
    return true;
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.renderer.rules.mdr_column_open = (tokens, index) => {
    const previous = tokens[index - 1];
    return `${previous?.type === 'mdr_column_close' ? '' : '<div class="mdr-columns">'}<section class="mdr-column">\n`;
  };
  md.renderer.rules.mdr_column_close = (tokens, index) => tokens[index + 1]?.type === 'mdr_column_open' ? '</section>\n' : '</section></div>\n';
  md.renderer.rules.mdr_details_open = (tokens, index) => {
    const meta = tokens[index]?.meta as { summary?: string; open?: boolean } | undefined;
    return `<details class="mdr-details"${meta?.open ? ' open' : ''}><summary>${escape(meta?.summary || '详情')}</summary><div class="mdr-details-content">\n`;
  };
  md.renderer.rules.mdr_details_close = () => '</div></details>\n';
}

export function registerComponentRenderers(
  md: MarkdownIt,
  datasets: ComponentDatasets = {},
  scenes: ComponentScenes = {},
  metrics: MetricRegistry = {},
): void {
  registerLayoutBlocks(md);
  let chartIndex = 0;
  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    if (!token) return '';
    const info = token.info.trim(); const language = info.split(/\s+/, 1)[0] ?? '';
    const chartId = language.toLowerCase() === 'chart' ? `mdr-chart-${++chartIndex}` : undefined;
    // Narrative components carry prose, so `{{metric_id}}` tokens resolve before rendering.
    const content = ['antv-t8', 'infographic', 'mermaid'].includes(language.toLowerCase())
      ? substituteMetricTokens(token.content, metrics, datasets)
      : token.content;
    const component = renderComponent(language, content, info, datasets, scenes, chartId, metrics);
    return component ?? defaultFence?.(tokens, index, options, env, renderer) ?? `<pre><code>${escape(token.content)}</code></pre>\n`;
  };

  // Resolve `{{metric_id}}` tokens in ordinary prose too.
  md.core.ruler.after('inline', 'mdr_metric_tokens', (state) => {
    if (Object.keys(metrics).length === 0) return false;
    for (const token of state.tokens) {
      if (token.type !== 'inline' || !token.children) continue;
      for (const child of token.children) {
        if (child.type !== 'text' || !child.content.includes('{{')) continue;
        child.content = substituteMetricTokens(child.content, metrics, datasets);
      }
    }
    return false;
  });
}

/** Dataset ids referenced through frontmatter metric definitions. */
export function metricDatasetRefs(metrics: MetricRegistry = {}): string[] {
  const refs = new Set<string>();
  for (const metric of Object.values(metrics)) {
    if (typeof metric.dataRef === 'string') refs.add(metric.dataRef);
    if (typeof metric.comparison?.dataRef === 'string') refs.add(metric.comparison.dataRef);
  }
  return [...refs];
}

export function metricsNeedDataset(metrics: MetricRegistry, dataRef: string): boolean {
  return metricDatasetRefs(metrics).includes(dataRef);
}

export function componentNeedsDataset(language: string, source: string): string | undefined {
  if (language !== 'chart' && language !== 'data-table') return undefined;
  const spec = parseJson(source);
  return typeof spec?.dataRef === 'string' ? spec.dataRef : undefined;
}

export const JSON_COMPONENT_LANGUAGES = ['kpi', 'chart', 'data-table', 'ranking', 'pivot', 'findings', 'provenance', 'quality', 'excalidraw'] as const;

export function componentSpec(language: string, source: string): JsonObject | undefined {
  if (!(JSON_COMPONENT_LANGUAGES as readonly string[]).includes(language)) return undefined;
  return parseJson(source);
}

export function renderExtensionBlock(
  language: string,
  source: string,
  info: string,
  datasets: ComponentDatasets = {},
  scenes: ComponentScenes = {},
  metrics: MetricRegistry = {},
): string | undefined {
  return renderComponent(language, source, info, datasets, scenes, undefined, metrics);
}

export const COMPONENT_LANGUAGES = ['kpi', 'chart', 'data-table', 'ranking', 'pivot', 'findings', 'provenance', 'quality', 'sql', 'mermaid', 'infographic', 'antv-t8', 'excalidraw'] as const;

export function isSupportedComponent(language: string): boolean {
  return (COMPONENT_LANGUAGES as readonly string[]).includes(language);
}

export function tokenFenceInfo(token: Token): { language: string; info: string } {
  const info = token.info.trim();
  return { language: info.split(/\s+/, 1)[0]?.toLowerCase() ?? '', info };
}
