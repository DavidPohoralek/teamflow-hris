import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function sb() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isAdmin(req: NextRequest) {
  const pw = req.headers.get('X-Admin-Password')
  const expected = process.env.TICKET_ADMIN_PASSWORD ?? 'Admin2026!'
  return !!pw && pw === expected
}

async function getUser(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const { data: { user } } = await sb().auth.getUser(auth.slice(7))
  return user ?? null
}

export async function GET(req: NextRequest) {
  if (isAdmin(req)) {
    const { data, error } = await sb()
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tickets: data ?? [] })
  }

  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await sb()
    .from('tickets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tickets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, reason, impact, priority } = body
  if (!title || !description) return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })

  const { data, error } = await sb()
    .from('tickets')
    .insert({
      user_id: user.id,
      user_email: user.email!,
      user_name: (user.user_metadata?.full_name ?? user.user_metadata?.name ?? null) as string | null,
      title: title.trim(),
      description: description.trim(),
      reason: reason?.trim() || null,
      impact: impact?.trim() || null,
      priority: priority ?? 'medium',
      status: 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ticket: data }, { status: 201 })
}
