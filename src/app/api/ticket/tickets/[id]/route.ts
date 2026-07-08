import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isAdmin(req: NextRequest) {
  const pw = req.headers.get('X-Admin-Password')
  return !!pw && pw === process.env.TICKET_ADMIN_PASSWORD
}

async function getUser(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const { data: { user } } = await sb().auth.getUser(auth.slice(7))
  return user ?? null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = isAdmin(req)
  const user = admin ? null : await getUser(req)
  if (!admin && !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ticket, error } = await sb()
    .from('tickets').select('*').eq('id', params.id).single()
  if (error || !ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!admin && ticket.user_id !== user!.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: replies } = await sb()
    .from('ticket_replies')
    .select('*')
    .eq('ticket_id', params.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ ticket, replies: replies ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status } = await req.json()
  const { data, error } = await sb()
    .from('tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ticket: data })
}
