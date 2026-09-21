import { describe, it, expect } from 'vitest';
import { AUTHOR_LABEL, AUTHOR_URL, SITE_URL, SUPPORT_URL } from '../config/site';

/**
 * The project is public and forkable. Every URL that says "this deployment
 * belongs to *this* person" lives in src/config/site.ts, so a fork retargets
 * the app by editing one file rather than hunting literals through screens,
 * domain code and tests.
 */
describe('site config', () => {
  it('derives the author link label from the URL, so the two cannot drift', () => {
    expect(AUTHOR_LABEL).toBe(new URL(AUTHOR_URL).host);
  });

  it('exposes absolute, scheme-qualified URLs with no trailing slash', () => {
    for (const url of [SITE_URL, AUTHOR_URL, SUPPORT_URL]) {
      expect(url).toMatch(/^https:\/\//);
      expect(url).not.toMatch(/\/$/);
    }
  });
});

/**
 * Drift guard, in the spirit of i18n.test.ts and backup.test.ts: the identity
 * constants are worthless if a screen quietly hard-codes the domain again.
 */
describe('no hard-coded identity outside src/config/site.ts', () => {
  const sources = import.meta.glob('../**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  const hosts = [SITE_URL, AUTHOR_URL, SUPPORT_URL].map((u) => new URL(u).host);

  it('finds the app sources (guard is actually looking at something)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it('keeps every identity host in the config file alone', () => {
    const offenders: string[] = [];
    for (const [path, code] of Object.entries(sources)) {
      if (path.endsWith('/config/site.ts')) continue;
      if (path.includes('/__tests__/')) continue;
      for (const host of hosts) {
        if (code.includes(host)) offenders.push(`${path} → ${host}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
