import { OFFICIAL } from './official';
import type { CityInfo } from './cities';

/**
 * Budgets and a German net-pay estimate, computed in code.
 * Payroll parameters are for 2026 where known (see research/knowledge.md); the result is labelled an estimate.
 */
export const PAYROLL = {
  year: 2026,
  grundfreibetrag: 12348,
  pension: 0.093, // employee share
  unemployment: 0.013,
  health: 0.073, // general rate, employee half
  healthExtra: 0.0145, // half of the average Zusatzbeitrag
  care: 0.018,
  careChildless: 0.006,
  werbungskosten: 1230,
  sonderausgaben: 36,
};

/** §32a EStG income tax for one person (tax class I). Zone limits shift with the Grundfreibetrag. */
export function incomeTax(zvE: number): number {
  const x = Math.floor(zvE);
  const g = PAYROLL.grundfreibetrag;
  if (x <= g) return 0;
  if (x <= 17799) {
    const y = (x - g) / 10000;
    return Math.floor((914.51 * y + 1400) * y);
  }
  if (x <= 69878) {
    const z = (x - 17799) / 10000;
    return Math.floor((173.1 * z + 2397) * z + 1034.87);
  }
  if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}

export interface NetPay {
  gross: number;
  net: number;
  lines: { label: string; amount: number }[];
  note: string;
}

export function netPay(grossMonthly: number, opts: { childless?: boolean } = {}): NetPay {
  const p = PAYROLL;
  const g = grossMonthly;
  const pension = g * p.pension;
  const unemployment = g * p.unemployment;
  const health = g * (p.health + p.healthExtra);
  const care = g * (p.care + (opts.childless !== false ? p.careChildless : 0));
  // Simplified Vorsorgepauschale: social contributions mostly deductible.
  const annualTaxable = Math.max(0, 12 * (g - pension - health - care) - p.werbungskosten - p.sonderausgaben);
  const tax = incomeTax(annualTaxable) / 12;
  const lines = [
    { label: 'Income tax (class I)', amount: -round(tax) },
    { label: 'Pension insurance', amount: -round(pension) },
    { label: 'Health insurance', amount: -round(health) },
    { label: 'Long-term care insurance', amount: -round(care) },
    { label: 'Unemployment insurance', amount: -round(unemployment) },
  ];
  const net = round(g + lines.reduce((s, l) => s + l.amount, 0));
  return { gross: g, net, lines, note: `Estimate for ${p.year}, tax class I, no church tax. Your real payslip may differ slightly.` };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export interface BudgetLine {
  label: string;
  amount: number;
  note?: string;
}

export function monthlyBudget(city: CityInfo, kind: 'student' | 'worker'): { lines: BudgetLine[]; total: number } {
  const lines: BudgetLine[] = [
    { label: kind === 'student' ? 'Room in a shared flat (WG)' : 'Room or small flat', amount: kind === 'student' ? city.wgRoom : Math.round((city.wgRoom + city.studio) / 2), note: `average for ${city.name}` },
    ...(kind === 'student' ? [{ label: 'Health insurance (students)', amount: OFFICIAL.student_health.amount!, note: 'public insurance' }] : []),
    { label: 'Food and groceries', amount: kind === 'student' ? 250 : 300 },
    { label: 'Deutschlandticket (all local transport)', amount: OFFICIAL.deutschlandticket.amount! },
    { label: 'Phone and internet', amount: 25 },
    { label: 'Broadcasting fee (share of flat)', amount: Math.round((OFFICIAL.rundfunk.amount! / 2) * 100) / 100, note: 'Rundfunkbeitrag, split between flatmates' },
    { label: 'Other (clothes, leisure)', amount: 80 },
  ];
  return { lines, total: Math.round(lines.reduce((s, l) => s + l.amount, 0)) };
}
