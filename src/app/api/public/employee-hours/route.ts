import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Chybí konfigurace Supabase')
  return createClient(url, key)
}

const CZECH_MONTHS: Record<number, string> = {
  1: 'Leden',
  2: 'Únor',
  3: 'Březen',
  4: 'Duben',
  5: 'Květen',
  6: 'Červen',
  7: 'Červenec',
  8: 'Srpen',
  9: 'Září',
  10: 'Říjen',
  11: 'Listopad',
  12: 'Prosinec',
}

function czechMonthName(year: number, month: number): string {
  return `${CZECH_MONTHS[month]} ${year}`
}

/** Returns { firstDay: 'YYYY-MM-DD', lastDay: 'YYYY-MM-DD' } for a given year+month (1-based). */
function monthRange(year: number, month: number): { firstDay: string; lastDay: string } {
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDayDate = new Date(year, month, 0) // day 0 of next month = last day of current
  const lastDay = lastDayDate.toISOString().slice(0, 10)
  return { firstDay, lastDay }
}

interface AttendanceRow {
  date: string
  check_in: string | null
  check_out: string | null
  work_type_name: string | null
}

function calcStats(logs: AttendanceRow[]): { hours: number; days: number } {
  let totalMs = 0
  const daySet = new Set<string>()

  for (const log of logs) {
    if (!log.check_in || !log.check_out) continue
    const ms = new Date(log.check_out).getTime() - new Date(log.check_in).getTime()
    if (ms > 0) {
      totalMs += ms
      daySet.add(log.date)
    }
  }

  return {
    hours: totalMs / 3_600_000,
    days: daySet.size,
  }
}

