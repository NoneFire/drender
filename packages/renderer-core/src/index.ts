import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import MarkdownIt, { type Token } from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import container from 'markdown-it-container';
import markdownItTocDoneRight from 'markdown-it-toc-done-right';
import { DOMParser, parseHTML } from 'linkedom';
import { isAlias, parseDocument } from 'yaml';
import { viewerThemeCss } from '@tita-agent/viewer-theme';
import {
  CHART_KINDS,
  COMPARISON_KINDS,
  JSON_COMPONENT_LANGUAGES,
  isMetricFormat,
  METRIC_FORMATS,
  METRIC_GOOD_DIRECTIONS,
  componentNeedsDataset,
  componentSpec,
  datasetRecords,
  isSupportedComponent,
  metricTokenIds,
  metricDatasetRefs,
  registerComponentRenderers,
  tokenFenceInfo,
  type ComponentDatasets,
  type ComponentScenes,
  type MetricRegistry,
  type MetricSpec,
} from './components.js';

export { datasetRecords };
export { COMPONENT_LANGUAGES, CHART_KINDS, formatMetricValue, type MetricSpec, type MetricRegistry } from './components.js';

const require = createRequire(import.meta.url);
const echartsRuntime = readFileSync(require.resolve('echarts/dist/echarts.min'), 'utf8');
const tabulatorRuntimePath = require.resolve('tabulator-tables/dist/js/tabulator.min.js');
const tabulatorPackagePath = resolve(dirname(tabulatorRuntimePath), '../..');
const tabulatorRuntimeSource = readFileSync(tabulatorRuntimePath, 'utf8').replace(/\n?\/\/# sourceMappingURL=.*$/m, '');
const tabulatorLicense = readFileSync(resolve(tabulatorPackagePath, 'LICENSE'), 'utf8');
const tabulatorRuntime = `/*! Tabulator Tables MIT license\n${tabulatorLicense.replace(/\*\//g, '* /')}\n*/\n${tabulatorRuntimeSource}`;
const tabulatorCss = readFileSync(require.resolve('tabulator-tables/dist/css/tabulator.min.css'), 'utf8').replace(/\/\*# sourceMappingURL=.*?\*\//g, '');
const t8RuntimePath = require.resolve('@antv/t8/dist/t8.min.js');
const t8PackagePath = resolve(dirname(t8RuntimePath), '..');
const t8RuntimeSource = readFileSync(t8RuntimePath, 'utf8').replace(/\n?\/\/# sourceMappingURL=.*$/m, '');
const t8License = readFileSync(resolve(t8PackagePath, 'LICENSE'), 'utf8');
const t8Runtime = `/*! AntV T8 MIT license\n${t8License.replace(/\*\//g, '* /')}\n*/\n${t8RuntimeSource}`;
const infographicEntryPath = require.resolve('@antv/infographic');
const infographicPackagePath = resolve(dirname(infographicEntryPath), '..');
const infographicRuntimeSource = readFileSync(resolve(infographicPackagePath, 'dist/infographic.min.js'), 'utf8')
  .replace(/\n?\/\/# sourceMappingURL=.*$/m, '')
  .replace(/[\t ]+$/gm, '');
const infographicLicense = readFileSync(resolve(infographicPackagePath, 'LICENSE'), 'utf8');
const infographicRuntime = `/*! AntV Infographic MIT license\n${infographicLicense.replace(/\*\//g, '* /')}\n*/\n${infographicRuntimeSource}`;
const mermaidRuntimePath = require.resolve('mermaid/dist/mermaid.min.js');
const mermaidPackagePath = resolve(dirname(mermaidRuntimePath), '..');
const mermaidRuntimeSource = readFileSync(mermaidRuntimePath, 'utf8')
  .replace(/\n?\/\/# sourceMappingURL=.*$/m, '')
  .replace(/[\t ]+$/gm, '');
const mermaidLicense = readFileSync(resolve(mermaidPackagePath, 'LICENSE'), 'utf8');
const mermaidRuntime = `/*! Mermaid MIT license\n${mermaidLicense.replace(/\*\//g, '* /')}\n*/\n${mermaidRuntimeSource}`;
let excalidrawQueue: Promise<void> = Promise.resolve();

function setupExcalidrawDom(): () => void {
  const { document, window } = parseHTML('<!doctype html><html><body></body></html>');
  const originalGlobals = new Map<string, PropertyDescriptor | undefined>();
  const setGlobal = (name: string, value: unknown): void => {
    if (!originalGlobals.has(name)) originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  };
  setGlobal('window', window);
  setGlobal('document', document);
  setGlobal('DOMParser', DOMParser);
  setGlobal('XMLSerializer', window.XMLSerializer);
  setGlobal('devicePixelRatio', 1);
  setGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  setGlobal('navigator', window.navigator);
  const windowGlobals = window as unknown as Record<string, unknown>;
  for (const name of [
    'HTMLElement', 'HTMLDivElement', 'HTMLSpanElement', 'HTMLImageElement', 'HTMLCanvasElement', 'HTMLInputElement',
    'HTMLButtonElement', 'Element', 'Node', 'Text', 'Comment', 'DocumentFragment', 'Document', 'MutationObserver',
    'SVGElement', 'SVGSVGElement', 'SVGGraphicsElement', 'SVGGElement', 'SVGPathElement', 'SVGRectElement',
    'SVGCircleElement', 'SVGTextElement', 'SVGLineElement', 'SVGPolygonElement', 'SVGPolylineElement', 'SVGEllipseElement',
    'SVGImageElement', 'SVGDefsElement', 'SVGUseElement', 'SVGClipPathElement', 'SVGLinearGradientElement',
    'SVGRadialGradientElement', 'SVGStopElement', 'SVGPatternElement', 'SVGMaskElement', 'SVGForeignObjectElement',
  ]) {
    if (windowGlobals[name]) setGlobal(name, windowGlobals[name]);
  }
  setGlobal('Image', function ImageShim() {
    const image = document.createElement('img');
    let source = '';
    Object.defineProperty(image, 'src', {
      configurable: true,
      get: () => source,
      set: (value: string) => {
        source = String(value);
        queueMicrotask(() => image.onload?.(new Event('load')));
      },
    });
    Object.defineProperty(image, 'naturalWidth', { configurable: true, get: () => 1 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, get: () => 1 });
    return image;
  });
  if (!document.fonts) {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        add: () => undefined, delete: () => false, has: () => false, clear: () => undefined,
        forEach: () => undefined, entries: () => [][Symbol.iterator](), keys: () => [][Symbol.iterator](),
        values: () => [][Symbol.iterator](), [Symbol.iterator]: () => [][Symbol.iterator](), size: 0,
        ready: Promise.resolve(), check: () => true, load: async () => [], status: 'loaded',
        addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => true,
      },
    });
  }
  let nextAnimationFrame = 0;
  const pendingFrames = new Map<number, ReturnType<typeof setImmediate>>();
  setGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      const id = ++nextAnimationFrame;
      pendingFrames.set(id, setImmediate(() => {
        pendingFrames.delete(id);
        callback(performance.now());
      }));
      return id;
  });
  setGlobal('cancelAnimationFrame', (id: number) => {
      const immediate = pendingFrames.get(id);
      if (immediate) clearImmediate(immediate);
      pendingFrames.delete(id);
  });
  return () => {
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  };
}

const SVG_NUMERIC_ATTRIBUTES = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'dx', 'dy', 'font-size', 'stroke-width', 'opacity']);
const SVG_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?:%|px|em|rem)?$/;

/** Remove SVG numeric attributes whose value is not a number (for example y="NaN"). */
function repairSvgNumbers(root: { querySelectorAll?: (selector: string) => ArrayLike<unknown> }): void {
  const elements = root.querySelectorAll?.('*');
  if (!elements) return;
  for (const element of Array.from(elements)) {
    const node = element as { attributes?: ArrayLike<{ name: string; value: string }>; removeAttribute?: (name: string) => void };
    if (!node.attributes || typeof node.removeAttribute !== 'function') continue;
    for (const attribute of Array.from(node.attributes)) {
      if (!SVG_NUMERIC_ATTRIBUTES.has(attribute.name)) continue;
      if (SVG_NUMBER.test(String(attribute.value).trim())) continue;
      node.removeAttribute(attribute.name);
    }
  }
}

