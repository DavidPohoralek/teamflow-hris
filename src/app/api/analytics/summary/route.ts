import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceClient } from '@/lib/managerAuth';
import { computeMonthlyStats } from '@/lib/computeAnalytics';

// GET /api/analytics/summary?month=YYYY-MM
// Integrační endpoint pro rozcestník. Vrací POUZE agregovaná týmová čísla
// (žádná jména, žádné mzdy). Chráněno sdíleným tajným klíčem v hlavičce X-Api-Key.
//
// Vyžaduje env:
//   INTEGRATION_API_KEY  – tajný klíč (stejný má rozcestník)
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
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getServiceClient() as any;
  const { stats } = await computeMonthlyStats(sb, orgId, month, { deptFilter: null, departments: null });

  const round1 = (n: number) => Math.round((n || 0) * 10) / 10;
  const sum = (f: keyof (typeof stats)[number]) => round1(stats.reduce((s, x) => s + (Number(x[f]) || 0), 0));
  const punct = stats.map((x) => x.avgPunctualityMin).filter((v): v is number => v !== null && v !== undefined);
  const worked = sum('workedHours');
  const target = sum('targetHours');

  return NextResponse.json({
    month,
    headcount: stats.length,
    workedHours: worked,
    targetHours: target,
    utilizationPct: target > 0 ? Math.round((worked / target) * 100) : null,
    overtimeHours: sum('overtimeHours'),
    avgPunctualityMin: punct.length ? Math.round(punct.reduce((a, b) => a + b, 0) / punct.length) : null,
    vacationRemaining: sum('vacationHoursRemaining'),
  });
}
