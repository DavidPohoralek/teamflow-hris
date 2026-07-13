import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Chybí konfigurace Supabase')
  return createClient(url, key)
}

export async function GET() {
  try {
    const supabase = getServiceClient()

    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error || !org) {
      return NextResponse.json({ error: 'Žádná organizace nenalezena' }, { status: 404 })
    }

    return NextResponse.json({ id: org.id, name: org.name })
  } catch (err) {
    console.error('GET /api/public/org error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}
