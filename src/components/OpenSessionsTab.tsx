'use client'

import { useCallback, useEffect, useState } from 'react'
import { managerFetch } from '@/lib/managerFetch'
import { useT } from '@/lib/i18n'

interface OpenSession {
  id: string
  employee_id: string
  date: string
  check_in: string
  work_type_name: string | null
  note: string | null
  employees: { id: string; name: string; department: string | null } | null
}

function buildISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}

export default function OpenSessionsTab({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const t = useT()
  const [sessions, setSessions] = useState<OpenSession[]>([])
  const [loading, setLoading] = useState(true)
  const [times, setTimes] = useState<Map<string, string>>(new Map())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await managerFetch('/api/manager/open-sessions')
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Chyba načítání')
      const list = (d.sessions ?? []) as OpenSession[]
      setSessions(list)
      onCountChange?.(list.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  async function closeSession(s: OpenSession) {
    const time = times.get(s.id)
    if (!time) {
      setError(t('Zadejte čas odchodu.', 'Enter a check-out time.'))
      return
    }
    setSavingId(s.id)
    setError(null)
    try {
      const res = await managerFetch(`/api/attendance/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify({ check_out: buildISO(s.date, time) }),
      })
      const resp = await res.json()
      if (!res.ok) throw new Error(resp.error ?? 'Uložení selhalo')
      setSessions(prev => {
        const next = prev.filter(x => x.id !== s.id)
        onCountChange?.(next.length)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení selhalo')
    } finally {
      setSavingId(null)
    }
  }

  // Group by date (newest first — API already sorts desc)
  const byDate: [string, OpenSession[]][] = []
  for (const s of sessions) {
    const last = byDate[byDate.length - 1]
    if (last && last[0] === s.date) last[1].push(s)
    else byDate.push([s.date, [s]])
  }

  return (
    <div className="p-6 max-w-3xl">
      <p className="text-xs text-gray-400 mb-4">
        {t('Směny z minulých dnů, kde se zaměstnanec zapomněl odhlásit. Bez odchodu se hodiny nezapočítají do výkazu — doplňte čas a záznam uzavřete.',
           'Past-day shifts where the employee forgot to check out. Without a check-out the hours are not counted — fill in the time and close the record.')}
      </p>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 font-medium">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          <div className="inline-flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            {t('Načítám…', 'Loading…')}
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-sm font-medium text-slate-600">{t('Žádné neuzavřené směny', 'No open sessions')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('Všichni se poctivě odhlašují.', 'Everyone checks out properly.')}</p>
        </div>
      ) : (
        byDate.map(([date, list]) => (
          <div key={date} className="mb-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{fmtDate(date)}</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {list.map(s => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 transition-colors">
                  <div className="w-44 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{s.employees?.name ?? '—'}</div>
                    <div className="text-[10px] text-slate-400">
                      {s.employees?.department ?? ''}
                      {s.work_type_name ? (s.employees?.department ? ' · ' : '') + s.work_type_name : ''}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">
                    {t('Příchod', 'In')}: <span className="font-semibold text-slate-700">{fmtTime(s.check_in)}</span>
                  </div>
                  <span className="text-slate-300">→</span>
                  <input
                    type="time"
                    value={times.get(s.id) ?? ''}
                    onChange={e => setTimes(prev => { const next = new Map(prev); next.set(s.id, e.target.value); return next })}
                    className="px-2 py-1.5 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    onClick={() => closeSession(s)}
                    disabled={savingId === s.id || !times.get(s.id)}
                    className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      times.get(s.id)
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {savingId === s.id ? '…' : t('Uzavřít', 'Close')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
