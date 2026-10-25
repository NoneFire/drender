import type { Context } from '@deepseek-ai/cordis';
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-skill';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { posix as path } from 'node:path';
import {
  COMPONENT_LANGUAGES,
  MAX_ASSET_BYTES,
  MAX_MARKDOWN_BYTES,
  MAX_VALIDATION_DIAGNOSTICS,
  datasetRecords,
  extractMetricConfig,
  renderReport,
  reportFileName,
  validateReport,
  type Diagnostic,
  type ReportAsset,
  type ReportDataset,
  type ReportDocument,
  type MetricRegistry,
  type ReportMode,
  type ReportAssetSourceConfig,
  type SqliteSourceConfig,
  extractAssetSourceConfig,
  extractSqliteSourceConfig,
} from '@tita-agent/renderer-core';
import { loadMarkdownSqliteSources } from '@tita-agent/data-sources';

export { loadMarkdownSqliteSources, loadSqliteDataset, parseCsvDataset, readCsvDataset } from '@tita-agent/data-sources';

const drenderReportSkill = readFileSync(new URL('./skills/drender-report/SKILL.md', import.meta.url), 'utf8');

export const name = '@tita-agent/dsh-drender-plugin';
export const inject = ['tools', 'skills', 'attachments'] as const;

interface ToolInput {
  markdown?: string;
  path?: string;
  assets?: Record<string, unknown>;
  datasets?: Record<string, unknown>;
  fontSize?: number;
}

interface DatasetSummary {
  id: string;
  rows: number;
  bytes: number;
}

interface ComponentSummary {
  type: string;
  title: string;
  dataRef: string;
  rows: number;
  heightPx: number;
  kind: string;
}

interface ToolResult {
  status: 'valid' | 'invalid' | 'rendered' | 'storage-failed';
  title: string;
  mode: ReportMode | '';
  diagnostics: Diagnostic[];
  artifact: { attachmentId: string; name: string; bytes: number };
  sourcePath: string;
  sourceWorkspacePath: string;
  previewPath: string;
  previewWorkspacePath: string;
  datasetStats: DatasetSummary[];
  components: ComponentSummary[];
  /** Declared frontmatter metrics, surfaced so an agent can confirm what the render saw. */
  metricCount: number;
}

interface WorkspaceFileSystem {
  resolve(path: string, options?: { cwd?: string; signal?: AbortSignal }): Promise<unknown>;
  contains(parent: unknown, child: unknown): boolean;
  stat(target: unknown, signal?: AbortSignal): Promise<{ type: string; size?: number } | undefined>;
  processPath(target: unknown): string;
  writeText(target: unknown, content: string, expected?: unknown, signal?: AbortSignal): Promise<unknown>;
}

const diagnosticSchema = {
  type: 'object',
  properties: {
    severity: { type: 'string', description: 'error or warning', required: true },
    code: { type: 'string', description: 'Stable diagnostic code', required: true },
    message: { type: 'string', description: 'Human-readable explanation', required: true },
    line: { type: 'number', description: 'One-based Markdown line', required: true },
    path: { type: 'string', description: 'Path in the report document', required: true },
  },
  additionalProperties: false,
} as const;

const outputSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', description: 'Validation or render status', required: true },
    title: { type: 'string', description: 'Frontmatter title, or empty when unavailable', required: true },
    mode: { type: 'string', description: 'report, dashboard, or empty when unavailable', required: true },
    diagnostics: { type: 'array', description: 'Validation messages', items: diagnosticSchema, required: true },
    datasetStats: {
      type: 'array',
      description: 'Materialized dataset row and UTF-8 byte counts, with the current 5,000-row and 1 MB limits described in diagnostics when near the limit.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', required: true },
          rows: { type: 'number', required: true },
          bytes: { type: 'number', required: true },
        },
        additionalProperties: false,
      },
      required: true,
    },
    components: {
      type: 'array',
      description: 'Components included in the generated document. heightPx is the configured/default container height, not a browser-measured value.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', required: true },
          title: { type: 'string', required: true },
          dataRef: { type: 'string', required: true },
          rows: { type: 'number', required: true },
          heightPx: { type: 'number', required: true },
          kind: { type: 'string', required: true },
        },
        additionalProperties: false,
      },
      required: true,
    },
    metricCount: { type: 'number', description: 'Number of frontmatter metric definitions the render resolved.', required: true },
    artifact: {
      type: 'object',
      description: 'Rendered HTML artifact metadata. The attachment id is empty when downloadable attachment storage is unavailable.',
      properties: {
        attachmentId: { type: 'string', required: true },
        name: { type: 'string', required: true },
        bytes: { type: 'number', required: true },
      },
      additionalProperties: false,
      required: true,
    },
    sourcePath: { type: 'string', description: 'Absolute Markdown source path, either the supplied path or a saved inline-source copy.', required: true },
    sourceWorkspacePath: { type: 'string', description: 'Workspace-relative Markdown path used by DSH to open the source in its sidebar.', required: true },
    previewPath: { type: 'string', description: 'Absolute path to the rendered HTML in the session workspace. Empty when workspace preview storage is unavailable.', required: true },
    previewWorkspacePath: { type: 'string', description: 'Workspace-relative path used by DSH to open the rendered HTML in its sidebar.', required: true },
  },
  additionalProperties: false,
} as const;

