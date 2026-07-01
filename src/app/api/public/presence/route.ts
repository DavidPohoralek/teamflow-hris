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
      .select('id, name, active, department')
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
      employeeDepartment: (employee as { department?: string | null }).department ?? null,
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
  const present: {
    employeeId: string;
    employeeName: string;
    workTypeName: string | null;
    workTypeColor: string | null;
    checkIn: string;
    duration: number;
    planned?: true;
  }[] = (logs ?? []).map((log: any) => {
    const checkInDate = new Date(log.check_in);
    const duration = Math.floor((now.getTime() - checkInDate.getTime()) / 60000);
    return {
      employeeId: log.employee_id as string,
      employeeName: log.employee ? log.employee.name : 'Neznámý zaměstnanec',
      workTypeName: log.work_type?.name ?? null,
      workTypeColor: log.work_type?.color ?? null,
      checkIn: log.check_in as string,
      duration,
    };
  });

  // Also surface employees with a planned HO work_plan for today (within planned hours)
  // even if they haven't submitted a kiosk record yet
  {
    const presentIds = new Set(present.map((p) => p.employeeId));

    const { data: orgEmps } = await supabase
      .from('employees')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true);

    if (orgEmps && orgEmps.length > 0) {
      const empIdToName = new Map(orgEmps.map((e: { id: string; name: string }) => [e.id, e.name]));
      const empIds = orgEmps.map((e: { id: string }) => e.id);

      const { data: hoPlans } = await supabase
        .from('work_plans')
        .select('employee_id, work_type, start_time, end_time')
        .in('employee_id', empIds)
        .eq('date', today)
        .eq('active', true);

      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hh}:${mm}:00`;

      for (const plan of (hoPlans ?? []) as { employee_id: string; work_type?: string; start_time?: string | null; end_time?: string | null }[]) {
        const wt = plan.work_type ?? '';
        const n = wt.toLowerCase().replace(/\s+/g, '');
        if (n !== 'ho' && n !== 'homeoffice') continue;
        if (presentIds.has(plan.employee_id)) continue;

        const start = plan.start_time ?? null;
        const end = plan.end_time ?? null;
        const withinWindow = start && end
          ? currentTimeStr >= start && currentTimeStr <= end
          : true;
        if (!withinWindow) continue;

        const checkIn = `${today}T${start ?? '00:00:00'}`;
        const duration = start
          ? Math.max(0, Math.floor((now.getTime() - new Date(checkIn).getTime()) / 60000))
          : 0;

        present.push({
          employeeId: plan.employee_id,
          employeeName: empIdToName.get(plan.employee_id) ?? 'Neznámý zaměstnanec',
          workTypeName: wt || 'HomeOffice',
          workTypeColor: null,
          checkIn,
          duration,
          planned: true,
        });
        presentIds.add(plan.employee_id);
      }
    }
  }

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
