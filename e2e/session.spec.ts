import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Settings } from '../src/domain/session';
import { seedProfiles } from './fixtures';

/**
 * Answering a session on the device this app is used on.
 *
 * jsdom can dispatch a `keydown` at `window` and watch `useNumericKeyboard`
 * react; what it cannot do is prove a real browser routes a physical key press
 * there while the focus sits on a `<button>` the child just tapped. Nor can it
 * run `requestAnimationFrame` against a clock nobody is advancing by hand.
 */

// iPad Air in portrait. The pad has to be reachable at this size, not merely
// present in the DOM — `toBeVisible()` would pass on a NumPad pushed off-screen.
test.use({ viewport: { width: 820, height: 1180 } });

const PROFILE = 'default';

type Asked = { text: string; answer: number };

/** Reads the question on screen and works out what the child should type. */
async function readQuestion(page: Page): Promise<Asked> {
  const text = (await page.getByTestId('question-operation').innerText()).trim();
  const match = text.match(/(\d+)\s*([×÷])\s*(\d+)/);
  expect(match, `unreadable operation: "${text}"`).not.toBeNull();
  const [, left, operator, right] = match as RegExpMatchArray;
  return {
    text,
    answer:
      operator === '×' ? Number(left) * Number(right) : Number(left) / Number(right),
  };
}

const seed = (page: Page, settings: Partial<Settings>) =>
  seedProfiles(page, [{ id: PROFILE, name: 'Léa', settings }]);

test('a session can be answered on the pad and on the keyboard', async ({ page }) => {
  // One table and one operator means `generateQuestions` draws two questions
  // from a pool of eleven distinct pairs, so the two are never the same — which
  // is what lets the spec below wait for the operation to *change*.
  await seed(page, {
    selectedTables: [7],
    mode: 'mul',
    answerMode: 'screen',
    questionCount: 2,
    // Far beyond anything a test will take, so the score is about the answers
    // and not about how loaded the machine was.
    durationPerQuestionMs: 30000,
    language: 'fr',
  });

  await page.goto('/');
  await page.getByTestId('start-session').click();

  const shown = page.getByTestId('answer-value');
  const operation = page.getByTestId('question-operation');

  // 1 — the on-screen pad, mistake and all.
  const first = await readQuestion(page);
  await page.getByTestId('numpad-digit-9').click();
  await expect(shown).toHaveText('9');
  await page.getByTestId('numpad-erase').click();
  await expect(shown).toHaveText('?');
  for (const digit of String(first.answer)) {
    await page.getByTestId(`numpad-digit-${digit}`).click();
  }
  await expect(shown).toHaveText(String(first.answer));
  await page.getByTestId('numpad-validate').click();

  // 2 — the physical keyboard, with focus still on the pad button just tapped.
  await expect(operation).not.toHaveText(first.text);
  const second = await readQuestion(page);
  await page.keyboard.type(String(second.answer));
  await expect(shown).toHaveText(String(second.answer));
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('results-score')).toHaveText('2 / 2');
});

test('the timer runs on a real clock', async ({ page }) => {
  await seed(page, {
    selectedTables: [7],
    mode: 'mul',
    answerMode: 'screen',
    questionCount: 4,
    language: 'fr',
  });

  await page.goto('/');
  await page.getByTestId('start-session').click();

  // Nothing here advances time; `requestAnimationFrame` does, and jsdom never
  // runs it. Waiting for the display to cross a whole second is the assertion.
  await expect(page.getByTestId('session-timer')).toHaveText(/^[1-9]\d*\.\ds$/);
});