const inputProperties = {
  markdown: {
    type: 'string',
    description: 'Complete md-report/1 Markdown source, including YAML frontmatter. Provide exactly one of markdown or path.',
  },
  path: {
    type: 'string',
    description: 'Workspace-relative .md/.markdown source file to read. Provide exactly one of markdown or path. SQLite, query-file, and asset paths remain workspace-relative.',
  },
  assets: {
    type: 'object',
    description: 'Optional inline image map keyed by asset ID for one-off reports. Reusable reports should declare workspace-relative image files and mediaType in Markdown frontmatter so the saved Markdown source can be reproduced.',
    additionalProperties: true,
  },
  datasets: {
    type: 'object',
    description: 'Optional inline snapshot map for one-off reports. These values are not stored in Markdown; use a Markdown-declared SQLite source for reusable reports. No business query is performed for this map.',
    additionalProperties: true,
  },
} as const;

const renderInputProperties = {
  ...inputProperties,
  fontSize: {
    type: 'number',
    description: 'Optional global base font size in CSS pixels for the exported HTML. Defaults to 14; allowed range is 12 to 20.',
  },
} as const;

function asReportDocument(input: ToolInput): ReportDocument {
  const document: ReportDocument = { markdown: input.markdown ?? '' };
  if (input.assets) document.assets = input.assets as Record<string, ReportAsset>;
  if (input.datasets) document.datasets = input.datasets as Record<string, ReportDataset>;
  return document;
}

function emptyArtifact(): ToolResult['artifact'] {
  return { attachmentId: '', name: '', bytes: 0 };
}

function formatDiagnostics(diagnostics: readonly Diagnostic[], sourcePath = ''): string {
  if (diagnostics.length === 0) return 'No validation errors.';
  return diagnostics.map((diagnostic) => {
    const hasMarkdownLocation = diagnostic.path === '$.markdown' || diagnostic.path.startsWith('$.markdown.')
      || diagnostic.path === '$.frontmatter' || diagnostic.path.startsWith('$.frontmatter.');
    const location = sourcePath && hasMarkdownLocation ? `${sourcePath}:${diagnostic.line}` : `line ${diagnostic.line}`;
    return `${diagnostic.severity.toUpperCase()} ${diagnostic.code} at ${location} (${diagnostic.path}): ${diagnostic.message}`;
  }).join('\n');
}

function limitToolDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  if (diagnostics.length <= MAX_VALIDATION_DIAGNOSTICS) return diagnostics;
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  const shownErrors = errors.slice(0, MAX_VALIDATION_DIAGNOSTICS - 1);
  const remaining = Math.max(0, MAX_VALIDATION_DIAGNOSTICS - 1 - shownErrors.length);
  return [
    ...shownErrors,
    ...warnings.slice(0, remaining),
    {
      severity: 'warning',
      code: 'validation.diagnostics-truncated',
      message: `Validation found more than ${MAX_VALIDATION_DIAGNOSTICS} diagnostics; only the first ${MAX_VALIDATION_DIAGNOSTICS - 1} errors and warnings are shown.`,
      line: 1,
      path: '$',
    },
  ];
}

