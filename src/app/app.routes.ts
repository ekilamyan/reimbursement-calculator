import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./calculator/reimbursement-calculator').then((m) => m.ReimbursementCalculator),
    title: 'Reimbursement Calculator',
  },
  { path: '**', redirectTo: '' },
];
