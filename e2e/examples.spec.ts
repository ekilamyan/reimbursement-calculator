import { expect, test } from '@playwright/test';
import { WORKED_EXAMPLES } from '../src/app/calculator/examples';
import { CalculatorPage, usd } from './calculator.page';

test.describe('Worked examples from the Calculator Explanation', () => {
  for (const example of WORKED_EXAMPLES) {
    for (const method of ['A', 'B'] as const) {
      const expected = example.expectedTotal[method];

      test(`${example.name} – Method ${method} totals ${usd(expected)}`, async ({ page }) => {
        const calc = new CalculatorPage(page);
        await calc.goto();
        await calc.fill({ ...example.input, crossingMethod: method });
        await calc.calculate();

        await expect(calc.total()).toHaveText(usd(expected));

        const totalDays = example.input.levelsOfCare.reduce((n, l) => n + l.days, 0);
        await expect(calc.dayRows()).toHaveCount(totalDays);

        if (method === 'A') {
          for (const [i, amount] of example.expectedDailyA.entries()) {
            await expect(calc.dayPayment(i + 1)).toHaveText(usd(amount));
          }
        }
      });
    }
  }
});
