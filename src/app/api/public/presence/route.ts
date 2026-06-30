import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/public/presence?orgId=UUID          → vrátí všechny přítomné (Přehled dashboard)
// GET /api/public/presence?orgId=UUID&pin=XXXX  → vrátí stav konkrétního zaměstnance (Kiosk)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  const pin = searchParams.get('pin');

  if (!orgId) {
    return NextResponse.json(
      { error: 'Chybí povinný parametr: orgId.' },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().slice(0, 10);

  // --- KIOSK MODE: pin provided → validate and return single employee status ---
  if (pin) {
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name, active')
      .eq('organization_id', orgId)
      .or(`pin_code.eq.${pin},pin.eq.${pin}`)
      .eq('active', true)
      .maybeSingle();

    if (empError || !employee) {
      return NextResponse.json({ error: 'Neplatný PIN kód' }, { status: 401 });
    }

    // Check if already checked in today without checkout (pick most recent open session)
    const { data: openLogs } = await supabase
      .from('attendance_logs')
      .select('id, check_in, work_type_name')
      .eq('organization_id', orgId)
      .eq('employee_id', employee.id)
      .eq('date', today)
      .not('check_in', 'is', null)
      .is('check_out', null)
      .order('check_in', { ascending: false })
      .limit(1)
    const openLog = openLogs?.[0] ?? null;

    return NextResponse.json({
      employeeId: employee.id,
      employeeName: employee.name,
      presence: openLog
        ? { checkIn: openLog.check_in, workTypeName: openLog.work_type_name ?? null }
        : null,
    });
  }

  // --- DASHBOARD MODE: no pin → return all present employees ---
  const { data: logs, error } = await supabase
    .from('attendance_logs')
    .select(
      `
      employee_id,
      check_in,
      check_out,
      work_type_id,
      employee:employees(name),
      work_type:work_types(name, color)
      `
    )
    .eq('organization_id', orgId)
    .eq('date', today)
    .not('check_in', 'is', null)
    .is('check_out', null);

  if (error) {
    console.error('GET public/presence error:', error);
    return NextResponse.json(
      { error: 'Chyba při načítání dat o přítomnosti.' },
      { status: 500 }
    );
  }

  const now = new Date();

  // Sestavíme seznam přítomných zaměstnanců
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const present = (logs ?? []).map((log: any) => {
    const checkInDate = new Date(log.check_in);
    const duration = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);

    return {
      employeeId: log.employee_id as string,
      employeeName: log.employee
        ? log.employee.name
        : 'Neznámý zaměstnanec',
      workTypeName: log.work_type?.name ?? null,
      workTypeColor: log.work_type?.color ?? null,
      checkIn: log.check_in as string,
      duration,
    };
  });

  // Souhrn podle typu práce
  const byWorkTypeMap = new Map<
    string,
    { workTypeName: string; color: string | null; count: number }
  >();

  for (const p of present) {
    const key = p.workTypeName ?? 'Neurčeno';
    if (byWorkTypeMap.has(key)) {
      byWorkTypeMap.get(key)!.count++;
    } else {
      byWorkTypeMap.set(key, {
        workTypeName: key,
        color: p.workTypeColor,
        count: 1,
      });
    }
  }

  const byWorkType = Array.from(byWorkTypeMap.values()).sort(
    (a, b) => b.count - a.count
  );

  return NextResponse.json({
    present,
    summary: {
      total: present.length,
      byWorkType,
    },
  });
}
