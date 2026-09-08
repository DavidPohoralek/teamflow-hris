// FROZEN COPY of the payroll arithmetic as it stood in
// src/app/api/analytics/export/route.ts before it was extracted into
// src/lib/payrollMonth.ts (commit 8fbfa31, 8. 9. 2026).
//
// It exists for one purpose: to prove the extraction changed nothing. Do not
// "improve" it and do not keep it in sync with later fixes — the moment it
// stops describing the old behaviour it stops being evidence.

const VACATION_LOG_NOTE = 'Placená dovolená';

function toISODateLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function eachDayISO(dateFrom, dateTo) {
  const to = dateTo && dateTo > dateFrom ? dateTo : dateFrom;
  const days = [];
  const cur = new Date(dateFrom + 'T12:00:00');
  let iso = toISODateLocal(cur);
  while (iso <= to && days.length < 1100) { days.push(iso); cur.setDate(cur.getDate() + 1); iso = toISODateLocal(cur); }
  return days;
}
function isWeekendISO(iso) { const d = new Date(iso + 'T12:00:00').getDay(); return d === 0 || d === 6; }
function countUniqueVacationDays(requests, countWeekends, clip) {
  const set = new Set();
  for (const r of requests) {
    for (const iso of eachDayISO(r.date_from, r.date_to)) {
      if (!countWeekends && isWeekendISO(iso)) continue;
      if (clip?.start && iso < clip.start) continue;
      if (clip?.end && iso > clip.end) continue;
      set.add(iso);
    }
  }
  return set.size;
}

export function referenceBreakdown(emp, inputs) {
  const { logs, vacationRequests, benefitLogs, managerBonus, settings, dateFrom, dateTo, includeRate } = inputs;
  const { saturdayBonusPct, overtimeThreshold, overtimeBonusPct, satBonusDepts, countWeekends, activeBenefits } = settings;

  function isSat(dateStr) { return new Date(dateStr + 'T00:00:00').getDay() === 6; }
  function countVacHoursInMonth(empId) {
    return countUniqueVacationDays(
      vacationRequests.filter((r) => r.employee_id === empId),
      countWeekends,
      { start: dateFrom, end: dateTo },
    ) * 8;
  }

  const empLogs = logs.filter((l) => l.employee_id === emp.id && l.check_in && l.check_out && l.note !== VACATION_LOG_NOTE);
  const hasAttendance = empLogs.length > 0;

  const empDept = emp.department ?? '';
  let workedMinutes = 0, saturdayMinutes = 0, satBonusMinutes = 0;
  for (const l of empLogs) {
    const mins = Math.round((new Date(l.check_out).getTime() - new Date(l.check_in).getTime()) / 60000);
    workedMinutes += mins;
    if (isSat(l.date)) {
      saturdayMinutes += mins;
      if (saturdayBonusPct > 0) {
        const logType = l.work_type_name ?? '';
        const eligible = satBonusDepts.length === 0 || satBonusDepts.includes(empDept) || satBonusDepts.includes(logType);
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
  const benefitHours = {};
  let totalBenefitHours = 0;
  for (const b of activeBenefits) {
    const log = empBenefitLogs.find((bl) => bl.benefit_key === b.key);
    const h = log ? Math.round(log.count * b.hoursPerUnit * 100) / 100 : 0;
    benefitHours[b.key] = h;
    totalBenefitHours += h;
  }
  totalBenefitHours = Math.round(totalBenefitHours * 100) / 100;
  const totalBonusHours = Math.round((satBonusHours + otBonusHours + totalBenefitHours) * 100) / 100;

  const finalHours = Math.round((
    workedHours + satBonusHours + otBonusHours
    + (benefitHours['blood'] ?? 0) + (benefitHours['gym'] ?? 0) + (benefitHours['english'] ?? 0)
  ) * 100) / 100;

  const hourlyRate = includeRate ? (emp.hourly_rate ?? null) : null;
  const vacHours = countVacHoursInMonth(emp.id);
  const isHPP = (emp.employment_type ?? '') === 'hpp';
  const billableTotal = hourlyRate != null
    ? Math.round(((finalHours + (isHPP ? vacHours : 0)) * hourlyRate + managerBonus) * 100) / 100
    : null;

  return {
    hasAttendance,
    workedHours: Math.round(workedHours * 100) / 100,
    saturdayHours: Math.round(saturdayHours * 100) / 100,
    satBonusHours: Math.round(satBonusHours * 100) / 100,
    otBonusHours: Math.round(otBonusHours * 100) / 100,
    benefitHours, totalBenefitHours, totalBonusHours, finalHours, targetHours,
    delta: Math.round((workedHours - targetHours) * 100) / 100,
    vacHours,
    finalWithVac: Math.round((finalHours + vacHours) * 100) / 100,
    managerBonus, hourlyRate, billableTotal,
  };
}
