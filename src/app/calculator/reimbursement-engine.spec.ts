import { describe, expect, it } from 'vitest';
import { WORKED_EXAMPLES } from './examples';
import { CalculatorInput, calculateReimbursement } from './reimbursement-engine';

describe('calculateReimbursement – worked examples', () => {
  for (const example of WORKED_EXAMPLES) {
    describe(example.name, () => {
      it('matches the hand-calculated daily payments (Method A)', () => {
        const result = calculateReimbursement({ ...example.input, crossingMethod: 'A' });
        expect(result.days.map((d) => d.payment)).toEqual(example.expectedDailyA);
      });

      it(`totals $${example.expectedTotal.A} with Method A`, () => {
        const result = calculateReimbursement({ ...example.input, crossingMethod: 'A' });
        expect(result.totalPayment).toBe(example.expectedTotal.A);
      });

      it(`totals $${example.expectedTotal.B} with Method B`, () => {
        const result = calculateReimbursement({ ...example.input, crossingMethod: 'B' });
        expect(result.totalPayment).toBe(example.expectedTotal.B);
      });
    });
  }

  it('Example 4 crossing day pays $188 (A) vs $170 (B)', () => {
    const ex4 = WORKED_EXAMPLES[3].input;
    expect(calculateReimbursement({ ...ex4, crossingMethod: 'A' }).days[5].payment).toBe(188);
    expect(calculateReimbursement({ ...ex4, crossingMethod: 'B' }).days[5].payment).toBe(170);
  });

  it('Example 7 reports the remaining balances shown in Figure 7', () => {
    const { days } = calculateReimbursement({ ...WORKED_EXAMPLES[6].input, crossingMethod: 'A' });
    expect(days.map((d) => d.remainingDeductible).slice(0, 2)).toEqual([200, 0]);
    expect(days.map((d) => d.remainingOop).slice(0, 7)).toEqual([700, 460, 340, 220, 100, 0, 0]);
    expect(days[1].events).toContain('deductible-met');
    expect(days[5].events).toContain('oop-met');
  });

  it('Example 6 reports Unlimited OOP as null', () => {
    const { days } = calculateReimbursement({ ...WORKED_EXAMPLES[5].input, crossingMethod: 'A' });
    expect(days.every((d) => d.remainingOop === null)).toBe(true);
  });
});

describe('calculateReimbursement – edge cases', () => {
  const base: CalculatorInput = {
    deductible: 500,
    deductibleMet: 0,
    maxOop: 500,
    maxOopMet: 0,
    oopUnlimited: false,
    providerPct: 60,
    patientPct: 40,
    afterOopPct: 100,
    deductibleIncludedInOop: false,
    crossingMethod: 'A',
    levelsOfCare: [{ name: 'DTX', rate: 300, days: 10 }],
  };

  it('subtracts Deductible Met and Max OOP Met', () => {
    const { days } = calculateReimbursement({ ...base, deductibleMet: 200, maxOopMet: 100 });
    // Deductible left 300 → met on day 1 exactly; OOP left 400.
    expect(days[0].remainingDeductible).toBe(0);
    expect(days[0].payment).toBe(0);
    expect(days[0].remainingOop).toBe(400);
    expect(days[1].remainingOop).toBe(280);
  });

  it('included in OOP: remaining OOP = (OOP − OOP Met) − (Ded − Ded Met)', () => {
    const { days } = calculateReimbursement({
      ...base,
      deductibleIncludedInOop: true,
      deductible: 500,
      deductibleMet: 200,
      maxOop: 1000,
      maxOopMet: 200,
    });
    // Deductible left 300, OOP left (800 − 300) = 500 after the deductible
    expect(days[0].remainingDeductible).toBe(0);
    expect(days[0].remainingOop).toBe(500);
    expect(days[1].remainingOop).toBe(380);
  });

  it('starts co-insurance immediately when the deductible is 0', () => {
    const { days } = calculateReimbursement({ ...base, deductible: 0 });
    expect(days[0].payment).toBe(180);
    expect(days[0].remainingOop).toBe(380);
  });

  it('pays the after-OOP % from day 1 when both are already met', () => {
    const { totalPayment } = calculateReimbursement({
      ...base,
      deductibleMet: 500,
      maxOopMet: 500,
      afterOopPct: 80,
    });
    expect(totalPayment).toBe(2400);
  });

  it('handles the deductible and the OOP both being met on the same day', () => {
    const { days } = calculateReimbursement({
      ...base,
      deductible: 100,
      maxOop: 40,
      levelsOfCare: [{ name: 'RTC', rate: 400, days: 1 }],
    });
    // 100 to deductible, 300 left: patient share 120 > 40 → A: 180 + 100% × 80 = 260
    expect(days[0].events).toEqual(['deductible-met', 'oop-met']);
    expect(days[0].payment).toBe(260);
  });

  it('never meets the OOP when the patient co-insurance is 0%', () => {
    const { days } = calculateReimbursement({ ...base, providerPct: 100, patientPct: 0 });
    expect(days.at(-1)?.remainingOop).toBe(500);
  });

  it('caps the deductible at the OOP when the deductible is included and larger', () => {
    const { days } = calculateReimbursement({
      ...base,
      deductible: 1000,
      maxOop: 600,
      deductibleIncludedInOop: true,
    });
    expect(days[1].remainingDeductible).toBe(0);
    expect(days[1].payment).toBe(0);
    expect(days[2].payment).toBe(300);
  });

  it('rounds to cents without floating-point drift', () => {
    const { totalPayment } = calculateReimbursement({
      ...base,
      deductible: 0,
      oopUnlimited: true,
      providerPct: 70,
      patientPct: 30,
      levelsOfCare: [{ name: 'DTX', rate: 0.1, days: 3 }],
    });
    // 0.1 * 0.7 * 3 = 0.21000000000000002 in plain floating point
    expect(totalPayment).toBe(0.21);
  });

  it('returns an empty result with no levels of care', () => {
    const result = calculateReimbursement({ ...base, levelsOfCare: [] });
    expect(result.days).toEqual([]);
    expect(result.totalPayment).toBe(0);
  });
});
