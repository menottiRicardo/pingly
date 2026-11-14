import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = (path: string) => fileURLToPath(new URL(`../../src/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^pingly\/styles\.css$/, replacement: src('styles.css') },
      { find: /^pingly$/, replacement: src('index.ts') },
    ],
  },
});