async function resolveWorkspaceFile(
  ctx: Context,
  exec: ToolRunContext,
  relativePath: string,
  description: string,
  maxBytes: number,
): Promise<{ path: string; size?: number }> {
  const cwd = exec.agent?.session.header.cwd;
  if (!cwd) throw new Error(`${description} requires a DSH session workspace.`);
  if (!relativePath || relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath)
    || /[\u0000-\u001f\u007f\\]/.test(relativePath) || relativePath.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`${description} paths must be explicit workspace-relative paths.`);
  }
  const fs = ctx.get('fs', false) as WorkspaceFileSystem | undefined;
  if (!fs || typeof fs.resolve !== 'function' || typeof fs.contains !== 'function' || typeof fs.stat !== 'function' || typeof fs.processPath !== 'function') {
    throw new Error('This DSH profile needs a workspace filesystem service to load SQLite sources declared in Markdown.');
  }
  const root = await fs.resolve('.', { cwd, signal: exec.signal });
  const target = await fs.resolve(relativePath, { cwd, signal: exec.signal });
  if (!fs.contains(root, target)) throw new Error(`${description} path resolves outside the DSH session workspace.`);
  const info = await fs.stat(target, exec.signal);
  if (!info || info.type !== 'file') throw new Error(`${description} file "${relativePath}" was not found in the DSH session workspace.`);
  if (info.size !== undefined && info.size > maxBytes) throw new Error(`${description} file "${relativePath}" exceeds the ${maxBytes}-byte limit.`);
  return { path: fs.processPath(target), ...(info.size === undefined ? {} : { size: info.size }) };
}

interface LoadedToolDocument {
  document: ReportDocument;
  sourcePath: string;
  sourceWorkspacePath: string;
}

async function loadToolDocument(ctx: Context, exec: ToolRunContext, input: ToolInput): Promise<LoadedToolDocument> {
  const hasMarkdown = Object.hasOwn(input, 'markdown') && typeof input.markdown === 'string';
  const hasPath = typeof input.path === 'string' && input.path.length > 0;
  if (hasMarkdown === hasPath) throw new Error('Provide exactly one of "markdown" or "path".');

  if (hasMarkdown) return { document: asReportDocument(input), sourcePath: '', sourceWorkspacePath: '' };

  const relativePath = input.path as string;
  if (!/\.(?:md|markdown)$/i.test(relativePath)) throw new Error('The report source path must end in .md or .markdown.');
  const resolved = await resolveWorkspaceFile(ctx, exec, relativePath, 'Markdown source', MAX_MARKDOWN_BYTES);
  const markdown = await readFile(resolved.path, { encoding: 'utf8', signal: exec.signal });
  const markdownBytes = new TextEncoder().encode(markdown).byteLength;
  if (markdownBytes > MAX_MARKDOWN_BYTES) throw new Error(`Markdown source cannot exceed ${MAX_MARKDOWN_BYTES} bytes.`);
  return {
    document: { ...asReportDocument(input), markdown },
    sourcePath: resolved.path,
    sourceWorkspacePath: relativePath,
  };
}

function summarizeDatasets(datasets: ReportDocument['datasets']): DatasetSummary[] {
  return Object.entries(datasets ?? {}).map(([id, dataset]) => {
    let rows = 0;
    let bytes = 0;
    try {
      rows = datasetRecords(dataset).length;
      bytes = new TextEncoder().encode(JSON.stringify(dataset)).byteLength;
    } catch {
      // Dataset shape diagnostics explain why these counts could not be materialized.
    }
    return { id, rows, bytes };
  });
}