async function renderOfficialExcalidraw(scene: Record<string, unknown>): Promise<string> {
  let release!: () => void;
  const previousRender = excalidrawQueue;
  excalidrawQueue = new Promise<void>((resolveQueue) => { release = resolveQueue; });
  await previousRender;
  let restoreDom: (() => void) | undefined;
  try {
    restoreDom = setupExcalidrawDom();
    const utility = await import('@excalidraw/utils') as unknown as {
      exportToSvg: (options: {
        data: never;
        config: { padding: number; skipInliningFonts: true; renderEmbeddables: false };
      }) => Promise<SVGSVGElement>;
    };
    const data = {
      ...scene,
      appState: scene.appState ?? { viewBackgroundColor: '#ffffff', gridSize: null },
      files: scene.files ?? {},
    };
    const svg = await utility.exportToSvg({ data: data as never, config: { padding: 20, skipInliningFonts: true, renderEmbeddables: false } });
    // The headless DOM shim has no text metrics, so Excalidraw can emit non-finite
    // coordinates (y="NaN"). Drop them so the SVG stays valid; CSS handles the font.
    repairSvgNumbers(svg);
    svg.setAttribute('class', 'mdr-excalidraw-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Excalidraw 场景');
    return svg.outerHTML;
  } finally {
    try {
      restoreDom?.();
    } finally {
      release();
    }
  }
}
const t8Bootstrap = String.raw`(() => {
  if (!window.T8?.Text) return;
  const theme = document.body.classList.contains('mdr-dashboard-page') || matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.querySelectorAll('.mdr-t8-host[data-t8]').forEach((element) => {
    try {
      const syntax = JSON.parse(element.dataset.t8 || '""');
      new window.T8.Text(element).theme(theme).render(syntax);
    } catch (error) {
      element.textContent = 'T8 内容无法解析';
      console.error('T8 rendering failed:', error);
    }
  });
})();`;
const infographicBootstrap = String.raw`(() => {
  const library = window.AntVInfographic;
  if (!library?.Infographic) return;
  library.setDefaultFont?.('Arial');
  // The bundled runtime would fetch AntV's hosted web fonts. The report must work
  // offline, and the Content-Security-Policy already forbids external stylesheets,
  // so those <link> elements can only ever produce blocked requests and console noise.
  const head = document.head;
  if (head && !head.dataset.mdrOfflineGuard) {
    head.dataset.mdrOfflineGuard = '1';
    const appendChild = head.appendChild.bind(head);
    head.appendChild = (node) => (node && node.tagName === 'LINK' && node.rel === 'stylesheet' && /^[a-z]+:/i.test(node.href || '')
      ? node
      : appendChild(node));
  }
  document.querySelectorAll('.mdr-infographic-host[data-infographic]').forEach((element) => {
    const source = new TextDecoder().decode(Uint8Array.from(atob(element.dataset.infographic || ''), (character) => character.charCodeAt(0)));
    try {
      const infographic = new library.Infographic({ container: element, width: '100%', height: '100%', editable: false });
      infographic.render(source);
      // AntV's templates use a small SVG viewBox (often only a few hundred
      // pixels wide). Keeping width="100%" scales that design up to the whole
      // report column, which makes its fixed-size labels collide. Restore the
      // SVG's natural dimensions; CSS can still shrink it for narrow screens.
      const svg = element.querySelector('svg');
      const viewBox = svg?.viewBox.baseVal;
      if (svg && viewBox && viewBox.width > 0 && viewBox.height > 0) {
        svg.setAttribute('width', String(viewBox.width));
        svg.setAttribute('height', String(viewBox.height));
      }
    } catch (error) {
      const fallback = document.createElement('pre');
      fallback.className = 'mdr-component-error';
      fallback.textContent = source;
      element.replaceChildren(fallback);
      console.error('AntV Infographic rendering failed:', error);
    }
  });
})();`;
const mermaidBootstrap = String.raw`(() => {
  const library = window.mermaid;
  if (!library?.render) return;
  const dashboard = document.body.classList.contains('mdr-dashboard-page');
  library.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: 'base',
    themeVariables: dashboard
      ? { background: '#0b1725', primaryColor: '#102e35', primaryTextColor: '#edf7fb', primaryBorderColor: '#58d6bd', lineColor: '#82a6b8', secondaryColor: '#192b3b', tertiaryColor: '#1a2330', fontFamily: 'system-ui, sans-serif' }
      : { background: '#ffffff', primaryColor: '#e4f3ef', primaryTextColor: '#17232f', primaryBorderColor: '#126a62', lineColor: '#547269', secondaryColor: '#eef4f7', tertiaryColor: '#f7f8fa', fontFamily: 'system-ui, sans-serif' },
    flowchart: { htmlLabels: false },
  });
  document.querySelectorAll('.mdr-mermaid-host[data-mermaid]').forEach(async (element, index) => {
    const syntax = new TextDecoder().decode(Uint8Array.from(atob(element.dataset.mermaid || ''), (character) => character.charCodeAt(0)));
    try {
      const result = await library.render('mdr-mermaid-' + (index + 1), syntax);
      element.innerHTML = result.svg;
      result.bindFunctions?.(element);
    } catch (error) {
      const fallback = document.createElement('pre');
      fallback.className = 'mdr-component-error';
      fallback.textContent = syntax;
      element.replaceChildren(fallback);
      console.error('Mermaid rendering failed:', error);
    }
  });
})();`;
const chartBootstrap = String.raw`(() => {
  const charts = new Map();
  const dashboard = document.body.classList.contains('mdr-dashboard-page');
  const fontScale = (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
  const chartColors = dashboard
    ? ['#58d6bd', '#67a8ff', '#f7b955', '#bd8cff', '#66d89a', '#ff8478', '#52c9d5']
    : ['#126a62', '#5479a6', '#c88637', '#9a6bb1', '#4d906d', '#c05c54', '#4e9caa'];
  const formatNumber = (value, spec) => {
    if (value === null || value === undefined || value === '') return '';
    const raw = Number(value);
    if (!Number.isFinite(raw)) return String(value);
    const scale = Number(spec?.scale) || 1;
    const scaled = raw * scale;
    const format = spec?.format || 'number';
    const decimals = spec?.decimals !== undefined
      ? spec.decimals
      : format === 'percent' || format === 'percentage-points' ? 1
        : format === 'currency' ? (spec?.compact ? 1 : 0)
          : spec?.compact ? 1 : Number.isInteger(scaled) ? 0 : 2;
    const options = { notation: spec?.compact ? 'compact' : 'standard', maximumFractionDigits: decimals, minimumFractionDigits: 0 };
    if (format === 'percent' || format === 'percentage-points') {
      return new Intl.NumberFormat('zh-CN', options).format(scaled * 100) + (format === 'percent' ? '%' : 'pp');
    }
    if (format === 'currency') {
      const currency = spec?.currency || 'CNY';
      try { return new Intl.NumberFormat('zh-CN', { ...options, style: 'currency', currency }).format(scaled); }
      catch { return new Intl.NumberFormat('zh-CN', options).format(scaled) + ' ' + currency; }
    }
    if (format === 'ratio' || format === 'date' || format === 'text') return format === 'ratio' ? new Intl.NumberFormat('zh-CN', options).format(scaled) : String(value);
    return new Intl.NumberFormat('zh-CN', options).format(scaled);
  };
  const resolveSentinels = (node, tokens) => {
    if (typeof node === 'string') return tokens[node] || node;
    if (Array.isArray(node)) return node.map((item) => resolveSentinels(item, tokens));
    if (node && typeof node === 'object') {
      const output = {};
      for (const key of Object.keys(node)) output[key] = resolveSentinels(node[key], tokens);
      return output;
    }
    return node;
  };
  const initCharts = () => {
    document.querySelectorAll('.mdr-echart[data-option]').forEach((element) => {
      if (charts.has(element)) return;
      const styles = getComputedStyle(element);
      const muted = styles.getPropertyValue('--mdr-ink-muted').trim() || '#586979';
      const faint = styles.getPropertyValue('--mdr-ink-faint').trim() || muted;
      const line = styles.getPropertyValue('--mdr-line').trim() || '#d7dfe5';
      const surface = styles.getPropertyValue('--mdr-surface').trim() || '#ffffff';
      const option = resolveSentinels(JSON.parse(element.dataset.option || '{}'), { __mdr_surface__: surface, __mdr_ink_faint__: muted });
      const valueFormat = option.mdrFormat;
      // A short panel cannot carry axis names, five ticks, and a top legend at once.
      const compact = element.clientHeight < 240;
      if (compact) {
        if (option.legend) {
          option.legend = { ...option.legend, top: undefined, bottom: 0 };
        }
        const valueAxes = [option.xAxis, option.yAxis].flatMap((axis) => Array.isArray(axis) ? axis : [axis]);
        for (const axis of valueAxes) {
          if (!axis || typeof axis !== 'object' || (axis.type !== 'value' && axis.type !== 'log')) continue;
          axis.splitNumber = 3;
          axis.name = '';
        }
        for (const series of option.series || []) {
          if (series.type === 'pie') {
            series.label = { ...(series.label || {}), show: false };
            series.labelLine = { ...(series.labelLine || {}), show: false };
          }
          if (series.type === 'candlestick' || series.type === 'boxplot') continue;
        }
        if (Array.isArray(option.grid)) option.grid = option.grid.map((grid) => ({ ...grid }));
        else if (option.grid) option.grid = { ...option.grid, top: 26, bottom: 30 };
      }
      if (option.mdrMap) {
        try { echarts.registerMap(option.mdrMap.name, option.mdrMap.geo); }
        catch (error) { console.error('md-report: map registration failed', error); }
        delete option.mdrMap;
      }
      const visualMaps = Array.isArray(option.visualMap) ? option.visualMap : option.visualMap ? [option.visualMap] : [];
      for (const visual of visualMaps) {
        if (visual && visual.mdrFormat) {
          const spec = visual.mdrFormat;
          visual.formatter = (value) => formatNumber(value, spec);
          delete visual.mdrFormat;
        }
      }
      option.color = chartColors;
      option.textStyle = { ...(option.textStyle || {}), color: muted, fontSize: Math.round(14 * fontScale), fontFamily: 'Inter, system-ui, sans-serif' };
      if (option.legend) option.legend.textStyle = { ...(option.legend.textStyle || {}), color: muted, fontSize: Math.round(12 * fontScale) };
      for (const axisName of ['xAxis', 'yAxis']) {
        const axes = Array.isArray(option[axisName]) ? option[axisName] : [option[axisName]];
        for (const axis of axes) {
          if (!axis || typeof axis !== 'object') continue;
          const axisSpec = axis.mdrFormat || valueFormat;
          axis.axisLabel = { ...(axis.axisLabel || {}), color: faint };
          if (axisSpec) {
            delete axis.mdrFormat;
            if (axis.type === 'value' || axis.type === 'log') axis.axisLabel.formatter = (value) => formatNumber(value, axisSpec);
          }
          axis.axisLine = { ...(axis.axisLine || {}), show: false, lineStyle: { ...(axis.axisLine?.lineStyle || {}), color: line } };
          axis.axisTick = { ...(axis.axisTick || {}), show: false };
          axis.splitLine = { ...(axis.splitLine || {}), lineStyle: { ...(axis.splitLine?.lineStyle || {}), color: line, width: 1, opacity: dashboard ? 0.32 : 0.52 } };
        }
      }
      if (option.tooltip) {
        const tooltip = { ...option.tooltip, backgroundColor: dashboard ? '#0b1725' : '#ffffff', borderColor: line, textStyle: { ...(option.tooltip.textStyle || {}), color: dashboard ? '#edf7fb' : '#17232f', fontSize: Math.round(14 * fontScale) } };
        if (valueFormat && tooltip.valueFormatter === undefined) tooltip.valueFormatter = (value) => formatNumber(value, valueFormat);
        option.tooltip = tooltip;
      }
      delete option.mdrFormat;
      for (const series of option.series || []) {
        if (series.type === 'pie' && series.label) series.label = { ...series.label, color: muted };
      }
      // One malformed chart must not prevent the rest of the report from rendering.
      try {
        const chart = echarts.init(element, null, { renderer: 'canvas' });
        chart.setOption(option);
        charts.set(element, chart);
        resizeObserver.observe(element);
      } catch (error) {
        const fallback = document.createElement('pre');
        fallback.className = 'mdr-component-error';
        fallback.textContent = '图表渲染失败：' + (error && error.message ? error.message : String(error));
        element.replaceChildren(fallback);
        console.error('md-report: chart rendering failed for', element.id || '(chart)', error);
      }
    });
  };
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) charts.get(entry.target)?.resize();
  });
  initCharts();
  window.addEventListener('resize', () => charts.forEach((chart) => chart.resize()), { passive: true });
  window.addEventListener('beforeprint', () => charts.forEach((chart) => chart.resize()));
})();`;
const tableBootstrap = String.raw`(() => {
  if (!window.Tabulator) return;
  const formatValue = (value, format) => {
    if (value === null || value === undefined) return '—';
    if (format?.startsWith('currency:')) {
      const currency = format.split(':')[1] || 'CNY';
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        try { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(parsed); }
        catch { return parsed.toLocaleString('zh-CN') + ' ' + currency; }
      }
    }
    if (format === 'percent') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return (parsed * 100).toFixed(1) + '%';
    }
    if (format === 'percentage-points') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return (parsed * 100).toFixed(1) + 'pp';
    }
    if (format === 'compact') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(parsed);
    }
    if (format === 'number') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: Number.isInteger(parsed) ? 0 : 2 }).format(parsed);
    }
    return String(value);
  };
  const toCsvCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  const buildCsv = (config) => {
    const columns = config.columns || [];
    const head = columns.map((column) => toCsvCell(column.title || column.field)).join(',');
    const body = (config.data || []).map((row) => columns.map((column) => toCsvCell(row[column.field])).join(','));
    return '\uFEFF' + [head, ...body].join('\r\n');
  };
  const announce = (section, message) => {
    const status = section?.querySelector('.mdr-table-status');
    if (status) status.textContent = message;
  };
  // Tabulator owns aria-sort and can rewrite it after we set it, so re-apply on the
  // next task as well; otherwise a default-sorted column announces "none".
  const describe = (table, config) => {
    const apply = () => {
      const sorted = table.getSorters ? table.getSorters() : [];
      table.element.querySelectorAll('.tabulator-col').forEach((col) => {
        const field = col.getAttribute('tabulator-field') || '';
        const column = (config.columns || []).find((item) => item.field === field);
        const active = sorted.find((entry) => entry.field === field);
        col.setAttribute('tabindex', '0');
        col.setAttribute('role', 'button');
        col.setAttribute('aria-label', '按 ' + ((column && (column.title || column.field)) || field) + ' 排序');
        col.setAttribute('aria-sort', active ? (active.dir === 'desc' ? 'descending' : 'ascending') : 'none');
        if (col.dataset.mdrKeybound) return;
        col.dataset.mdrKeybound = '1';
        col.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          col.click();
        });
      });
    };
    apply();
    setTimeout(apply, 0);
  };
  document.querySelectorAll('.mdr-tabulator[data-table]').forEach((element) => {
    const config = JSON.parse(element.dataset.table || '{}');
    const formats = config.formats || {};
    const table = new window.Tabulator(element, {
      data: config.data || [],
      columns: (config.columns || []).map((column) => ({
        ...column,
        formatter: (cell) => {
          const text = document.createElement('span');
          text.textContent = formatValue(cell.getValue(), formats[column.field] || (typeof column.format === 'string' ? column.format : undefined));
          return text;
        },
      })),
      initialSort: config.initialSort || [],
      height: '100%',
      layout: 'fitData',
      renderVertical: 'virtual',
      renderHorizontal: (config.columns || []).length > 20 ? 'virtual' : 'basic',
      placeholder: '暂无数据',
      columnHeaderVertAlign: 'middle',
      rowHeight: 38,
      movableColumns: false,
      selectableRows: false,
      tooltips: false,
      textDirection: 'auto',
      columnDefaults: { headerSort: true, headerWordWrap: false, resizable: true },
    });
    describe(table, config);
    table.on('dataSorted', () => describe(table, config));
    const section = element.closest('.mdr-data-table');
    section?.querySelectorAll('[data-mdr-export]').forEach((button) => {
      button.addEventListener('click', async () => {
        const csv = buildCsv(config);
        const kind = button.getAttribute('data-mdr-export');
        try {
          if (kind === 'clipboard' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(csv.replace(/^\uFEFF/, ''));
            announce(section, '已复制 ' + (config.data || []).length + ' 行到剪贴板。');
            return;
          }
          throw new Error('clipboard unavailable');
        } catch {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = (config.title || 'table') + '.csv';
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          announce(section, '已导出 ' + (config.data || []).length + ' 行 CSV。');
        }
      });
    });
  });
})();`;
const tocBootstrap = String.raw`(() => {
  const toc = document.querySelector('details.mdr-toc[data-mdr-toc="auto"]');
  if (!toc) return;
  const wide = matchMedia('(min-width: 900px)');
  const sync = () => { toc.open = wide.matches; };
  sync();
  if (wide.addEventListener) wide.addEventListener('change', sync);
})();`;
const themeBootstrap = String.raw`(() => {
  const button = document.querySelector('.mdr-theme-toggle');
  if (!button) return;
  const root = document.documentElement;
  let stored = null;
  try { stored = localStorage.getItem('mdr-theme'); } catch (error) { stored = null; }
  if (stored === 'light' || stored === 'dark') root.dataset.theme = stored;
  const effective = () => root.dataset.theme === 'dark'
    || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const sync = () => {
    const dark = effective();
    button.hidden = false;
    button.textContent = dark ? '切换为浅色' : '切换为深色';
    button.setAttribute('aria-pressed', dark ? 'true' : 'false');
    button.setAttribute('aria-label', dark ? '切换为浅色主题' : '切换为深色主题');
  };
  button.addEventListener('click', () => {
    root.dataset.theme = effective() ? 'light' : 'dark';
    try { localStorage.setItem('mdr-theme', root.dataset.theme); } catch (error) { /* storage unavailable */ }
    sync();
    window.dispatchEvent(new Event('resize'));
  });
  sync();
})();`;
const hashesFor = (sources: readonly string[]): string => sources
  .map((source) => `'sha256-${createHash('sha256').update(source).digest('base64')}'`)
  .join(' ');
const chartScriptHashes = hashesFor([echartsRuntime, chartBootstrap]);
const tableScriptHashes = hashesFor([tabulatorRuntime, tableBootstrap]);
const t8ScriptHashes = hashesFor([t8Runtime, t8Bootstrap]);
const infographicScriptHashes = hashesFor([infographicRuntime, infographicBootstrap]);
const mermaidScriptHashes = hashesFor([mermaidRuntime, mermaidBootstrap]);
const tocScriptHashes = hashesFor([tocBootstrap]);
const themeScriptHashes = hashesFor([themeBootstrap]);

export const REPORT_FORMAT = 'md-report/1' as const;
export const DEFAULT_RENDER_FONT_SIZE = 14;
export const MIN_RENDER_FONT_SIZE = 12;
export const MAX_RENDER_FONT_SIZE = 20;
export const MAX_MARKDOWN_BYTES = 1_000_000;
export const MAX_RENDERED_HTML_BYTES = 12_000_000;
export const MAX_ASSET_BYTES = 8_000_000;
export const MAX_EMBEDDED_ASSET_BYTES = 7_000_000;
export const MAX_INLINE_DATASET_BYTES = 1_000_000;
export const MAX_VALIDATION_DIAGNOSTICS = 500;

export type ReportMode = 'report' | 'dashboard';
export type DiagnosticSeverity = 'error' | 'warning';

export interface ReportAsset {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  dataBase64: string;
}

export interface ReportAssetSource {
  path: string;
  mediaType: ReportAsset['mediaType'];
}

export type ReportAssetSourceConfig = Record<string, ReportAssetSource>;

export interface ReportDataset {
  columns?: readonly { name: string; type?: string; unit?: string }[];
  rows?: readonly (readonly (string | number | boolean | null)[])[];
  format?: 'json' | 'csv';
  data?: string;
  /** Human-readable origin of this snapshot, such as a provider name and endpoint. */
  source?: string;
  /** ISO-8601 time when the host fetched this snapshot from its source. */
  fetchedAt?: string;
  /** Latest business/data date represented by this snapshot. */
  updatedAt?: string;
}

export type SqliteParameter = string | number | boolean | null;

export interface SqliteDatasetSource {
  /** Source table name for provenance when a query or queryFile is used. */
  table?: string;
  /** Source tables for joins and multi-table queries. */
  tables?: readonly string[];
  /** Inline, read-only SQL for small one-off sources. */
  query?: string;
  /** Workspace-relative .sql sidecar for reusable queries. */
  queryFile?: string;
  /** SQLite view to select from without repeating its query. */
  view?: string;
  parameters?: readonly SqliteParameter[];
  columns?: readonly { name: string; type?: string; unit?: string }[];
  maxRows?: number;
  source?: string;
  fetchedAt?: string;
  updatedAt?: string;
}

export interface SqliteSceneSource {
  table?: string;
  tables?: readonly string[];
  query?: string;
  queryFile?: string;
  view?: string;
  parameters?: readonly SqliteParameter[];
  column?: string;
}

/** One workspace-relative SQLite file can provide datasets and Excalidraw scenes. */
export interface SqliteSourceConfig {
  path: string;
  datasets?: Record<string, SqliteDatasetSource>;
  scenes?: Record<string, SqliteSceneSource>;
}

export interface ReportScene extends Record<string, unknown> {
  type: 'excalidraw';
  elements: readonly unknown[];
}

/** Host-neutral transport envelope. Format metadata remains in Markdown frontmatter. */
export interface ReportDocument {
  markdown: string;
  datasets?: Record<string, ReportDataset>;
  assets?: Record<string, ReportAsset>;
  scenes?: Record<string, ReportScene>;
}

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  line: number;
  path: string;
}

export interface ValidationResult {
  valid: boolean;
  title: string;
  mode: ReportMode | '';
  diagnostics: Diagnostic[];
}

export interface RenderResult {
  title: string;
  mode: ReportMode;
  html: string;
  bytes: number;
}

export interface RenderOptions {
  /** Global base font size in CSS pixels. Applies to report/dashboard text and chart labels. */
  fontSize?: number;
}

/** Author-controlled reader-facing text. Every value has a built-in default. */
export interface ReportPresentation {
  eyebrow: string;
  deck: string;
  status: string;
  footer: string;
  /** Initial table-of-contents state. `auto` expands on desktop and collapses on narrow screens. */
  toc: 'auto' | 'open' | 'collapsed';
  /** Colour scheme. `auto` follows the reader's system and shows an in-page toggle. */
  theme: 'auto' | 'light' | 'dark';
}

interface ParsedReport {
  title: string;
  mode: ReportMode;
  body: string;
  bodyLine: number;
  sqlite?: SqliteSourceConfig;
  assets?: ReportAssetSourceConfig;
  metrics?: MetricRegistry;
  presentation: ReportPresentation;
}

/**
 * Reader-facing chrome defaults to empty: a report should not inherit boilerplate
 * copy in the wrong language. The author opts in via frontmatter.
 */
const DEFAULT_PRESENTATION: ReportPresentation = {
  eyebrow: '',
  deck: '',
  status: '',
  footer: '',
  toc: 'auto',
  theme: 'auto',
};
const DEFAULT_EYEBROW: Record<ReportMode, string> = { report: 'Markdown Report', dashboard: 'OPERATIONS DASHBOARD' };

const ASSET_ID = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const ASSET_REFERENCE = /^asset:([A-Za-z][A-Za-z0-9._-]{0,127})$/;
const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const SAFE_EXTERNAL_URL = /^(?:https?:\/\/|mailto:)/i;
const MEDIA_TYPES = new Set<ReportAsset['mediaType']>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

