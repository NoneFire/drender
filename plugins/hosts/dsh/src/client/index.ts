import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-primitives';
import { createElement } from 'react';
import { RenderToolRow } from './RenderToolRow.js';

export const inject = ['slots'] as const;

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.slots.inject(
    'tool.call.toolview',
    () => ctx.slots.register(
      { name: 'tool.call.toolview', key: 'md_report_render' },
      props => createElement(RenderToolRow, props),
    ),
  ), 'md-report: render result card');
}