function datasetSizeDiagnostics(datasets: ReportDocument['datasets'], summary: DatasetSummary[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const totalBytes = new TextEncoder().encode(JSON.stringify(datasets ?? {})).byteLength;
  if (totalBytes >= 800_000) {
    diagnostics.push(hostWarning('dataset.near-size-limit', `Materialized datasets use ${totalBytes.toLocaleString('en-US')} of 1,000,000 bytes; the current dataset limit is 1 MB.`));
  }
  for (const dataset of summary) {
    if (dataset.rows >= 4_000) {
      diagnostics.push(hostWarning('dataset.near-row-limit', `Dataset "${dataset.id}" has ${dataset.rows.toLocaleString('en-US')} rows; SQLite queries allow at most 5,000 rows and data tables display at most 5,000 rows.`));
    }
  }
  return diagnostics;
}

function summarizeComponents(markdown: string, datasets: ReportDocument['datasets'], mode: ReportMode | '', metrics?: MetricRegistry): ComponentSummary[] {
  const known = new Set<string>(COMPONENT_LANGUAGES);
  const result: ComponentSummary[] = [];
  const fencePattern = /^```([A-Za-z0-9_-]+)[^\r\n]*\r?\n([\s\S]*?)^```[ \t]*$/gm;
  for (const match of markdown.matchAll(fencePattern)) {
    const type = (match[1] ?? '').toLowerCase();
    if (!known.has(type)) continue;
    const source = match[2] ?? '';
    let spec: Record<string, unknown> = {};
    try {
      const candidate = JSON.parse(source) as unknown;
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) spec = candidate as Record<string, unknown>;
    } catch {
      // The validator reports JSON syntax errors; retain a basic component summary.
    }
    let dataRefs = typeof spec.dataRef === 'string' ? [spec.dataRef] : [];
    if (type === 'kpi' && Array.isArray(spec.items)) {
      dataRefs = [...new Set(spec.items.flatMap((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).dataRef === 'string'
        ? [(item as Record<string, unknown>).dataRef as string]
        : []))];
    }
    if (Array.isArray(spec.dataRefs)) {
      dataRefs = [...new Set(spec.dataRefs.filter((entry): entry is string => typeof entry === 'string'))];
    }
    if ((type === 'ranking' || type === 'pivot') && typeof spec.metricRef === 'string') {
      const bound = metrics?.[spec.metricRef]?.dataRef;
      if (typeof bound === 'string') dataRefs = [...new Set([...dataRefs, bound])];
    }
    const rows = [...new Set(dataRefs)].reduce((total, id) => {
      try { return total + (datasets?.[id] ? datasetRecords(datasets[id]).length : 0); }
      catch { return total; }
    }, 0);
    const height = mode === 'dashboard' ? 0 : type === 'chart' ? 250 : type === 'data-table'
      ? Math.max(160, Math.min(1200, typeof spec.viewportHeight === 'number' && Number.isFinite(spec.viewportHeight) ? spec.viewportHeight : 480))
      : 0;
    result.push({
      type,
      title: typeof spec.title === 'string' ? spec.title : type,
      dataRef: dataRefs.join(', '),
      rows,
      heightPx: height,
      kind: typeof spec.kind === 'string' ? spec.kind : '',
    });
  }
  return result;
}

function formatDataSummary(datasetStats: DatasetSummary[], components: ComponentSummary[], metricCount = 0): string {
  const datasets = datasetStats.length === 0
    ? 'Datasets: none.'
    : `Datasets: ${datasetStats.map((item) => `${item.id} ${item.rows.toLocaleString('en-US')} rows / ${item.bytes.toLocaleString('en-US')} B`).join('; ')}.`;
  const renderedComponents = components.length === 0
    ? 'Components: none.'
    : `Components: ${components.map((item) => `${item.type}${item.title !== item.type ? ` "${item.title}"` : ''}${item.kind ? ` (${item.kind})` : ''}${item.dataRef ? ` · ${item.dataRef}: ${item.rows.toLocaleString('en-US')} rows` : ''}${item.heightPx ? ` · ${item.heightPx}px container` : ''}`).join('; ')}.`;
  const metrics = metricCount === 0 ? 'Metrics: none declared.' : `Metrics: ${metricCount} declared with shared display semantics.`;
  return `${datasets}\n${renderedComponents}\n${metrics}`;
}

