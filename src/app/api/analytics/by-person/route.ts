import { NextRequest, NextResponse } from 'next/server';
import { pragueMonth } from '@/lib/vacationDays';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/managerAuth';
import { computeMonthlyStats } from '@/lib/computeAnalytics';

// GET /api/analytics/by-person?month=YYYY-MM
// Integrační endpoint pro interní portál (hub.helveti.cz). Vrací odpracované
// hodiny a bonusy PO JEDNOTLIVÝCH ZAMĚSTNANCÍCH (summary z týchž dat jen dělá
// součty). Žádné mzdy ani sazby — jen bonusy. Chráněno sdíleným tajným klíčem
// v hlavičce X-Api-Key.
//
// Vyžaduje env (stejné jako /api/analytics/summary, žádné nové):
//   INTEGRATION_API_KEY  – tajný klíč (stejný má portál)
//   INTEGRATION_ORG_ID   – organization_id, jehož data se vrací (Helveti)

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function GET(req: NextRequest) {
  const expected = process.env.INTEGRATION_API_KEY ?? '';
  const orgId = process.env.INTEGRATION_ORG_ID ?? '';
  if (!expected || !orgId) {
    return NextResponse.json({ error: 'Integrace není nakonfigurovaná (chybí INTEGRATION_API_KEY / INTEGRATION_ORG_ID).' }, { status: 503 });
  }

  const key = req.headers.get('x-api-key') ?? '';
  if (!key || !safeEqual(key, expected)) {
    return NextResponse.json({ error: 'Neautorizováno.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? pragueMonth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getServiceClient() as any;

  // Docházka + dovolená po lidech — přesně stejný výpočet jako /api/analytics/summary,
  // jen nesečtený.
  const { stats } = await computeMonthlyStats(sb, orgId, month, { deptFilter: null, departments: null });

  // Bonusy za měsíc — stejná tabulka jako /api/manager/bonuses.
  const { data: bonusRows } = await sb
    .from('employee_bonuses')
    .select('employee_id, amount, note')
    .eq('organization_id', orgId)
    .eq('month', month);

  const bonusesByEmp = new Map<string, { amount: number; note: string | null }[]>();
  for (const b of ((bonusRows ?? []) as { employee_id: string; amount: number; note: string | null }[])) {
    const arr = bonusesByEmp.get(b.employee_id) ?? [];
    arr.push({ amount: Number(b.amount) || 0, note: b.note ?? null });
    bonusesByEmp.set(b.employee_id, arr);
  }

  const people = stats.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    workedHours: s.workedHours,
    targetHours: s.targetHours,
    overtimeHours: s.overtimeHours,
    vacationHoursRemaining: s.vacationHoursRemaining,
    bonuses: bonusesByEmp.get(s.id) ?? [],
  }));

  return NextResponse.json({ month, people });
}
