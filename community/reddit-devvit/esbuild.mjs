import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist/server', { recursive: true });

await esbuild.build({
  entryPoints: ['src/server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/server/index.cjs',
  target: 'node20',
  external: ['@devvit/public-api'],
  logLevel: 'info',
});

console.log('built dist/server/index.cjs');
