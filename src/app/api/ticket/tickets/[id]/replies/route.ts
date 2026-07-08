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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = isAdmin(req)
  const user = admin ? null : await getUser(req)
  if (!admin && !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Chybí obsah' }, { status: 400 })

  const { data: ticket } = await sb().from('tickets').select('user_id').eq('id', params.id).single()
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!admin && ticket.user_id !== user!.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await sb()
    .from('ticket_replies')
    .insert({
      ticket_id: params.id,
      content: content.trim(),
      is_admin: admin,
      author_name: admin ? 'Admin' : (user?.user_metadata?.full_name ?? user?.email ?? 'Uživatel'),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reply: data }, { status: 201 })
}
