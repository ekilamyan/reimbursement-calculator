/**
 * Reimbursement calculation engine (framework-free, pure functions).
 *
 * Walks every treatment day in order and splits each day's rate between the
 * patient's responsibility (deductible, then max OOP) and the facility.
 *
 * Phases for a single day (a day can pass through several phases):
 *  1. Deductible phase – the patient owns 100% of the rate until the deductible is met.
 *  2. OOP phase        – what's left of the rate is split by co-insurance:
 *                        provider % goes to the facility, patient % reduces the OOP.
 *  3. Post-OOP phase   – the facility receives "Payment After OOP is Met" % of the rate.
 *
 * All money is handled in integer cents to avoid floating-point drift.
 */

export type CrossingMethod = 'A' | 'B';

export interface LevelOfCareInput {
  name: string;
  rate: number;
  days: number;
}

export interface CalculatorInput {
  deductible: number;
  deductibleMet: number;
  maxOop: number;
  maxOopMet: number;
  /** When true the OOP can never be met (Max OOP & Max OOP Met are ignored). */
  oopUnlimited: boolean;
  /** Co-Insurance % After Deductible to Provider (0-100). */
  providerPct: number;
  /** Co-Insurance % After Deductible to Patient (0-100). */
  patientPct: number;
  /** Payment After OOP is Met (0-100). */
  afterOopPct: number;
  /** Is Deductible Included in OOP? */
  deductibleIncludedInOop: boolean;
  /** How the day the OOP gets met is paid. See {@link CROSSING_METHOD_HELP}. */
  crossingMethod: CrossingMethod;
  levelsOfCare: LevelOfCareInput[];
}

export type DayEvent = 'deductible-met' | 'oop-met';

export interface DayResult {
  day: number;
  loc: string;
  rate: number;
  /** Amount the facility receives for this day. */
  payment: number;
  /** Amount applied to the patient's responsibility (deductible + OOP) this day. */
  patientResponsibility: number;
  /** Deductible remaining at the end of the day. */
  remainingDeductible: number;
  /**
   * OOP remaining at the end of the day (includes the remaining deductible when the
   * deductible is included in OOP); `null` means Unlimited.
   */
  remainingOop: number | null;
  events: DayEvent[];
}

export interface CalculatorResult {
  days: DayResult[];
  totalPayment: number;
  totalBilled: number;
  totalPatientResponsibility: number;
}

export const CROSSING_METHOD_HELP: Record<CrossingMethod, string> = {
  A:
    'Method A (original): on the day the OOP is met the facility gets its co-insurance % of the ' +
    'whole rate, plus "Payment After OOP" % of the patient-share overshoot. ' +
    'Example: $300 rate, 60/40 split, $100 OOP left, 40% after OOP → patient share $120 ' +
    '(overshoot $20) → $180 + 40% × $20 = $188.',
  B:
    'Method B (proportional): only the part of the rate needed to finish the OOP is split by ' +
    'co-insurance; the rest of that day is paid at "Payment After OOP" %. ' +
    'Example: $300 rate, 60/40 split, $100 OOP left, 40% after OOP → $250 of the rate finishes ' +
    'the OOP (40% × $250 = $100) → 60% × $250 + 40% × $50 = $150 + $20 = $170.',
};

const toCents = (dollars: number): number => Math.round((Number(dollars) || 0) * 100);
const toDollars = (cents: number): number => Math.round(cents) / 100;
const pct = (cents: number, percent: number): number => Math.round((cents * percent) / 100);

export function calculateReimbursement(input: CalculatorInput): CalculatorResult {
  const providerPct = clampPct(input.providerPct);
  const patientPct = clampPct(input.patientPct);
  const afterOopPct = clampPct(input.afterOopPct);

  // Remaining patient responsibility (in cents).
  let dedLeft = Math.max(0, toCents(input.deductible) - toCents(input.deductibleMet));
  let oopLeft: number;

  if (input.oopUnlimited) {
    oopLeft = Number.POSITIVE_INFINITY;
  } else {
    const oopRemaining = Math.max(0, toCents(input.maxOop) - toCents(input.maxOopMet));
    if (input.deductibleIncludedInOop) {
      // Max OOP Met already includes Deductible Met, so subtract only the deductible still owed.
      // The deductible can never exceed what is left of an OOP that includes it.
      dedLeft = Math.min(dedLeft, oopRemaining);
      oopLeft = oopRemaining - dedLeft;
    } else {
      oopLeft = oopRemaining;
    }
  }

  const days: DayResult[] = [];
  let dayNumber = 0;

  for (const loc of input.levelsOfCare) {
    const rateCents = toCents(loc.rate);
    const dayCount = Math.max(0, Math.floor(Number(loc.days) || 0));

    for (let i = 0; i < dayCount; i++) {
      dayNumber++;
      const events: DayEvent[] = [];
      let remaining = rateCents;
      let payment = 0;
      let patient = 0;

      // 1. Deductible phase
      if (dedLeft > 0 && remaining > 0) {
        const take = Math.min(remaining, dedLeft);
        dedLeft -= take;
        remaining -= take;
        patient += take;
        if (dedLeft === 0) events.push('deductible-met');
      }

      if (remaining > 0) {
        if (oopLeft > 0) {
          // 2. OOP phase – co-insurance split
          const patientShare = pct(remaining, patientPct);
          if (patientShare <= oopLeft) {
            oopLeft -= patientShare;
            patient += patientShare;
            payment += pct(remaining, providerPct);
            if (oopLeft === 0) events.push('oop-met');
          } else {
            // OOP is met part-way through this day.
            if (input.crossingMethod === 'B') {
              const rateNeeded = Math.round((oopLeft * 100) / patientPct);
              payment += pct(rateNeeded, providerPct) + pct(remaining - rateNeeded, afterOopPct);
            } else {
              const overshoot = patientShare - oopLeft;
              payment += pct(remaining, providerPct) + pct(overshoot, afterOopPct);
            }
            patient += oopLeft;
            oopLeft = 0;
            events.push('oop-met');
          }
        } else {
          // 3. Post-OOP phase
          payment += pct(remaining, afterOopPct);
        }
      }

      days.push({
        day: dayNumber,
        loc: loc.name,
        rate: toDollars(rateCents),
        payment: toDollars(payment),
        patientResponsibility: toDollars(patient),
        remainingDeductible: toDollars(dedLeft),
        // When the deductible is part of the OOP, show the full OOP still owed (incl. deductible).
        remainingOop: Number.isFinite(oopLeft)
          ? toDollars(oopLeft + (input.deductibleIncludedInOop ? dedLeft : 0))
          : null,
        events,
      });
    }
  }

  const sum = (pick: (d: DayResult) => number) =>
    toDollars(days.reduce((acc, d) => acc + toCents(pick(d)), 0));

  return {
    days,
    totalPayment: sum((d) => d.payment),
    totalBilled: sum((d) => d.rate),
    totalPatientResponsibility: sum((d) => d.patientResponsibility),
  };
}

function clampPct(value: number): number {
  const n = Number(value) || 0;
  return Math.min(100, Math.max(0, n));
}
