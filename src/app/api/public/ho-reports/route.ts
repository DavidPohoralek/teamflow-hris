import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Chybí konfigurace Supabase');
  return createClient(url, key);
}

function isHO(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase().replace(/\s+/g, '');
  return n === 'ho' || n === 'homeoffice';
}

// GET /api/public/ho-reports?orgId=UUID&pin=XXXX
// Returns the authenticated employee's HomeOffice attendance logs with notes.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  const pin = searchParams.get('pin');

  if (!orgId || !pin) {
    return NextResponse.json({ error: 'Chybí parametry orgId nebo pin.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', orgId)
    .eq('active', true)
    .eq('pin_code', pin)
    .maybeSingle();

  if (empError || !employee) {
    return NextResponse.json({ error: 'Neplatný PIN.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, date, check_in, check_out, work_type_name, note')
    .eq('organization_id', orgId)
    .eq('employee_id', employee.id)
    .order('date', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'Chyba při načítání záznamů.' }, { status: 500 });
  }

  const hoLogs = (data ?? [])
    .filter((l) => isHO(l.work_type_name))
    .map((l) => ({
      id: l.id,
      date: l.date,
      checkIn: l.check_in,
      checkOut: l.check_out,
      note: l.note,
    }));

  return NextResponse.json({ logs: hoLogs });
}
