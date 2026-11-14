import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'tsup';

/** Public entry points; each becomes `pingly/<name>`. */
export const ENTRIES = ['toast', 'inbox'] as const;

/** Stylesheets in load order. `styles.css` bundles them all. */
const STYLES = ['tokens', 'toast', 'inbox'];

const USE_CLIENT = '"use client";\n';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Mark every bundle and chunk as a client module for React Server Components. */
function addUseClient(file: string) {
  const code = readFileSync(file, 'utf8');
  if (code.startsWith(USE_CLIENT)) return;
  writeFileSync(file, USE_CLIENT + code);
  try {
    // Shift the sourcemap down one line to account for the added directive.
    const map = JSON.parse(readFileSync(`${file}.map`, 'utf8'));
    map.mappings = `;${map.mappings}`;
    writeFileSync(`${file}.map`, JSON.stringify(map));
  } catch {
    // No sourcemap for this file.
  }
}

function writeStyles() {
  const parts = STYLES.map((name) => {
    copyFileSync(`src/styles/${name}.css`, `dist/${name}.css`);
    return readFileSync(`src/styles/${name}.css`, 'utf8');
  });
  writeFileSync('dist/styles.css', parts.join('\n'));
}

export default defineConfig({
  entry: Object.fromEntries([
    ['index', 'src/index.ts'],
    ...ENTRIES.map((name) => [`${name}/index`, `src/${name}/index.ts`]),
  ]),
  format: ['esm', 'cjs'],
  // tsup sets `baseUrl` for the declaration build, which TypeScript 6 flags as deprecated.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  // Shared chunks keep one store instance no matter which entry is imported.
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  external: ['react', 'react-dom'],
  onSuccess: async () => {
    for (const file of walk('dist')) if (/\.(c?js)$/.test(file)) addUseClient(file);
    writeStyles();
  },
});
