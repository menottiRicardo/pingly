import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const USE_CLIENT = '"use client";\n';

/** Mark the bundle as a client module for React Server Components. */
function addUseClient(file: string) {
  const code = readFileSync(file, 'utf8');
  if (code.startsWith(USE_CLIENT)) return;
  writeFileSync(file, USE_CLIENT + code);
  // Shift the sourcemap down one line to account for the added directive.
  const map = JSON.parse(readFileSync(`${file}.map`, 'utf8'));
  map.mappings = `;${map.mappings}`;
  writeFileSync(`${file}.map`, JSON.stringify(map));
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // tsup sets `baseUrl` for the declaration build, which TypeScript 6 flags as deprecated.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2020',
  external: ['react', 'react-dom'],
  onSuccess: async () => {
    addUseClient('dist/index.js');
    addUseClient('dist/index.cjs');
    copyFileSync('src/styles.css', 'dist/styles.css');
  },
});
