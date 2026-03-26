#!/usr/bin/env node
// Bundles src/app.js and all dependencies into a single dist/datadrag.js.
// Run this after build-data.js and build-css.js.
//   node scripts/bundle.js
import esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
mkdirSync(join(root, 'dist'), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'src', 'app.js')],
  bundle: true,
  outfile: join(root, 'dist', 'datadrag.js'),
  format: 'iife',
  platform: 'browser',
  alias: {
    'node:fs/promises': join(root, 'src', 'stubs', 'node-fs-stub.js'),
    'node:stream':      join(root, 'src', 'stubs', 'node-stream-stub.js'),
  },
});
console.log('Wrote dist/datadrag.js');
