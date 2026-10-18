import { createElement, useState, type ReactNode } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';

export interface RenderToolViewProps {
  phase: 'preparing' | 'start' | 'result';
  callId: string;
  toolName: string;
  block: {
    argsRaw?: string;
    content?: readonly unknown[];
    isError?: boolean;
    meta?: unknown;
  };
  openFile?: (path: string) => unknown;
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'tool.call.toolview': { kind: 'keyed'; scope: 'session'; owner: RenderToolViewProps }
  }
}

interface RenderMeta {
  kind: 'md-report-render';
  status: string;
  title: string;
  sourcePath: string;
  sourceWorkspacePath: string;
  previewPath: string;
  previewWorkspacePath: string;
  fileName: string;
  bytes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readMeta(value: unknown): RenderMeta | undefined {
  if (!isRecord(value) || value.kind !== 'md-report-render') return undefined;
  return {
    kind: 'md-report-render',
    status: typeof value.status === 'string' ? value.status : 'unknown',
    title: typeof value.title === 'string' ? value.title : 'md-report',
    sourcePath: typeof value.sourcePath === 'string' ? value.sourcePath : '',
    sourceWorkspacePath: typeof value.sourceWorkspacePath === 'string' ? value.sourceWorkspacePath : '',
    previewPath: typeof value.previewPath === 'string' ? value.previewPath : '',
    previewWorkspacePath: typeof value.previewWorkspacePath === 'string' ? value.previewWorkspacePath : '',
    fileName: typeof value.fileName === 'string' ? value.fileName : '',
    bytes: typeof value.bytes === 'number' ? value.bytes : 0,
  };
}

function resultText(content: readonly unknown[] | undefined): string {
  if (!content) return '';
  return content.flatMap(block => {
    if (!isRecord(block) || block.type !== 'text' || typeof block.text !== 'string') return [];
    return [block.text];
  }).join('\n');
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeWorkspaceFile(path: string, extension: RegExp): boolean {
  return Boolean(path)
    && !path.startsWith('/')
    && !path.includes('\\')
    && !/[\u0000-\u001f\u007f]/.test(path)
    && extension.test(path)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

export function RenderToolRow(props: RenderToolViewProps): ReactNode {
  const [openError, setOpenError] = useState('');
  if (props.phase === 'preparing') {
    return createElement('div', { role: 'status' }, '准备渲染报告…');
  }
  if (props.phase === 'start') {
    return createElement('div', { role: 'status' }, '正在渲染报告…');
  }

  const meta = readMeta(props.block.meta);
  const body = resultText(props.block.content);
  if (!meta) {
    return createElement('div', { role: props.block.isError ? 'alert' : 'status' }, body || (props.block.isError ? '报告渲染失败。' : '报告渲染已结束。'));
  }

  const summary = meta.status === 'rendered'
    ? `${meta.title} · ${formatBytes(meta.bytes) || meta.fileName}`
    : meta.status === 'storage-failed'
      ? `${meta.title} · HTML 已生成，预览文件保存失败`
      : `${meta.title} · ${meta.status}`;

  const sourceCanOpen = safeWorkspaceFile(meta.sourceWorkspacePath, /\.(?:md|markdown)$/i);
  const htmlCanOpen = safeWorkspaceFile(meta.previewWorkspacePath, /\.html$/i);
  const openWorkspaceFile = (path: string, label: string, ariaLabel: string) => typeof props.openFile === 'function'
    ? createElement(Button, {
        type: 'button',
        variant: 'outline',
        size: 'sm',
        onClick: () => {
          setOpenError('');
          void Promise.resolve().then(() => props.openFile?.(path)).catch(() => {
            setOpenError('DSH 无法打开文件，请检查会话工作区访问权限。');
          });
        },
        'aria-label': ariaLabel,
      }, label)
    : null;

  if (htmlCanOpen && !props.block.isError && meta.status === 'rendered') {
    return createElement('div', { className: 'md-report-tool-row' },
      createElement('span', null, summary),
      meta.sourcePath ? createElement('span', null, `源 Markdown：${meta.sourcePath}`) : null,
      meta.previewPath ? createElement('span', null, `HTML 文件：${meta.previewPath}`) : null,
      sourceCanOpen ? openWorkspaceFile(meta.sourceWorkspacePath, '预览 Markdown', `在右侧预览 ${meta.title} 的 Markdown 源文件`) : null,
      openWorkspaceFile(meta.previewWorkspacePath, '预览 HTML', `在右侧预览 ${meta.title} 的 HTML 报告`)
        ?? createElement('span', null, `预览文件：${meta.previewWorkspacePath}`),
      body ? createElement('details', null,
        createElement('summary', null, '查看渲染摘要'),
        createElement('pre', null, body),
      ) : null,
      openError ? createElement('span', { role: 'alert' }, openError) : null,
    );
  }

  return createElement('div', { className: 'md-report-tool-row', role: props.block.isError || meta.status === 'storage-failed' ? 'alert' : 'status' },
    createElement('span', null, summary),
    meta.sourcePath ? createElement('span', null, `源 Markdown：${meta.sourcePath}`) : null,
    meta.previewPath ? createElement('span', null, `HTML 文件：${meta.previewPath}`) : null,
    sourceCanOpen ? openWorkspaceFile(meta.sourceWorkspacePath, '预览 Markdown', `在右侧预览 ${meta.title} 的 Markdown 源文件`) : null,
    meta.previewWorkspacePath && !htmlCanOpen ? createElement('span', { role: 'alert' }, 'HTML 预览路径无效，未打开文件。') : null,
    body ? createElement('details', null,
      createElement('summary', null, props.block.isError ? '查看错误详情' : '查看渲染结果'),
      createElement('pre', null, body),
    ) : null,
  );
}
