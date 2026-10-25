import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const id = '@tita-agent/dsh-drender-plugin';
const root = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(root, 'src/client/index.ts')],
  bundle: true,
  outfile: resolve(root, 'lib/client.js'),
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  sourcemap: false,
  minify: false,
  external: ['react', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-renderer/client', '@deepseek-ai/dsh-client-ui-primitives'],
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: { js: 'return module.exports; } });' },
});
