import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeMonthBreakdown, parsePayrollSettings } from '@/lib/payrollMonth'
import { monthEndISO, pragueMonth, toISODateLocal } from '@/lib/vacationDays'

// GET /api/public/employee-breakdown?orgId=UUID&pin=XXXX&month=YYYY-MM
//
// One employee's month, itemised, so they can check their own pay. It runs the
// SAME calculation as the payroll export (src/lib/payrollMonth.ts) — if this
// computed its own version, the employee and the accountant would arrive at
// different numbers and the feature would create disputes instead of settling
// them.
//
// Money stays out of the response: hours only, never an hourly rate or a total
// in CZK. Those are not something a PIN should reveal.

function svc() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Chybí konfigurace Supabase')
  return createClient(url, key)
}

const CZECH_MONTHS: Record<number, string> = {
  1: 'Leden', 2: 'Únor', 3: 'Březen', 4: 'Duben', 5: 'Květen', 6: 'Červen',
  7: 'Červenec', 8: 'Srpen', 9: 'Září', 10: 'Říjen', 11: 'Listopad', 12: 'Prosinec',
}

interface Log {
  employee_id: string; date: string;
  check_in: string | null; check_out: string | null;
  note: string | null; work_type_name: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    const pin = searchParams.get('pin')
    const month = searchParams.get('month') ?? pragueMonth()

    if (!orgId || !pin) return NextResponse.json({ error: 'Chybí parametry.' }, { status: 400 })
    if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Neplatný měsíc.' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = svc() as any

    const { data: employee } = await sb
      .from('employees')
      .select('id, name, department, target_hours, employment_type')
      .eq('organization_id', orgId)
      .eq('active', true)
      .eq('pin_code', pin)
      .maybeSingle()

    if (!employee) return NextResponse.json({ error: 'Nesprávný PIN.' }, { status: 401 })

    const dateFrom = `${month}-01`
    const dateTo = monthEndISO(month)

    const [settingsRes, logsRes, vacRes, benefitRes, entriesRes] = await Promise.all([
      sb.from('company_settings').select('extra_settings').eq('organization_id', orgId).maybeSingle(),
      sb.from('attendance_logs')
        .select('employee_id, date, check_in, check_out, note, work_type_name')
        .eq('organization_id', orgId).eq('employee_id', employee.id)
        .gte('date', dateFrom).lte('date', dateTo).order('date'),
      sb.from('requests')
        .select('employee_id, date_from, date_to')
        .eq('organization_id', orgId).eq('employee_id', employee.id)
        .eq('type', 'vacation').eq('status', 'approved')
        .lte('date_from', dateTo)
        .or(`date_to.gte.${dateFrom},and(date_to.is.null,date_from.gte.${dateFrom})`),
      sb.from('employee_benefit_logs')
        .select('employee_id, benefit_key, count')
        .eq('organization_id', orgId).eq('employee_id', employee.id).eq('month', month),
      sb.from('benefit_entries')
        .select('benefit_key, date')
        .eq('organization_id', orgId).eq('employee_id', employee.id)
        .gte('date', dateFrom).lte('date', dateTo).order('date'),
    ])

    const extra = (settingsRes.data?.extra_settings ?? {}) as Record<string, unknown>
    const settings = parsePayrollSettings(extra)
    const logs: Log[] = logsRes.data ?? []

    const breakdown = computeMonthBreakdown(employee, {
      logs,
      vacationRequests: vacRes.data ?? [],
      benefitLogs: benefitRes.data ?? [],
      managerBonus: 0,     // CZK — deliberately not exposed here
      settings,
      dateFrom,
      dateTo,
      includeRate: false,  // never hand an hourly rate to a PIN
    })

    // The detail behind each line, so the employee sees WHICH Saturdays and
    // WHICH activities make up a number instead of being asked to trust it.
    const saturdays = logs
      .filter((l) => l.check_in && l.check_out && new Date(l.date + 'T00:00:00').getDay() === 6)
      .map((l) => ({
        date: l.date,
        from: (l.check_in as string).slice(11, 16),
        to: (l.check_out as string).slice(11, 16),
        workType: l.work_type_name,
        hours: Math.round(((new Date(l.check_out as string).getTime() - new Date(l.check_in as string).getTime()) / 3600000) * 100) / 100,
      }))

    const labels = Object.fromEntries(settings.activeBenefits.map((b) => [b.key, b.czLabel]))
    const perUnit = Object.fromEntries(settings.activeBenefits.map((b) => [b.key, b.hoursPerUnit]))
    const [y, m] = month.split('-').map(Number)

    return NextResponse.json({
      month,
      monthName: `${CZECH_MONTHS[m]} ${y}`,
      employee: { name: employee.name },
      totals: {
        workedHours: breakdown.workedHours,
        satBonusHours: breakdown.satBonusHours,
        otBonusHours: breakdown.otBonusHours,
        benefitHours: breakdown.benefitHours,
        totalBenefitHours: breakdown.totalBenefitHours,
        vacHours: breakdown.vacHours,
        targetHours: breakdown.targetHours,
        delta: breakdown.delta,
        finalWithVac: breakdown.finalWithVac,
      },
      detail: {
        workedDays: logs.filter((l) => l.check_in && l.check_out).length,
        saturdays,
        saturdayBonusPct: settings.saturdayBonusPct,
        overtimeThreshold: settings.overtimeThreshold,
        overtimeBonusPct: settings.overtimeBonusPct,
        benefits: (entriesRes.data ?? []).map((e: { benefit_key: string; date: string }) => ({
          key: e.benefit_key,
          label: labels[e.benefit_key] ?? e.benefit_key,
          date: e.date,
          hours: perUnit[e.benefit_key] ?? 0,
        })),
        vacations: (vacRes.data ?? []).map((r: { date_from: string; date_to: string | null }) => ({
          from: r.date_from,
          to: r.date_to ?? r.date_from,
        })),
      },
      generatedAt: toISODateLocal(new Date()),
    })
  } catch (err) {
    console.error('GET /api/public/employee-breakdown error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
  }
}
