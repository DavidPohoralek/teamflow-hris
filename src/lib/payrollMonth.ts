// One month of one employee, the way payroll counts it.
//
// This is the arithmetic that used to live inline in the Excel export. It is
// shared so the employee-facing breakdown and the payroll export can never
// drift apart — an employee checking their own hours has to arrive at the same
// number the accountant does, or the feature makes disputes worse, not better.
//
// Extracted verbatim: no rule was changed while moving it. Anything that looks
// wrong here is behaviour that already shipped; fix it in its own commit so the
// change is visible, never as a side effect of a refactor.

import { countUniqueVacationDays, VACATION_LOG_NOTE } from './vacationDays';

export interface BenefitDef {
  key: string;
  czLabel: string;
  enLabel: string;
  hoursPerUnit: number;
}

export interface PayrollSettings {
  saturdayBonusPct: number;
  overtimeThreshold: number;
  overtimeBonusPct: number;
  /** Empty = every department qualifies for the Saturday bonus. */
  satBonusDepts: string[];
  countWeekends: boolean;
  activeBenefits: BenefitDef[];
  /**
   * Which employment types get vacation paid, keyed UPPERCASE. Same source the
   * vacation balances use (company_settings.employment_type_configs), so the
   * number an employee sees and the money payroll pays follow one rule.
   */
  paidVacationByType: Record<string, boolean>;
}

export interface PayrollEmployee {
  id: string;
  name?: string | null;
  department?: string | null;
  target_hours?: number | null;
  employment_type?: string | null;
  hourly_rate?: number | null;
}

export interface PayrollLog {
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  note?: string | null;
  work_type_name?: string | null;
}

export interface PayrollVacationRequest {
  employee_id: string;
  date_from: string;
  date_to: string | null;
}

export interface PayrollBenefitLog {
  employee_id: string;
  benefit_key: string;
  count: number;
}

export interface MonthInputs {
  logs: PayrollLog[];
  vacationRequests: PayrollVacationRequest[];
  benefitLogs: PayrollBenefitLog[];
  managerBonus: number;
  settings: PayrollSettings;
  /** Month window as YYYY-MM-DD, inclusive. */
  dateFrom: string;
  dateTo: string;
  /** Hourly rate is admin-only; omit to leave the money fields null. */
  includeRate?: boolean;
}

export interface MonthBreakdown {
  hasAttendance: boolean;
  workedHours: number;
  saturdayHours: number;
  satBonusHours: number;
  otBonusHours: number;
  benefitHours: Record<string, number>;
  totalBenefitHours: number;
  totalBonusHours: number;
  finalHours: number;
  targetHours: number;
  delta: number;
  vacationPaid: boolean;
  vacHours: number;
  finalWithVac: number;
  managerBonus: number;
  hourlyRate: number | null;
  billableTotal: number | null;
}

const BENEFIT_DEFS: Omit<BenefitDef, 'hoursPerUnit'>[] = [
  { key: 'blood', czLabel: 'Darování krve', enLabel: 'Blood donation' },
  { key: 'english', czLabel: 'Angličtina', enLabel: 'English lessons' },
  { key: 'gym', czLabel: 'Cvičení', enLabel: 'Gym' },
];

/** Reads the payroll rules out of company_settings.extra_settings. */
export function parsePayrollSettings(extra: Record<string, unknown>): PayrollSettings {
  const num = (k: string): number =>
    typeof extra[k] === 'number' ? (extra[k] as number) : Number(extra[k] ?? 0);

  return {
    saturdayBonusPct: num('bonus_saturday_pct'),
    overtimeThreshold: num('bonus_overtime_threshold'),
    overtimeBonusPct: num('bonus_overtime_pct'),
    satBonusDepts: Array.isArray(extra['bonus_saturday_departments'])
      ? (extra['bonus_saturday_departments'] as string[])
      : [],
    countWeekends: (extra['vacation_counting_mode'] as string | undefined) === 'all',
    // A benefit counts only once the company has given it an hour value.
    activeBenefits: BENEFIT_DEFS
      .filter((b) => extra[`benefit_${b.key}_hours`] != null)
      .map((b) => ({ ...b, hoursPerUnit: Number(extra[`benefit_${b.key}_hours`]) })),
    paidVacationByType: parsePaidVacation(extra),
  };
}

/**
 * Defaults when a company has not configured a type, keyed UPPERCASE.
 *
 * A default, not a legal opinion: entitlement for the Czech agreements has
 * moved in recent years, so a company that needs it different sets it in
 * Správa → Nastavení and that choice wins.
 */
export const DEFAULT_PAID_VACATION: Record<string, boolean> = {
  HPP: true, DPP: false, 'DPČ': true, 'IČO': false,
};

export function parsePaidVacation(extra: Record<string, unknown>): Record<string, boolean> {
  const configs = (extra['employment_type_configs'] as Record<string, { paidVacation?: boolean }> | undefined) ?? {};
  const out: Record<string, boolean> = { ...DEFAULT_PAID_VACATION };
  for (const [type, cfg] of Object.entries(configs)) {
    if (typeof cfg?.paidVacation === 'boolean') out[type.toUpperCase()] = cfg.paidVacation;
  }
  return out;
}

