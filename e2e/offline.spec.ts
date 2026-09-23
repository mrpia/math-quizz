import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The service worker, exercised as a service worker.
 *
 * `swCacheStrategy.test.ts` already pins the routing *decision* — but it tests
 * `src/sw/cacheStrategy.ts`, and what ships is `public/sw.js`, a hand-written
 * copy of that logic which cannot import TypeScript and has had no test of any
 * kind. Everything below runs against the file the browser actually installs.
 *
 * What this does **not** cover: `firebase.json`'s `Cache-Control` headers.
 * `vite preview` does not reproduce them, and a worker's `fetch()` goes through
 * the browser's ordinary HTTP cache — which is precisely where 47fef35 lived.
 * These specs can show the worker asks the network; they cannot show the CDN
 * answers with something new. That stays a deploy-time check.
 */

const CACHE_PREFIX = 'mathquizz';

/**
 * Loads the app until its shell and assets are genuinely in Cache Storage.
 *
 * Two loads are needed, and the reason is not incidental: on the very first
 * visit the document and its assets are fetched *before* any worker exists to
 * intercept them, so `install` + `clients.claim()` leave a controlled page with
 * an empty cache. The second load is the one that fills it.
 */
async function primeServiceWorker(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // `sw.js` does not await its `cache.put`s, so poll for the entries rather
  // than sleep — the shell plus every asset the document references.
  //
  // Listing the keys rather than calling `cache.match(url)`: `vite preview`
  // answers with `Vary: Origin`, and a `Request` built here from a bare URL
  // carries no `Origin` header, so it would fail to match the entry stored
  // under the real (crossorigin) asset request. The worker looks entries up
  // with that same real request, so it hits — this probe would not.
  await expect
    .poll(
      () =>
        page.evaluate(async (prefix) => {
          const name = (await caches.keys()).find((key) => key.startsWith(prefix));
          if (name === undefined) return false;
          const cache = await caches.open(name);
          const cached = (await cache.keys()).map((request) => request.url);
          const wanted = [
            new URL('./', location.href).href,
            ...[
              ...document.querySelectorAll<HTMLElement>(
                'script[src], link[rel="stylesheet"]',
              ),
            ].map((el) =>
              el instanceof HTMLScriptElement ? el.src : (el as HTMLLinkElement).href,
            ),
          ];
          return wanted.length > 1 && wanted.every((url) => cached.includes(url));
        }, CACHE_PREFIX),
      { message: 'the worker should have cached the shell and its assets' },
    )
    .toBe(true);
}

const cachedShell = (page: Page): Promise<string> =>
  page.evaluate(async (prefix) => {
    const name = (await caches.keys()).find((key) => key.startsWith(prefix));
    if (name === undefined) return '';
    // `ignoreVary` for the same reason the probe above lists keys.
    const cached = await (await caches.open(name)).match('./', { ignoreVary: true });
    return cached === undefined ? '' : cached.text();
  }, CACHE_PREFIX);

test('the app still launches with the network gone', async ({ page, context }) => {
  await primeServiceWorker(page);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByTestId('start-session')).toBeVisible();
  await expect(page.getByTestId('table-selector')).toBeVisible();

  // Without this the test could pass on a network that never went away. A
  // request for something not in the cache has to fail outright: if the
  // emulation were a no-op the preview server would answer it with a 404,
  // which resolves instead of rejecting.
  const networkIsDown = await page.evaluate(() =>
    fetch(`./never-cached-${Date.now()}`).then(
      () => false,
      () => true,
    ),
  );
  expect(networkIsDown).toBe(true);
});

test('a launch while online prefers the network over the cached shell', async ({
  page,
}) => {
  await primeServiceWorker(page);

  // Stand in for "the cache still holds yesterday's build". Poisoning the entry
  // the worker reads is the whole experiment: were navigations cache-first,
  // this is exactly what the next launch would render — and the shell is what
  // names the content-hashed bundle, so a stale one pins the whole app.
  await page.evaluate(async (prefix) => {
    const name = (await caches.keys()).find((key) => key.startsWith(prefix));
    const cache = await caches.open(name as string);
    await cache.put(
      './',
      new Response(
        '<!doctype html><html><head><title>Stale shell</title></head><body>stale</body></html>',
        { headers: { 'Content-Type': 'text/html' } },
      ),
    );
  }, CACHE_PREFIX);

  await page.reload();

  await expect(page).toHaveTitle('Math Quizz');
  await expect(page.getByTestId('start-session')).toBeVisible();

  // And the fresh response replaced the poisoned entry, so the next launch
  // without a network gets the current shell rather than the decoy.
  await expect.poll(() => cachedShell(page)).toContain('<div id="root">');
  expect(await cachedShell(page)).not.toContain('Stale shell');
});
