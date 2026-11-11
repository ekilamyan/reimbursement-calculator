import { Locator, Page, expect } from '@playwright/test';
import { CalculatorInput } from '../src/app/calculator/reimbursement-engine';

type FormInput = Omit<CalculatorInput, 'crossingMethod'> & { crossingMethod?: 'A' | 'B' };

/** Page object for the Reimbursement Calculator. */
export class CalculatorPage {
  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'Reimbursement Calculator' })).toBeVisible();
    await this.page.waitForLoadState('networkidle');
  }

  input(id: string): Locator {
    return this.page.locator(`#${id}`);
  }

  async setNumber(id: string, value: number): Promise<void> {
    const field = this.input(id);
    await field.click();
    await field.press('ControlOrMeta+a');
    await field.press('Backspace');
    await field.pressSequentially(String(value));
    await field.press('Tab');
  }

  async choose(testId: string, option: string): Promise<void> {
    await this.page.locator(`[data-testid="${testId}"]`).click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }

  async clickButton(testId: string): Promise<void> {
    await this.page.locator(`[data-testid="${testId}"] button`).click();
  }

  async fill(form: FormInput): Promise<void> {
    await this.clickButton('clear');
    await this.setNumber('deductible', form.deductible);
    await this.setNumber('deductibleMet', form.deductibleMet);

    if (form.oopUnlimited) {
      await this.page.locator('[data-testid="oopUnlimited"]').click();
      await expect(this.input('maxOop')).toBeDisabled();
    } else {
      await this.setNumber('maxOop', form.maxOop);
      await this.setNumber('maxOopMet', form.maxOopMet);
    }

    await this.setNumber('providerPct', form.providerPct);
    await this.setNumber('patientPct', form.patientPct);
    await this.setNumber('afterOopPct', form.afterOopPct);
    await this.choose('deductibleIncludedInOop', form.deductibleIncludedInOop ? 'Yes' : 'No');

    if (form.crossingMethod) {
      const label = form.crossingMethod === 'A' ? 'Method A (original)' : 'Method B (proportional)';
      await this.page.locator('[data-testid="crossingMethod"]').getByText(label).click();
    }

    for (const [i, loc] of form.levelsOfCare.entries()) {
      if (i > 0) await this.clickButton('add-loc');
      await this.choose(`loc-name-${i}`, loc.name);
      await this.setNumber(`loc-rate-${i}`, loc.rate);
      await this.setNumber(`loc-days-${i}`, loc.days);
    }
  }

  async calculate(): Promise<void> {
    await this.clickButton('calculate');
    await expect(this.page.locator('[data-testid="results"]')).toBeVisible();
  }

  total(): Locator {
    return this.page.locator('[data-testid="total"]');
  }

  dayRows(): Locator {
    return this.page.locator('[data-testid="results"] tbody tr[data-testid^="day-"]');
  }

  dayPayment(day: number): Locator {
    return this.page.locator(`[data-testid="day-${day}"] [data-testid="day-payment"]`);
  }
}

export const usd = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