function addDiagnostic(
  diagnostics: Diagnostic[],
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  line = 1,
  path = '$',
): void {
  diagnostics.push({ severity, code, message, line: Math.max(1, line), path });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isSafeLink(url: string): boolean {
  if (url.startsWith('#')) return /^#[A-Za-z0-9_.:-]*$/.test(url);
  return SAFE_EXTERNAL_URL.test(url) && !/^[\u0000-\u0020\u007f]/.test(url) && !/[\u0000-\u001f\u007f]/.test(url);
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function validWorkspaceRelativePath(value: string): boolean {
  if (!value.trim() || /[\u0000-\u001f\u007f\\]/.test(value) || value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
  return value.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function validSqlitePath(value: string): boolean {
  return validWorkspaceRelativePath(value) && /\.(?:db|sqlite|sqlite3)$/i.test(value);
}

function validReadQuery(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 100_000
    && /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(?:select|with|values)\b/i.test(value);
}

function validParameters(value: unknown): value is readonly SqliteParameter[] {
  return Array.isArray(value) && value.every((item) => item === null || typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)));
}

function validateSqliteSourceConfig(value: unknown, diagnostics: Diagnostic[]): SqliteSourceConfig | undefined {
  const path = '$.frontmatter.sqlite';
  const config = plainRecord(value);
  if (!config) {
    addDiagnostic(diagnostics, 'error', 'sqlite.config', 'sqlite must be a mapping with one relative database path.', 1, path);
    return undefined;
  }
  for (const key of Object.keys(config)) {
    if (!['path', 'datasets', 'scenes'].includes(key)) {
      addDiagnostic(diagnostics, 'error', 'sqlite.unknown-key', `Unknown SQLite source key "${key}".`, 1, `${path}.${key}`);
    }
  }
  if (typeof config.path !== 'string' || !validSqlitePath(config.path)) {
    addDiagnostic(diagnostics, 'error', 'sqlite.path', 'SQLite path must be a workspace-relative .db, .sqlite, or .sqlite3 file without parent-directory traversal.', 1, `${path}.path`);
  }

  const datasetSources = plainRecord(config.datasets);
  const sceneSources = plainRecord(config.scenes);
  if (config.datasets !== undefined && !datasetSources) {
    addDiagnostic(diagnostics, 'error', 'sqlite.datasets', 'SQLite datasets must be a mapping of dataRef IDs to query declarations.', 1, `${path}.datasets`);
  }
  if (config.scenes !== undefined && !sceneSources) {
    addDiagnostic(diagnostics, 'error', 'sqlite.scenes', 'SQLite scenes must be a mapping of sceneRef IDs to query declarations.', 1, `${path}.scenes`);
  }
  if ((!datasetSources || Object.keys(datasetSources).length === 0) && (!sceneSources || Object.keys(sceneSources).length === 0)) {
    addDiagnostic(diagnostics, 'error', 'sqlite.sources-empty', 'Declare at least one SQLite dataset or Excalidraw scene query.', 1, path);
  }

  const validateQueryMap = (entries: Record<string, unknown> | undefined, kind: 'dataset' | 'scene') => {
    for (const [id, raw] of Object.entries(entries ?? {})) {
      const itemPath = `${path}.${kind === 'dataset' ? 'datasets' : 'scenes'}.${id}`;
      if (!ASSET_ID.test(id)) addDiagnostic(diagnostics, 'error', `sqlite.${kind}-id`, 'Source IDs must match [A-Za-z][A-Za-z0-9._-]{0,127}.', 1, itemPath);
      const item = plainRecord(raw);
      if (!item) {
        addDiagnostic(diagnostics, 'error', `sqlite.${kind}-query`, 'Each SQLite source must declare a table and a SELECT query.', 1, itemPath);
        continue;
      }
      const allowed = kind === 'dataset'
        ? ['table', 'tables', 'query', 'queryFile', 'view', 'parameters', 'columns', 'maxRows', 'source', 'fetchedAt', 'updatedAt']
        : ['table', 'tables', 'query', 'queryFile', 'view', 'parameters', 'column'];
      for (const key of Object.keys(item)) {
        if (!allowed.includes(key)) addDiagnostic(diagnostics, 'error', 'sqlite.query-unknown-key', `Unknown SQLite ${kind} source key "${key}".`, 1, `${itemPath}.${key}`);
      }
      const sourceModes = [item.query !== undefined, item.queryFile !== undefined, item.view !== undefined].filter(Boolean).length;
      if (sourceModes !== 1) {
        addDiagnostic(diagnostics, 'error', 'sqlite.source-mode', 'Declare exactly one of query, queryFile, or view for each SQLite source.', 1, itemPath);
      }
      const validIdentifier = (candidate: unknown): candidate is string => typeof candidate === 'string'
        && /^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate);
      const hasTable = typeof item.table === 'string' && item.table.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(item.table);
      const hasTables = Array.isArray(item.tables) && item.tables.length > 0 && item.tables.every((table) => typeof table === 'string' && table.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(table));
      if (item.table !== undefined && !hasTable) {
        addDiagnostic(diagnostics, 'error', 'sqlite.table', 'table must be a non-empty table name.', 1, `${itemPath}.table`);
      }
      if (item.tables !== undefined && !hasTables) {
        addDiagnostic(diagnostics, 'error', 'sqlite.tables', 'tables must be a non-empty list of source table names.', 1, `${itemPath}.tables`);
      }
      if (item.view !== undefined && !validIdentifier(item.view)) {
        addDiagnostic(diagnostics, 'error', 'sqlite.view', 'view must be a simple SQLite view name using letters, digits, and underscores.', 1, `${itemPath}.view`);
      }
      if (item.queryFile !== undefined && (typeof item.queryFile !== 'string' || !validWorkspaceRelativePath(item.queryFile) || !/\.sql$/i.test(item.queryFile))) {
        addDiagnostic(diagnostics, 'error', 'sqlite.query-file', 'queryFile must be an explicit workspace-relative .sql path without parent-directory traversal.', 1, `${itemPath}.queryFile`);
      }
      if (item.query !== undefined && !validReadQuery(item.query)) {
        addDiagnostic(diagnostics, 'error', 'sqlite.query-read-only', 'SQLite source queries must be a single bounded-length SELECT, WITH, or VALUES query.', 1, `${itemPath}.query`);
      }
      if (item.view === undefined && !hasTable && !hasTables) {
        addDiagnostic(diagnostics, 'error', 'sqlite.source-table', 'Declare table or tables to document the source tables used by a query.', 1, itemPath);
      }
      if (item.parameters !== undefined && !validParameters(item.parameters)) {
        addDiagnostic(diagnostics, 'error', 'sqlite.parameters', 'SQLite query parameters must be JSON scalar values.', 1, `${itemPath}.parameters`);
      } else if (item.view !== undefined && Array.isArray(item.parameters) && item.parameters.length > 0) {
        addDiagnostic(diagnostics, 'error', 'sqlite.view-parameters', 'SQLite views do not accept query parameters; use a parameterized query or queryFile instead.', 1, `${itemPath}.parameters`);
      }
      if (kind === 'dataset') {
        if (item.maxRows !== undefined && (!Number.isInteger(item.maxRows) || Number(item.maxRows) < 1 || Number(item.maxRows) > 5000)) {
          addDiagnostic(diagnostics, 'error', 'sqlite.max-rows', 'SQLite dataset maxRows must be an integer from 1 to 5000.', 1, `${itemPath}.maxRows`);
        }
        for (const field of ['source', 'fetchedAt', 'updatedAt']) {
          if (item[field] !== undefined && typeof item[field] !== 'string') {
            addDiagnostic(diagnostics, 'error', 'sqlite.metadata', `SQLite dataset ${field} must be a string.`, 1, `${itemPath}.${field}`);
          }
        }
        if (item.columns !== undefined && (!Array.isArray(item.columns) || item.columns.some((column) => {
          const record = plainRecord(column);
          return !record || typeof record.name !== 'string' || !record.name.trim()
            || (record.type !== undefined && typeof record.type !== 'string')
            || (record.unit !== undefined && typeof record.unit !== 'string');
        }))) {
          addDiagnostic(diagnostics, 'error', 'sqlite.columns', 'SQLite dataset columns must be an array of named columns with optional string type and unit.', 1, `${itemPath}.columns`);
        }
      } else if (item.column !== undefined && (typeof item.column !== 'string' || !item.column.trim())) {
        addDiagnostic(diagnostics, 'error', 'sqlite.scene-column', 'Scene query column must be a non-empty string when provided.', 1, `${itemPath}.column`);
      }
    }
  };

  validateQueryMap(datasetSources, 'dataset');
  validateQueryMap(sceneSources, 'scene');
  if (typeof config.path !== 'string') return undefined;
  return config as unknown as SqliteSourceConfig;
}

function validateAssetSourceConfig(value: unknown, diagnostics: Diagnostic[]): ReportAssetSourceConfig | undefined {
  const path = '$.frontmatter.assets';
  const entries = plainRecord(value);
  if (!entries || Object.keys(entries).length === 0) {
    addDiagnostic(diagnostics, 'error', 'assets.source-map', 'assets must map one or more asset IDs to workspace-relative image file declarations.', 1, path);
    return undefined;
  }
  for (const [id, raw] of Object.entries(entries)) {
    const itemPath = `${path}.${id}`;
    if (!ASSET_ID.test(id)) addDiagnostic(diagnostics, 'error', 'asset.source-id', 'Asset IDs must match [A-Za-z][A-Za-z0-9._-]{0,127}.', 1, itemPath);
    const source = plainRecord(raw);
    if (!source) {
      addDiagnostic(diagnostics, 'error', 'asset.source', 'Each image source must declare a relative path and mediaType.', 1, itemPath);
      continue;
    }
    for (const key of Object.keys(source)) {
      if (!['path', 'mediaType'].includes(key)) addDiagnostic(diagnostics, 'error', 'asset.source-unknown-key', `Unknown image source key "${key}".`, 1, `${itemPath}.${key}`);
    }
    if (typeof source.path !== 'string' || !validWorkspaceRelativePath(source.path)) {
      addDiagnostic(diagnostics, 'error', 'asset.source-path', 'Image paths must be workspace-relative files without absolute paths or parent-directory traversal.', 1, `${itemPath}.path`);
    }
    if (typeof source.mediaType !== 'string' || !MEDIA_TYPES.has(source.mediaType as ReportAsset['mediaType'])) {
      addDiagnostic(diagnostics, 'error', 'asset.source-media-type', 'Image mediaType must be PNG, JPEG, WebP, or GIF.', 1, `${itemPath}.mediaType`);
    }
  }
  return value as ReportAssetSourceConfig;
}

/** Read the SQLite declarations from md-report frontmatter for a host-side data adapter. */
export function extractSqliteSourceConfig(markdown: string): SqliteSourceConfig | undefined {
  const match = FRONTMATTER.exec(markdown);
  if (!match) return undefined;
  const document = parseDocument(match[1] ?? '', { version: '1.2', schema: 'core', strict: true, uniqueKeys: true, merge: false, customTags: [], logLevel: 'silent' });
  if (document.errors.length > 0 || !document.contents) return undefined;
  try {
    const metadata = document.toJS({ maxAliasCount: 0 });
    const record = plainRecord(metadata);
    return plainRecord(record?.sqlite) as unknown as SqliteSourceConfig | undefined;
  } catch {
    return undefined;
  }
}

/** Read the declared metric definitions from md-report frontmatter for a host-side summary. */
export function extractMetricConfig(markdown: string): MetricRegistry | undefined {
  const match = FRONTMATTER.exec(markdown);
  if (!match) return undefined;
  const document = parseDocument(match[1] ?? '', { version: '1.2', schema: 'core', strict: true, uniqueKeys: true, merge: false, customTags: [], logLevel: 'silent' });
  if (document.errors.length > 0 || !document.contents) return undefined;
  try {
    const metadata = document.toJS({ maxAliasCount: 0 });
    const record = plainRecord(metadata);
    return plainRecord(record?.metrics) as unknown as MetricRegistry | undefined;
  } catch {
    return undefined;
  }
}

/** Read declared workspace-relative image files from md-report frontmatter. */
export function extractAssetSourceConfig(markdown: string): ReportAssetSourceConfig | undefined {
  const match = FRONTMATTER.exec(markdown);
  if (!match) return undefined;
  const document = parseDocument(match[1] ?? '', { version: '1.2', schema: 'core', strict: true, uniqueKeys: true, merge: false, customTags: [], logLevel: 'silent' });
  if (document.errors.length > 0 || !document.contents) return undefined;
  try {
    const metadata = document.toJS({ maxAliasCount: 0 });
    const record = plainRecord(metadata);
    return plainRecord(record?.assets) as unknown as ReportAssetSourceConfig | undefined;
  } catch {
    return undefined;
  }
}

const METRIC_KEYS = new Set([
  'label', 'value', 'dataRef', 'field', 'format', 'currency', 'decimals', 'unit', 'compact', 'scale',
  'goodDirection', 'comparison', 'definition', 'numerator', 'denominator', 'source', 'asOf', 'owner',
]);
const COMPARISON_KEYS = new Set(['kind', 'value', 'dataRef', 'field', 'asPercent', 'pointsDelta', 'period']);

/** Validate the optional frontmatter `metrics` map (one display definition per business metric). */
function validateMetricsConfig(value: unknown, diagnostics: Diagnostic[]): MetricRegistry | undefined {
  const path = '$.frontmatter.metrics';
  const entries = plainRecord(value);
  if (!entries || Object.keys(entries).length === 0) {
    addDiagnostic(diagnostics, 'error', 'metrics.mapping', 'metrics must map one or more metric IDs to declaration objects.', 1, path);
    return undefined;
  }
  for (const [id, raw] of Object.entries(entries)) {
    const itemPath = `${path}.${id}`;
    if (!ASSET_ID.test(id)) addDiagnostic(diagnostics, 'error', 'metric.id', 'Metric IDs must match [A-Za-z][A-Za-z0-9._-]{0,127}.', 1, itemPath);
    const metric = plainRecord(raw);
    if (!metric) {
      addDiagnostic(diagnostics, 'error', 'metric.object', 'Each metric must be a mapping.', 1, itemPath);
      continue;
    }
    for (const key of Object.keys(metric)) {
      if (!METRIC_KEYS.has(key)) addDiagnostic(diagnostics, 'error', 'metric.unknown-key', `Unknown metric key "${key}".`, 1, `${itemPath}.${key}`);
    }
    const hasValue = Object.hasOwn(metric, 'value');
    const hasBinding = Object.hasOwn(metric, 'dataRef') || Object.hasOwn(metric, 'field');
    if (hasValue && hasBinding) {
      addDiagnostic(diagnostics, 'error', 'metric.value-source', 'A metric must use either a literal value or a dataRef/field binding, not both.', 1, itemPath);
    } else if (!hasValue && !hasBinding) {
      addDiagnostic(diagnostics, 'error', 'metric.value', 'A metric needs a literal value or a dataRef/field binding.', 1, itemPath);
    }
    if (hasValue && typeof metric.value !== 'string' && !(typeof metric.value === 'number' && Number.isFinite(metric.value))) {
      addDiagnostic(diagnostics, 'error', 'metric.value-type', 'A metric value must be a finite number or a string.', 1, `${itemPath}.value`);
    }
    if (hasBinding) {
      if (typeof metric.dataRef !== 'string' || !ASSET_ID.test(metric.dataRef)) {
        addDiagnostic(diagnostics, 'error', 'metric.data-ref', 'A metric binding needs a dataRef matching [A-Za-z][A-Za-z0-9._-]{0,127}.', 1, `${itemPath}.dataRef`);
      }
      if (typeof metric.field !== 'string' || !metric.field.trim()) {
        addDiagnostic(diagnostics, 'error', 'metric.field', 'A metric binding needs a non-empty field.', 1, `${itemPath}.field`);
      }
    }
    if (metric.format !== undefined && !isMetricFormat(metric.format)) {
      addDiagnostic(diagnostics, 'error', 'metric.format', `Metric format must be one of ${METRIC_FORMATS.join(', ')}, optionally with a currency suffix such as currency:CNY.`, 1, `${itemPath}.format`);
    }
    if (metric.goodDirection !== undefined && !METRIC_GOOD_DIRECTIONS.includes(metric.goodDirection as never)) {
      addDiagnostic(diagnostics, 'error', 'metric.good-direction', 'goodDirection must be up, down, or neutral.', 1, `${itemPath}.goodDirection`);
    }
    if (metric.decimals !== undefined && (!Number.isInteger(metric.decimals) || Number(metric.decimals) < 0 || Number(metric.decimals) > 6)) {
      addDiagnostic(diagnostics, 'error', 'metric.decimals', 'decimals must be an integer from 0 to 6.', 1, `${itemPath}.decimals`);
    }
    if (metric.scale !== undefined && (typeof metric.scale !== 'number' || !Number.isFinite(metric.scale))) {
      addDiagnostic(diagnostics, 'error', 'metric.scale', 'scale must be a finite number.', 1, `${itemPath}.scale`);
    }
    if (metric.compact !== undefined && typeof metric.compact !== 'boolean') {
      addDiagnostic(diagnostics, 'error', 'metric.compact', 'compact must be a boolean.', 1, `${itemPath}.compact`);
    }
    if (metric.currency !== undefined && (typeof metric.currency !== 'string' || !/^[A-Za-z]{3}$/.test(metric.currency))) {
      addDiagnostic(diagnostics, 'error', 'metric.currency', 'currency must be a three-letter ISO 4217 code.', 1, `${itemPath}.currency`);
    }
    for (const field of ['label', 'unit', 'definition', 'numerator', 'denominator', 'source', 'asOf', 'owner']) {
      if (metric[field] !== undefined && typeof metric[field] !== 'string') {
        addDiagnostic(diagnostics, 'error', 'metric.text', `Metric ${field} must be a string.`, 1, `${itemPath}.${field}`);
      }
    }
    if (metric.comparison === undefined) continue;
    const comparison = plainRecord(metric.comparison);
    if (!comparison) {
      addDiagnostic(diagnostics, 'error', 'metric.comparison', 'comparison must be a mapping.', 1, `${itemPath}.comparison`);
      continue;
    }
    for (const key of Object.keys(comparison)) {
      if (!COMPARISON_KEYS.has(key)) addDiagnostic(diagnostics, 'error', 'metric.comparison-unknown-key', `Unknown comparison key "${key}".`, 1, `${itemPath}.comparison.${key}`);
    }
    if (comparison.kind !== undefined && !COMPARISON_KINDS.includes(comparison.kind as never)) {
      addDiagnostic(diagnostics, 'error', 'metric.comparison-kind', `comparison.kind must be one of ${COMPARISON_KINDS.join(', ')}.`, 1, `${itemPath}.comparison.kind`);
    }
    const baselineLiteral = Object.hasOwn(comparison, 'value');
    const baselineBinding = Object.hasOwn(comparison, 'dataRef') || Object.hasOwn(comparison, 'field');
    if (baselineLiteral && baselineBinding) {
      addDiagnostic(diagnostics, 'error', 'metric.comparison-source', 'comparison must use either a literal value or a dataRef/field binding, not both.', 1, `${itemPath}.comparison`);
    }
    if (!baselineLiteral && !baselineBinding) {
      addDiagnostic(diagnostics, 'error', 'metric.comparison-baseline', 'comparison needs a baseline value or a dataRef/field binding.', 1, `${itemPath}.comparison`);
    }
    if (baselineLiteral && (typeof comparison.value !== 'number' || !Number.isFinite(comparison.value))) {
      addDiagnostic(diagnostics, 'error', 'metric.comparison-value', 'comparison.value must be a finite number.', 1, `${itemPath}.comparison.value`);
    }
    if (baselineBinding && (typeof comparison.dataRef !== 'string' || typeof comparison.field !== 'string' || !comparison.dataRef || !comparison.field)) {
      addDiagnostic(diagnostics, 'error', 'metric.comparison-binding', 'comparison.dataRef and comparison.field must both be non-empty strings.', 1, `${itemPath}.comparison`);
    }
    if (comparison.asPercent !== undefined && typeof comparison.asPercent !== 'boolean') {
      addDiagnostic(diagnostics, 'error', 'metric.comparison-as-percent', 'comparison.asPercent must be a boolean.', 1, `${itemPath}.comparison.asPercent`);
    }
    if (comparison.pointsDelta !== undefined && typeof comparison.pointsDelta !== 'boolean') {
      addDiagnostic(diagnostics, 'error', 'metric.comparison-points', 'comparison.pointsDelta must be a boolean.', 1, `${itemPath}.comparison.pointsDelta`);
    }
    if (comparison.period !== undefined && typeof comparison.period !== 'string') {
      addDiagnostic(diagnostics, 'error', 'metric.comparison-period', 'comparison.period must be a string.', 1, `${itemPath}.comparison.period`);
    }
  }
  return entries as unknown as MetricRegistry;
}

function validatePresentationConfig(values: Record<string, unknown>, diagnostics: Diagnostic[]): ReportPresentation {
  const presentation: ReportPresentation = { ...DEFAULT_PRESENTATION };
  const frontmatterLine = 2;
  for (const key of ['eyebrow', 'deck', 'status', 'footer'] as const) {
    const value = values[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) {
      addDiagnostic(diagnostics, 'error', 'frontmatter.presentation-text', `${key} must be a string of at most 200 characters without control characters.`, frontmatterLine, `$.frontmatter.${key}`);
      continue;
    }
    presentation[key] = value;
  }
  if (values.toc !== undefined) {
    if (values.toc !== 'auto' && values.toc !== 'open' && values.toc !== 'collapsed') {
      addDiagnostic(diagnostics, 'error', 'frontmatter.toc', 'toc must be auto, open, or collapsed.', frontmatterLine, '$.frontmatter.toc');
    } else {
      presentation.toc = values.toc;
    }
  }
  if (values.theme !== undefined) {
    if (values.theme !== 'auto' && values.theme !== 'light' && values.theme !== 'dark') {
      addDiagnostic(diagnostics, 'error', 'frontmatter.theme', 'theme must be auto, light, or dark.', frontmatterLine, '$.frontmatter.theme');
    } else {
      presentation.theme = values.theme;
    }
  }
  return presentation;
}

/** Cross-metric invariants that need materialized values: unresolved references and declared share totals. */
function validateMetricInvariants(document: ReportDocument, metrics: MetricRegistry, diagnostics: Diagnostic[]): void {
  const datasets = document.datasets ?? {};
  for (const [id, metric] of Object.entries(metrics)) {
    const dataRef = typeof metric.dataRef === 'string' ? metric.dataRef : '';
    if (dataRef && !datasets[dataRef]) {
      addDiagnostic(diagnostics, 'error', 'metric.dataset-missing', `Metric "${id}" reads dataset "${dataRef}", which is not materialized for this report.`, 1, `$.metrics.${id}.dataRef`);
    }
    const comparisonRef = typeof metric.comparison?.dataRef === 'string' ? metric.comparison.dataRef : '';
    if (comparisonRef && !datasets[comparisonRef]) {
      addDiagnostic(diagnostics, 'error', 'metric.comparison-dataset-missing', `Metric "${id}" compares against dataset "${comparisonRef}", which is not materialized for this report.`, 1, `$.metrics.${id}.comparison.dataRef`);
    }
  }

  // Declared shares that name the same denominator must add up to a whole.
  const groups = new Map<string, Array<{ id: string; value: number }>>();
  for (const [id, metric] of Object.entries(metrics)) {
    const denominator = typeof metric.denominator === 'string' ? metric.denominator.trim() : '';
    if (!denominator) continue;
    if (metric.format !== undefined && metric.format !== 'percent' && metric.format !== 'ratio') continue;
    const value = numericMetricValue(metric, datasets);
    if (value === undefined) continue;
    const bucket = groups.get(denominator) ?? [];
    bucket.push({ id, value });
    groups.set(denominator, bucket);
  }
  for (const [denominator, members] of groups) {
    if (members.length < 2) continue;
    const total = members.reduce((sum, member) => sum + member.value, 0);
    if (Math.abs(total - 1) > 0.005) {
      addDiagnostic(
        diagnostics,
        'error',
        'metric.share-sum',
        `Metrics sharing denominator "${denominator}" sum to ${(total * 100).toFixed(2)}%, not 100%. Members: ${members.map((member) => member.id).join(', ')}.`,
        1,
        '$.frontmatter.metrics',
      );
    }
  }
}

function numericMetricValue(metric: MetricSpec, datasets: ReportDocument['datasets']): number | undefined {
  const dataset = typeof metric.dataRef === 'string' ? datasets?.[metric.dataRef] : undefined;
  if (dataset && typeof metric.field === 'string') {
    try {
      const value = datasetRecords(dataset)[0]?.[metric.field];
      const parsed = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(parsed)) return parsed;
    } catch {
      return undefined;
    }
    return undefined;
  }
  const literal = typeof metric.value === 'number' ? metric.value : Number(metric.value);
  return Number.isFinite(literal) ? literal : undefined;
}

