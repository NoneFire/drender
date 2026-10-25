import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const external = [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
];

await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  bundle: true,
  outfile: resolve(root, 'lib/index.js'),
  platform: 'node',
  format: 'esm',
  target: 'node22',
  alias: {
    '@tita-agent/renderer-core': resolve(root, '../../../packages/renderer-core/dist/index.js'),
    '@tita-agent/data-sources': resolve(root, '../../../packages/data-sources/dist/index.js'),
  },
  external,
  sourcemap: false,
});
