/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Relative base so the build works at any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: { target: 'es2020', sourcemap: false },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