function parseFrontmatter(markdown: string, diagnostics: Diagnostic[]): ParsedReport | undefined {
  const match = FRONTMATTER.exec(markdown);
  if (!match) {
    addDiagnostic(diagnostics, 'error', 'frontmatter.required', 'The first Markdown block must be a YAML frontmatter block.', 1, '$.frontmatter');
    return undefined;
  }

  const document = parseDocument(match[1] ?? '', {
    version: '1.2',
    schema: 'core',
    strict: true,
    uniqueKeys: true,
    merge: false,
    customTags: [],
    prettyErrors: false,
    logLevel: 'silent',
  });
  const frontmatterLine = 2;
  for (const error of document.errors) {
    const line = error.linePos?.[0]?.line ?? 1;
    addDiagnostic(diagnostics, 'error', 'frontmatter.yaml', error.message, frontmatterLine + line - 1, '$.frontmatter');
  }
  for (const warning of document.warnings) {
    const line = warning.linePos?.[0]?.line ?? 1;
    addDiagnostic(diagnostics, 'warning', 'frontmatter.yaml-warning', warning.message, frontmatterLine + line - 1, '$.frontmatter');
  }
  if (document.errors.length > 0 || !document.contents) return undefined;

  try {
    if (isAlias(document.contents)) {
      addDiagnostic(diagnostics, 'error', 'frontmatter.alias', 'YAML aliases are not supported.', frontmatterLine, '$.frontmatter');
      return undefined;
    }
    const metadata = document.toJS({ maxAliasCount: 0 }) as unknown;
    if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
      addDiagnostic(diagnostics, 'error', 'frontmatter.object', 'Frontmatter must be a YAML mapping.', frontmatterLine, '$.frontmatter');
      return undefined;
    }

    const values = metadata as Record<string, unknown>;
    const allowed = new Set(['format', 'mode', 'title', 'sqlite', 'assets', 'metrics', 'eyebrow', 'deck', 'status', 'footer', 'toc', 'theme']);
    for (const key of Object.keys(values)) {
      if (!allowed.has(key)) {
        addDiagnostic(diagnostics, 'error', 'frontmatter.unknown-key', `Unknown frontmatter key "${key}".`, frontmatterLine, `$.frontmatter.${key}`);
      }
    }
    if (values.format !== REPORT_FORMAT) {
      addDiagnostic(diagnostics, 'error', 'frontmatter.format', `format must be "${REPORT_FORMAT}".`, frontmatterLine, '$.frontmatter.format');
    }
    if (values.mode !== 'report' && values.mode !== 'dashboard') {
      addDiagnostic(diagnostics, 'error', 'frontmatter.mode', 'mode must be "report" or "dashboard".', frontmatterLine, '$.frontmatter.mode');
    }
    if (typeof values.title !== 'string' || values.title.trim().length === 0 || values.title.length > 120 || /[\u0000-\u001f\u007f]/.test(values.title)) {
      addDiagnostic(diagnostics, 'error', 'frontmatter.title', 'title must be a non-empty string of at most 120 characters.', frontmatterLine, '$.frontmatter.title');
    }
    const sqlite = values.sqlite === undefined ? undefined : validateSqliteSourceConfig(values.sqlite, diagnostics);
    const assets = values.assets === undefined ? undefined : validateAssetSourceConfig(values.assets, diagnostics);
    const metrics = values.metrics === undefined ? undefined : validateMetricsConfig(values.metrics, diagnostics);
    const presentation = validatePresentationConfig(values, diagnostics);
    if (values.mode !== 'report' && values.mode !== 'dashboard') return undefined;
    if (typeof values.title !== 'string' || !values.title.trim() || values.title.length > 120) return undefined;

    const body = markdown.slice(match[0].length);
    const bodyLine = (match[0].match(/\n/g)?.length ?? 0) + 1;
    return { title: values.title.trim(), mode: values.mode, body, bodyLine, presentation, ...(sqlite ? { sqlite } : {}), ...(assets ? { assets } : {}), ...(metrics ? { metrics } : {}) };
  } catch (error) {
    addDiagnostic(
      diagnostics,
      'error',
      'frontmatter.unsupported-yaml',
      error instanceof Error ? error.message : 'Frontmatter uses unsupported YAML features.',
      frontmatterLine,
      '$.frontmatter',
    );
    return undefined;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createMarkdownParser(
  assets: ReportDocument['assets'],
  datasets: ComponentDatasets = {},
  scenes: ReportDocument['scenes'] = {},
  metrics: MetricRegistry = {},
  tocPlaceholder = '${toc}',
): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
    breaks: false,
  });
  md.validateLink = (url) => isSafeLink(url) || ASSET_REFERENCE.test(url);
  md.use(markdownItAnchor, { level: [2, 3, 4] });
  md.use(markdownItTocDoneRight, {
    placeholder: escapeRegExp(tocPlaceholder),
    containerClass: 'mdr-toc-nav',
    listClass: 'mdr-toc-list',
    itemClass: 'mdr-toc-item',
    linkClass: 'mdr-toc-link',
    level: [2, 3, 4],
  });

  const useContainer = container as unknown as (
    parser: MarkdownIt,
    name: string,
    options: { render(tokens: Array<{ nesting: number; info: string }>, index: number): string },
  ) => void;

  for (const type of ['note', 'warning', 'success'] as const) {
    useContainer(md, type, {
      render(tokens, index) {
        if (tokens[index]?.nesting === 1) return `<aside class="mdr-callout mdr-callout--${type}" role="note">\n`;
        return '</aside>\n';
      },
    });
  }

  useContainer(md, 'dashboard', {
    render(tokens, index) {
      if (tokens[index]?.nesting === 1) return '<section class="mdr-dashboard" aria-label="Dashboard">\n';
      return '</section>\n';
    },
  });
  useContainer(md, 'panel', {
    render(tokens, index) {
      const token = tokens[index];
      if (token?.nesting === 1) {
        const match = /^panel\s+span=(\d{1,2})$/.exec(token.info.trim());
        const span = match ? Math.max(1, Math.min(12, Number(match[1]))) : 12;
        return `<section class="mdr-panel mdr-panel--span-${span}" data-span="${span}">\n`;
      }
      return '</section>\n';
    },
  });

  const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const href = tokens[index]?.attrGet('href') ?? '';
    if (href.startsWith('asset:') || !isSafeLink(href)) {
      for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
        if (tokens[cursor]?.type === 'link_close') {
          tokens[cursor]!.meta = { ...tokens[cursor]!.meta, mdrInvalidLink: true };
          break;
        }
      }
      return '<span class="mdr-invalid-link">';
    }
    return defaultLinkOpen(tokens, index, options, env, renderer);
  };
  md.renderer.rules.link_close = (tokens, index, options, env, renderer) => {
    if (tokens[index]?.meta?.mdrInvalidLink === true) return '</span>';
    return renderer.renderToken(tokens, index, options);
  };

  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const source = token?.attrGet('src') ?? '';
    const reference = ASSET_REFERENCE.exec(source);
    const alt = token?.content ?? '';
    const escapedAlt = md.utils.escapeHtml(alt);
    if (!reference || !assets?.[reference[1] ?? '']) {
      return `<span class="mdr-image-missing" role="img" aria-label="${escapedAlt}">Image asset unavailable: ${escapedAlt}</span>`;
    }
    const asset = assets[reference[1] as string];
    if (!asset || !MEDIA_TYPES.has(asset.mediaType)) {
      return `<span class="mdr-image-missing" role="img" aria-label="${escapedAlt}">Image asset unavailable: ${escapedAlt}</span>`;
    }
    const title = token?.attrGet('title');
    const titleAttribute = title ? ` title="${md.utils.escapeHtml(title)}"` : '';
    return `<img src="data:${asset.mediaType};base64,${asset.dataBase64}" alt="${escapedAlt}"${titleAttribute} loading="lazy">`;
  };

  registerComponentRenderers(md, datasets, scenes as ComponentScenes, metrics);

  return md;
}

function validateAssets(
  document: ReportDocument,
  parsed: ParsedReport | undefined,
  diagnostics: Diagnostic[],
): void {
  if (document.assets !== undefined && (document.assets === null || typeof document.assets !== 'object' || Array.isArray(document.assets))) {
    addDiagnostic(diagnostics, 'error', 'assets.object', 'assets must be a mapping of asset IDs to asset records.', 1, '$.assets');
    return;
  }
  const assets = document.assets ?? {};
  let totalBytes = 0;
  for (const [id, asset] of Object.entries(assets)) {
    const path = `$.assets.${id}`;
    if (!ASSET_ID.test(id)) addDiagnostic(diagnostics, 'error', 'asset.id', 'Asset IDs must match [A-Za-z][A-Za-z0-9._-]{0,127}.', 1, path);
    if (!asset || typeof asset !== 'object' || !MEDIA_TYPES.has(asset.mediaType)) {
      addDiagnostic(diagnostics, 'error', 'asset.media-type', 'Assets must use PNG, JPEG, WebP, or GIF media types.', 1, path);
      continue;
    }
    if (typeof asset.dataBase64 !== 'string' || asset.dataBase64.length === 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(asset.dataBase64)) {
      addDiagnostic(diagnostics, 'error', 'asset.base64', 'Asset dataBase64 must be canonical base64.', 1, `${path}.dataBase64`);
      continue;
    }
    const bytes = Math.floor(asset.dataBase64.length * 3 / 4) - (asset.dataBase64.endsWith('==') ? 2 : asset.dataBase64.endsWith('=') ? 1 : 0);
    totalBytes += bytes;
    if (bytes > MAX_ASSET_BYTES) addDiagnostic(diagnostics, 'error', 'asset.too-large', `An asset cannot exceed ${MAX_ASSET_BYTES} bytes.`, 1, path);
  }
  if (totalBytes > MAX_ASSET_BYTES) addDiagnostic(diagnostics, 'error', 'assets.too-large', `All report assets together cannot exceed ${MAX_ASSET_BYTES} bytes.`, 1, '$.assets');

  if (!parsed) return;
  const md = createMarkdownParser(assets, {}, {}, {});
  const tokens = md.parse(parsed.body, {});
  let referencedAssetBytes = 0;
  const usedAssets = new Set<string>();
  for (const token of tokens) {
    if (token.type !== 'inline' || !token.children) continue;
    for (const child of token.children) {
      const line = parsed.bodyLine + (token.map?.[0] ?? 0);
      if (child.type === 'image') {
        const src = child.attrGet('src') ?? '';
        const reference = ASSET_REFERENCE.exec(src);
        if (!reference) {
          addDiagnostic(diagnostics, 'error', 'image.asset-only', 'Report images must use an asset: reference.', line, '$.markdown');
        } else if (!assets[reference[1] ?? '']) {
          addDiagnostic(diagnostics, 'error', 'image.asset-missing', `Image asset "${reference[1]}" is not declared in the report envelope.`, line, '$.assets');
        } else {
          usedAssets.add(reference[1] ?? '');
          const asset = assets[reference[1] as string];
          if (asset && typeof asset.dataBase64 === 'string') {
            referencedAssetBytes += Math.floor(asset.dataBase64.length * 3 / 4) - (asset.dataBase64.endsWith('==') ? 2 : asset.dataBase64.endsWith('=') ? 1 : 0);
          }
        }
      } else if (child.type === 'link_open') {
        const href = child.attrGet('href') ?? '';
        if (href.startsWith('asset:') || !isSafeLink(href)) {
          addDiagnostic(diagnostics, 'error', 'link.protocol', 'Links must use https:, http:, mailto:, or an in-document anchor.', line, '$.markdown');
        }
      }
    }
  }
  if (referencedAssetBytes > MAX_EMBEDDED_ASSET_BYTES) {
    addDiagnostic(diagnostics, 'error', 'assets.references-too-large', `Referenced image bytes, including repeated uses, cannot exceed ${MAX_EMBEDDED_ASSET_BYTES} bytes.`, 1, '$.assets');
  }
  for (const id of Object.keys(assets)) {
    if (!usedAssets.has(id)) addDiagnostic(diagnostics, 'warning', 'asset.unused', `Asset "${id}" is declared but not referenced by the Markdown.`, 1, `$.assets.${id}`);
  }
}

