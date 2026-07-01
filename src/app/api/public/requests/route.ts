// SQL: ALTER TABLE requests ADD COLUMN IF NOT EXISTS hours NUMERIC DEFAULT NULL;
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const VALID_TYPES = ['vacation', 'sick', 'correction', 'other'] as const;
type RequestType = (typeof VALID_TYPES)[number];

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Chybí konfigurace Supabase');
  return createSupabaseClient(url, key);
}

// POST /api/public/requests
// Body: { orgId, pin, type, dateFrom, dateTo?, note? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, pin, type, dateFrom, dateTo, note, hours, timeIn, timeOut, correctionField, linkedLogId } = body as {
      orgId: string;
      pin: string;
      type: RequestType;
      dateFrom: string;
      dateTo?: string;
      note?: string;
      hours?: number;
      timeIn?: string;
      timeOut?: string;
      correctionField?: 'check_in' | 'check_out' | 'both';
      linkedLogId?: string;
    };

    // For correction: embed all correction metadata as JSON in note
    const storedNote = type === 'correction'
      ? JSON.stringify({
          field: correctionField ?? 'both',
          timeIn: timeIn ?? null,
          timeOut: timeOut ?? null,
          linkedLogId: linkedLogId ?? null,
          userNote: note ?? '',
        })
      : (note ?? null);

    if (!orgId || !pin || !type || !dateFrom) {
      return NextResponse.json(
        { error: 'Povinné pole chybí: orgId, pin, type, dateFrom.' },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Neplatný typ žádosti. Povolené hodnoty: ${VALID_TYPES.join(', ')}.` },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('organization_id', orgId)
      .or(`pin_code.eq.${pin},pin.eq.${pin}`)
      .maybeSingle();

    if (empError) {
      console.error('POST /api/public/requests - employee lookup error:', empError);
      return NextResponse.json({ error: 'Chyba při vyhledávání zaměstnance.' }, { status: 500 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Zaměstnanec s tímto PINem nebyl nalezen.' }, { status: 404 });
    }

    const insertPayload: Record<string, unknown> = {
      organization_id: orgId,
      employee_id: employee.id,
      type,
      date_from: dateFrom,
      date_to: dateTo ?? null,
      note: storedNote,
      status: 'pending',
    };
    if (hours != null) insertPayload.hours = hours;

    const { data: newRequest, error: insertError } = await supabase
      .from('requests')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      console.error('POST /api/public/requests - insert error:', insertError);
      return NextResponse.json({ error: 'Nepodařilo se vytvořit žádost.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, requestId: newRequest.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/public/requests error:', err);
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 });
  }
}

// DELETE /api/public/requests?orgId=UUID&pin=XXXX&requestId=UUID
// Deletes a request that belongs to the employee identified by PIN
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const pin = searchParams.get('pin');
    const requestId = searchParams.get('requestId');

    if (!orgId || !pin || !requestId) {
      return NextResponse.json({ error: 'Povinné parametry chybí: orgId, pin, requestId.' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('organization_id', orgId)
      .or(`pin_code.eq.${pin},pin.eq.${pin}`)
      .maybeSingle();

    if (empError || !employee) {
      return NextResponse.json({ error: 'Zaměstnanec s tímto PINem nebyl nalezen.' }, { status: 404 });
    }

    // Verify the request belongs to this employee
    const { data: existing } = await supabase
      .from('requests')
      .select('id, status')
      .eq('id', requestId)
      .eq('employee_id', employee.id)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Žádost nebyla nalezena.' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId);

    if (deleteError) {
      return NextResponse.json({ error: 'Nepodařilo se smazat žádost.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/public/requests error:', err);
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 });
  }
}

// GET /api/public/requests?orgId=UUID&pin=XXXX
// Returns requests for the employee identified by PIN
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const pin = searchParams.get('pin');

    if (!orgId || !pin) {
      return NextResponse.json(
        { error: 'Povinné parametry chybí: orgId, pin.' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('organization_id', orgId)
      .or(`pin_code.eq.${pin},pin.eq.${pin}`)
      .maybeSingle();

    if (empError) {
      console.error('GET /api/public/requests - employee lookup error:', empError);
      return NextResponse.json({ error: 'Chyba při vyhledávání zaměstnance.' }, { status: 500 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Zaměstnanec s tímto PINem nebyl nalezen.' }, { status: 404 });
    }

    const { data: requests, error: fetchError } = await supabase
      .from('requests')
      .select('id, type, date_from, date_to, note, status, created_at')
      .eq('organization_id', orgId)
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('GET /api/public/requests - fetch error:', fetchError);
      return NextResponse.json({ error: 'Nepodařilo se načíst žádosti.' }, { status: 500 });
    }

    return NextResponse.json({ requests });
  } catch (err) {
    console.error('GET /api/public/requests error:', err);
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 });
  }
}