async function loadDeclaredSources(ctx: Context, exec: ToolRunContext, document: ReportDocument): Promise<ReportDocument> {
  const sqliteConfig = extractSqliteSourceConfig(document.markdown);
  const assetConfig = extractAssetSourceConfig(document.markdown);
  if (!sqliteConfig && !assetConfig) return document;

  const preliminary = validateReport(document);
  const blocked = preliminary.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'
    && diagnostic.code !== 'dataset.reference-missing'
    && diagnostic.code !== 'component.excalidraw-reference'
    && diagnostic.code !== 'image.asset-missing');
  if (blocked.length > 0) throw Object.assign(new Error('Markdown source metadata failed validation.'), { diagnostics: blocked });

  let loaded = { datasets: {}, scenes: {} } as ReturnType<typeof loadMarkdownSqliteSources>;
  if (sqliteConfig) {
    const queryFilePaths = [...new Set([
      ...Object.values(sqliteConfig.datasets ?? {}).map((source) => source.queryFile),
      ...Object.values(sqliteConfig.scenes ?? {}).map((source) => source.queryFile),
    ].filter((path): path is string => typeof path === 'string'))];
    const queryFiles: Record<string, string> = {};
    for (const path of queryFilePaths) {
      const resolved = await resolveWorkspaceFile(ctx, exec, path, 'SQLite query file', 100_000);
      queryFiles[path] = await readFile(resolved.path, { encoding: 'utf8', signal: exec.signal });
    }
    const database = await resolveWorkspaceFile(ctx, exec, sqliteConfig.path, 'SQLite database', 512_000_000);
    loaded = loadMarkdownSqliteSources(sqliteConfig, database.path, { queryFiles });
  }
  for (const id of Object.keys(loaded.datasets)) {
    if (document.datasets && Object.hasOwn(document.datasets, id)) {
      throw new Error(`Dataset "${id}" is declared both in Markdown SQLite metadata and tool arguments.`);
    }
  }

  const fileAssets: NonNullable<ReportDocument['assets']> = {};
  let totalAssetBytes = 0;
  for (const [id, source] of Object.entries((assetConfig ?? {}) as ReportAssetSourceConfig)) {
    if (document.assets && Object.hasOwn(document.assets, id)) {
      throw new Error(`Asset "${id}" is declared both in Markdown frontmatter and tool arguments.`);
    }
    const resolved = await resolveWorkspaceFile(ctx, exec, source.path, 'Image asset', MAX_ASSET_BYTES);
    const image = await readFile(resolved.path, { signal: exec.signal });
    if (image.byteLength > MAX_ASSET_BYTES) throw new Error(`Image asset "${id}" exceeds the ${MAX_ASSET_BYTES}-byte limit.`);
    totalAssetBytes += image.byteLength;
    if (totalAssetBytes > MAX_ASSET_BYTES) throw new Error(`Declared image files exceed the ${MAX_ASSET_BYTES}-byte total asset limit.`);
    fileAssets[id] = { mediaType: source.mediaType, dataBase64: image.toString('base64') };
  }

  return {
    ...document,
    datasets: { ...loaded.datasets, ...(document.datasets ?? {}) },
    scenes: loaded.scenes,
    assets: { ...fileAssets, ...(document.assets ?? {}) },
  };
}

function sourceFailureDiagnostics(error: unknown): Diagnostic[] {
  const diagnostics = (error as Error & { diagnostics?: Diagnostic[] })?.diagnostics;
  if (diagnostics?.length) return diagnostics;
  return [{
    severity: 'error',
    code: 'source.resource-load',
    message: error instanceof Error ? error.message : 'Could not load a declared report source.',
    line: 1,
    path: '$.frontmatter',
  }];
}

function sourcePortabilityDiagnostics(input: ToolInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (input.datasets && Object.keys(input.datasets).length > 0) {
    diagnostics.push(hostWarning(
      'source.inline-datasets',
      'Inline dataset snapshots are not stored in the Markdown source. Declare reusable datasets in the Markdown SQLite frontmatter to reproduce this report from its source files.',
    ));
  }
  if (input.assets && Object.keys(input.assets).length > 0) {
    diagnostics.push(hostWarning(
      'source.inline-assets',
      'Inline image bytes are not stored in the Markdown source. Declare reusable images by workspace-relative path in Markdown frontmatter and preserve those files with the source.',
    ));
  }
  return diagnostics;
}

function createValidateTool(ctx: Context) {
  return defineTool({
  name: 'drender_validate',
  description: 'Validate md-report/1 from exactly one complete Markdown payload or workspace-relative Markdown path. Includes component schemas, dashboard layout, declared datasets and assets; reports dataset sizes and component summaries.',
  parameters: inputProperties,
  output: {
    schema: outputSchema,
    render: (_args, value: ToolResult) => [{
      type: 'text',
      text: `${value.status === 'valid' ? 'Report is valid.' : 'Report has validation errors.'}${value.sourcePath ? ` Source: ${value.sourcePath}.` : ''}\n${formatDataSummary(value.datasetStats, value.components, value.metricCount)}\n${formatDiagnostics(value.diagnostics, value.sourcePath)}`,
    }],
  },
  async execute(args: ToolInput, exec: ToolRunContext): Promise<ToolResult> {
    let loaded: LoadedToolDocument | undefined;
    let document: ReportDocument;
    try {
      loaded = await loadToolDocument(ctx, exec, args);
      document = loaded.document;
      document = await loadDeclaredSources(ctx, exec, document);
    } catch (error) {
      return {
        status: 'invalid',
        title: '',
        mode: '',
        diagnostics: limitToolDiagnostics(sourceFailureDiagnostics(error)),
        artifact: emptyArtifact(),
        sourcePath: loaded?.sourcePath ?? '',
        sourceWorkspacePath: loaded?.sourceWorkspacePath ?? '',
        previewPath: '',
        previewWorkspacePath: '',
        datasetStats: [],
        components: [],
        metricCount: 0,
      };
    }
    const metrics = extractMetricConfig(document.markdown);
    const metricCount = Object.keys(metrics ?? {}).length;
    const validation = validateReport(document);
    const datasetStats = summarizeDatasets(document.datasets);
    const components = summarizeComponents(document.markdown, document.datasets, validation.mode, metrics);
    return {
      status: validation.valid ? 'valid' : 'invalid',
      title: validation.title,
      mode: validation.mode,
      diagnostics: limitToolDiagnostics([...validation.diagnostics, ...datasetSizeDiagnostics(document.datasets, datasetStats), ...sourcePortabilityDiagnostics(args)]),
      artifact: emptyArtifact(),
      sourcePath: loaded?.sourcePath ?? '',
      sourceWorkspacePath: loaded?.sourceWorkspacePath ?? '',
      previewPath: '',
      previewWorkspacePath: '',
      datasetStats,
      components,
      metricCount,
    };
  },
  });
}

