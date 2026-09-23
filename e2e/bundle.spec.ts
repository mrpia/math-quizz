import { expect, test } from '@playwright/test';
import pkg from '../package.json' with { type: 'json' };

/**
 * What the production build actually serves.
 *
 * `manifest.test.ts` reads `public/manifest.webmanifest` off disk and
 * `releaseNotes.test.ts` ties the version to `package.json`, but neither one
 * proves the built site hands any of it to a browser. #9 was exactly that gap:
 * the À propos screen read 0.10.0 while `package.json` said 0.12.0, and it was
 * caught by eye.
 */

test('À propos shows the version package.json declares', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-about').click();

  // Substring, not equality: the line reads "Math Quizz version 1.0.0", and the
  // wording around the number is translated. The number is not.
  await expect(page.getByTestId('about-version')).toContainText(pkg.version);
});

test('the shell references its assets relatively', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('<div id="root">');

  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(([, ref]) => ref);
  // `base: './'` is what lets the same bundle work from a subdirectory. A
  // root-absolute path here means someone dropped it.
  expect(refs.filter((ref) => ref.startsWith('/'))).toEqual([]);
  expect(refs.filter((ref) => ref.includes('assets/')).length).toBeGreaterThan(0);
});

test('the manifest and every icon it lists are served', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);

  const manifest = JSON.parse(await response.text());
  expect(manifest.name).toBe('Math Quizz');
  expect(manifest.start_url).toBe('./');

  for (const icon of manifest.icons as { src: string; type: string }[]) {
    const served = await request.get(icon.src.replace(/^\.\//, '/'));
    expect(served.ok(), `${icon.src} should be served`).toBe(true);
    expect(served.headers()['content-type']).toContain(icon.type);
  }
});

test('the worker script is served from the site root', async ({ request }) => {
  const response = await request.get('/sw.js');
  expect(response.ok()).toBe(true);
  // Scope is the directory the script is served from, so a worker living
  // anywhere but the root would silently stop controlling the app.
  expect(await response.text()).toContain("mode === 'navigate'");
});
