import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';

async function getOrgDlcToken(supabase: unknown, orgId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('dlc_licenses')
    .select('token, active, expires_at')
    .eq('org_id', orgId)
    .eq('dlc_key', 'shift_assistant')
    .maybeSingle();

  if (!data || !data.active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data.token as string;
}

export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, isAdmin, permissions } = resolved;

  // ── RBAC gate — scoped managers need shift_assistant permission ────────────
  if (!isAdmin && !permissions.includes('shift_assistant')) {
    return NextResponse.json(
      { error: 'Nemáte oprávnění k Asistentovi směn. Kontaktujte administrátora.' },
      { status: 403 },
    );
  }

  // ── License gate ──────────────────────────────────────────────────────────
  const dlcToken = await getOrgDlcToken(supabase, orgId);
  if (!dlcToken) {
    return NextResponse.json(
      { error: 'Asistent směn není aktivován. Dokupte licenci na helvetiplanovac.cz/assistant', licensed: false },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const draft = (searchParams.get('draft') ?? 'A').toUpperCase() === 'B' ? 'B' : 'A';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Load all data needed for analysis
  const [empRes, draftRes, absenceRes, wpRes, settingsRes, scheduleDaysRes] = await Promise.all([
    sb.from('employees')
      .select(`id, name, target_hours, labels, can_saturday, saturday_priority,
        max_saturdays, tier, prodejna_tier, employment_type, shift_pattern,
        store_rating, short_long_week`)
      .eq('organization_id', orgId).eq('active', true).order('name'),
    sb.from('work_plans')
      .select('employee_id, date, work_type, start_time, end_time, notes')
      .eq('organization_id', orgId)
      .eq('type', 'draft')
      .eq('draft_label', draft)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
    sb.from('attendance_logs').select('employee_id, date, type, start_time, end_time, notes')
      .eq('organization_id', orgId)
      .eq('type', 'absence')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
    sb.from('work_plans')
      .select('employee_id, date, work_type, start_time, end_time, is_evening')
      .eq('organization_id', orgId)
      .eq('active', true)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
    sb.from('company_settings').select('extra_settings, saturday_logic_enabled').eq('organization_id', orgId).maybeSingle(),
    sb.from('schedule_days')
      .select('date, required_total, day_type, start_time, end_time')
      .eq('organization_id', orgId)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`),
  ]);

  const employees: EmpRecord[] = (empRes.data ?? []).map((e: Record<string, unknown>) => ({
    id: String(e.id),
    name: String(e.name ?? ''),
    targetHours: Number(e.target_hours ?? 160),
    labels: (Array.isArray(e.labels) ? e.labels : []).map(String),
    canSaturday: Boolean(e.can_saturday),
    saturdayPriority: Number(e.saturday_priority ?? 0),
    maxSaturdays: Number(e.max_saturdays ?? 0),
    prodejnaTier: Number(e.prodejna_tier ?? e.tier ?? 0),
    employmentType: String(e.employment_type ?? 'Zaměstnanec'),
    shiftPattern: String(e.shift_pattern ?? 'Standardní'),
    storeRating: Number(e.store_rating ?? 3),
    shortLongWeek: Boolean(e.short_long_week),
  }));

  // Index confirmed (non-draft) shifts by date
  const confirmedByDate: Record<string, {
    count: number; employeeIds: string[];
    shifts: { employeeId: string; workType: string; startTime: string; endTime: string; isEvening: boolean }[];
  }> = {};
  for (const wp of (wpRes.data ?? [])) {
    const d = String(wp.date ?? '').slice(0, 10);
    if (!d) continue;
    if (!confirmedByDate[d]) confirmedByDate[d] = { count: 0, employeeIds: [], shifts: [] };
    confirmedByDate[d].count++;
    if (wp.employee_id) confirmedByDate[d].employeeIds.push(String(wp.employee_id));
    confirmedByDate[d].shifts.push({
      employeeId: String(wp.employee_id ?? ''),
      workType: String(wp.work_type ?? ''),
      startTime: String(wp.start_time ?? ''),
      endTime: String(wp.end_time ?? ''),
      isEvening: Boolean(wp.is_evening),
    });
  }

  const orgSettings = buildSettings(settingsRes.data);
  const draftDays = buildDraftDays(month, draftRes.data ?? [], draft, scheduleDaysRes.data ?? [], confirmedByDate, orgSettings, employees);
  const absences = buildAbsences(absenceRes.data ?? []);

  const workPlans: WorkPlanRecord[] = (wpRes.data ?? []).map((w: Record<string, unknown>) => ({
    employeeId: String(w.employee_id ?? ''),
    date: String(w.date ?? ''),
    workType: String(w.work_type ?? ''),
    startTime: String(w.start_time ?? ''),
    endTime: String(w.end_time ?? ''),
  }));

  // Run local analysis instead of external bot service
  const result = analyzeLocally(month, draft, employees, draftDays, absences, workPlans);
  return NextResponse.json(result);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmpRecord {
  id: string;
  name: string;
  targetHours: number;
  labels: string[];
  canSaturday: boolean;
  saturdayPriority: number;
  maxSaturdays: number;
  prodejnaTier: number;
  employmentType: string;
  shiftPattern: string;
  storeRating: number;
  shortLongWeek: boolean;
}

interface WorkPlanRecord {
  employeeId: string;
  date: string;
  workType: string;
  startTime: string;
  endTime: string;
}

interface AbsenceRecord {
  employeeId: string;
  date: string;
}

interface EveningCandidate {
  employeeId: string;
  workType: string;
  shiftEnd: string;
  hasProdejnaLabel: boolean;
  freeForEvening: boolean;
}

interface DraftDayRecord {
  date: string;
  dayName: string;
  dayType: string;
  requiredTotal: number;
  startTime: string | null;
  endTime: string | null;
  assignedEmployees: string[];
  assignedCount: number;
  totalAssignedCount: number;
  confirmedShifts: { employeeId: string; workType: string; startTime: string; endTime: string; isEvening: boolean }[];
  eveningCoverage: {
    enabled: boolean; from: string; to: string; requiredStaff: number;
    assignedStaff: number; missingStaff: number;
    candidates: EveningCandidate[];
  } | null;
}

// ─── Local Analysis Engine ────────────────────────────────────────────────────

function shiftHoursFromTimes(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 8;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = (sh || 0) * 60 + (sm || 0);
  let endMins = (eh || 0) * 60 + (em || 0);
  if (endMins <= startMins) endMins += 24 * 60;
  return Math.round((endMins - startMins) / 6) / 10; // one decimal
}

function analyzeLocally(
  monthKey: string,
  draft: string,
  employees: EmpRecord[],
  draftDays: DraftDayRecord[],
  absences: { fullDay: AbsenceRecord[]; partial: AbsenceRecord[] },
  workPlans: WorkPlanRecord[],
) {
  // Build per-employee assigned hours + days from confirmed work plans AND draft assignments
  const assignedHoursMap = new Map<string, number>();
  const assignedDaysMap = new Map<string, number>();
  for (const emp of employees) {
    assignedHoursMap.set(emp.id, 0);
    assignedDaysMap.set(emp.id, 0);
  }
  // Confirmed shifts from work_plans table
  const confirmedKeys = new Set<string>(); // "employeeId|date"
  for (const wp of workPlans) {
    const h = shiftHoursFromTimes(wp.startTime, wp.endTime);
    assignedHoursMap.set(wp.employeeId, (assignedHoursMap.get(wp.employeeId) ?? 0) + h);
    assignedDaysMap.set(wp.employeeId, (assignedDaysMap.get(wp.employeeId) ?? 0) + 1);
    confirmedKeys.add(`${wp.employeeId}|${wp.date}`);
  }
  // Draft assignments (already planned in draft but not yet written to work_plans)
  for (const day of draftDays) {
    const dayH = shiftHoursFromTimes(day.startTime, day.endTime);
    for (const empId of day.assignedEmployees) {
      if (confirmedKeys.has(`${empId}|${day.date}`)) continue; // already counted above
      assignedHoursMap.set(empId, (assignedHoursMap.get(empId) ?? 0) + dayH);
      assignedDaysMap.set(empId, (assignedDaysMap.get(empId) ?? 0) + 1);
    }
  }

  // Absence lookup: "employeeId|date"
  const absenceSet = new Set<string>();
  for (const a of [...absences.fullDay, ...absences.partial]) {
    absenceSet.add(`${a.employeeId}|${a.date}`);
  }

  const empById = new Map<string, EmpRecord>(employees.map(e => [e.id, e]));

  const problemDays: AnalyzedDayOut[] = [];
  let allSuggestionCount = 0;
  let recommendedCount = 0;

  // Track which employees have already been recommended to diversify picks across days
  const alreadyRecommendedFds = new Set<string>();
  const alreadyRecommendedCa = new Set<string>();

  for (const day of draftDays) {
    if (day.requiredTotal === 0) continue; // closed day

    const missingProdejna = Math.max(0, day.requiredTotal - day.assignedCount);
    const eveningMissing = day.eveningCoverage?.missingStaff ?? 0;
    if (missingProdejna === 0 && eveningMissing === 0) continue;

    const [, mm, dd] = day.date.split('-');
    const dateLabel = `${parseInt(dd, 10)}. ${parseInt(mm, 10)}.`;
    const shiftH = shiftHoursFromTimes(day.startTime, day.endTime);
    const storeHoursLabel = day.startTime && day.endTime ? `${day.startTime}–${day.endTime}` : '';
    const dow = new Date(day.date + 'T00:00:00').getDay();
    const isSaturday = dow === 6;

    const suggestions: SuggestionOut[] = [];
    const recommendedIds: string[] = [];

    // ── FULL_DAY_STORE: someone needed on Prodejna ──
    if (missingProdejna > 0) {
      const assignedSet = new Set(day.assignedEmployees);
      const candidates = employees
        .filter(e =>
          !assignedSet.has(e.id) &&
          !absenceSet.has(`${e.id}|${day.date}`) &&
          !e.shortLongWeek &&
          (!isSaturday || e.canSaturday)
        )
        .map(e => {
          const assignedH = assignedHoursMap.get(e.id) ?? 0;
          const assignedD = assignedDaysMap.get(e.id) ?? 0;
          const hasProdejnaLabel = e.labels.some(l => l.toLowerCase().includes('prodejna'));
          // Availability: allow up to 30h over target without penalty
          const headroom = e.targetHours + 30;
          const avail = headroom > 0 ? Math.max(0, (headroom - assignedH) / headroom) : 0;
          // Saturday tier bonus: if this is Saturday and employee has unused Saturday budget
          const satBonus = isSaturday && e.maxSaturdays > 0 && e.prodejnaTier >= 1 ? 0.2 : 0;
          const score =
            0.25 * avail +
            0.1 * (e.storeRating / 5) +
            0.35 * Math.min(1, e.prodejnaTier / 3) +
            (hasProdejnaLabel ? 0.3 : 0) +
            satBonus;
          return { e, score, assignedH, assignedD, hasProdejnaLabel };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      for (const { e, score, assignedH, assignedD, hasProdejnaLabel } of candidates) {
        const projected = assignedH + shiftH;
        const badges: string[] = [];
        const reasons: string[] = [];
        const warnings: string[] = [];
        reasons.push(`Naplánováno ${assignedH.toFixed(1)} h / ${e.targetHours} h`);
        if (hasProdejnaLabel) { badges.push('Prodejna'); reasons.push('Štítek Prodejna'); }
        if (e.prodejnaTier >= 1) { reasons.push(`Tier ${e.prodejnaTier}`); badges.push(`T${e.prodejnaTier}`); }
        if (isSaturday && e.maxSaturdays > 0) reasons.push(`Max sobot: ${e.maxSaturdays}/měsíc`);
        if (projected > e.targetHours + 30) warnings.push(`Výrazně přesáhne fond`);
        const sugg: SuggestionOut = {
          id: `${day.date}__${e.id}__FDS`,
          employeeId: e.id,
          employeeName: e.name,
          firstName: e.name.split(' ')[0],
          dateLabel,
          timeLabel: storeHoursLabel,
          suggestionType: 'FULL_DAY_STORE',
          canAutoApply: true,
          actionLabel: 'Přidat na Prodejnu',
          score: Math.round(score * 100) / 100,
          confidence: Math.min(100, Math.round(score * 100)),
          badges,
          reasons,
          warnings,
          partialAvailability: null,
          projectedHours: Math.round(projected * 10) / 10,
          assignedHours: Math.round(assignedH * 10) / 10,
          assignedDays: assignedD,
        };
        suggestions.push(sugg);
      }

      // Pick up to missingProdejna candidates, preferring employees not yet recommended elsewhere
      const fdsRecs = suggestions.filter(s => s.suggestionType === 'FULL_DAY_STORE');
      let fdsPicked = 0;
      for (const s of fdsRecs) {
        if (fdsPicked >= missingProdejna) break;
        if (!alreadyRecommendedFds.has(s.employeeId)) {
          recommendedIds.push(s.id);
          alreadyRecommendedFds.add(s.employeeId);
          fdsPicked++;
        }
      }
      // If not enough unique employees, backfill with best remaining
      if (fdsPicked < missingProdejna) {
        for (const s of fdsRecs) {
          if (fdsPicked >= missingProdejna) break;
          if (!recommendedIds.includes(s.id)) {
            recommendedIds.push(s.id);
            fdsPicked++;
          }
        }
      }
    }

    // ── CLOSING_ASSIST: evening coverage gap ──
    if (eveningMissing > 0 && day.eveningCoverage) {
      const ev = day.eveningCoverage;
      const candMap = new Map<string, EveningCandidate>(ev.candidates.map(c => [c.employeeId, c]));
      const closingCandidates = employees
        .filter(e => candMap.has(e.id) && !e.shortLongWeek)
        .map(e => {
          const c = candMap.get(e.id)!;
          const assignedH = assignedHoursMap.get(e.id) ?? 0;
          const assignedD = assignedDaysMap.get(e.id) ?? 0;
          const avail = e.targetHours > 0 ? Math.max(0, (e.targetHours + 30 - assignedH) / (e.targetHours + 30)) : 0;
          const score =
            0.2 * avail +
            0.1 * (e.storeRating / 5) +
            (c.hasProdejnaLabel ? 0.5 : 0) +
            (c.freeForEvening ? 0.2 : 0);
          return { e, score, assignedH, assignedD, c };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      for (const { e, score, assignedH, assignedD, c } of closingCandidates) {
        const from = c.freeForEvening ? ev.from : c.shiftEnd;
        const partialH = shiftHoursFromTimes(from, ev.to);
        const projected = assignedH + partialH;
        const badges: string[] = [];
        const reasons: string[] = [];
        const warnings: string[] = [];
        if (c.hasProdejnaLabel) { badges.push('Prodejna'); reasons.push('Má štítek Prodejna'); }
        if (c.freeForEvening) reasons.push(`Směna končí ${c.shiftEnd}, večerní od ${ev.from}`);
        else reasons.push(`Může zůstat od ${from} do ${ev.to}`);
        reasons.push(`Naplánováno ${assignedH.toFixed(1)} h / ${e.targetHours} h`);
        if (projected > e.targetHours + 30) warnings.push(`Výrazně přesáhne fond`);
        const sugg: SuggestionOut = {
          id: `${day.date}__${e.id}__CA`,
          employeeId: e.id,
          employeeName: e.name,
          firstName: e.name.split(' ')[0],
          dateLabel,
          timeLabel: `${from}–${ev.to}`,
          suggestionType: 'CLOSING_ASSIST',
          canAutoApply: true,
          actionLabel: 'Přidat na večerní',
          score: Math.round(score * 100) / 100,
          confidence: Math.min(100, Math.round(score * 100)),
          badges,
          reasons,
          warnings,
          partialAvailability: {
            type: 'CLOSING_ASSIST',
            from,
            to: ev.to,
            hours: partialH,
            reason: c.freeForEvening ? 'Volný po skončení denní směny' : 'Může prodloužit směnu',
          },
          projectedHours: Math.round(projected * 10) / 10,
          assignedHours: Math.round(assignedH * 10) / 10,
          assignedDays: assignedD,
        };
        suggestions.push(sugg);
      }

      // Pick up to eveningMissing CA candidates, preferring employees not yet recommended
      const caRecs = suggestions.filter(s => s.suggestionType === 'CLOSING_ASSIST');
      let caPicked = 0;
      for (const s of caRecs) {
        if (caPicked >= eveningMissing) break;
        if (!alreadyRecommendedCa.has(s.employeeId)) {
          recommendedIds.push(s.id);
          alreadyRecommendedCa.add(s.employeeId);
          caPicked++;
        }
      }
      if (caPicked < eveningMissing) {
        for (const s of caRecs) {
          if (caPicked >= eveningMissing) break;
          if (!recommendedIds.includes(s.id)) {
            recommendedIds.push(s.id);
            caPicked++;
          }
        }
      }
    }

    allSuggestionCount += suggestions.length;
    recommendedCount += recommendedIds.length;

    const closingCoverage = day.eveningCoverage
      ? {
          enabled: day.eveningCoverage.enabled,
          from: day.eveningCoverage.from,
          to: day.eveningCoverage.to,
          requiredStaff: day.eveningCoverage.requiredStaff,
          assignedStaff: day.eveningCoverage.assignedStaff,
          missingStaff: day.eveningCoverage.missingStaff,
        }
      : { enabled: false, from: '', to: '', requiredStaff: 0, assignedStaff: 0, missingStaff: 0 };

    let statusLabel = '';
    if (missingProdejna > 0 && eveningMissing > 0) {
      statusLabel = `Chybí ${missingProdejna} na Prodejně · chybí ${eveningMissing} na večerní`;
    } else if (missingProdejna > 0) {
      statusLabel = `Chybí ${missingProdejna} ${missingProdejna === 1 ? 'člověk' : missingProdejna < 5 ? 'lidé' : 'lidí'} na Prodejně`;
    } else {
      statusLabel = `Chybí ${eveningMissing} na večerní směně`;
    }

    problemDays.push({
      date: day.date,
      dateLabel,
      dayName: day.dayName,
      requiredTotal: day.requiredTotal,
      assignedEmployees: day.assignedEmployees.map(id => empById.get(id)?.name ?? id),
      assignedCount: day.assignedCount,
      missingCount: missingProdejna,
      status: 'MISSING',
      statusLabel,
      storeHoursLabel,
      shiftHours: shiftH,
      closingCoverage,
      suggestions,
      recommendedSuggestionIds: recommendedIds,
    });
  }

  // Sort problem days by date
  problemDays.sort((a, b) => a.date.localeCompare(b.date));

  return {
    ok: true,
    month: monthKey,
    draft,
    summary: {
      totalDays: draftDays.filter(d => d.requiredTotal > 0).length,
      problemDays: problemDays.length,
      recommendedCount,
      allSuggestionCount,
    },
    problemDays,
  };
}

// ─── Output shape types (must match ShiftAssistant.tsx) ───────────────────────

interface SuggestionOut {
  id: string;
  employeeId: string;
  employeeName: string;
  firstName: string;
  dateLabel: string;
  timeLabel: string;
  suggestionType: 'FULL_DAY_STORE' | 'CLOSING_ASSIST';
  canAutoApply: boolean;
  actionLabel: string;
  score: number;
  confidence: number;
  badges: string[];
  reasons: string[];
  warnings: string[];
  partialAvailability: { type: 'CLOSING_ASSIST'; from: string; to: string; hours: number; reason: string } | null;
  projectedHours: number;
  assignedHours: number;
  assignedDays: number;
}

interface AnalyzedDayOut {
  date: string;
  dateLabel: string;
  dayName: string;
  requiredTotal: number;
  assignedEmployees: string[];
  assignedCount: number;
  missingCount: number;
  status: 'OK' | 'MISSING' | 'CLOSED';
  statusLabel: string;
  storeHoursLabel: string;
  shiftHours: number;
  closingCoverage: {
    enabled: boolean; from: string; to: string;
    requiredStaff: number; assignedStaff: number; missingStaff: number;
  };
  suggestions: SuggestionOut[];
  recommendedSuggestionIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOW_REQUIRED_KEYS = ['required_sun','required_mon','required_tue','required_wed','required_thu','required_fri','required_sat'];

function buildDraftDays(
  month: string,
  draftRows: Record<string, unknown>[],
  _draft: string,
  scheduleDays: Record<string, unknown>[],
  confirmedByDate: Record<string, { count: number; employeeIds: string[]; shifts: { employeeId: string; workType: string; startTime: string; endTime: string; isEvening: boolean }[] }>,
  orgSettings: Record<string, unknown> = {},
  employees: { id: string; labels: string[] }[] = [],
): DraftDayRecord[] {
  const empLabels = new Map<string, string[]>(employees.map(e => [e.id, e.labels]));

  const rawClosedDates = orgSettings.closed_dates;
  const closedDates = new Set<string>(
    typeof rawClosedDates === 'string'
      ? rawClosedDates.split(',').map(s => s.trim()).filter(Boolean)
      : Array.isArray(rawClosedDates)
        ? (rawClosedDates as unknown[]).map(String)
        : []
  );

  const DOW_HOURS_KEYS = ['hours_sun','hours_mon','hours_tue','hours_wed','hours_thu','hours_fri','hours_sat'];
  const closedWeekdays = new Set<number>(
    DOW_HOURS_KEYS.map((k, i) => ({ k, i }))
      .filter(({ k }) => orgSettings[k] != null && !orgSettings[k])
      .map(({ i }) => i)
  );

  const schedMeta: Record<string, { requiredTotal: number; dayType: string; startTime: string | null; endTime: string | null }> = {};
  for (const row of scheduleDays) {
    const date = String(row.date ?? '').slice(0, 10);
    if (date) schedMeta[date] = {
      requiredTotal: Number(row.required_total ?? 0),
      dayType: String(row.day_type ?? ''),
      startTime: row.start_time ? String(row.start_time) : null,
      endTime: row.end_time ? String(row.end_time) : null,
    };
  }

  const eveningEnabled = Boolean(orgSettings.evening_shift_enabled);
  const eveningStart = String(orgSettings.evening_shift_start ?? '17:00');
  const eveningEnd = String(orgSettings.evening_shift_end ?? '19:00');
  const eveningMinStaff = Number(orgSettings.evening_shift_min_staff ?? 2);
  const eveningLabel = String(orgSettings.evening_shift_label ?? 'Prodejna').toLowerCase();

  function isProdejnaType(workType: string) {
    const wt = workType.toLowerCase();
    return wt.includes('prodejna') || wt.includes('store');
  }

  const draftByDate: Record<string, { employeeIds: string[]; prodejnaIds: string[] }> = {};
  for (const row of draftRows) {
    const date = String(row.date ?? '').slice(0, 10);
    if (!date) continue;
    if (!draftByDate[date]) draftByDate[date] = { employeeIds: [], prodejnaIds: [] };
    if (row.employee_id) {
      draftByDate[date].employeeIds.push(String(row.employee_id));
      if (!row.work_type || isProdejnaType(String(row.work_type))) {
        draftByDate[date].prodejnaIds.push(String(row.employee_id));
      }
    }
  }

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const DAY_NAMES = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
  const days: DraftDayRecord[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, mon - 1, d);
    const dow = dateObj.getDay();
    const isSunday = dow === 0;

    const draftSlot = draftByDate[date] ?? { employeeIds: [], prodejnaIds: [] };
    const confirmed = confirmedByDate[date];
    const meta = schedMeta[date];

    const isClosed = closedDates.has(date)
      || closedWeekdays.has(dow)
      || (meta?.dayType != null && meta.dayType.toLowerCase().includes('zavř'));
    const dowKey = DOW_REQUIRED_KEYS[dow];
    const orgDefault = dowKey && orgSettings[dowKey] != null ? Number(orgSettings[dowKey]) : (isSunday ? 0 : 3);
    const requiredTotal = isClosed ? 0 : (meta ? meta.requiredTotal : orgDefault);

    const dayType = isClosed ? 'Zavřeno' : (meta?.dayType || (isSunday ? 'Zavřeno' : ''));

    const confirmedIds = confirmed?.employeeIds ?? [];
    const seen = new Set<string>();
    const allAssignedIds: string[] = [];
    for (const id of [...confirmedIds, ...draftSlot.employeeIds]) {
      if (!seen.has(id)) { seen.add(id); allAssignedIds.push(id); }
    }

    const prodejnaConfirmedCount = (confirmed?.shifts ?? []).filter(s =>
      s.workType && isProdejnaType(s.workType)
    ).length;
    const assignedCount = prodejnaConfirmedCount + draftSlot.prodejnaIds.length;
    const totalAssignedCount = allAssignedIds.length;

    const allShifts = confirmed?.shifts ?? [];
    let eveningCoverage: DraftDayRecord['eveningCoverage'] = null;

    // Determine store closing time for this specific day:
    // prefer per-day schedule_days.end_time, fall back to weekly hours_DOW setting
    const dowHoursKey = DOW_HOURS_KEYS[dow]; // e.g. 'hours_fri'
    const orgDayHours = dowHoursKey ? String(orgSettings[dowHoursKey] ?? '') : '';
    const orgDayEndTime = orgDayHours.includes('-') ? orgDayHours.split('-').slice(-1)[0] : null;
    const dayEndTime = meta?.endTime ?? orgDayEndTime;
    // If store closes at or before evening shift start, skip evening coverage entirely
    const storeClosesBeforeEvening = dayEndTime ? dayEndTime <= eveningStart : false;

    if (eveningEnabled && !isClosed && !storeClosesBeforeEvening) {
      const eveningCovered = allShifts.filter(s =>
        s.isEvening ||
        (isProdejnaType(s.workType) && s.startTime <= eveningStart && s.endTime >= eveningEnd)
      ).length;

      const hasEveningLabel = (empId: string) => {
        const labels = empLabels.get(empId) ?? [];
        return labels.some(l => l.toLowerCase().replace(/\s+/g, '') === eveningLabel.toLowerCase().replace(/\s+/g, ''));
      };

      const candidates: EveningCandidate[] = allShifts
        .filter(s => !isProdejnaType(s.workType) && !s.isEvening)
        .filter(s =>
          (hasEveningLabel(s.employeeId) && s.endTime <= eveningStart) ||
          (s.endTime > eveningStart && s.endTime < eveningEnd)
        )
        .map(s => ({
          employeeId: s.employeeId,
          workType: s.workType,
          shiftEnd: s.endTime,
          hasProdejnaLabel: hasEveningLabel(s.employeeId),
          freeForEvening: s.endTime <= eveningStart,
        }));

      eveningCoverage = {
        enabled: true,
        from: eveningStart,
        to: eveningEnd,
        requiredStaff: eveningMinStaff,
        assignedStaff: eveningCovered,
        missingStaff: Math.max(0, eveningMinStaff - eveningCovered),
        candidates,
      };
    }

    days.push({
      date,
      dayName: DAY_NAMES[dow],
      dayType,
      requiredTotal,
      startTime: meta?.startTime ?? null,
      endTime: meta?.endTime ?? null,
      assignedEmployees: allAssignedIds,
      assignedCount,
      totalAssignedCount,
      confirmedShifts: allShifts,
      eveningCoverage,
    });
  }
  return days;
}

function buildSettings(row: { extra_settings: Record<string, unknown> | null; saturday_logic_enabled: boolean | null } | null) {
  const s: Record<string, unknown> = {};
  if (!row) return s;
  if (row.saturday_logic_enabled != null) s.saturday_logic_enabled = row.saturday_logic_enabled;
  for (const [k, v] of Object.entries(row.extra_settings ?? {})) { s[k] = v; }
  return s;
}

function buildAbsences(rows: Array<Record<string, unknown>>) {
  const fullDay: AbsenceRecord[] = [];
  const partial: AbsenceRecord[] = [];

  for (const row of rows) {
    const base: AbsenceRecord = {
      employeeId: String(row.employee_id ?? ''),
      date: String(row.date ?? '').slice(0, 10),
    };
    if (row.start_time && row.end_time) partial.push(base);
    else fullDay.push(base);
  }
  return { fullDay, partial };
}
