import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, run against the **built bundle in a real browser**.
 *
 * The rule that keeps this suite small: if a test can be written in Vitest, it
 * stays in Vitest. What lives here is only what jsdom cannot reach — the
 * service worker, Cache Storage, a real page reload, the browser's download and
 * file-picker flows, and a clock that is not faked.
 *
 * `vite preview` is deliberate, not a convenience: `registerServiceWorker()`
 * returns early unless `import.meta.env.PROD`, so none of the PWA specs would
 * do anything against `pnpm dev`.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',

  /**
   * Safe to parallelise: every spec shares one read-only `dist/` behind one
   * preview server, and Playwright gives each test its own browser context —
   * which means its own localStorage *and* its own Cache Storage, so no spec
   * can see another spec's service worker.
   */
  fullyParallel: true,

  forbidOnly: !!process.env.CI,
  // Above the 30s default: the PWA specs load the page three times and wait for
  // the worker to fill its cache, which is slow on a cold CI runner and is not
  // a signal about anything.
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}`,
    // Cheap where it is free: a trace is only kept when a first attempt failed.
    trace: 'on-first-retry',
  },

  // Chromium only until the suite has proven quiet. WebKit is the interesting
  // one to add next — the app is used on an iPad — but not before then.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // `--strictPort` so a port already in use fails here, loudly, instead of
    // moving to 4174 and leaving Playwright to time out against nothing.
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Locally a preview server you already have open is reused. On CI there is
    // never one, so the build always runs.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
