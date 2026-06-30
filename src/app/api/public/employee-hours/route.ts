import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
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

    // Lookup employee by PIN + org
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name, active, vacation_days_per_year')
      .eq('organization_id', orgId)
      .or(`pin_code.eq.${pin},pin.eq.${pin}`)
      .single()

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

    // Fetch this month + last month + recent logs in one query (last 10 by date desc)
    const earliestDate = lastRange.firstDay

    const { data: allLogs, error: logsError } = await supabase
      .from('attendance_logs')
      .select('date, check_in, check_out, work_type_name')
      .eq('organization_id', orgId)
      .eq('employee_id', employee.id)
      .gte('date', earliestDate)
      .order('date', { ascending: false })
      .order('check_in', { ascending: true })

    if (logsError) {
      console.error('employee-hours GET logs error:', logsError)
      return NextResponse.json({ error: logsError.message }, { status: 500 })
    }

    const logs: AttendanceRow[] = allLogs ?? []

    // Partition by month
    const thisMonthLogs = logs.filter((l) => l.date >= thisRange.firstDay && l.date <= thisRange.lastDay)
    const lastMonthLogs = logs.filter((l) => l.date >= lastRange.firstDay && l.date <= lastRange.lastDay)

    const thisStats = calcStats(thisMonthLogs)
    const lastStats = calcStats(lastMonthLogs)

    // Recent 10 logs (already sorted by date desc from query)
    const recentSource = logs.slice(0, 10)
    const recentLogs = recentSource.map((l) => {
      const durationHours =
        l.check_in && l.check_out
          ? (new Date(l.check_out).getTime() - new Date(l.check_in).getTime()) / 3_600_000
          : null

      return {
        date: l.date,
        check_in: l.check_in,
        check_out: l.check_out,
        duration: durationHours,
        work_type_name: l.work_type_name ?? null,
      }
    })

    // Fetch vacation requests (approved) for this year
    const thisYearStart = `${thisYear}-01-01`
    const thisYearEnd = `${thisYear}-12-31`
    const { data: vacationReqs } = await supabase
      .from('requests')
      .select('date_from, date_to')
      .eq('organization_id', orgId)
      .eq('employee_id', employee.id)
      .eq('type', 'vacation')
      .eq('status', 'approved')
      .gte('date_from', thisYearStart)
      .lte('date_from', thisYearEnd)

    // Count vacation days used (each request = date_from to date_to inclusive, or 1 day if no date_to)
    let vacationUsed = 0
    for (const req of vacationReqs ?? []) {
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
    const vacationRemaining = Math.max(0, vacationTotal - vacationUsed)

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
      },
      lastMonth: {
        hours: lastStats.hours,
        days: lastStats.days,
        monthName: czechMonthName(lastYear, lastMonthNum),
      },
      recentLogs,
    })
  } catch (err) {
    console.error('employee-hours unexpected error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}