// GET /api/public/employee-hours?orgId=UUID&pin=XXXX
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    const pin = searchParams.get('pin')

    if (!orgId || !pin) {
      return NextResponse.json(
        { error: 'Chybí parametry orgId nebo pin' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    // Lookup employee by PIN + org (active only — .single() fails if multiple rows match)
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name, active, department, vacation_days_per_year, vacation_hours_offset')
      .eq('organization_id', orgId)
      .eq('active', true)
      .eq('pin_code', pin)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json({ error: 'Nesprávný PIN' }, { status: 401 })
    }

    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonthNum = now.getMonth() + 1 // 1-based

    const lastMonthDate = new Date(thisYear, thisMonthNum - 2, 1) // subtract 1 month
    const lastYear = lastMonthDate.getFullYear()
    const lastMonthNum = lastMonthDate.getMonth() + 1

    const thisRange = monthRange(thisYear, thisMonthNum)
    const lastRange = monthRange(lastYear, lastMonthNum)

    // Fetch 3 months of logs + settings in parallel
    const threeMonthsAgo = new Date(thisYear, thisMonthNum - 4, 1)
    const earliestDate = threeMonthsAgo.toISOString().slice(0, 10)
    const thisYearStart = `${thisYear}-01-01`
    const thisYearEnd = `${thisYear}-12-31`

    const [logsResult, vacResult, settingsResult] = await Promise.all([
      supabase
        .from('attendance_logs')
        .select('date, check_in, check_out, work_type_name')
        .eq('organization_id', orgId)
        .eq('employee_id', employee.id)
        .gte('date', earliestDate)
        .order('date', { ascending: false })
        .order('check_in', { ascending: false })
        .limit(200),
      supabase
        .from('requests')
        .select('date_from, date_to')
        .eq('organization_id', orgId)
        .eq('employee_id', employee.id)
        .eq('type', 'vacation')
        .eq('status', 'approved')
        .gte('date_from', thisYearStart)
        .lte('date_from', thisYearEnd),
      supabase
        .from('company_settings')
        .select('extra_settings')
        .eq('organization_id', orgId)
        .maybeSingle(),
    ])

    if (logsResult.error) {
      console.error('employee-hours GET logs error:', logsResult.error)
      return NextResponse.json({ error: logsResult.error.message }, { status: 500 })
    }

    const logs: AttendanceRow[] = logsResult.data ?? []
    const vacationReqs = vacResult.data ?? []
    const extra = (settingsResult.data as { extra_settings?: Record<string, unknown> | null } | null)?.extra_settings ?? {}

    // Partition by month
    const thisMonthLogs = logs.filter((l) => l.date >= thisRange.firstDay && l.date <= thisRange.lastDay)
    const lastMonthLogs = logs.filter((l) => l.date >= lastRange.firstDay && l.date <= lastRange.lastDay)

    const thisStats = calcStats(thisMonthLogs)
    const lastStats = calcStats(lastMonthLogs)

    // Saturday / Sunday / special-day bonus eligibility
    const satBonusPct: number = extra['bonus_saturday_pct'] != null ? Number(extra['bonus_saturday_pct']) : 0
    const satBonusDepts: string[] = Array.isArray(extra['bonus_saturday_departments']) ? (extra['bonus_saturday_departments'] as string[]) : []
    const sunBonusPct: number = extra['bonus_sunday_pct'] != null ? Number(extra['bonus_sunday_pct']) : 0
    const sunBonusDepts: string[] = Array.isArray(extra['bonus_sunday_departments']) ? (extra['bonus_sunday_departments'] as string[]) : []

    interface SpecialBonusDay { id: string; dateFrom: string; dateTo: string; pct: number; departments: string[]; label: string }
    const specialDays: SpecialBonusDay[] = Array.isArray(extra['bonus_special_days']) ? (extra['bonus_special_days'] as SpecialBonusDay[]) : []

    const empDept: string = (employee as { department?: string | null }).department ?? ''
    const isSat = (dateStr: string): boolean => new Date(dateStr + 'T12:00:00').getDay() === 6
    const isSun = (dateStr: string): boolean => new Date(dateStr + 'T12:00:00').getDay() === 0
    const deptMatches = (allowed: string[], logDept: string): boolean =>
      allowed.length === 0 || allowed.includes(empDept) || allowed.includes(logDept)

    // Returns total special-day bonus pct for a given date (sums all matching rules)
    const specialPctFor = (dateStr: string, logDept: string): number =>
      specialDays.reduce((sum, rule) => {
        if (dateStr < rule.dateFrom || dateStr > rule.dateTo) return sum
        if (!deptMatches(rule.departments, logDept)) return sum
        return sum + rule.pct
      }, 0)

    // All logs for display (sorted by date desc, check_in desc)
    let thisMonthSatBonusHours = 0
    const recentLogs = logs.map((l) => {
      const durationHours =
        l.check_in && l.check_out
          ? (new Date(l.check_out).getTime() - new Date(l.check_in).getTime()) / 3_600_000
          : null

      const logDept = l.work_type_name ?? ''

      // Bonus applies if: pct is set AND dept matches
      let satBonusHours: number | null = null

      if (durationHours !== null) {
        let totalPct = 0

        if (satBonusPct > 0 && isSat(l.date) && deptMatches(satBonusDepts, logDept)) totalPct += satBonusPct
        if (sunBonusPct > 0 && isSun(l.date) && deptMatches(sunBonusDepts, logDept)) totalPct += sunBonusPct
        totalPct += specialPctFor(l.date, logDept)

        if (totalPct > 0) {
          satBonusHours = Math.round(durationHours * (totalPct / 100) * 100) / 100
          if (l.date >= thisRange.firstDay && l.date <= thisRange.lastDay) {
            thisMonthSatBonusHours += satBonusHours
          }
        }
      }

      return {
        date: l.date,
        check_in: l.check_in,
        check_out: l.check_out,
        duration: durationHours,
        work_type_name: l.work_type_name ?? null,
        sat_bonus_hours: satBonusHours,
      }
    })
    thisMonthSatBonusHours = Math.round(thisMonthSatBonusHours * 100) / 100

    // Count vacation days used
    let vacationUsed = 0
    for (const req of vacationReqs) {
      if (req.date_to && req.date_to > req.date_from) {
        const from = new Date(req.date_from)
        const to = new Date(req.date_to)
        const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
        vacationUsed += days
      } else {
        vacationUsed += 1
      }
    }
    const vacationTotal = (employee as { vacation_days_per_year?: number }).vacation_days_per_year ?? 20
    const vacationOffsetDays = Number((employee as { vacation_hours_offset?: number }).vacation_hours_offset ?? 0) / 8
    const vacationRemaining = Math.max(0, vacationTotal - vacationUsed - vacationOffsetDays)

    const BENEFIT_DEFS = [
      { key: 'blood',   czLabel: 'Darování krve',  enLabel: 'Blood donation',   hoursKey: 'benefit_blood_hours',   maxKey: 'benefit_blood_max' },
      { key: 'english', czLabel: 'Angličtina',      enLabel: 'English lessons',  hoursKey: 'benefit_english_hours', maxKey: 'benefit_english_max' },
      { key: 'gym',     czLabel: 'Cvičení',         enLabel: 'Gym',              hoursKey: 'benefit_gym_hours',     maxKey: 'benefit_gym_max' },
    ]

    const benefits = BENEFIT_DEFS
      .map((b) => ({
        key: b.key,
        czLabel: b.czLabel,
        enLabel: b.enLabel,
        hoursPerUnit: extra[b.hoursKey] != null ? Number(extra[b.hoursKey]) : null,
        maxPerMonth: extra[b.maxKey] != null ? Number(extra[b.maxKey]) : null,
      }))
      .filter((b) => b.hoursPerUnit != null)

    return NextResponse.json({
      employee: {
        name: employee.name,
      },
      vacation: {
        total: vacationTotal,
        used: vacationUsed,
        remaining: vacationRemaining,
      },
      thisMonth: {
        hours: thisStats.hours,
        days: thisStats.days,
        monthName: czechMonthName(thisYear, thisMonthNum),
        monthKey: `${thisYear}-${String(thisMonthNum).padStart(2, '0')}`,
        saturdayBonusHours: thisMonthSatBonusHours,
      },
      lastMonth: {
        hours: lastStats.hours,
        days: lastStats.days,
        monthName: czechMonthName(lastYear, lastMonthNum),
        monthKey: `${lastYear}-${String(lastMonthNum).padStart(2, '0')}`,
      },
      recentLogs,
      benefits,
    })
  } catch (err) {
    console.error('employee-hours unexpected error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}
