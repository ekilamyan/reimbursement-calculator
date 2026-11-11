import { expect, test } from '@playwright/test';
import { CalculatorPage } from './calculator.page';

test.describe('Calculator behaviour', () => {
  let calc: CalculatorPage;

  test.beforeEach(async ({ page }) => {
    calc = new CalculatorPage(page);
    await calc.goto();
  });

  test('Preset fills the form and Calculate shows the Figure 7 results', async ({ page }) => {
    await calc.clickButton('preset');
    await expect(calc.input('deductible')).toHaveValue('$500.00');
    await expect(calc.input('loc-rate-1')).toHaveValue('$400.00');
    await calc.calculate();
    await expect(calc.total()).toHaveText('$2,076.00');
    await expect(page.locator('[data-testid="day-6"]')).toContainText('OOP met');
  });

  test('Clear resets every field and hides the results', async ({ page }) => {
    await calc.clickButton('preset');
    await calc.calculate();
    await calc.clickButton('clear');
    await expect(calc.input('deductible')).toHaveValue('');
    await expect(calc.input('maxOop')).toHaveValue('');
    await expect(page.locator('[data-testid^="loc-row-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="results"]')).toHaveCount(0);
  });

  test('+ LOC adds a row and the trash icon removes it', async ({ page }) => {
    await calc.clickButton('add-loc');
    await calc.clickButton('add-loc');
    await expect(page.locator('[data-testid^="loc-row-"]')).toHaveCount(3);
    await calc.clickButton('loc-remove-1');
    await expect(page.locator('[data-testid^="loc-row-"]')).toHaveCount(2);
  });

  test('the two Unlimited switches are linked and disable both OOP fields', async ({ page }) => {
    await page.locator('[data-testid="oopUnlimited"]').click();
    await expect(page.locator('#oopMetUnlimited')).toBeChecked();
    await expect(calc.input('maxOop')).toBeDisabled();
    await expect(calc.input('maxOopMet')).toBeDisabled();
    await expect(calc.input('maxOopMet')).toHaveAttribute('placeholder', 'Unlimited');

    await page.locator('[data-testid="oopMetUnlimited"]').click();
    await expect(page.locator('#oopUnlimited')).not.toBeChecked();
    await expect(calc.input('maxOop')).toBeEnabled();
  });

  test('co-insurance percentages auto-complement to 100%', async () => {
    await calc.setNumber('providerPct', 70);
    await expect(calc.input('patientPct')).toHaveValue('30%');
    await calc.setNumber('patientPct', 25);
    await expect(calc.input('providerPct')).toHaveValue('75%');
  });

  test('Calculate with missing required fields shows errors and no results', async ({ page }) => {
    await calc.clickButton('calculate');
    await expect(page.getByText('Deductible is required.')).toBeVisible();
    await expect(page.locator('[data-testid="results"]')).toHaveCount(0);
  });

  test('changing an input after calculating flags the results as stale', async ({ page }) => {
    await calc.clickButton('preset');
    await calc.calculate();
    await page.locator('[data-testid="crossingMethod"]').getByText('Method B (proportional)').click();
    await expect(page.locator('[data-testid="stale"]')).toBeVisible();
    await calc.calculate();
    await expect(page.locator('[data-testid="stale"]')).toHaveCount(0);
    await expect(calc.total()).toHaveText('$2,040.00');
  });

  test('the info icon explains both crossing-day methods', async ({ page }) => {
    await page.locator('[data-testid="method-info"]').hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Method A (original)');
    await expect(tooltip).toContainText('Method B (proportional)');
    await expect(tooltip).toContainText('$188');
    await expect(tooltip).toContainText('$170');
  });
});
