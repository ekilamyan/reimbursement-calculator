import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { LEVEL_OF_CARE_OPTIONS, PRESET_VALUES } from './preset';
import {
  CROSSING_METHOD_HELP,
  CalculatorResult,
  CrossingMethod,
  calculateReimbursement,
} from './reimbursement-engine';

type LocGroup = FormGroup<{
  name: FormControl<string | null>;
  rate: FormControl<number | null>;
  days: FormControl<number | null>;
}>;

const coInsuranceSumValidator = (group: AbstractControl): ValidationErrors | null => {
  const provider = group.get('providerPct')?.value;
  const patient = group.get('patientPct')?.value;
  if (provider == null || patient == null) return null;
  return Math.abs(provider + patient - 100) > 0.0001 ? { coInsuranceSum: true } : null;
};

@Component({
  selector: 'app-reimbursement-calculator',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    ButtonModule,
    InputNumberModule,
    MessageModule,
    SelectModule,
    SelectButtonModule,
    TableModule,
    ToggleSwitchModule,
    TooltipModule,
  ],
  templateUrl: './reimbursement-calculator.html',
  styleUrl: './reimbursement-calculator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReimbursementCalculator {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly locOptions = LEVEL_OF_CARE_OPTIONS;
  protected readonly yesNoOptions = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ];
  protected readonly methodOptions: { label: string; value: CrossingMethod }[] = [
    { label: 'Method A (original)', value: 'A' },
    { label: 'Method B (proportional)', value: 'B' },
  ];
  protected readonly methodHelp = CROSSING_METHOD_HELP;

  protected readonly form = new FormGroup(
    {
      deductible: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
      deductibleMet: new FormControl<number | null>(0, Validators.min(0)),
      maxOop: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
      maxOopMet: new FormControl<number | null>(0, Validators.min(0)),
      oopUnlimited: new FormControl<boolean>(false, { nonNullable: true }),
      providerPct: new FormControl<number | null>(null, Validators.required),
      patientPct: new FormControl<number | null>(null, Validators.required),
      afterOopPct: new FormControl<number | null>(100, Validators.required),
      deductibleIncludedInOop: new FormControl<boolean>(false, { nonNullable: true }),
      crossingMethod: new FormControl<CrossingMethod>('A', { nonNullable: true }),
      levelsOfCare: new FormArray<LocGroup>([this.createLoc()]),
    },
    { validators: coInsuranceSumValidator },
  );

  protected readonly result = signal<CalculatorResult | null>(null);
  protected readonly stale = signal(false);
  protected readonly submitted = signal(false);

  constructor() {
    const { providerPct, patientPct, oopUnlimited } = this.form.controls;

    // Co-insurance percentages always add up to 100%.
    providerPct.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => {
      if (v != null && v >= 0 && v <= 100) patientPct.setValue(100 - v, { emitEvent: false });
    });
    patientPct.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => {
      if (v != null && v >= 0 && v <= 100) providerPct.setValue(100 - v, { emitEvent: false });
    });

    // Both "Unlimited" switches share one control; it disables Max OOP and Max OOP Met.
    oopUnlimited.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((unlimited) => {
        // A view change only updates the switch that was clicked; re-push so both switches match.
        oopUnlimited.setValue(unlimited, { emitEvent: false });
        this.applyUnlimited(unlimited);
      });

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.result()) this.stale.set(true);
    });
  }

  protected get locs(): FormArray<LocGroup> {
    return this.form.controls.levelsOfCare;
  }

  protected addLoc(): void {
    this.locs.push(this.createLoc());
  }

  protected removeLoc(index: number): void {
    this.locs.removeAt(index);
  }

  protected calculate(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.locs.length === 0) return;

    const v = this.form.getRawValue();
    this.result.set(
      calculateReimbursement({
        deductible: v.deductible ?? 0,
        deductibleMet: v.deductibleMet ?? 0,
        maxOop: v.maxOop ?? 0,
        maxOopMet: v.maxOopMet ?? 0,
        oopUnlimited: v.oopUnlimited,
        providerPct: v.providerPct ?? 0,
        patientPct: v.patientPct ?? 0,
        afterOopPct: v.afterOopPct ?? 0,
        deductibleIncludedInOop: v.deductibleIncludedInOop,
        crossingMethod: v.crossingMethod,
        levelsOfCare: v.levelsOfCare.map((l) => ({
          name: l.name ?? '',
          rate: l.rate ?? 0,
          days: l.days ?? 0,
        })),
      }),
    );
    this.stale.set(false);
  }

  protected clear(): void {
    this.locs.clear({ emitEvent: false });
    this.locs.push(this.createLoc(), { emitEvent: false });
    this.form.reset({
      deductible: null,
      deductibleMet: 0,
      maxOop: null,
      maxOopMet: 0,
      oopUnlimited: false,
      providerPct: null,
      patientPct: null,
      afterOopPct: 100,
      deductibleIncludedInOop: false,
      crossingMethod: this.form.controls.crossingMethod.value,
    });
    this.result.set(null);
    this.stale.set(false);
    this.submitted.set(false);
  }

  protected preset(): void {
    const p = PRESET_VALUES;
    this.locs.clear({ emitEvent: false });
    for (const loc of p.levelsOfCare) {
      this.locs.push(this.createLoc(loc.name, loc.rate, loc.days), { emitEvent: false });
    }
    this.form.patchValue({
      deductible: p.deductible,
      deductibleMet: p.deductibleMet,
      maxOop: p.maxOop,
      maxOopMet: p.maxOopMet,
      oopUnlimited: p.oopUnlimited,
      providerPct: p.providerPct,
      patientPct: p.patientPct,
      afterOopPct: p.afterOopPct,
      deductibleIncludedInOop: p.deductibleIncludedInOop,
    });
  }

  protected showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted());
  }

  private applyUnlimited(unlimited: boolean): void {
    const { maxOop, maxOopMet } = this.form.controls;
    if (unlimited) {
      // Empty values let the "Unlimited" placeholder show in both fields.
      maxOop.setValue(null, { emitEvent: false });
      maxOopMet.setValue(null, { emitEvent: false });
      maxOop.disable({ emitEvent: false });
      maxOopMet.disable({ emitEvent: false });
    } else if (maxOop.disabled) {
      maxOop.enable({ emitEvent: false });
      maxOopMet.enable({ emitEvent: false });
      if (maxOopMet.value == null) maxOopMet.setValue(0, { emitEvent: false });
    }
  }

  private createLoc(name: string | null = null, rate: number | null = null, days: number | null = null): LocGroup {
    return new FormGroup({
      name: new FormControl<string | null>(name, Validators.required),
      rate: new FormControl<number | null>(rate, [Validators.required, Validators.min(0)]),
      days: new FormControl<number | null>(days, [Validators.required, Validators.min(1)]),
    });
  }
}
