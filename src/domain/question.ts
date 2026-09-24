import { MULTIPLIERS } from './tables';
import type { AdaptiveDraw, Settings } from './session';
import { canonicalKey, weightedErrorRate } from './stats';
import type { PairCounterMap } from './stats';

export type Operator = 'mul' | 'div';
export type Mode = 'mul' | 'div' | 'mix';

export type Question = {
  a: number;
  b: number;
  op: Operator;
  expected: number;
};

const fisherYates = <T>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * α in `weight = 1 + α × weightedErrorRate`. At 2, a pair missed every time
 * recently is three times as likely to come up as one the child has mastered;
 * at 5, six times. Stored settings name the level, not the number, so the
 * curve can be retuned without touching anyone's saved data.
 */
export const ADAPTIVE_ALPHA: Record<AdaptiveDraw, number> = {
  off: 0,
  moderate: 2,
  strong: 5,
};

export const adaptiveAlpha = (settings: Settings): number =>
  ADAPTIVE_ALPHA[settings.adaptiveDraw ?? 'moderate'];

/**
 * Error rate assumed for a pair with no history: above a mastered pair, so
 * untried pairs (a newly selected table, say) get their turn, but below one
 * the child misses half the time. Low because the child already knows the
 * tables — an unknown pair is more likely right than wrong.
 */
export const UNPRACTISED_RATE = 0.25;

/**
 * Recency-weighted on purpose — raw counters would keep drilling a pair the
 * child fixed months ago (see "Statistics are recency-weighted" in CLAUDE.md).
 */
const pairWeight = (
  a: number,
  b: number,
  stats: PairCounterMap | undefined,
  alpha: number,
): number => {
  const counters = stats?.[canonicalKey(a, b)];
  const rate = counters ? weightedErrorRate(counters) : null;
  return 1 + alpha * (rate ?? UNPRACTISED_RATE);
};

/**
 * Weighted sampling without replacement (Efraimidis–Spirakis): each item gets
 * the key `-ln(u) / w` and the `k` smallest keys win. With all weights equal
 * this is a plain uniform draw. The keys also order the winners heaviest-first,
 * so the caller shuffles them afterwards.
 */
const weightedSample = <T>(items: T[], weights: number[], k: number): T[] =>
  items
    .map((item, i) => ({ item, key: -Math.log(1 - Math.random()) / weights[i] }))
    .sort((x, y) => x.key - y.key)
    .slice(0, k)
    .map((entry) => entry.item);

/** One weighted draw with replacement (roulette wheel). */
const weightedPick = <T>(items: T[], weights: number[], total: number): T => {
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
};

const buildQuestion = (a: number, b: number, op: Operator): Question => ({
  a,
  b,
  op,
  expected: op === 'mul' ? a * b : b,
});

export const formatOperation = (q: Question): string =>
  q.op === 'mul' ? `${q.a} × ${q.b}` : `${q.a * q.b} ÷ ${q.a}`;

const pickOp = (mode: Mode): Operator =>
  mode === 'mix' ? (Math.random() < 0.5 ? 'mul' : 'div') : mode;

/**
 * One fact in the draw pool: `a` a selected table, `b` a multiplier.
 * `reversible` when `b × a` is also in the selection, i.e. both are selected
 * tables in 2..12. The child knows a pair, not a direction (see `stats.ts`),
 * so 3×4 and 4×3 are one fact, drawn as often as 3×3 or 15×4, and the
 * orientation is picked when the question is asked.
 */
type Fact = { a: number; b: number; reversible: boolean };

const isMultiplier = (n: number): boolean =>
  (MULTIPLIERS as readonly number[]).includes(n);

const buildPool = (tables: number[]): Fact[] => {
  const selected = new Set(tables);
  const pool: Fact[] = [];
  for (const a of selected) {
    for (const b of MULTIPLIERS) {
      const reversible = a !== b && selected.has(b) && isMultiplier(a);
      // Keep one of the two orientations: the one with the smaller table.
      if (reversible && b < a) continue;
      pool.push({ a, b, reversible });
    }
  }
  return pool;
};

const drawQuestion = (fact: Fact, mode: Mode): Question =>
  fact.reversible && Math.random() < 0.5
    ? buildQuestion(fact.b, fact.a, pickOp(mode))
    : buildQuestion(fact.a, fact.b, pickOp(mode));

/**
 * Draws a session. `stats` — normally `aggregatePairs` over the profile's
 * histories — biases the draw toward pairs the child has been getting wrong
 * lately, as strongly as `settings.adaptiveDraw` asks. Without it, or with
 * 'off', every fact is equally likely: 3×4 and 4×3 count as one.
 */
export const generateQuestions = (
  settings: Settings,
  stats?: PairCounterMap,
): Question[] => {
  if (settings.selectedTables.length === 0) {
    throw new Error('selectedTables must not be empty');
  }
  if (settings.questionCount <= 0) {
    throw new Error('questionCount must be positive');
  }

  const pool = buildPool(settings.selectedTables);
  const alpha = adaptiveAlpha(settings);
  const weights = pool.map((f) => pairWeight(f.a, f.b, stats, alpha));
  const ask = (f: Fact) => drawQuestion(f, settings.mode);

  if (pool.length >= settings.questionCount) {
    return fisherYates(weightedSample(pool, weights, settings.questionCount).map(ask));
  }

  // Every fact once, then weighted repeats to make up the count.
  const total = weights.reduce((sum, w) => sum + w, 0);
  const extras: Fact[] = [];
  while (pool.length + extras.length < settings.questionCount) {
    extras.push(weightedPick(pool, weights, total));
  }
  return fisherYates([...pool, ...extras].map(ask));
};
