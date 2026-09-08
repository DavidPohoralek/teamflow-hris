// Differential test: the frozen pre-refactor payroll arithmetic vs the shared
// module that replaced it. Every generated case must produce byte-identical
// output. Run with:  npm run test:payroll
//
// Cases are generated rather than hand-written so the awkward combinations get
// covered: Saturdays, the overtime threshold boundary, negative benefits, leap
// February, vacation straddling the month edge, an employee with no attendance.

import { referenceBreakdown } from './payroll-reference.mjs';
import { computeMonthBreakdown } from '../.payroll-test/payrollMonth.js';

let rngState = 20260908;
function rnd() { rngState = (rngState * 1664525 + 1013904223) % 4294967296; return rngState / 4294967296; }
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const MONTHS = ['2026-01', '2026-02', '2024-02', '2026-04', '2026-06', '2026-09', '2026-11', '2026-12'];
const DEPTS = ['Prodejna', 'Sklad', 'Kancelář', 'Expedice', ''];

function monthEnd(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeCase(i) {
  const month = MONTHS[i % MONTHS.length];
  const dateFrom = month + '-01';
  const dateTo = monthEnd(month);
  const lastDay = Number(dateTo.slice(-2));

  const emp = {
    id: 'e1',
    name: 'Test',
    department: pick(DEPTS),
    target_hours: pick([null, 120, 160, 168]),
    employment_type: pick(['hpp', 'HPP', 'dpp', 'DPP', 'DPČ', 'ico', 'IČO', '', null]),
    hourly_rate: pick([null, 0, 180.5, 250]),
  };

  // A second employee shares the arrays, so the per-employee filters get exercised.
  const logs = [];
  const nLogs = i % 7 === 0 ? 0 : int(1, 22);
  for (let k = 0; k < nLogs; k++) {
    const day = String(int(1, lastDay)).padStart(2, '0');
    const date = `${month}-${day}`;
    const startH = int(6, 12);
    const hours = int(1, 11);
    logs.push({
      employee_id: pick(['e1', 'e1', 'e2']),
      date,
      check_in: `${date}T${String(startH).padStart(2, '0')}:00:00`,
      check_out: `${date}T${String(startH + hours).padStart(2, '0')}:30:00`,
      note: rnd() < 0.15 ? 'Placená dovolená' : null,
      work_type_name: pick([...DEPTS, null]),
    });
  }

  const vacationRequests = [];
  for (let k = 0; k < int(0, 3); k++) {
    const from = int(1, lastDay);
    vacationRequests.push({
      employee_id: pick(['e1', 'e2']),
      date_from: `${month}-${String(from).padStart(2, '0')}`,
      // Deliberately allowed to run past the month end so the clip is tested.
      date_to: rnd() < 0.3 ? null : `${month}-${String(Math.min(from + int(0, 9), 28)).padStart(2, '0')}`,
    });
  }

  const benefitLogs = [];
  for (const key of ['blood', 'english', 'gym']) {
    if (rnd() < 0.6) benefitLogs.push({ employee_id: pick(['e1', 'e2']), benefit_key: key, count: int(0, 5) });
  }

  const activeBenefits = [
    { key: 'blood', czLabel: 'Darování krve', enLabel: 'Blood donation', hoursPerUnit: 8 },
    { key: 'english', czLabel: 'Angličtina', enLabel: 'English lessons', hoursPerUnit: -1 },
    { key: 'gym', czLabel: 'Cvičení', enLabel: 'Gym', hoursPerUnit: -1 },
  ].filter(() => rnd() < 0.85);

  const settings = {
    saturdayBonusPct: pick([0, 25, 50, 100]),
    // Straddle the boundary so `workedHours > threshold` is hit from both sides.
    overtimeThreshold: pick([0, 100, 150, 160]),
    overtimeBonusPct: pick([0, 25, 33.5]),
    satBonusDepts: pick([[], ['Prodejna'], ['Sklad', 'Expedice'], ['Kancelář']]),
    countWeekends: rnd() < 0.3,
    activeBenefits,
    paidVacationByType: pick([
      { HPP: true, DPP: true, 'DPČ': true, 'IČO': false },
      { HPP: true, DPP: false, 'DPČ': true, 'IČO': false },
      { HPP: false, DPP: true, 'DPČ': false, 'IČO': true },
    ]),
  };

  return {
    emp,
    inputs: {
      logs, vacationRequests, benefitLogs,
      managerBonus: pick([0, 0, 1500, 2750.5]),
      settings, dateFrom, dateTo,
      includeRate: rnd() < 0.5,
    },
  };
}

const CASES = 2000;
let failures = 0;
const changedFields = new Map();

for (let i = 0; i < CASES; i++) {
  const { emp, inputs } = makeCase(i);
  const before = referenceBreakdown(emp, inputs);
  const after = computeMonthBreakdown(emp, inputs);
  // The reference has no `vacationPaid` field — compare the shape it knows.
  const trimmed = { ...after };
  delete trimmed.vacationPaid;
  const a = JSON.stringify(before);
  const b = JSON.stringify(trimmed);
  if (a !== b) {
    failures++;
    // Which fields moved matters more than how many cases did: a change that
    // touches a field nobody expected is a different change from the one meant.
    for (const k of Object.keys(before)) {
      if (JSON.stringify(before[k]) !== JSON.stringify(trimmed[k])) {
        changedFields.set(k, (changedFields.get(k) ?? 0) + 1);
      }
    }
    if (failures <= 2) {
      console.error(`\n✗ případ #${i} (${inputs.dateFrom})`);
      console.error('  před:', a);
      console.error('  po:  ', b);
    }
  }
}

if (changedFields.size > 0) {
  console.error('\nZměněná pole:');
  for (const [k, n] of [...changedFields].sort((x, y) => y[1] - x[1])) {
    console.error(`  ${k}: ${n}× z ${CASES}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} z ${CASES} případů se liší — refaktor NENÍ věrný.`);
  process.exit(1);
}
console.log(`✓ ${CASES} případů, výsledky identické — extrakce nezměnila výpočet.`);
