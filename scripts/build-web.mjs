import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
const out = 'src/Schreibatelier.App/Web';
await mkdir(out, { recursive: true });
await build({ entryPoints: ['web/main.ts'], bundle: true, outfile: `${out}/main.js`, platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof' });
for (const name of ['index.html', 'style.css']) await copyFile(`web/${name}`, `${out}/${name}`);
