import { CalculatorInput } from './reimbursement-engine';

/**
 * The worked examples from "Calculator Explanation/Examples", with the typos in the
 * screenshots corrected so the inputs match the hand-written math.
 * Shared by the unit tests (vitest) and the e2e tests (Playwright).
 */
export interface WorkedExample {
  name: string;
  input: Omit<CalculatorInput, 'crossingMethod'>;
  /** Expected facility total for Method A (original) and Method B (proportional). */
  expectedTotal: { A: number; B: number };
  /** Expected per-day facility payments (Method A), from the hand-written math. */
  expectedDailyA: number[];
}

const base = {
  deductibleMet: 0,
  maxOopMet: 0,
  oopUnlimited: false,
  deductibleIncludedInOop: false,
};

const dtx = (rate: number, days: number) => ({ name: 'DTX', rate, days });
const rtc = (rate: number, days: number) => ({ name: 'RTC', rate, days });

export const WORKED_EXAMPLES: WorkedExample[] = [
  {
    name: 'Example 1 – simplest case',
    input: {
      ...base,
      deductible: 1000,
      maxOop: 500,
      providerPct: 0,
      patientPct: 100,
      afterOopPct: 100,
      levelsOfCare: [dtx(300, 10)],
    },
    expectedTotal: { A: 1500, B: 1500 },
    expectedDailyA: [0, 0, 0, 0, 0, 300, 300, 300, 300, 300],
  },
  {
    name: 'Example 2 – deductible included in OOP',
    input: {
      ...base,
      deductible: 500,
      maxOop: 1000,
      deductibleIncludedInOop: true,
      providerPct: 0,
      patientPct: 100,
      afterOopPct: 100,
      levelsOfCare: [dtx(300, 10)],
    },
    expectedTotal: { A: 2000, B: 2000 },
    expectedDailyA: [0, 0, 0, 200, 300, 300, 300, 300, 300, 300],
  },
  {
    name: 'Example 3 – 60/40 co-insurance',
    input: {
      ...base,
      deductible: 500,
      maxOop: 500,
      providerPct: 60,
      patientPct: 40,
      afterOopPct: 100,
      levelsOfCare: [dtx(300, 10)],
    },
    expectedTotal: { A: 2000, B: 2000 },
    expectedDailyA: [0, 60, 180, 180, 180, 200, 300, 300, 300, 300],
  },
  {
    name: 'Example 4 – 40% payment after OOP',
    input: {
      ...base,
      deductible: 500,
      maxOop: 1000,
      deductibleIncludedInOop: true,
      providerPct: 60,
      patientPct: 40,
      afterOopPct: 40,
      levelsOfCare: [dtx(300, 10)],
    },
    expectedTotal: { A: 1268, B: 1250 },
    expectedDailyA: [0, 60, 180, 180, 180, 188, 120, 120, 120, 120],
  },
  {
    name: 'Example 5 – multiple levels of care',
    input: {
      ...base,
      deductible: 500,
      maxOop: 500,
      providerPct: 60,
      patientPct: 40,
      afterOopPct: 40,
      levelsOfCare: [dtx(300, 5), rtc(400, 6)],
    },
    expectedTotal: { A: 1664, B: 1610 },
    expectedDailyA: [0, 60, 180, 180, 180, 264, 160, 160, 160, 160, 160],
  },
  {
    name: 'Example 6 – unlimited OOP',
    input: {
      ...base,
      deductible: 500,
      maxOop: 0,
      oopUnlimited: true,
      providerPct: 60,
      patientPct: 40,
      afterOopPct: 40,
      levelsOfCare: [dtx(300, 5), rtc(400, 6)],
    },
    expectedTotal: { A: 2040, B: 2040 },
    expectedDailyA: [0, 60, 180, 180, 180, 240, 240, 240, 240, 240, 240],
  },
  {
    name: 'Example 7 – deductible included in OOP, 60% after OOP',
    input: {
      ...base,
      deductible: 500,
      maxOop: 1000,
      deductibleIncludedInOop: true,
      providerPct: 60,
      patientPct: 40,
      afterOopPct: 60,
      levelsOfCare: [dtx(300, 5), rtc(400, 6)],
    },
    expectedTotal: { A: 2076, B: 2040 },
    expectedDailyA: [0, 60, 180, 180, 180, 276, 240, 240, 240, 240, 240],
  },
];
