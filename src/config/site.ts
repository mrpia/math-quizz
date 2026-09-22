/**
 * Every URL that ties this build to a particular deployment and a particular
 * author. The project is public and MIT-licensed, so a fork needs exactly one
 * file to retarget: change the constants below and nothing else in `src/`
 * still points at the original.
 *
 * Three things outside `src/` carry the same identity and do NOT read this file,
 * because they are static assets with no build step:
 *
 * - `public/schemas/math-quizz-backup-v1.schema.json` — its `$id` must equal
 *   `BACKUP_SCHEMA_URL`. `src/__tests__/backup.test.ts` asserts that, so
 *   changing `SITE_URL` without updating the schema fails `pnpm test`.
 * - `.firebaserc` — the Firebase project a `pnpm ship` deploys to.
 * - `.github/FUNDING.yml` — GitHub's own sponsor button, which must name the
 *   same account as `SUPPORT_URL`.
 *
 * `src/__tests__/siteConfig.test.ts` guards the rest: if any other file under
 * `src/` hard-codes one of these hosts — or the whole of `SOURCE_URL` — again,
 * the suite fails.
 */

/** Where this build is deployed. No trailing slash — callers append the path. */
export const SITE_URL = 'https://math-quizz.mrpia.ch';

/** The author's site, linked from the "Conçu avec 💖" credit line. */
export const AUTHOR_URL = 'https://mrpia.ch';

/**
 * The public, MIT-licensed repository this build comes from, linked from the
 * "Code source" panel on the À propos screen.
 *
 * A fork must point this at *its own* repository, not upstream: the panel's
 * promise is that a reader can check what the app they are running actually
 * does, and upstream's code is no longer that app once a fork diverges.
 */
export const SOURCE_URL = 'https://github.com/mrpia/math-quizz';

/**
 * Visible text of the credit link. Derived from `AUTHOR_URL` rather than
 * written twice: the label is the bare host, so it cannot drift from the href.
 */
export const AUTHOR_LABEL = new URL(AUTHOR_URL).host;

/**
 * Where the "m'offrir un café ☕" link goes. Shown to the child, but the copy
 * routes the decision through their parents — see `info.coffee` in src/i18n/.
 */
export const SUPPORT_URL = 'https://buymeacoffee.com/mrpia';