function previewFileName(title: string, html: string, sourceWorkspacePath: string): string {
  const fileName = reportFileName(title, html);
  if (!sourceWorkspacePath) return fileName;
  const directory = path.dirname(sourceWorkspacePath);
  return directory === '.' ? fileName : path.join(directory, fileName);
}

function sourceFileName(title: string, callId: string): string {
  const baseName = reportFileName(title).replace(/\.html$/i, '');
  const callToken = callId.replace(/[^A-Za-z0-9_-]/g, '-').slice(-40) || Date.now().toString(36);
  return `${baseName}-source-${callToken}.md`;
}

async function saveWorkspaceSource(
  ctx: Context,
  exec: ToolRunContext,
  title: string,
  markdown: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const cwd = exec.agent?.session?.header.cwd;
  if (!cwd) return { relativePath: '', absolutePath: '' };

  const fs = ctx.get('fs', false) as WorkspaceFileSystem | undefined;
  if (!fs || typeof fs.resolve !== 'function' || typeof fs.writeText !== 'function' || typeof fs.processPath !== 'function') {
    return { relativePath: '', absolutePath: '' };
  }

  const name = sourceFileName(title, exec.callId);
  const target = await fs.resolve(name, { cwd, signal: exec.signal });
  await fs.writeText(target, markdown, undefined, exec.signal);
  return { relativePath: name, absolutePath: fs.processPath(target) };
}

async function saveWorkspacePreview(
  ctx: Context,
  exec: ToolRunContext,
  title: string,
  html: string,
  sourceWorkspacePath: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const cwd = exec.agent?.session?.header.cwd;
  if (!cwd) return { relativePath: '', absolutePath: '' };

  const fs = ctx.get('fs', false) as WorkspaceFileSystem | undefined;
  if (!fs || typeof fs.resolve !== 'function' || typeof fs.writeText !== 'function' || typeof fs.processPath !== 'function') {
    return { relativePath: '', absolutePath: '' };
  }

  const name = previewFileName(title, html, sourceWorkspacePath);
  const target = await fs.resolve(name, { cwd, signal: exec.signal });
  const root = await fs.resolve('.', { cwd, signal: exec.signal });
  if (!fs.contains(root, target)) throw new Error('Rendered HTML path resolves outside the DSH session workspace.');
  await fs.writeText(target, html, undefined, exec.signal);
  return { relativePath: name, absolutePath: fs.processPath(target) };
}

function hostWarning(code: string, message: string): Diagnostic {
  return { severity: 'warning', code, message, line: 1, path: '$' };
}

