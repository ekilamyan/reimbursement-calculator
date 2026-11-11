/**
 * Values used by the "Preset" button.
 *
 * In the full portal these come from the processed VOB (deductible / OOP section) and the
 * provider's Level of Care rates. Until that integration exists, this constant stands in
 * for that data — replace it with a service call when wiring to a real backend.
 * (Currently mirrors Example 7.)
 */
export const PRESET_VALUES = {
  deductible: 500,
  deductibleMet: 0,
  maxOop: 1000,
  maxOopMet: 0,
  oopUnlimited: false,
  providerPct: 60,
  patientPct: 40,
  afterOopPct: 60,
  deductibleIncludedInOop: true,
  levelsOfCare: [
    { name: 'DTX', rate: 300, days: 5 },
    { name: 'RTC', rate: 400, days: 6 },
  ],
};

export const LEVEL_OF_CARE_OPTIONS: string[] = [
  'DTX',
  'RTC',
  'PHP',
  'IOP',
  'OP-IND',
  'OP-GRP',
  'TMS',
  'Office Visit',
  'Psychiatric Evaluation',
  'Initial Mapping',
  'Remapping',
  'Concurrent Treatment',
  'Other',
];