function validateScenes(document: ReportDocument, diagnostics: Diagnostic[]): void {
  if (document.scenes === undefined) return;
  if (!document.scenes || typeof document.scenes !== 'object' || Array.isArray(document.scenes)) {
    addDiagnostic(diagnostics, 'error', 'scenes.object', 'scenes must be a mapping of scene IDs to Excalidraw scene objects.', 1, '$.scenes');
    return;
  }
  for (const [id, scene] of Object.entries(document.scenes)) {
    const path = `$.scenes.${id}`;
    if (!ASSET_ID.test(id)) addDiagnostic(diagnostics, 'error', 'scene.id', 'Scene IDs must match [A-Za-z][A-Za-z0-9._-]{0,127}.', 1, path);
    if (!scene || typeof scene !== 'object' || Array.isArray(scene) || scene.type !== 'excalidraw' || !Array.isArray(scene.elements)) {
      addDiagnostic(diagnostics, 'error', 'scene.shape', 'Each scene must be an Excalidraw scene object with an elements array.', 1, path);
    } else if (!hasOnlyEmbeddedExcalidrawFiles(scene as Record<string, unknown>)) {
      addDiagnostic(diagnostics, 'error', 'scene.external-resource', 'Excalidraw image files must use embedded data:image URLs for offline export.', 1, `${path}.files`);
    }
  }
}

function hasOnlyEmbeddedExcalidrawFiles(scene: Record<string, unknown>): boolean {
  if (scene.files === undefined) return true;
  const files = plainRecord(scene.files);
  if (!files) return false;
  return Object.values(files).every((value) => {
    const file = plainRecord(value);
    if (!file) return false;
    return file.dataURL === undefined || (typeof file.dataURL === 'string' && /^data:image\//i.test(file.dataURL));
  });
}

function validateDatasets(document: ReportDocument, diagnostics: Diagnostic[]): void {
  if (document.datasets === undefined) return;
  if (document.datasets === null || typeof document.datasets !== 'object' || Array.isArray(document.datasets)) {
    addDiagnostic(diagnostics, 'error', 'datasets.object', 'datasets must be a mapping of dataset IDs to dataset records.', 1, '$.datasets');
    return;
  }
  let serialized: string;
  try {
    const value = JSON.stringify(document.datasets);
    if (typeof value !== 'string') throw new TypeError('datasets did not serialize to JSON.');
    serialized = value;
  } catch {
    addDiagnostic(diagnostics, 'error', 'datasets.json', 'datasets must contain JSON-compatible values.', 1, '$.datasets');
    return;
  }
  if (byteLength(serialized) > MAX_INLINE_DATASET_BYTES) {
    addDiagnostic(diagnostics, 'error', 'datasets.too-large', `Inline datasets cannot exceed ${MAX_INLINE_DATASET_BYTES} bytes in this release.`, 1, '$.datasets');
    return;
  }
  for (const [id, dataset] of Object.entries(document.datasets)) {
    const path = `$.datasets.${id}`;
    if (!ASSET_ID.test(id)) addDiagnostic(diagnostics, 'error', 'dataset.id', 'Dataset IDs must match [A-Za-z][A-Za-z0-9._-]{0,127}.', 1, path);
    if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
      addDiagnostic(diagnostics, 'error', 'dataset.object', 'Each dataset must be an object.', 1, path);
      continue;
    }

    const candidate = dataset as unknown as Record<string, unknown>;
    for (const field of ['source', 'fetchedAt', 'updatedAt']) {
      if (candidate[field] !== undefined && typeof candidate[field] !== 'string') {
        addDiagnostic(diagnostics, 'error', 'dataset.metadata', `Dataset ${field} must be a string.`, 1, `${path}.${field}`);
      }
    }
    if (candidate.format !== undefined && candidate.format !== 'json' && candidate.format !== 'csv') {
      addDiagnostic(diagnostics, 'error', 'dataset.format', 'Dataset format must be "json" or "csv".', 1, `${path}.format`);
    }
    if (candidate.format !== undefined && candidate.data === undefined) {
      addDiagnostic(diagnostics, 'error', 'dataset.data-required', 'Dataset format can only be set when data is provided.', 1, `${path}.format`);
    }
    if (Array.isArray(candidate.columns)) {
      for (const [index, column] of candidate.columns.entries()) {
        const record = column && typeof column === 'object' && !Array.isArray(column) ? column as Record<string, unknown> : undefined;
        if (!record || typeof record.name !== 'string' || record.name.trim() === '') {
          addDiagnostic(diagnostics, 'error', 'dataset.column', `Column ${index + 1} needs a non-empty name.`, 1, `${path}.columns[${index}]`);
          continue;
        }
        for (const field of ['type', 'unit']) {
          if (record[field] !== undefined && typeof record[field] !== 'string') {
            addDiagnostic(diagnostics, 'error', 'dataset.column-metadata', `Column ${field} must be a string.`, 1, `${path}.columns[${index}].${field}`);
          }
        }
      }
    } else if (candidate.columns !== undefined) {
      addDiagnostic(diagnostics, 'error', 'dataset.columns', 'Dataset columns must be an array.', 1, `${path}.columns`);
    }
    if (candidate.rows !== undefined && !Array.isArray(candidate.rows)) {
      addDiagnostic(diagnostics, 'error', 'dataset.rows', 'Dataset rows must be an array.', 1, `${path}.rows`);
    }
    if (candidate.data !== undefined && typeof candidate.data !== 'string') {
      addDiagnostic(diagnostics, 'error', 'dataset.data', 'Dataset data must be a string.', 1, `${path}.data`);
    }
    try {
      datasetRecords(dataset as ReportDataset);
    } catch (error) {
      addDiagnostic(
        diagnostics,
        'error',
        'dataset.shape',
        error instanceof Error ? error.message : 'Dataset rows and columns have an invalid shape.',
        1,
        path,
      );
    }
  }
}

function validateContainers(parsed: ParsedReport | undefined, diagnostics: Diagnostic[], assets: ReportDocument['assets']): void {
  if (!parsed) return;
  const md = createMarkdownParser(assets, {}, {}, {});
  const tokens = md.parse(parsed.body, {});
  let dashboardDepth = 0;
  let panelDepth = 0;
  let topLevelDashboards = 0;
  let dashboardOpenLine = parsed.bodyLine;
  let panelOpenLine = parsed.bodyLine;

  for (const token of tokens) {
    if (token.type === 'heading_open' && token.tag === 'h1') {
      addDiagnostic(diagnostics, 'error', 'heading.title-duplicate', 'Do not repeat the frontmatter title as a top-level H1.', parsed.bodyLine + (token.map?.[0] ?? 0), '$.markdown');
    }
    if (token.type === 'container_dashboard_open') {
      const openingLine = parsed.bodyLine + (token.map?.[0] ?? 0);
      dashboardOpenLine = openingLine;
      if (!/^dashboard\s+columns=12$/.test(token.info.trim())) {
        addDiagnostic(diagnostics, 'error', 'dashboard.columns', 'Dashboard containers must use exactly `:::: dashboard columns=12`.', openingLine, '$.markdown');
      }
      if (dashboardDepth !== 0) addDiagnostic(diagnostics, 'error', 'dashboard.nested', 'Dashboard containers cannot be nested.', openingLine, '$.markdown');
      if (token.level === 0) topLevelDashboards += 1;
      dashboardDepth += 1;
    } else if (token.type === 'container_dashboard_close') {
      dashboardDepth = Math.max(0, dashboardDepth - 1);
      if (dashboardDepth === 0) dashboardOpenLine = parsed.bodyLine;
    } else if (token.type === 'container_panel_open') {
      const openingLine = parsed.bodyLine + (token.map?.[0] ?? 0);
      panelOpenLine = openingLine;
      const match = /^panel\s+span=(\d{1,2})$/.exec(token.info.trim());
      if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) {
        addDiagnostic(diagnostics, 'error', 'dashboard.panel-span', 'Panel declarations must use `::: panel span=N` where N is an integer from 1 to 12.', openingLine, '$.markdown');
      }
      if (dashboardDepth === 0) addDiagnostic(diagnostics, 'error', 'dashboard.panel-outside', 'A panel must be inside a dashboard container.', openingLine, '$.markdown');
      if (panelDepth > 0) addDiagnostic(diagnostics, 'error', 'dashboard.panel-nested', 'Dashboard panels cannot be nested.', openingLine, '$.markdown');
      panelDepth += 1;
    } else if (token.type === 'container_panel_close') {
      panelDepth = Math.max(0, panelDepth - 1);
      if (panelDepth === 0) panelOpenLine = parsed.bodyLine;
    }
  }

  if (panelDepth > 0) addDiagnostic(diagnostics, 'error', 'dashboard.panel-unclosed', 'A dashboard panel is missing its closing `:::` delimiter.', panelOpenLine, '$.markdown');
  if (dashboardDepth > 0) addDiagnostic(diagnostics, 'error', 'dashboard.unclosed', 'A dashboard is missing its closing `::::` delimiter.', dashboardOpenLine, '$.markdown');

  if (parsed.mode === 'dashboard' && topLevelDashboards !== 1) {
    addDiagnostic(diagnostics, 'error', 'dashboard.required', 'A dashboard-mode document must contain exactly one top-level `:::: dashboard columns=12` container.', parsed.bodyLine, '$.markdown');
  }
}

/** Allowed keys per component spec. Unknown keys are rejected so a typo cannot silently drop a field. */
const COMPONENT_KEYS: Record<string, readonly string[]> = {
  kpi: ['items', 'title', 'kicker'],
  'kpi.item': [
    'label', 'value', 'dataRef', 'field', 'metricRef', 'unit', 'change', 'changeField', 'changeFormat',
    'period', 'periodField', 'direction', 'goodDirection', 'format', 'currency', 'decimals', 'compact', 'scale',
    'sparkline', 'anchor',
  ],
  chart: [
    'kind', 'dataRef', 'x', 'y', 'series', 'title', 'unit', 'kicker', 'metricRef', 'axisFormat', 'anchor',
    'targets', 'bands', 'points',
    'value', 'name', 'mapName', 'geo',
    'open', 'high', 'low', 'close', 'volume',
    'source', 'target',
    'totalField', 'sort', 'min', 'max',
  ],
  'chart.axisFormat': ['format', 'decimals', 'compact', 'currency', 'scale'],
  'chart.series': ['field', 'type', 'axis', 'name', 'stack', 'format', 'decimals', 'compact'],
  'chart.target': ['value', 'label', 'axis', 'color'],
  'chart.band': ['from', 'to', 'axis', 'label'],
  'chart.point': ['x', 'y', 'text'],
  'data-table': ['dataRef', 'title', 'kicker', 'anchor', 'columns', 'defaultSort', 'viewportHeight', 'exportable', 'updatedAt'],
  'data-table.column': ['field', 'label', 'width', 'minWidth', 'format', 'formatRef', 'frozen', 'sorter'],
  'data-table.defaultSort': ['field', 'direction'],
  ranking: ['dataRef', 'x', 'y', 'title', 'kicker', 'anchor', 'limit', 'format', 'currency', 'unit', 'decimals', 'compact', 'share', 'metricRef'],
  'ranking.sparkline': ['dataRef', 'x', 'y', 'title'],
  pivot: ['dataRef', 'rows', 'columns', 'value', 'agg', 'title', 'kicker', 'anchor', 'format', 'currency', 'unit', 'decimals', 'compact', 'rowTotal', 'columnTotal', 'metricRef', 'rowsLabel', 'columnsLabel'],
  findings: ['title', 'kicker', 'anchor', 'items'],
  'findings.item': ['severity', 'title', 'detail', 'metricRef', 'evidence', 'action', 'owner'],
  provenance: ['title', 'kicker', 'anchor', 'items'],
  quality: ['title', 'kicker', 'anchor', 'dataRefs', 'notes'],
  excalidraw: ['sceneRef', 'title', 'kicker'],
};

const FENCE_INFO_TOKENS = new Set(['dialect', 'title', 'kicker', 'engine']);
const SQL_DIALECTS = new Set(['standard', 'postgresql', 'mysql', 'bigquery', 'duckdb', 'sqlite']);

function rejectUnknownKeys(
  value: Record<string, unknown>,
  kind: string,
  diagnostics: Diagnostic[],
  line: number,
  path: string,
): void {
  const allowed = COMPONENT_KEYS[kind] ?? [];
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      addDiagnostic(diagnostics, 'error', 'component.unknown-key', `Unknown ${kind} key "${key}". Allowed keys: ${allowed.join(', ')}.`, line, `${path}.${key}`);
    }
  }
}

/** Validate target lines, shaded bands, and anchored annotations on a chart. */
function rejectAnnotations(spec: Record<string, unknown>, diagnostics: Diagnostic[], line: number): void {
  const shape = (key: string, kind: string, required: readonly string[], axisAllowed: boolean): void => {
    const value = spec[key];
    if (value === undefined) return;
    if (!Array.isArray(value) || value.length > 20) {
      addDiagnostic(diagnostics, 'error', 'component.chart-annotation', `${key} must be an array of at most 20 entries.`, line, `$.markdown.${key}`);
      return;
    }
    for (const [index, raw] of value.entries()) {
      const entry = plainRecord(raw);
      const path = `$.markdown.${key}[${index}]`;
      if (!entry) {
        addDiagnostic(diagnostics, 'error', 'component.chart-annotation', `${key} entry ${index + 1} must be an object.`, line, path);
        continue;
      }
      rejectUnknownKeys(entry, kind, diagnostics, line, path);
      for (const field of required) {
        if (entry[field] === undefined) addDiagnostic(diagnostics, 'error', 'component.chart-annotation', `${key} entry ${index + 1} needs "${field}".`, line, `${path}.${field}`);
      }
      if (axisAllowed && entry.axis !== undefined && entry.axis !== 'x' && entry.axis !== 'y') {
        addDiagnostic(diagnostics, 'error', 'component.chart-annotation-axis', `${key} entry ${index + 1} axis must be "x" or "y".`, line, `${path}.axis`);
      }
    }
  };
  shape('targets', 'chart.target', ['value'], true);
  shape('bands', 'chart.band', ['from', 'to'], true);
  shape('points', 'chart.point', ['x', 'y'], false);
}

