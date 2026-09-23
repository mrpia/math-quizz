import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    /**
     * Pinned, not left at the default. Vitest would otherwise match
     * `**\/*.{test,spec}.*` from the repo root and sweep `e2e/*.spec.ts` into
     * `pnpm test`, where the Playwright specs cannot run and would simply fail.
     * Constraining the unit run to `src/` is the sturdier half of the fix: it
     * holds whatever a contributor later drops in the root, and it lets the
     * E2E specs keep Playwright's ordinary `.spec.ts` naming.
     */
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
