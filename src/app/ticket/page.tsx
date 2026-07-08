'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ──────────────────────────────────────────────────────────────────

interface Ticket {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  title: string
  description: string
  reason: string | null
  impact: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'in_progress' | 'resolved'
  created_at: string
  updated_at: string
}

interface Reply {
  id: string
  ticket_id: string
  content: string
  is_admin: boolean
  author_name: string | null
  created_at: string
}

type View = 'login' | 'list' | 'new' | 'detail'
type LoginTab = 'user' | 'admin'

// ─── Constants ────────────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<string, string> = { low: 'Nízká', medium: 'Střední', high: 'Vysoká' }
const PRIORITY_STYLE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-red-100 text-red-700 border-red-200',
}
const STATUS_LABEL: Record<string, string> = { open: 'Otevřený', in_progress: 'Řeší se', resolved: 'Vyřešeno' }
const STATUS_STYLE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Component ───────────────────────────────────────────────────────────

export default function TicketPage() {
  const [view, setView] = useState<View>('login')
  const [loginTab, setLoginTab] = useState<LoginTab>('user')

  // Auth state
  const [accessToken, setAccessToken] = useState('')
  const [userName, setUserName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPw, setAdminPw] = useState('')

  // Login form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminPwInput, setAdminPwInput] = useState('')

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])

  // New ticket form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('')
  const [impact, setImpact] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')

  // Reply
  const [replyText, setReplyText] = useState('')

  // UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Restore session ──────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('tf_ticket_session')
      if (raw) {
        const s = JSON.parse(raw)
        setAccessToken(s.token); setUserName(s.name); setView('list')
      }
      const rawAdmin = sessionStorage.getItem('tf_ticket_admin')
      if (rawAdmin) {
        setIsAdmin(true); setAdminPw(rawAdmin); setView('list')
      }
    } catch { /* ignore */ }
  }, [])

  // ── Auth helpers ─────────────────────────────────────────────────────────

  const userHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(isAdmin ? { 'X-Admin-Password': adminPw } : {}),
  }), [accessToken, isAdmin, adminPw])

  const adminHeaders = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    'X-Admin-Password': adminPw,
  }), [adminPw])

  // ── Fetch tickets ────────────────────────────────────────────────────────

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ticket/tickets', { headers: isAdmin ? adminHeaders() : userHeaders() })
      if (!res.ok) { setError('Nepodařilo se načíst tickety.'); return }
      const json = await res.json()
      setTickets(json.tickets ?? [])
    } catch { setError('Chyba připojení.') }
    finally { setLoading(false) }
  }, [userHeaders, adminHeaders, isAdmin])

  useEffect(() => { if (view === 'list') fetchTickets() }, [view, fetchTickets])

  // ── Login ────────────────────────────────────────────────────────────────

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr || !data.session) { setError('Nesprávný email nebo heslo.'); return }
      const token = data.session.access_token
      const name = (data.user.user_metadata?.full_name as string | undefined) ?? data.user.email ?? email
      setAccessToken(token); setUserName(name)
      sessionStorage.setItem('tf_ticket_session', JSON.stringify({ token, name }))
      setView('list')
    } catch { setError('Chyba připojení.') }
    finally { setLoading(false) }
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await fetch('/api/ticket/tickets', {
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPwInput },
      })
      if (!res.ok) { setError('Nesprávné admin heslo.'); return }
      setIsAdmin(true); setAdminPw(adminPwInput); setUserName('Admin')
      sessionStorage.setItem('tf_ticket_admin', adminPwInput)
      setView('list')
    } catch { setError('Chyba připojení.') }
    finally { setLoading(false) }
  }

  const handleLogout = () => {
    supabase.auth.signOut()
    sessionStorage.removeItem('tf_ticket_session')
    sessionStorage.removeItem('tf_ticket_admin')
    setAccessToken(''); setUserName(''); setIsAdmin(false); setAdminPw('')
    setTickets([]); setView('login')
  }

  // ── Create ticket ─────────────────────────────────────────────────────────

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) { setError('Vyplňte název a popis.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/ticket/tickets', {
        method: 'POST',
        headers: userHeaders(),
        body: JSON.stringify({ title, description, reason, impact, priority }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Chyba'); return }
      setTitle(''); setDescription(''); setReason(''); setImpact(''); setPriority('medium')
      setSuccess('Ticket byl úspěšně odeslán.')
      setTimeout(() => setSuccess(''), 3000)
      setView('list')
    } catch { setError('Chyba připojení.') }
    finally { setLoading(false) }
  }

  // ── Open ticket detail ────────────────────────────────────────────────────

  const openDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket); setReplies([]); setView('detail')
    try {
      const res = await fetch(`/api/ticket/tickets/${ticket.id}`, {
        headers: isAdmin ? adminHeaders() : userHeaders(),
      })
      if (res.ok) {
        const json = await res.json()
        setSelectedTicket(json.ticket)
        setReplies(json.replies ?? [])
      }
    } catch { /* ignore */ }
  }

  // ── Status change (admin) ─────────────────────────────────────────────────

  const changeStatus = async (status: string) => {
    if (!selectedTicket) return
    try {
      const res = await fetch(`/api/ticket/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const json = await res.json()
        setSelectedTicket(json.ticket)
        setTickets(prev => prev.map(t => t.id === json.ticket.id ? json.ticket : t))
      }
    } catch { /* ignore */ }
  }

  // ── Add reply ─────────────────────────────────────────────────────────────

  const handleAddReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !selectedTicket) return
    setLoading(true)
    try {
      const res = await fetch(`/api/ticket/tickets/${selectedTicket.id}/replies`, {
        method: 'POST',
        headers: isAdmin ? adminHeaders() : userHeaders(),
        body: JSON.stringify({ content: replyText }),
      })
      if (res.ok) {
        const json = await res.json()
        setReplies(prev => [...prev, json.reply])
        setReplyText('')
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── LOGIN ── */}
      {view === 'login' && (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">TeamFlow Podpora</h1>
              <p className="text-sm text-slate-500 mt-1">Nahlaste nápad nebo problém k řešení</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                {(['user', 'admin'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setLoginTab(tab); setError('') }}
                    className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${loginTab === tab ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500 hover:text-slate-700'}`}
                  >
                    {tab === 'user' ? 'Zaměstnanec' : 'Admin'}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* User login */}
                {loginTab === 'user' && (
                  <form onSubmit={handleUserLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                      <input
                        type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="vas@email.cz"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Heslo</label>
                      <input
                        type="password" required value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
                    <button
                      type="submit" disabled={loading}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Přihlašuji…' : 'Přihlásit se'}
                    </button>
                    <p className="text-xs text-center text-slate-400">Přihlaste se pomocí TeamFlow přihlašovacích údajů</p>
                  </form>
                )}

                {/* Admin login */}
                {loginTab === 'admin' && (
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Admin heslo</label>
                      <input
                        type="password" required value={adminPwInput} onChange={e => setAdminPwInput(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
                    <button
                      type="submit" disabled={loading}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Přihlašuji…' : 'Přihlásit se jako admin'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LIST ── */}
      {view === 'list' && (
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </span>
                TeamFlow Podpora
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-500">{userName}</span>
                {isAdmin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 text-white rounded-full uppercase tracking-wide">Admin</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isAdmin && (
                <button
                  onClick={() => { setError(''); setView('new') }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Nový ticket
                </button>
              )}
              <button onClick={handleLogout} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors">
                Odhlásit
              </button>
            </div>
          </div>

          {success && (
            <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">✓ {success}</div>
          )}

          {/* Ticket list */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <p className="text-sm">Žádné tickety</p>
              {!isAdmin && <button onClick={() => setView('new')} className="mt-3 text-indigo-600 text-sm font-medium hover:underline">Vytvořit první ticket →</button>}
            </div>
          ) : (
            <div className="space-y-3">
              {isAdmin && (
                <p className="text-xs text-slate-400 mb-2">{tickets.length} ticketů celkem</p>
              )}
              {tickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => openDetail(ticket)}
                  className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[ticket.priority]}`}>
                          {PRIORITY_LABEL[ticket.priority]}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[ticket.status]}`}>
                          {STATUS_LABEL[ticket.status]}
                        </span>
                        {isAdmin && ticket.user_email && (
                          <span className="text-[11px] text-slate-400">{ticket.user_name ?? ticket.user_email}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">{ticket.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{ticket.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-slate-400">{fmtShort(ticket.created_at)}</p>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 mt-1 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NEW TICKET ── */}
      {view === 'new' && (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button onClick={() => { setView('list'); setError('') }} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Zpět
          </button>

          <h2 className="text-xl font-bold text-slate-900 mb-6">Nový ticket</h2>

          <form onSubmit={handleCreateTicket} className="space-y-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Název <span className="text-red-500">*</span></label>
              <input
                required value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Stručný popis tématu"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Co chcete zlepšit? <span className="text-red-500">*</span></label>
              <textarea
                required rows={4} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Popište situaci nebo funkci, kterou byste rádi viděli…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Proč je to potřeba?</label>
              <textarea
                rows={3} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Jaký problém to řeší nebo co vám chybí?"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jaký by to mělo dopad?</label>
              <textarea
                rows={3} value={impact} onChange={e => setImpact(e.target.value)}
                placeholder="Komu a čemu by to pomohlo? Kolik lidí to ovlivní?"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Důležitost</label>
              <div className="flex gap-3">
                {(['low', 'medium', 'high'] as const).map(p => (
                  <label key={p} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${priority === p ? `border-current ${PRIORITY_STYLE[p]}` : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <input type="radio" name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)} className="sr-only" />
                    {PRIORITY_LABEL[p]}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setView('list'); setError('') }} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                Zrušit
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {loading ? 'Odesílám…' : 'Odeslat ticket'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── DETAIL ── */}
      {view === 'detail' && selectedTicket && (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button onClick={() => { setView('list'); setReplyText('') }} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Zpět na tickety
          </button>

          {/* Ticket card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex-1">{selectedTicket.title}</h2>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${PRIORITY_STYLE[selectedTicket.priority]}`}>
                  {PRIORITY_LABEL[selectedTicket.priority]}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[selectedTicket.status]}`}>
                  {STATUS_LABEL[selectedTicket.status]}
                </span>
              </div>
            </div>

            {isAdmin && (
              <p className="text-xs text-slate-400 mb-3">od {selectedTicket.user_name ?? selectedTicket.user_email} · {fmt(selectedTicket.created_at)}</p>
            )}
            {!isAdmin && (
              <p className="text-xs text-slate-400 mb-3">{fmt(selectedTicket.created_at)}</p>
            )}

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Co chceme zlepšit</p>
                <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
              {selectedTicket.reason && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Proč je to potřeba</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.reason}</p>
                </div>
              )}
              {selectedTicket.impact && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Očekávaný dopad</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.impact}</p>
                </div>
              )}
            </div>

            {/* Admin: status controls */}
            {isAdmin && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 mb-2">Změnit stav</p>
                <div className="flex gap-2">
                  {(['open', 'in_progress', 'resolved'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedTicket.status === s ? `${STATUS_STYLE[s]} ring-2 ring-offset-1 ring-current` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Replies */}
          <div className="space-y-3 mb-4">
            {replies.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-4">Žádné odpovědi</p>
            )}
            {replies.map(reply => (
              <div key={reply.id} className={`flex ${reply.is_admin ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${reply.is_admin ? 'bg-slate-800 text-white rounded-tl-sm' : 'bg-indigo-600 text-white rounded-tr-sm'}`}>
                  <p className="font-semibold text-[11px] mb-1 opacity-70">{reply.author_name ?? (reply.is_admin ? 'Admin' : 'Já')}</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                  <p className="text-[10px] mt-1.5 opacity-50">{fmt(reply.created_at)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply form */}
          {selectedTicket.status !== 'resolved' && (
            <form onSubmit={handleAddReply} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <textarea
                rows={3} value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder={isAdmin ? 'Napište odpověď zákazníkovi…' : 'Napište zprávu…'}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3"
              />
              <div className="flex justify-end">
                <button
                  type="submit" disabled={loading || !replyText.trim()}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl text-white transition-colors disabled:opacity-40 ${isAdmin ? 'bg-slate-800 hover:bg-slate-900' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {loading ? 'Odesílám…' : 'Odeslat'}
                </button>
              </div>
            </form>
          )}
          {selectedTicket.status === 'resolved' && (
            <div className="text-center py-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-700 font-medium">
              ✓ Tento ticket byl vyřešen
            </div>
          )}
        </div>
      )}
    </div>
  )
}