/** Validate the optional fence info string, e.g. ```sql dialect=sqlite title="口径复核". */
function validateFenceInfo(info: string, language: string, diagnostics: Diagnostic[], line: number): void {
  const rest = info.slice(language.length).trim();
  if (!rest) return;
  const pattern = /([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)|([A-Za-z][A-Za-z0-9_-]*)|\S+/g;
  for (const match of rest.matchAll(pattern)) {
    const name = match[1] ?? match[2];
    if (!name || !FENCE_INFO_TOKENS.has(name)) {
      addDiagnostic(diagnostics, 'error', 'component.info-token', `Unknown fence attribute "${(match[0] ?? '').trim()}" on a ${language} block. Allowed: ${[...FENCE_INFO_TOKENS].join(', ')}.`, line, '$.markdown');
    }
  }
}

function validateComponents(document: ReportDocument, parsed: ParsedReport | undefined, diagnostics: Diagnostic[]): void {
  if (!parsed) return;
  const datasets = document.datasets ?? {};
  const scenes = document.scenes ?? {};
  const metrics = parsed.metrics ?? {};
  const md = createMarkdownParser(document.assets, datasets, scenes, metrics);
  const tokens = md.parse(parsed.body, {});
  const usedDatasets = new Set<string>(metricDatasetRefs(metrics));
  const usedScenes = new Set<string>();

  // Prose `{{metric_id}}` tokens must resolve, and must not appear inside fences that never substitute.
  for (const id of metricTokenIds(parsed.body)) {
    if (!metrics[id]) {
      addDiagnostic(diagnostics, 'error', 'metric.token-unresolved', `{{${id}}} does not match any declared metric.`, parsed.bodyLine, '$.frontmatter.metrics');
    }
  }
  for (const id of metricDatasetRefs(metrics)) {
    if (!datasets[id]) {
      addDiagnostic(diagnostics, 'error', 'metric.dataset-unmaterialized', `Metric binding reads dataset "${id}", which is not materialized for this report.`, parsed.bodyLine, `$.datasets.${id}`);
    }
  }

  for (const token of tokens) {
    if (token.type !== 'fence') continue;
    const { language, info } = tokenFenceInfo(token);
    if (!isSupportedComponent(language)) continue;
    const line = parsed.bodyLine + (token.map?.[0] ?? 0);
    const spec = componentSpec(language, token.content);
    validateFenceInfo(info, language, diagnostics, line);

    if (language === 'sql') {
      const dialect = /(?:^|\s)dialect=([A-Za-z0-9_-]+)/.exec(info)?.[1] ?? 'standard';
      if (!SQL_DIALECTS.has(dialect)) addDiagnostic(diagnostics, 'error', 'component.sql-dialect', `Unsupported SQL dialect "${dialect}".`, line, '$.markdown');
    }

    if (language === 'antv-t8') {
      const t8LinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
      for (const match of token.content.matchAll(t8LinkPattern)) {
        if (match[1]?.startsWith('/')) {
          addDiagnostic(diagnostics, 'error', 't8.link.relative', 'T8 links cannot use root-relative or protocol-relative URLs in portable reports.', line, '$.markdown');
        }
      }
      const referenced = metricTokenIds(token.content);
      if (referenced.length === 0) {
        addDiagnostic(diagnostics, 'warning', 't8.metric-token-missing', 'This narrative hard-codes its numbers. Use {{metric_id}} tokens so the prose cannot drift from the data.', line, '$.markdown');
      }
      // `[display](entity, origin=N)`: when the display is a metric token, origin must agree with that metric.
      for (const item of token.content.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)) {
        const display = item[1] ?? '';
        const ids = metricTokenIds(display);
        if (ids.length !== 1) continue;
        const origin = /(?:^|[,\s])origin\s*=\s*(-?[\d.]+(?:[eE][-+]?\d+)?)/.exec(item[2] ?? '');
        if (!origin) continue;
        const declared = Number(origin[1]);
        const value = numericMetricValue(metrics[ids[0] as string] ?? {}, datasets);
        if (value === undefined || !Number.isFinite(declared)) continue;
        const scale = typeof metrics[ids[0] as string]?.scale === 'number' ? metrics[ids[0] as string]!.scale as number : 1;
        if (declared !== value && declared !== value / scale && declared !== value * 100) {
          addDiagnostic(diagnostics, 'error', 't8.origin-mismatch', `Narrative declares origin=${declared} for {{${ids[0]}}}, but that metric is ${value}. Remove the origin or use the metric's value.`, line, '$.markdown');
        }
      }
    }

    if ((JSON_COMPONENT_LANGUAGES as readonly string[]).includes(language) && !spec) {
      addDiagnostic(diagnostics, 'error', 'component.json', `The ${language} block must contain a valid JSON object.`, line, '$.markdown');
      continue;
    }
    if (language !== 'excalidraw' || typeof spec?.sceneRef === 'string') {
      if (spec) rejectUnknownKeys(spec, language, diagnostics, line, `$.markdown.${language}`);
    }
    if (language === 'kpi') {
      if (!Array.isArray(spec?.items) || spec.items.length === 0 || spec.items.length > 12) {
        addDiagnostic(diagnostics, 'error', 'component.kpi-items', 'KPI blocks need between 1 and 12 items.', line, '$.markdown');
        continue;
      }
      for (const [index, value] of spec.items.entries()) {
        const item = plainRecord(value);
        const itemPath = `$.markdown.kpi.items[${index}]`;
        if (!item) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-item', `KPI item ${index + 1} must be an object.`, line, itemPath);
          continue;
        }
        rejectUnknownKeys(item, 'kpi.item', diagnostics, line, itemPath);
        const metricRef = typeof item.metricRef === 'string' ? item.metricRef : '';
        if ((typeof item.label !== 'string' || !item.label.trim()) && !metricRef) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-label', `KPI item ${index + 1} needs a non-empty label, or a metricRef whose metric declares one.`, line, `${itemPath}.label`);
        }
        const resolvedMetric = metricRef ? metrics[metricRef] : undefined;
        if (metricRef && !resolvedMetric) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-metric-ref', `KPI item ${index + 1} references metric "${metricRef}", which is not declared in frontmatter metrics.`, line, `${itemPath}.metricRef`);
        }
        const hasStaticValue = Object.hasOwn(item, 'value');
        const hasDatasetBinding = Object.hasOwn(item, 'dataRef') || Object.hasOwn(item, 'field');
        const dataRef = typeof item.dataRef === 'string' ? item.dataRef : '';
        const field = typeof item.field === 'string' ? item.field : '';
        const valueSources = [hasStaticValue, hasDatasetBinding, !!metricRef].filter(Boolean).length;
        if (valueSources > 1) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-value-source', `KPI item ${index + 1} must use exactly one of metricRef, a literal value, or a dataRef/field binding.`, line, itemPath);
        } else if (valueSources === 0) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-value', `KPI item ${index + 1} needs a metricRef, a literal value, or a dataRef/field binding.`, line, itemPath);
        }
        if (metricRef && (hasStaticValue || hasDatasetBinding || item.changeField !== undefined)) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-metric-ref-source', `KPI item ${index + 1} takes its value and comparison from metric "${metricRef}"; remove value/dataRef/field/changeField.`, line, itemPath);
        }
        if (hasStaticValue && typeof item.value !== 'string' && !(typeof item.value === 'number' && Number.isFinite(item.value))) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-value', `KPI item ${index + 1} value must be a finite number or string.`, line, `${itemPath}.value`);
        }
        if (hasDatasetBinding) {
          if (!dataRef.trim() || !field.trim()) {
            addDiagnostic(diagnostics, 'error', 'component.kpi-data-binding', `KPI item ${index + 1} needs non-empty dataRef and field strings.`, line, itemPath);
          } else {
            usedDatasets.add(dataRef);
            const dataset = datasets[dataRef];
            if (!dataset) {
              addDiagnostic(diagnostics, 'error', 'dataset.reference-missing', `Dataset "${dataRef}" is not declared in ReportDocument.datasets.`, line, `$.datasets.${dataRef}`);
            } else {
              try {
                const rows = datasetRecords(dataset);
                if (rows.length !== 1) {
                  addDiagnostic(diagnostics, 'error', 'component.kpi-dataset-rows', `KPI dataset "${dataRef}" must return exactly one summary row; it returned ${rows.length}.`, line, `$.datasets.${dataRef}`);
                } else {
                  const row = rows[0]!;
                  const declaredColumns = Array.isArray(dataset.columns) ? dataset.columns.map((column) => column.name) : [];
                  const availableFields = new Set(Object.keys(row).length > 0 ? Object.keys(row) : declaredColumns);
                  if (!availableFields.has(field)) {
                    addDiagnostic(diagnostics, 'error', 'component.kpi-field', `KPI field "${field}" does not exist in dataset "${dataRef}".`, line, `${itemPath}.field`);
                  }
                  if (typeof item.changeField === 'string' && !availableFields.has(item.changeField)) {
                    addDiagnostic(diagnostics, 'error', 'component.kpi-change-field', `KPI changeField "${item.changeField}" does not exist in dataset "${dataRef}".`, line, `${itemPath}.changeField`);
                  }
                  if (typeof item.periodField === 'string' && !availableFields.has(item.periodField)) {
                    addDiagnostic(diagnostics, 'error', 'component.kpi-period-field', `KPI periodField "${item.periodField}" does not exist in dataset "${dataRef}".`, line, `${itemPath}.periodField`);
                  }
                  if (typeof item.changeField === 'string') {
                    const changeValue = row[item.changeField];
                    if (changeValue !== null && (typeof changeValue !== 'number' && !(typeof changeValue === 'string' && changeValue.trim() !== '' && Number.isFinite(Number(changeValue))))) {
                      addDiagnostic(diagnostics, 'error', 'component.kpi-change-field-value', `KPI changeField "${item.changeField}" must contain a number or null.`, line, `${itemPath}.changeField`);
                    }
                  }
                  if (typeof item.periodField === 'string') {
                    const periodValue = row[item.periodField];
                    if (periodValue !== null && typeof periodValue !== 'string') {
                      addDiagnostic(diagnostics, 'error', 'component.kpi-period-field-value', `KPI periodField "${item.periodField}" must contain a string or null.`, line, `${itemPath}.periodField`);
                    }
                  }
                }
              } catch {
                // Dataset shape diagnostics are emitted by validateDatasets.
              }
            }
          }
        }
        if (item.changeField !== undefined && typeof item.changeField !== 'string') {
          addDiagnostic(diagnostics, 'error', 'component.kpi-change-field', `KPI item ${index + 1} changeField must be a string.`, line, `${itemPath}.changeField`);
        }
        if (item.periodField !== undefined && typeof item.periodField !== 'string') {
          addDiagnostic(diagnostics, 'error', 'component.kpi-period-field', `KPI item ${index + 1} periodField must be a string.`, line, `${itemPath}.periodField`);
        }
        if (item.changeField !== undefined && item.change !== undefined) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-change-source', `KPI item ${index + 1} cannot declare both change and changeField.`, line, itemPath);
        }
        if (item.periodField !== undefined && item.period !== undefined) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-period-source', `KPI item ${index + 1} cannot declare both period and periodField.`, line, itemPath);
        }
        if ((item.changeField !== undefined || item.periodField !== undefined) && !hasDatasetBinding) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-data-binding', `KPI item ${index + 1} changeField and periodField require a dataRef/field binding.`, line, itemPath);
        }
        for (const field of ['unit', 'period']) {
          if (item[field] !== undefined && typeof item[field] !== 'string') {
            addDiagnostic(diagnostics, 'error', 'component.kpi-text', `KPI item ${index + 1} ${field} must be a string.`, line, `${itemPath}.${field}`);
          }
        }
        if (item.change !== undefined && (typeof item.change !== 'number' || !Number.isFinite(item.change))) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-change', `KPI item ${index + 1} change must be a finite number.`, line, `${itemPath}.change`);
        }
        if (item.changeFormat !== undefined && item.changeFormat !== 'percent' && item.changeFormat !== 'percentage-points') {
          addDiagnostic(diagnostics, 'error', 'component.kpi-change-format', `KPI item ${index + 1} changeFormat must be percent or percentage-points.`, line, `${itemPath}.changeFormat`);
        }
        if (item.format !== undefined && !isMetricFormat(item.format)) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-format', `KPI item ${index + 1} format must be one of ${METRIC_FORMATS.join(', ')}, optionally with a currency suffix such as currency:CNY.`, line, `${itemPath}.format`);
        }
        if (item.goodDirection !== undefined && !METRIC_GOOD_DIRECTIONS.includes(item.goodDirection as never)) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-good-direction', `KPI item ${index + 1} goodDirection must be up, down, or neutral.`, line, `${itemPath}.goodDirection`);
        }
        if (item.direction !== undefined && !['positive', 'negative', 'neutral'].includes(String(item.direction))) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-direction', `KPI item ${index + 1} direction must be positive, negative, or neutral.`, line, `${itemPath}.direction`);
        }
        if (item.decimals !== undefined && (!Number.isInteger(item.decimals) || Number(item.decimals) < 0 || Number(item.decimals) > 6)) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-decimals', `KPI item ${index + 1} decimals must be an integer from 0 to 6.`, line, `${itemPath}.decimals`);
        }
        if (item.compact !== undefined && typeof item.compact !== 'boolean') {
          addDiagnostic(diagnostics, 'error', 'component.kpi-compact', `KPI item ${index + 1} compact must be a boolean.`, line, `${itemPath}.compact`);
        }
        if (item.scale !== undefined && (typeof item.scale !== 'number' || !Number.isFinite(item.scale))) {
          addDiagnostic(diagnostics, 'error', 'component.kpi-scale', `KPI item ${index + 1} scale must be a finite number.`, line, `${itemPath}.scale`);
        }
        if (item.sparkline !== undefined) {
          const spark = plainRecord(item.sparkline);
          if (!spark) {
            addDiagnostic(diagnostics, 'error', 'component.kpi-sparkline', `KPI item ${index + 1} sparkline must be a mapping with dataRef, x, and y.`, line, `${itemPath}.sparkline`);
          } else {
            rejectUnknownKeys(spark, 'ranking.sparkline', diagnostics, line, `${itemPath}.sparkline`);
            const sparkRef = typeof spark.dataRef === 'string' ? spark.dataRef : '';
            const sparkX = typeof spark.x === 'string' ? spark.x : '';
            const sparkY = typeof spark.y === 'string' ? spark.y : '';
            if (!sparkRef || !sparkY) {
              addDiagnostic(diagnostics, 'error', 'component.kpi-sparkline', `KPI item ${index + 1} sparkline needs a dataRef and a y field.`, line, `${itemPath}.sparkline`);
            } else {
              usedDatasets.add(sparkRef);
              const dataset = datasets[sparkRef];
              if (!dataset) {
                addDiagnostic(diagnostics, 'error', 'dataset.reference-missing', `Sparkline dataset "${sparkRef}" is not declared in ReportDocument.datasets.`, line, `${itemPath}.sparkline.dataRef`);
              } else {
                try {
                  const sparkRows = datasetRecords(dataset);
                  if (sparkRows.length < 2) {
                    addDiagnostic(diagnostics, 'warning', 'component.kpi-sparkline-rows', `Sparkline dataset "${sparkRef}" needs at least two rows to show a trend.`, line, `${itemPath}.sparkline`);
                  }
                  const fields = new Set(Object.keys(sparkRows[0] ?? {}).length > 0
                    ? Object.keys(sparkRows[0]!)
                    : (dataset.columns ?? []).map((column) => column.name));
                  for (const [key, candidate] of [['x', sparkX], ['y', sparkY]] as const) {
                    if (candidate && fields.size > 0 && !fields.has(candidate)) {
                      addDiagnostic(diagnostics, 'error', 'component.field-missing', `Sparkline ${key} field "${candidate}" does not exist in dataset "${sparkRef}".`, line, `${itemPath}.sparkline.${key}`);
                    }
                  }
                  const numeric = (value: unknown): boolean => typeof value === 'number'
                    ? Number.isFinite(value)
                    : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
                  if (sparkY && fields.has(sparkY) && sparkRows.some((row) => !numeric(row[sparkY]))) {
                    addDiagnostic(diagnostics, 'error', 'component.chart-value', `Sparkline y field "${sparkY}" must be numeric in every row.`, line, `${itemPath}.sparkline.y`);
                  }
                } catch {
                  // Dataset shape diagnostics are emitted by validateDatasets.
                }
              }
            }
          }
        }
      }
    }
    if (language === 'ranking' || language === 'pivot') {
      const reference = typeof spec?.dataRef === 'string' ? spec.dataRef : '';
      if (reference) usedDatasets.add(reference);
      if (!reference) {
        addDiagnostic(diagnostics, 'error', 'component.data-ref', `${language} blocks must declare a dataRef.`, line, '$.markdown');
        continue;
      }
      const dataset = datasets[reference];
      if (!dataset) {
        addDiagnostic(diagnostics, 'error', 'dataset.reference-missing', `Dataset "${reference}" is not declared in ReportDocument.datasets.`, line, `$.datasets.${reference}`);
        continue;
      }
      let rows: ReturnType<typeof datasetRecords>;
      try { rows = datasetRecords(dataset); } catch { continue; }
      if (rows.length === 0) addDiagnostic(diagnostics, 'warning', 'dataset.empty', `Dataset "${reference}" is empty; the component will show an empty state.`, line, `$.datasets.${reference}`);
      const declared = Array.isArray(dataset.columns) ? dataset.columns.map((column) => column.name) : [];
      const fields = new Set(Object.keys(rows[0] ?? {}).length > 0 ? Object.keys(rows[0]!) : declared);
      const rankingMetricRef = typeof spec?.metricRef === 'string' ? spec.metricRef : '';
      // A ranking may take its value from a metric instead of a y column.
      const requiredFields = language === 'ranking'
        ? (rankingMetricRef ? ['x'] : ['x', 'y'])
        : ['rows', 'columns', 'value'];
      for (const key of requiredFields) {
        const field = typeof spec?.[key] === 'string' ? String(spec[key]) : '';
        if (!field) addDiagnostic(diagnostics, 'error', 'component.field-required', `${language} needs a non-empty "${key}".`, line, `$.markdown.${key}`);
        else if (fields.size > 0 && !fields.has(field)) addDiagnostic(diagnostics, 'error', 'component.field-missing', `${language} field "${field}" does not exist in dataset "${reference}".`, line, `$.markdown.${key}`);
      }
      if (language === 'ranking') {
        const metricRef = rankingMetricRef;
        if (metricRef && !metrics[metricRef]) addDiagnostic(diagnostics, 'error', 'component.metric-ref', `Ranking references metric "${metricRef}", which is not declared in frontmatter metrics.`, line, '$.markdown.metricRef');
        if (metricRef && typeof spec?.y === 'string') addDiagnostic(diagnostics, 'error', 'component.metric-ref-source', `Ranking takes y from metric "${metricRef}"; remove y or drop metricRef.`, line, '$.markdown');
        const bound = metricRef ? metrics[metricRef]?.dataRef : undefined;
        if (typeof bound === 'string' && bound !== reference) {
          addDiagnostic(diagnostics, 'error', 'component.metric-ref-dataset', `Ranking metric "${metricRef}" reads dataset "${bound}", but the block declares dataRef "${reference}". They must match.`, line, '$.markdown.dataRef');
        }
        if (spec?.limit !== undefined && (!Number.isInteger(spec.limit) || Number(spec.limit) < 1 || Number(spec.limit) > 50)) {
          addDiagnostic(diagnostics, 'error', 'component.ranking-limit', 'Ranking limit must be an integer from 1 to 50.', line, '$.markdown.limit');
        }
      }
      if (language === 'pivot') {
        if (spec?.agg !== undefined && !['sum', 'avg', 'min', 'max', 'count', 'first'].includes(String(spec.agg))) {
          addDiagnostic(diagnostics, 'error', 'component.pivot-agg', 'Pivot agg must be sum, avg, min, max, count, or first.', line, '$.markdown.agg');
        }
        const valueField = typeof spec?.value === 'string' ? spec.value : '';
        const numeric = (value: unknown): boolean => typeof value === 'number'
          ? Number.isFinite(value)
          : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
        if (valueField && spec?.agg !== 'count' && rows.some((row) => !numeric(row[valueField]))) {
          addDiagnostic(diagnostics, 'error', 'component.pivot-value', `Pivot value field "${valueField}" must be numeric in every row (or use agg: "count").`, line, '$.markdown.value');
        }
      }
    }
    if (language === 'findings') {
      if (!Array.isArray(spec?.items) || spec.items.length === 0 || spec.items.length > 12) {
        addDiagnostic(diagnostics, 'error', 'component.findings-items', 'Findings need between 1 and 12 items.', line, '$.markdown');
        continue;
      }
      for (const [index, raw] of spec.items.entries()) {
        const item = plainRecord(raw);
        const itemPath = `$.markdown.items[${index}]`;
        if (!item) {
          addDiagnostic(diagnostics, 'error', 'component.findings-item', `Finding ${index + 1} must be an object.`, line, itemPath);
          continue;
        }
        rejectUnknownKeys(item, 'findings.item', diagnostics, line, itemPath);
        if (typeof item.title !== 'string' || !item.title.trim()) {
          addDiagnostic(diagnostics, 'error', 'component.findings-title', `Finding ${index + 1} needs a non-empty title.`, line, `${itemPath}.title`);
        }
        if (item.severity !== undefined && !['risk', 'opportunity', 'info', 'positive'].includes(String(item.severity))) {
          addDiagnostic(diagnostics, 'error', 'component.findings-severity', `Finding ${index + 1} severity must be risk, opportunity, info, or positive.`, line, `${itemPath}.severity`);
        }
        if (typeof item.metricRef === 'string') {
          if (!metrics[item.metricRef]) addDiagnostic(diagnostics, 'error', 'component.metric-ref', `Finding ${index + 1} references metric "${item.metricRef}", which is not declared in frontmatter metrics.`, line, `${itemPath}.metricRef`);
              const bound = metrics[item.metricRef]?.dataRef;
          if (typeof bound === 'string') usedDatasets.add(bound);
        }
      }
    }
    if (language === 'provenance' && spec) {
      if (spec.items !== undefined) {
        if (!Array.isArray(spec.items)) {
          addDiagnostic(diagnostics, 'error', 'component.provenance-items', 'provenance items must be an array of metric IDs.', line, '$.markdown.items');
        } else {
          for (const [index, id] of spec.items.entries()) {
            if (typeof id !== 'string' || !metrics[id]) {
              addDiagnostic(diagnostics, 'error', 'component.metric-ref', `provenance item ${index + 1} must name a declared metric.`, line, `$.markdown.items[${index}]`);
            }
          }
        }
      } else if (Object.keys(metrics).length === 0) {
        addDiagnostic(diagnostics, 'warning', 'component.provenance-empty', 'provenance lists every declared metric, but frontmatter declares none.', line, '$.markdown');
      }
    }
    if (language === 'quality') {
      const refs = Array.isArray(spec?.dataRefs) ? spec.dataRefs : [];
      for (const [index, id] of refs.entries()) {
        if (typeof id !== 'string' || !datasets[id]) {
          addDiagnostic(diagnostics, 'error', 'component.quality-ref', `quality dataRefs[${index}] must name a materialized dataset.`, line, `$.markdown.dataRefs[${index}]`);
        } else {
          usedDatasets.add(id);
        }
      }
    }

    if (language === 'chart' || language === 'data-table') {
      const reference = componentNeedsDataset(language, token.content);
      if (!reference) {
        addDiagnostic(diagnostics, 'error', 'component.data-ref', `${language} blocks must declare a dataRef.`, line, '$.markdown');
        continue;
      }
      usedDatasets.add(reference);
      if (!datasets[reference]) {
        addDiagnostic(diagnostics, 'error', 'dataset.reference-missing', `Dataset "${reference}" is not declared in ReportDocument.datasets.`, line, `$.datasets.${reference}`);
        continue;
      }
      let rows: ReturnType<typeof datasetRecords>;
      try {
        rows = datasetRecords(datasets[reference]);
      } catch {
        // Dataset shape diagnostics are emitted by validateDatasets; keep checking sibling blocks.
        continue;
      }
      if (rows.length === 0) addDiagnostic(diagnostics, 'warning', 'dataset.empty', `Dataset "${reference}" is empty; the component will show an empty state.`, line, `$.datasets.${reference}`);
      if (language === 'chart') {
        const kind = String(spec?.kind ?? '');
        if (!CHART_KINDS.includes(kind)) {
          addDiagnostic(diagnostics, 'error', 'component.chart-kind', `Chart kind must be one of ${CHART_KINDS.join(', ')}.`, line, '$.markdown');
          continue;
        }
        const metricRef = typeof spec?.metricRef === 'string' ? spec.metricRef : '';
        const chartMetric = metricRef ? metrics[metricRef] : undefined;
        if (metricRef && !chartMetric) {
          addDiagnostic(diagnostics, 'error', 'component.chart-metric-ref', `Chart references metric "${metricRef}", which is not declared in frontmatter metrics.`, line, '$.markdown.metricRef');
        }
        if (metricRef && (typeof spec?.y === 'string' || typeof spec?.unit === 'string')) {
          addDiagnostic(diagnostics, 'error', 'component.chart-metric-ref-source', `Chart takes y and unit from metric "${metricRef}"; remove y/unit or drop metricRef.`, line, '$.markdown');
        }
        const axisFormat = plainRecord(spec?.axisFormat);
        if (spec?.axisFormat !== undefined && !axisFormat) {
          addDiagnostic(diagnostics, 'error', 'component.chart-axis-format', 'axisFormat must be a mapping.', line, '$.markdown.axisFormat');
        } else if (axisFormat) {
          rejectUnknownKeys(axisFormat, 'chart.axisFormat', diagnostics, line, '$.markdown.axisFormat');
          if (axisFormat.format !== undefined && !isMetricFormat(axisFormat.format)) {
            addDiagnostic(diagnostics, 'error', 'component.chart-axis-format-kind', `axisFormat.format must be one of ${METRIC_FORMATS.join(', ')}.`, line, '$.markdown.axisFormat.format');
          }
        }
        if (spec) rejectAnnotations(spec, diagnostics, line);
        const numeric = (value: unknown): boolean => typeof value === 'number'
          ? Number.isFinite(value)
          : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
        const first = rows[0];
        const declaredColumns = Array.isArray(datasets[reference]?.columns)
          ? datasets[reference]!.columns!.map((column) => column.name)
          : [];
        const availableFields = new Set(first ? Object.keys(first) : declaredColumns);
        const fieldOk = (candidate: string): boolean => availableFields.size === 0 || availableFields.has(candidate);
        const xField = typeof spec?.x === 'string' ? spec.x : '';
        const yField = typeof spec?.y === 'string' ? spec.y : typeof chartMetric?.field === 'string' ? chartMetric.field : '';

        if (['line', 'bar', 'column', 'area', 'scatter', 'pie'].includes(kind)) {
          if (availableFields.size > 0 && (!availableFields.has(xField) || !availableFields.has(yField))) {
            addDiagnostic(diagnostics, 'error', 'component.chart-field', 'Chart x and y fields must exist in the referenced dataset.', line, '$.markdown');
            continue;
          }
          const invalidYRow = rows.findIndex((row) => !numeric(row[yField]));
          if (invalidYRow >= 0) {
            addDiagnostic(diagnostics, 'error', 'component.chart-value', `Chart y field "${yField}" must be numeric in every row; row ${invalidYRow + 1} is not.`, line, `$.datasets.${reference}[${invalidYRow}].${yField}`);
            continue;
          }
          const numericScatter = kind === 'scatter' && rows.filter((row) => numeric(row[yField])).every((row) => numeric(row[xField]));
          if (!numericScatter) {
            const seriesField = typeof spec?.series === 'string' ? spec.series : '';
            const seen = new Set<string>();
            for (const row of rows) {
              if (!numeric(row[yField])) continue;
              const key = kind === 'pie'
                ? JSON.stringify([String(row[xField] ?? '')])
                : JSON.stringify([String(row[xField] ?? ''), String(row[seriesField] ?? '总计')]);
              if (seen.has(key)) {
                addDiagnostic(
                  diagnostics,
                  'error',
                  'component.chart-duplicate-coordinate',
                  kind === 'pie'
                    ? 'Pie charts require one row per category; aggregate repeated categories before rendering.'
                    : 'Charts require one row per x/series coordinate; aggregate repeated coordinates before rendering.',
                  line,
                  '$.markdown',
                );
                break;
              }
              seen.add(key);
            }
          }
          continue;
        }

        // Kinds with an explicit field contract instead of a single y series.
        const requiredByKind: Record<string, string[]> = {
          funnel: ['x', 'y'], waterfall: ['x', 'y'], boxplot: ['x', 'y'], treemap: ['x', 'y'],
          radar: ['x', 'y'], heatmap: ['x', 'y', 'value'], sankey: ['source', 'target', 'y'],
          candlestick: ['x', 'open', 'high', 'low', 'close'], gauge: [], map: ['name', 'value', 'geo'],
          combo: ['x'],
        };
        const required = requiredByKind[kind] ?? [];
        for (const key of required) {
          if (key === 'geo') continue;
          if (typeof spec?.[key] !== 'string' || !String(spec[key]).trim()) {
            addDiagnostic(diagnostics, 'error', 'component.chart-required-field', `A ${kind} chart needs a non-empty "${key}".`, line, `$.markdown.${key}`);
          }
        }
        const referencedFields = required.filter((key) => !['geo', 'name', 'value', 'source', 'target'].includes(key));
        if (kind === 'map') {
          if (!plainRecord(spec?.geo)) addDiagnostic(diagnostics, 'error', 'component.chart-map-geo', 'A map chart needs an inline GeoJSON `geo` object; the report stays offline only if the geometry travels with it.', line, '$.markdown.geo');
          for (const key of ['name', 'value']) {
            const candidate = typeof spec?.[key] === 'string' ? String(spec[key]) : '';
            if (candidate && !fieldOk(candidate)) addDiagnostic(diagnostics, 'error', 'component.chart-field', `Map field "${candidate}" does not exist in dataset "${reference}".`, line, '$.markdown');
          }
        }
        for (const key of [...referencedFields, ...['source', 'target']]) {
          const candidate = typeof spec?.[key] === 'string' ? String(spec[key]) : '';
          if (candidate && !fieldOk(candidate)) {
            addDiagnostic(diagnostics, 'error', 'component.chart-field', `Chart ${kind} field "${candidate}" does not exist in dataset "${reference}".`, line, `$.markdown.${key}`);
          }
        }
        const numericFieldsByKind: Record<string, string[]> = {
          funnel: [yField], waterfall: [yField], boxplot: [yField], treemap: [yField],
          radar: [yField], heatmap: [typeof spec?.value === 'string' ? spec.value : ''],
          sankey: [yField], candlestick: ['open', 'high', 'low', 'close'],
        };
        for (const field of numericFieldsByKind[kind] ?? []) {
          if (!field) continue;
          const badRow = rows.findIndex((row) => !numeric(row[field]));
          if (badRow >= 0) {
            addDiagnostic(diagnostics, 'error', 'component.chart-value', `Chart field "${field}" must be numeric in every row; row ${badRow + 1} is not.`, line, `$.datasets.${reference}[${badRow}].${field}`);
          }
        }
        if (kind === 'combo') {
          const declared = Array.isArray(spec?.series) ? spec.series : undefined;
          if (!declared || declared.length === 0 || declared.length > 6) {
            addDiagnostic(diagnostics, 'error', 'component.chart-combo-series', 'A combo chart needs between 1 and 6 series entries with a field and a type.', line, '$.markdown.series');
          } else {
            const axes = new Set<number>();
            for (const [index, value] of declared.entries()) {
              const entry = plainRecord(value);
              const entryPath = `$.markdown.series[${index}]`;
              if (!entry) {
                addDiagnostic(diagnostics, 'error', 'component.chart-combo-entry', `Combo series ${index + 1} must be an object.`, line, entryPath);
                continue;
              }
              rejectUnknownKeys(entry, 'chart.series', diagnostics, line, entryPath);
              const field = typeof entry.field === 'string' ? entry.field : '';
              if (!fieldOk(field)) {
                addDiagnostic(diagnostics, 'error', 'component.chart-field', `Combo series field "${field}" does not exist in dataset "${reference}".`, line, entryPath);
              } else if (rows.some((row) => !numeric(row[field]))) {
                addDiagnostic(diagnostics, 'error', 'component.chart-value', `Combo series field "${field}" must be numeric in every row.`, line, entryPath);
              }
              if (entry.format !== undefined && !isMetricFormat(entry.format)) {
                addDiagnostic(diagnostics, 'error', 'component.chart-combo-format', `Combo series ${index + 1} format must be one of ${METRIC_FORMATS.join(', ')}.`, line, `${entryPath}.format`);
              }
              if (entry.type !== undefined && !['line', 'bar', 'area'].includes(String(entry.type))) {
                addDiagnostic(diagnostics, 'error', 'component.chart-combo-type', `Combo series ${index + 1} type must be line, bar, or area.`, line, `${entryPath}.type`);
              }
              const axis = entry.axis === undefined ? 0 : Number(entry.axis);
              if (axis !== 0 && axis !== 1) {
                addDiagnostic(diagnostics, 'error', 'component.chart-combo-axis', `Combo series ${index + 1} axis must be 0 or 1.`, line, `${entryPath}.axis`);
              }
              axes.add(axis);
            }
            if (axes.size > 1 && typeof spec?.unit !== 'string') {
              addDiagnostic(diagnostics, 'warning', 'component.chart-combo-unit', 'This combo chart uses two value axes; declare `unit` for the primary axis so the reader can tell them apart.', line, '$.markdown.unit');
            }
            const seen = new Set<string>();
            for (const row of rows) {
              const key = String(row[xField] ?? '');
              if (seen.has(key)) {
                addDiagnostic(diagnostics, 'error', 'component.chart-duplicate-coordinate', 'Combo charts require one row per x value; aggregate repeated coordinates before rendering.', line, '$.markdown');
                break;
              }
              seen.add(key);
            }
          }
        }
        if (kind === 'waterfall' && spec?.totalField !== undefined && typeof spec.totalField !== 'string') {
          addDiagnostic(diagnostics, 'error', 'component.chart-total-field', 'waterfall totalField must be a string column name.', line, '$.markdown.totalField');
        }
        for (const key of ['min', 'max']) {
          if (spec?.[key] !== undefined && (typeof spec[key] !== 'number' || !Number.isFinite(spec[key] as number))) {
            addDiagnostic(diagnostics, 'error', 'component.chart-number', `Chart ${key} must be a finite number.`, line, `$.markdown.${key}`);
          }
        }
      } else {
        const dataset = datasets[reference]!;
        const declaredColumns = Array.isArray(dataset.columns) ? dataset.columns.map((column) => column.name) : [];
        const availableFields = new Set(Object.keys(rows[0] ?? {}).length > 0 ? Object.keys(rows[0]!) : declaredColumns);
        const selectedColumns: Array<Record<string, unknown>> = [];
        if (spec?.columns !== undefined) {
          if (!Array.isArray(spec.columns) || spec.columns.length === 0) {
            addDiagnostic(diagnostics, 'error', 'component.table-columns', 'Table columns must be a non-empty array when provided.', line, '$.markdown');
            continue;
          }
          const seenFields = new Set<string>();
          for (const [index, value] of spec.columns.entries()) {
            const column = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
            const field = typeof column?.field === 'string' ? column.field : '';
            if (!field.trim()) {
              addDiagnostic(diagnostics, 'error', 'component.table-column-field', `Table column ${index + 1} needs a non-empty field.`, line, '$.markdown');
              continue;
            }
            if (seenFields.has(field)) {
              addDiagnostic(diagnostics, 'error', 'component.table-column-duplicate', `Table field "${field}" is declared more than once.`, line, '$.markdown');
            }
            seenFields.add(field);
            if (availableFields.size > 0 && !availableFields.has(field)) {
              addDiagnostic(diagnostics, 'error', 'component.table-column-missing', `Table field "${field}" does not exist in dataset "${reference}".`, line, '$.markdown');
            }
            if (column?.label !== undefined && typeof column.label !== 'string') {
              addDiagnostic(diagnostics, 'error', 'component.table-column-label', `Table column "${field}" label must be a string.`, line, '$.markdown');
            }
            for (const dimension of ['width', 'minWidth']) {
              if (column?.[dimension] !== undefined && (typeof column[dimension] !== 'number' || !Number.isFinite(column[dimension]) || column[dimension] <= 0)) {
                addDiagnostic(diagnostics, 'error', 'component.table-column-size', `Table column "${field}" ${dimension} must be a positive finite number.`, line, '$.markdown');
              }
            }
            if (column) rejectUnknownKeys(column, 'data-table.column', diagnostics, line, `$.markdown.columns[${index}]`);
            if (column?.formatRef !== undefined && (typeof column.formatRef !== 'string' || !metrics[column.formatRef])) {
              addDiagnostic(diagnostics, 'error', 'component.table-format-ref', `Table column "${field}" formatRef must name a declared metric.`, line, '$.markdown');
            }
            if (column?.format !== undefined && typeof column.format !== 'string') {
              addDiagnostic(diagnostics, 'error', 'component.table-column-format', `Table column "${field}" format must be a string.`, line, '$.markdown');
            }
            selectedColumns.push(column ?? {});
          }
        } else {
          for (const field of availableFields) selectedColumns.push({ field });
        }

        if (spec?.defaultSort !== undefined) {
          const sort = spec.defaultSort && typeof spec.defaultSort === 'object' && !Array.isArray(spec.defaultSort)
            ? spec.defaultSort as Record<string, unknown>
            : undefined;
          if (!sort || typeof sort.field !== 'string' || !['asc', 'desc'].includes(String(sort.direction ?? 'asc'))) {
            addDiagnostic(diagnostics, 'error', 'component.table-sort', 'defaultSort must contain a field and an asc/desc direction.', line, '$.markdown');
          } else if (!selectedColumns.some((column) => column.field === sort.field)) {
            addDiagnostic(diagnostics, 'error', 'component.table-sort-field', `Sort field "${sort.field}" must be one of the displayed table columns.`, line, '$.markdown');
          }
          if (sort) rejectUnknownKeys(sort, 'data-table.defaultSort', diagnostics, line, '$.markdown');
        }
        if (spec?.viewportHeight !== undefined) {
          const height = spec.viewportHeight;
          if (typeof height !== 'number' || !Number.isFinite(height)) {
            addDiagnostic(diagnostics, 'error', 'component.table-viewport-height', 'viewportHeight must be a finite number from 160 to 1200 pixels.', line, '$.markdown');
          } else if (height < 160 || height > 1200) {
            addDiagnostic(diagnostics, 'warning', 'component.table-viewport-height-clamped', `viewportHeight ${height}px is outside 160–1200px and will be clamped.`, line, '$.markdown');
          }
        }
      }
    }
    if (language === 'excalidraw') {
      if (typeof spec?.sceneRef === 'string') {
        usedScenes.add(spec.sceneRef);
        if (!scenes[spec.sceneRef]) {
          addDiagnostic(diagnostics, 'error', 'component.excalidraw-reference', `Excalidraw scene "${spec.sceneRef}" is not available in the report source.`, line, `$.scenes.${spec.sceneRef}`);
          continue;
        }
      } else if (spec?.type !== 'excalidraw' || !Array.isArray(spec.elements)) {
        addDiagnostic(diagnostics, 'error', 'component.excalidraw-scene', 'Excalidraw data must be a sceneRef or an official scene object with an elements array.', line, '$.markdown');
        continue;
      } else if (!hasOnlyEmbeddedExcalidrawFiles(spec)) {
        addDiagnostic(diagnostics, 'error', 'component.excalidraw-resource', 'Excalidraw image files must use embedded data:image URLs for offline export.', line, '$.markdown');
        continue;
      }
    }
  }
  for (const id of Object.keys(datasets)) {
    if (!usedDatasets.has(id)) addDiagnostic(diagnostics, 'warning', 'dataset.unused', `Dataset "${id}" is declared but not referenced by a KPI, chart, or data table.`, 1, `$.datasets.${id}`);
  }
  for (const id of Object.keys(scenes)) {
    if (!usedScenes.has(id)) addDiagnostic(diagnostics, 'warning', 'scene.unused', `Excalidraw scene "${id}" is declared but not referenced.`, 1, `$.scenes.${id}`);
  }
}

