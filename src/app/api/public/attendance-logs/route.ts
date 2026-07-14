import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Chybí konfigurace Supabase');
  return createClient(url, key);
}

// GET /api/public/attendance-logs?orgId=UUID&pin=XXXX&date=YYYY-MM-DD
// Returns the authenticated employee's own attendance logs for the given date.
// Used by the correction request form to let employees find their existing log.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId');
  const pin = searchParams.get('pin');
  const date = searchParams.get('date');

  if (!orgId || !pin || !date) {
    return NextResponse.json({ error: 'Chybí parametry orgId, pin nebo date.' }, { status: 400 });
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
    .select('id, check_in, check_out, work_type_name')
    .eq('organization_id', orgId)
    .eq('employee_id', employee.id)
    .eq('date', date)
    .order('check_in', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Chyba při načítání záznamů.' }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}
