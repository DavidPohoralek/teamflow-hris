import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Public endpoint — employee adds their own shift identified by PIN.
// POST /api/public/schedule/add
// Body: { orgId, pin, date, workTypeId, startTime, endTime, note }

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  let body: {
    orgId?: string;
    pin?: string;
    date?: string;
    workTypeId?: string;
    startTime?: string;
    endTime?: string;
    note?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Neplatné tělo požadavku.' }, { status: 400 });
  }

  const { orgId, pin, date, workTypeId, startTime, endTime, note } = body;

  if (!orgId || !pin || !date || !workTypeId) {
    return NextResponse.json(
      { error: 'Pole orgId, pin, date a workTypeId jsou povinná.' },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Datum musí být ve formátu YYYY-MM-DD.' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Find employee by PIN within the given organization
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employee, error: empError } = await (supabase as any)
    .from('employees')
    .select('id')
    .eq('organization_id', orgId)
    .or(`pin_code.eq.${pin},pin.eq.${pin}`)
    .eq('active', true)
    .single();

  if (empError || !employee) {
    return NextResponse.json({ error: 'Zaměstnanec s tímto PINem nebyl nalezen.' }, { status: 404 });
  }

  // Look up work type name for work_type text column
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wtData } = await (supabase as any)
    .from('work_types')
    .select('name')
    .eq('id', workTypeId)
    .maybeSingle();

  // Insert work_plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from('work_plans')
    .insert({
      organization_id: orgId,
      employee_id: employee.id,
      date,
      work_type_id: workTypeId,
      work_type: wtData?.name ?? null,
      start_time: startTime ?? null,
      end_time: endTime ?? null,
      note: note ?? null,
      active: true,
    });

  if (insertError) {
    console.error('public/schedule/add insert error:', insertError);
    return NextResponse.json({ error: 'Nepodařilo se přidat směnu.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