function buildValidation(document: ReportDocument): { result: ValidationResult; parsed?: ParsedReport } {
  const diagnostics: Diagnostic[] = [];
  if (!document || typeof document !== 'object' || typeof document.markdown !== 'string') {
    addDiagnostic(diagnostics, 'error', 'document.markdown', 'ReportDocument.markdown must be a string.', 1, '$.markdown');
    return { result: { valid: false, title: '', mode: '', diagnostics } };
  }
  const markdownBytes = byteLength(document.markdown);
  if (markdownBytes > MAX_MARKDOWN_BYTES) {
    addDiagnostic(diagnostics, 'error', 'document.too-large', `Markdown source cannot exceed ${MAX_MARKDOWN_BYTES} bytes.`, 1, '$.markdown');
  }
  const parsed = parseFrontmatter(document.markdown, diagnostics);
  validateAssets(document, parsed, diagnostics);
  validateDatasets(document, diagnostics);
  validateScenes(document, diagnostics);
  validateContainers(parsed, diagnostics, document.assets);
  validateComponents(document, parsed, diagnostics);
  if (parsed?.metrics) validateMetricInvariants(document, parsed.metrics, diagnostics);
  const result: ValidationResult = {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    title: parsed?.title ?? '',
    mode: parsed?.mode ?? '',
    diagnostics: diagnostics.length > MAX_VALIDATION_DIAGNOSTICS
      ? [
          ...diagnostics.filter((diagnostic) => diagnostic.severity === 'error').slice(0, MAX_VALIDATION_DIAGNOSTICS - 1),
          ...diagnostics.filter((diagnostic) => diagnostic.severity === 'warning')
            .slice(0, Math.max(0, MAX_VALIDATION_DIAGNOSTICS - 1 - diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length)),
          {
            severity: 'warning',
            code: 'validation.diagnostics-truncated',
            message: `Validation found more than ${MAX_VALIDATION_DIAGNOSTICS} diagnostics; only the first ${MAX_VALIDATION_DIAGNOSTICS - 1} are shown. Fix those issues and validate again.`,
            line: 1,
            path: '$',
          },
        ]
      : diagnostics,
  };
  return { result, parsed };
}

