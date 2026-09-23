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
 * Pairs never practised count as rate 0: the same weight as a mastered pair.
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
  const rate = counters ? (weightedErrorRate(counters) ?? 0) : 0;
  return 1 + alpha * rate;
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
 * Draws a session. `stats` — normally `aggregatePairs` over the profile's
 * histories — biases the draw toward pairs the child has been getting wrong
 * lately, as strongly as `settings.adaptiveDraw` asks. Without it, or with
 * 'off', every pair is equally likely.
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

  const pool: Question[] = [];
  for (const a of settings.selectedTables) {
    for (const b of MULTIPLIERS) {
      pool.push(buildQuestion(a, b, pickOp(settings.mode)));
    }
  }

  const alpha = adaptiveAlpha(settings);
  const weights = pool.map((q) => pairWeight(q.a, q.b, stats, alpha));

  if (pool.length >= settings.questionCount) {
    return fisherYates(weightedSample(pool, weights, settings.questionCount));
  }

  // Every pair once, then weighted repeats to make up the count.
  const total = weights.reduce((sum, w) => sum + w, 0);
  const extras: Question[] = [];
  while (pool.length + extras.length < settings.questionCount) {
    const src = weightedPick(pool, weights, total);
    extras.push(buildQuestion(src.a, src.b, pickOp(settings.mode)));
  }
  return fisherYates([...pool, ...extras]);
};
