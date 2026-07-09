import { NextRequest, NextResponse } from 'next/server';
import { resolveOrgId } from '@/lib/resolveOrg';
import { fetchAllRows } from '@/lib/fetchAllRows';

// GET /api/analytics/weekday?month=YYYY-MM&department=Prodejna
// Returns avg punctuality by day of week (Mon–Sun, ISO order), using last 3 months for sample size
export async function GET(req: NextRequest) {
  const resolved = await resolveOrgId(req);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { orgId, supabase, departments } = resolved;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const deptFilter = searchParams.get('department');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Use 3-month window ending at month for statistical significance
  const [ey, em] = month.split('-').map(Number);
  const months: string[] = [];
  for (let i = 2; i >= 0; i--) {
    let y = ey; let m = em - i;
    while (m <= 0) { m += 12; y--; }
    months.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  const rangeFrom = `${months[0]}-01`;
  const [ly, lm] = months[2].split('-').map(Number);
  const rangeTo = new Date(ly, lm, 0).toISOString().slice(0, 10);

  let empQuery = sb.from('employees').select('id').eq('organization_id', orgId).eq('active', true);
  if (deptFilter && deptFilter !== '__all__') {
    empQuery = empQuery.eq('department', deptFilter);
  } else if (departments?.length) {
    empQuery = empQuery.in('department', departments);
  }

  const [empRes, allLogs, plans] = await Promise.all([
    empQuery,
    fetchAllRows<{ employee_id: string; check_in: string | null; date: string }>(
      (from, to) => sb.from('attendance_logs').select('employee_id, check_in, date').eq('organization_id', orgId).gte('date', rangeFrom).lte('date', rangeTo).order('date', { ascending: true }).range(from, to),
    ),
    fetchAllRows<{ employee_id: string; date: string; start_time: string | null }>(
      (from, to) => sb.from('work_plans').select('employee_id, date, start_time').eq('organization_id', orgId).eq('active', true).gte('date', rangeFrom).lte('date', rangeTo).order('date', { ascending: true }).range(from, to),
    ),
  ]);

  const empIds = new Set<string>((empRes.data ?? []).map((e: { id: string }) => e.id));
  const logs: { employee_id: string; check_in: string; date: string }[] =
    allLogs.filter((l) => empIds.has(l.employee_id) && l.check_in) as { employee_id: string; check_in: string; date: string }[];

  // Index plans by empId+date for O(1) lookup
  const planMap = new Map<string, string>();
  for (const p of plans) {
    if (p.start_time) planMap.set(`${p.employee_id}_${p.date}`, p.start_time);
  }

  // Buckets indexed by JS getDay(): 0=Sun, 1=Mon … 6=Sat
  const buckets: { sum: number; count: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));

  const fmt = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  for (const log of logs) {
    const startTime = planMap.get(`${log.employee_id}_${log.date}`);
    if (!startTime) continue;
    const [ph, pm] = startTime.split(':').map(Number);
    const plannedMin = ph * 60 + pm;

    const checkInDate = new Date(log.check_in);
    const parts = fmt.formatToParts(checkInDate);
    const ah = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
    const am = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
    const actualMin = ah * 60 + am;

    const jsDow = new Date(log.date + 'T12:00:00').getDay();
    buckets[jsDow].sum += actualMin - plannedMin;
    buckets[jsDow].count++;
  }

  // Return Mon–Sun order (ISO)
  const DAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  const ISO_JS = [1, 2, 3, 4, 5, 6, 0]; // Mon=1, Tue=2 … Sun=0 in JS

  const result = ISO_JS.map((jsDow, idx) => ({
    day: DAY_LABELS[idx],
    avgLateMin: buckets[jsDow].count > 0 ? Math.round(buckets[jsDow].sum / buckets[jsDow].count) : 0,
    sampleCount: buckets[jsDow].count,
  }));

  return NextResponse.json(result);
}