/** Validate md-report/1 metadata, links, image references, and dashboard syntax. */
export function validateReport(document: ReportDocument): ValidationResult {
  return buildValidation(document).result;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

async function renderExcalidrawHosts(html: string): Promise<string> {
  const pattern = /<div class="mdr-excalidraw-host" data-excalidraw="([A-Za-z0-9+/=]+)"><\/div>/g;
  let rendered = '';
  let previousEnd = 0;
  for (const match of html.matchAll(pattern)) {
    const encodedScene = match[1];
    const matchIndex = match.index;
    if (encodedScene === undefined || matchIndex === undefined) continue;
    const scene = JSON.parse(Buffer.from(encodedScene, 'base64').toString('utf8')) as Record<string, unknown>;
    const svg = await renderOfficialExcalidraw(scene);
    rendered += `${html.slice(previousEnd, matchIndex)}<div class="mdr-excalidraw-host">${svg}</div>`;
    previousEnd = matchIndex + match[0].length;
  }
  return rendered ? rendered + html.slice(previousEnd) : html;
}

function buildHtml(
  title: string,
  mode: ReportMode,
  renderedBody: string,
  tocHtml: string,
  fontSize: number,
  presentation: ReportPresentation,
): string {
  const dashboard = mode === 'dashboard';
  const hasCharts = renderedBody.includes('class="mdr-echart"');
  const hasTables = renderedBody.includes('class="mdr-tabulator"');
  const hasT8 = renderedBody.includes('class="mdr-t8-host"');
  const hasInfographics = renderedBody.includes('class="mdr-infographic-host"');
  const hasMermaid = renderedBody.includes('class="mdr-mermaid-host"');
  const autoToc = Boolean(tocHtml) && presentation.toc === 'auto';
  const runtimeScripts = [
    ...(hasCharts ? [`<script>${echartsRuntime}</script>`, `<script>${chartBootstrap}</script>`] : []),
    ...(hasTables ? [`<script>${tabulatorRuntime}</script>`, `<script>${tableBootstrap}</script>`] : []),
    ...(hasT8 ? [`<script>${t8Runtime}</script>`, `<script>${t8Bootstrap}</script>`] : []),
    ...(hasInfographics ? [`<script>${infographicRuntime}</script>`, `<script>${infographicBootstrap}</script>`] : []),
    ...(hasMermaid ? [`<script>${mermaidRuntime}</script>`, `<script>${mermaidBootstrap}</script>`] : []),
    ...(autoToc ? [`<script>${tocBootstrap}</script>`] : []),
    ...(!dashboard ? [`<script>${themeBootstrap}</script>`] : []),
  ].join('\n  ');
  const allowedHashes = [
    ...(hasCharts ? chartScriptHashes.split(' ') : []),
    ...(hasTables ? tableScriptHashes.split(' ') : []),
    ...(hasT8 ? t8ScriptHashes.split(' ') : []),
    ...(hasInfographics ? infographicScriptHashes.split(' ') : []),
    ...(hasMermaid ? mermaidScriptHashes.split(' ') : []),
    ...(autoToc ? tocScriptHashes.split(' ') : []),
    ...(!dashboard ? themeScriptHashes.split(' ') : []),
  ];
  const scriptPolicy = allowedHashes.length ? allowedHashes.join(' ') : "'none'";
  const themeAttribute = presentation.theme;
  const eyebrow = presentation.eyebrow || DEFAULT_EYEBROW[mode];
  const deck = presentation.deck ? `<p class="mdr-deck">${escapeHtml(presentation.deck)}</p>` : '';
  const footer = presentation.footer ? `<footer class="mdr-footer">${escapeHtml(presentation.footer)}</footer>` : '';
  const status = presentation.status ? `<div class="mdr-dashboard-status">${escapeHtml(presentation.status)}</div>` : '';
  const body = dashboard
    ? `<body class="mdr-dashboard-page">
  <main class="mdr-dashboard-shell">
    <header class="mdr-dashboard-topbar">
      <div class="mdr-dashboard-brand"><div class="mdr-dashboard-eyebrow">${escapeHtml(eyebrow)}</div><h1 class="mdr-dashboard-title">${escapeHtml(title)}</h1></div>
      ${status}
    </header>
    <article class="mdr-content mdr-dashboard-content">${renderedBody}</article>
  </main>
  ${runtimeScripts}
</body>`
    : `<body class="mdr-report-page">
  <main class="mdr-shell">
    <header class="mdr-header">
      <div class="mdr-eyebrow"><span>${escapeHtml(eyebrow)}</span><span class="mdr-mode">REPORT</span></div>
      <h1 class="mdr-title">${escapeHtml(title)}</h1>
      ${deck}
      ${presentation.theme === 'auto' ? '<button type="button" class="mdr-theme-toggle" hidden>切换主题</button>' : ''}
    </header>
    <div class="mdr-report-layout${tocHtml ? '' : ' mdr-report-layout--without-toc'}">
${tocHtml ? `      ${tocHtml}\n` : ''}      <article class="mdr-content">${renderedBody}</article>
    </div>
${footer ? `    ${footer}\n` : ''}  </main>
  ${runtimeScripts}
</body>`;
  return `<!doctype html>
<html lang="zh-CN" data-theme="${themeAttribute}" style="font-size:${fontSize}px">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${scriptPolicy}; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)}</title>
  <style>${viewerThemeCss}${hasTables ? tabulatorCss : ''}</style>
</head>
${body}
</html>`;
}

/** Render a validated report to a self-contained HTML document and export Excalidraw scenes to SVG. */
export async function renderReport(document: ReportDocument, options: RenderOptions = {}): Promise<RenderResult> {
  const fontSize = options.fontSize ?? DEFAULT_RENDER_FONT_SIZE;
  if (!Number.isFinite(fontSize) || fontSize < MIN_RENDER_FONT_SIZE || fontSize > MAX_RENDER_FONT_SIZE) {
    throw new RangeError(`fontSize must be between ${MIN_RENDER_FONT_SIZE}px and ${MAX_RENDER_FONT_SIZE}px.`);
  }

  const { result, parsed } = buildValidation(document);
  if (!result.valid || !parsed) {
    const error = new Error('Report validation failed.') as Error & { diagnostics: Diagnostic[] };
    error.diagnostics = result.diagnostics;
    throw error;
  }

  const markerSeed = 'mdreport-auto-toc-placeholder';
  let tocPlaceholder = markerSeed;
  while (parsed.body.includes(tocPlaceholder)) tocPlaceholder += '-x';
  const md = createMarkdownParser(document.assets, document.datasets, document.scenes, parsed.metrics ?? {}, tocPlaceholder);
  const source = parsed.mode === 'report' ? `${parsed.body}\n\n${tocPlaceholder}\n` : parsed.body;
  const tokens = md.parse(source, {});
  const tocHeadings = tokens.filter((token) => token.type === 'heading_open' && ['h2', 'h3', 'h4'].includes(token.tag));
  const withGeneratedToc = md.renderer.render(tokens, md.options, {});
  const generatedTocPattern = /<nav class="mdr-toc-nav">[\s\S]*?<\/nav>/;
  const generatedToc = generatedTocPattern.exec(withGeneratedToc)?.[0] ?? '';
  const tocState = parsed.presentation.toc;
  const tocHtml = parsed.mode === 'report' && tocHeadings.length >= 2 && generatedToc
    ? `<details class="mdr-toc" data-mdr-toc="${tocState}"${tocState === 'collapsed' ? '' : ' open'}>\n  <summary>目录</summary>\n  ${generatedToc}\n</details>`
    : '';
  const renderedBody = await renderExcalidrawHosts(withGeneratedToc.replace(generatedTocPattern, ''));
  const html = buildHtml(parsed.title, parsed.mode, renderedBody, tocHtml, fontSize, parsed.presentation);
  const bytes = byteLength(html);
  if (bytes > MAX_RENDERED_HTML_BYTES) {
    const error = new Error(`Rendered HTML exceeds the ${MAX_RENDERED_HTML_BYTES}-byte export limit.`) as Error & { diagnostics: Diagnostic[] };
    error.diagnostics = [{
      severity: 'error',
      code: 'html.too-large',
      message: `Rendered HTML exceeds the ${MAX_RENDERED_HTML_BYTES}-byte export limit.`,
      line: 1,
      path: '$',
    }];
    throw error;
  }
  return { title: parsed.title, mode: parsed.mode, html, bytes };
}

/** Convert a title into a conservative downloadable file name. */
export function reportFileName(title: string, content?: string): string {
  const slug = title
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const suffix = createHash('sha256').update(content ?? title, 'utf8').digest('hex').slice(0, 12);
  return `${slug || 'report'}-${suffix}.html`;
}
