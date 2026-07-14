import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Chybí konfigurace Supabase')
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceClient()
    const slug = new URL(req.url).searchParams.get('slug')

    let query = supabase.from('organizations').select('id, name')

    if (slug) {
      query = query.eq('slug', slug)
    } else {
      // No slug — refuse to guess; kiosk must always supply ?slug=
      return NextResponse.json({ error: 'Parametr slug je povinný' }, { status: 400 })
    }

    const { data: org, error } = await query.single()

    if (error || !org) {
      return NextResponse.json({ error: 'Žádná organizace nenalezena' }, { status: 404 })
    }

    return NextResponse.json({ id: org.id, name: org.name })
  } catch (err) {
    console.error('GET /api/public/org error:', err)
    return NextResponse.json({ error: 'Interní chyba serveru' }, { status: 500 })
  }
}
