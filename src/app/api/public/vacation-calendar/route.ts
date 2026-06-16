import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Chybí konfigurace Supabase');
  return createSupabaseClient(url, key);
}

// GET /api/public/vacation-calendar?orgId=UUID
// Returns all approved + pending vacations for the org (public, no auth)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId) return NextResponse.json({ error: 'Chybí orgId.' }, { status: 400 });

    const supabase = getServiceClient();

    const { data: requests, error } = await supabase
      .from('requests')
      .select('id, employee_id, type, date_from, date_to, status, note, employees(name)')
      .eq('organization_id', orgId)
      .eq('type', 'vacation')
      .in('status', ['approved', 'pending'])
      .order('date_from');

    if (error) return NextResponse.json({ error: 'Chyba načítání.' }, { status: 500 });

    const { data: employees } = await supabase
      .from('employees')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name');

    return NextResponse.json({ requests: requests ?? [], employees: employees ?? [] });
  } catch (err) {
    console.error('GET /api/public/vacation-calendar error:', err);
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 });
  }
}