/**
 * Whether this employee's vacation hours are paid.
 *
 * Case-insensitive on purpose: the column holds both 'HPP' and 'hpp' — the
 * export carries a legacy map for exactly that reason — and the old check
 * compared against lowercase only, so every employee stored uppercase silently
 * lost their paid vacation in the money column.
 */
export function isVacationPaid(employmentType: string | null | undefined, settings: PayrollSettings): boolean {
  const key = (employmentType ?? '').toUpperCase();
  return settings.paidVacationByType[key] ?? true;
}

/**
 * Same answer for callers that hold raw company_settings.extra_settings rather
 * than parsed PayrollSettings — the vacation balances and the approval path.
 * They each used to carry their own copy of the table, all of them
 * case-sensitive, which is how payroll and the balances drifted apart.
 */
export function vacationPaidFor(
  employmentType: string | null | undefined,
  extra: Record<string, unknown>,
): boolean {
  return parsePaidVacation(extra)[(employmentType ?? '').toUpperCase()] ?? true;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const isSaturday = (dateStr: string) => new Date(dateStr + 'T00:00:00').getDay() === 6;

export function computeMonthBreakdown(emp: PayrollEmployee, inputs: MonthInputs): MonthBreakdown {
  const { logs, vacationRequests, benefitLogs, managerBonus, settings, dateFrom, dateTo } = inputs;
  const { saturdayBonusPct, overtimeThreshold, overtimeBonusPct, satBonusDepts, countWeekends, activeBenefits } = settings;

  // Auto-inserted vacation logs are EXCLUDED from worked hours — vacation is
  // counted separately from requests (vacHours); including both doubled it.
  const empLogs = logs.filter(
    (l) => l.employee_id === emp.id && l.check_in && l.check_out && l.note !== VACATION_LOG_NOTE,
  );
  const hasAttendance = empLogs.length > 0;

  const empDept = emp.department ?? '';
  let workedMinutes = 0;
  let saturdayMinutes = 0;
  let satBonusMinutes = 0;
  for (const l of empLogs) {
    const mins = Math.round((new Date(l.check_out as string).getTime() - new Date(l.check_in as string).getTime()) / 60000);
    workedMinutes += mins;
    if (isSaturday(l.date)) {
      saturdayMinutes += mins;
      if (saturdayBonusPct > 0) {
        const logType = l.work_type_name ?? '';
        const eligible = satBonusDepts.length === 0
          || satBonusDepts.includes(empDept)
          || satBonusDepts.includes(logType);
        if (eligible) satBonusMinutes += mins;
      }
    }
  }

  const workedHours = workedMinutes / 60;
  const saturdayHours = saturdayMinutes / 60;
  const satBonusHours = satBonusMinutes / 60 * (saturdayBonusPct / 100);

  let otBonusHours = 0;
  if (overtimeThreshold > 0 && workedHours > overtimeThreshold) {
    otBonusHours = (workedHours - overtimeThreshold) * (overtimeBonusPct / 100);
  }

  const targetHours = emp.target_hours ?? 160;

  const empBenefitLogs = benefitLogs.filter((bl) => bl.employee_id === emp.id);
  const benefitHours: Record<string, number> = {};
  let totalBenefitHours = 0;
  for (const b of activeBenefits) {
    const log = empBenefitLogs.find((bl) => bl.benefit_key === b.key);
    const h = log ? r2(log.count * b.hoursPerUnit) : 0;
    benefitHours[b.key] = h;
    totalBenefitHours += h;
  }
  totalBenefitHours = r2(totalBenefitHours);

  const totalBonusHours = r2(satBonusHours + otBonusHours + totalBenefitHours);

  // Benefit hours carry their own sign (blood +8/unit, gym/english −1/unit),
  // so everything is ADDED — subtracting a negative would double-count.
  // The three keys are named explicitly, as in the original: a benefit outside
  // this list would be reported but not paid. Preserved deliberately.
  const finalHours = r2(
    workedHours + satBonusHours + otBonusHours
    + (benefitHours['blood'] ?? 0)
    + (benefitHours['gym'] ?? 0)
    + (benefitHours['english'] ?? 0),
  );

  const vacHours = countUniqueVacationDays(
    vacationRequests.filter((r) => r.employee_id === emp.id),
    countWeekends,
    { start: dateFrom, end: dateTo },
  ) * 8;

  const hourlyRate = inputs.includeRate ? (emp.hourly_rate ?? null) : null;
  const vacationPaid = isVacationPaid(emp.employment_type, settings);
  // Payroll total = final hours × rate + manager bonus (CZK)
  // Vacation hours are paid at the hourly rate only where the type earns them.
  const billableTotal = hourlyRate != null
    ? r2((finalHours + (vacationPaid ? vacHours : 0)) * hourlyRate + managerBonus)
    : null;

  return {
    hasAttendance,
    workedHours: r2(workedHours),
    saturdayHours: r2(saturdayHours),
    satBonusHours: r2(satBonusHours),
    otBonusHours: r2(otBonusHours),
    benefitHours,
    totalBenefitHours,
    totalBonusHours,
    finalHours,
    targetHours,
    delta: r2(workedHours - targetHours),
    vacationPaid,
    vacHours,
    // Hours a type does not earn are not added to the payable figure either —
    // this used to add them for everyone, so contractors looked overpaid.
    finalWithVac: r2(finalHours + (vacationPaid ? vacHours : 0)),
    managerBonus,
    hourlyRate,
    billableTotal,
  };
}