function createRenderTool(ctx: Context, attachments?: AttachmentStore) {
  return defineTool({
  name: 'drender_render',
  description: 'Read md-report/1 from exactly one Markdown payload or workspace-relative path, validate it, render self-contained offline HTML, and return absolute source/output paths plus dataset and component summaries. Path input saves the content-addressed HTML beside the Markdown file. Use optional fontSize (12–20 px, default 14).',
  parameters: renderInputProperties,
  output: {
    schema: outputSchema,
    presentationMeta: (_args, value: ToolResult) => ({
      kind: 'md-report-render',
      status: value.status,
      title: value.title,
      mode: value.mode,
      sourcePath: value.sourcePath,
      sourceWorkspacePath: value.sourceWorkspacePath,
      previewPath: value.previewPath,
      previewWorkspacePath: value.previewWorkspacePath,
      metricCount: value.metricCount,
      datasetStats: value.datasetStats.map((item) => ({ id: item.id, rows: item.rows, bytes: item.bytes })),
      components: value.components.map((item) => ({
        type: item.type,
        title: item.title,
        dataRef: item.dataRef,
        rows: item.rows,
        heightPx: item.heightPx,
        kind: item.kind,
      })),
      fileName: value.artifact.name,
      bytes: value.artifact.bytes,
    }),
    render: (_args, value: ToolResult) => {
      if (value.status === 'invalid') {
        return [{ type: 'text', text: `Report was not rendered.${value.sourcePath ? ` Source: ${value.sourcePath}.` : ''}\n${formatDataSummary(value.datasetStats, value.components, value.metricCount)}\n${formatDiagnostics(value.diagnostics, value.sourcePath)}` }];
      }
      if (value.status === 'rendered') {
        const warningText = value.diagnostics.length > 0 ? `\n${formatDiagnostics(value.diagnostics, value.sourcePath)}` : '';
        const sourceText = value.sourcePath
          ? ` Source Markdown: ${value.sourcePath}. Preserve its declared SQLite database, query files, and image files to reproduce the report.`
          : '';
        const attachmentText = value.artifact.attachmentId
          ? ` Downloadable attachment: ${value.artifact.name} (${value.artifact.bytes} bytes; reference ${value.artifact.attachmentId}).`
          : '';
        return [{ type: 'text', text: `Rendered ${value.mode} report "${value.title}" as a self-contained offline HTML file. HTML: ${value.previewPath}${sourceText}\n${formatDataSummary(value.datasetStats, value.components, value.metricCount)}${attachmentText}${warningText}` }];
      }
      const attachmentText = value.artifact.attachmentId
        ? ` The downloadable HTML attachment was saved as ${value.artifact.name} (reference ${value.artifact.attachmentId}).`
        : '';
      return [{ type: 'text', text: `HTML was rendered, but writing a workspace preview failed; no absolute HTML file path is available.${attachmentText}\n${formatDataSummary(value.datasetStats, value.components, value.metricCount)}\n${formatDiagnostics(value.diagnostics, value.sourcePath)}` }];
    },
  },
  async execute(args: ToolInput, exec: ToolRunContext): Promise<ToolResult> {
    let loaded: LoadedToolDocument | undefined;
    let document: ReportDocument;
    try {
      loaded = await loadToolDocument(ctx, exec, args);
      document = loaded.document;
      document = await loadDeclaredSources(ctx, exec, document);
    } catch (error) {
      return {
        status: 'invalid',
        title: '',
        mode: '',
        diagnostics: limitToolDiagnostics(sourceFailureDiagnostics(error)),
        artifact: emptyArtifact(),
        sourcePath: loaded?.sourcePath ?? '',
        sourceWorkspacePath: loaded?.sourceWorkspacePath ?? '',
        previewPath: '',
        previewWorkspacePath: '',
        datasetStats: [],
        components: [],
        metricCount: 0,
      };
    }
    const metrics = extractMetricConfig(document.markdown);
    const metricCount = Object.keys(metrics ?? {}).length;
    const validation = validateReport(document);
    const datasetStats = summarizeDatasets(document.datasets);
    const components = summarizeComponents(document.markdown, document.datasets, validation.mode, metrics);
    const sizeDiagnostics = datasetSizeDiagnostics(document.datasets, datasetStats);
    if (!validation.valid) {
      return {
        status: 'invalid',
        title: validation.title,
        mode: validation.mode,
        diagnostics: limitToolDiagnostics([...validation.diagnostics, ...sizeDiagnostics, ...sourcePortabilityDiagnostics(args)]),
        artifact: emptyArtifact(),
        sourcePath: loaded?.sourcePath ?? '',
        sourceWorkspacePath: loaded?.sourceWorkspacePath ?? '',
        previewPath: '',
        previewWorkspacePath: '',
        datasetStats,
        components,
        metricCount,
      };
    }

    let rendered;
    try {
      rendered = await renderReport(document, { fontSize: args.fontSize });
    } catch (error) {
      const diagnostics = (error as Error & { diagnostics?: Diagnostic[] }).diagnostics;
      return {
        status: 'invalid',
        title: validation.title,
        mode: validation.mode,
        diagnostics: limitToolDiagnostics([...(diagnostics ?? [{ severity: 'error', code: 'render.failed', message: error instanceof Error ? error.message : 'Rendering failed.', line: 1, path: '$' }]), ...sizeDiagnostics, ...sourcePortabilityDiagnostics(args)]),
        artifact: emptyArtifact(),
        sourcePath: loaded?.sourcePath ?? '',
        sourceWorkspacePath: loaded?.sourceWorkspacePath ?? '',
        previewPath: '',
        previewWorkspacePath: '',
        datasetStats,
        components,
        metricCount,
      };
    }

    let previewPath = '';
    let previewWorkspacePath = '';
    let previewError = '';
    try {
      const preview = await saveWorkspacePreview(ctx, exec, rendered.title, rendered.html, loaded?.sourceWorkspacePath ?? '');
      previewPath = preview.absolutePath;
      previewWorkspacePath = preview.relativePath;
    } catch (error) {
      previewError = error instanceof Error ? error.message : 'Could not write the HTML preview.';
    }

    let sourcePath = loaded?.sourcePath ?? '';
    let sourceWorkspacePath = loaded?.sourceWorkspacePath ?? '';
    let sourceError = '';
    if (!sourcePath) {
      try {
        const source = await saveWorkspaceSource(ctx, exec, rendered.title, document.markdown);
        sourcePath = source.absolutePath;
        sourceWorkspacePath = source.relativePath;
      } catch (error) {
        sourceError = error instanceof Error ? error.message : 'Could not save the Markdown source.';
      }
    }

    let artifact = emptyArtifact();
    let attachmentError = '';
    if (attachments && typeof attachments.saveFile === 'function') {
      try {
        const file = await attachments.saveFile({
          data: new TextEncoder().encode(rendered.html),
          name: reportFileName(rendered.title, rendered.html),
        });
        artifact = { attachmentId: file.attachmentId, name: file.name, bytes: file.bytes };
      } catch (error) {
        attachmentError = error instanceof Error ? error.message : 'The DSH attachment store rejected the HTML file.';
      }
    }

    if (previewPath) {
      const diagnostics = [...validation.diagnostics, ...sizeDiagnostics, ...sourcePortabilityDiagnostics(args)];
      if (!artifact.attachmentId) {
        diagnostics.push(hostWarning(
          'host.html-attachment-unavailable',
          `The HTML preview was saved to the Session workspace, but downloadable attachment storage is unavailable. ${attachmentError}`.trim(),
        ));
      }
      if (!sourcePath) {
        diagnostics.push(hostWarning(
          'host.source-markdown-unavailable',
          `The HTML was saved, but the Markdown source could not be saved to the session workspace. Keep the original Markdown together with its declared SQLite and image files to reproduce this report. ${sourceError}`.trim(),
        ));
      }
      return {
        status: 'rendered',
        title: rendered.title,
        mode: rendered.mode,
        diagnostics: limitToolDiagnostics(diagnostics),
        artifact: { ...artifact, name: artifact.name || reportFileName(rendered.title, rendered.html), bytes: artifact.bytes || rendered.bytes },
        sourcePath,
        sourceWorkspacePath,
        previewPath,
        previewWorkspacePath,
        datasetStats,
        components,
        metricCount,
      };
    }

    return {
      status: 'storage-failed',
      title: rendered.title,
      mode: rendered.mode,
      diagnostics: limitToolDiagnostics([...validation.diagnostics, ...sizeDiagnostics, ...sourcePortabilityDiagnostics(args), hostWarning(
        'host.html-storage-unavailable',
        `This DSH profile could not save a workspace preview. ${previewError || 'Workspace file service unavailable.'} The HTML was rendered, but the tool cannot provide a workspace file path.`,
      ), ...(!artifact.attachmentId ? [hostWarning(
        'host.html-attachment-unavailable',
        `Downloadable attachment storage is also unavailable. ${attachmentError || 'No attachment store is configured.'}`.trim(),
      )] : []), ...(sourcePath ? [] : [hostWarning(
        'host.source-markdown-unavailable',
        `The Markdown source could not be saved to the session workspace. Keep the original Markdown together with its declared SQLite and image files to reproduce this report. ${sourceError}`.trim(),
      )])]),
      artifact,
      sourcePath,
      sourceWorkspacePath,
      previewPath: '',
      previewWorkspacePath: '',
      datasetStats,
      components,
      metricCount,
    };
  },
  });
}

export function apply(ctx: Context): void {
  const attachmentStore = (ctx as Context & { attachments?: AttachmentStore }).attachments;
  const validateTool = createValidateTool(ctx);
  const renderTool = createRenderTool(ctx, attachmentStore);
  ctx.skills.register({
    name: 'drender-report',
    description: 'Create, validate, and render portable md-report/1 Markdown reports and full-screen dashboard views with offline interactive ECharts charts.',
    source: 'runtime',
    content: drenderReportSkill,
  });
  ctx.tools.register(validateTool);
  ctx.tools.register(renderTool);
}
