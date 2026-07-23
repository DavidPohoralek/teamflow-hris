'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { managerFetch } from '@/lib/managerFetch'
import { useT } from '@/lib/i18n'

interface Employee {
  id: string
  name: string
  department: string | null
}

interface BonusEntry {
  id: string
  employee_id: string
  month: string
  amount: number
  note: string | null
  granted_by: string | null
  created_at: string
}

interface MonthSummary {
  month: string
  total: number
  count: number
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string): string {
  return new Date(month + '-15T00:00:00').toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
}

const fmtCZK = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })

export default function BonusesTab() {
  const t = useT()
  const [month, setMonth] = useState(currentMonth())
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<BonusEntry[]>([])
  const [summary, setSummary] = useState<MonthSummary[]>([])
  const [loading, setLoading] = useState(true)
  // Add-form drafts keyed by employee id
  const [drafts, setDrafts] = useState<Map<string, { amount: string; note: string }>>(new Map())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const isCurrentMonth = month === currentMonth()

  // Scoped list — a manager only hands out bonuses to their own people
  useEffect(() => {
    managerFetch('/api/employees')
      .then(r => r.json())
      .then(d => setEmployees((d.employees ?? []).map((e: Employee) => ({ id: e.id, name: e.name, department: e.department }))))
      .catch(() => {})
  }, [])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await managerFetch(`/api/manager/bonuses?month=${month}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Chyba načítání')
      setEntries((d.bonuses ?? []) as BonusEntry[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [month])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await managerFetch('/api/manager/bonuses?summary=1')
      const d = await res.json()
      if (res.ok) setSummary((d.summary ?? []) as MonthSummary[])
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  const entriesByEmployee = useMemo(() => {
    const map = new Map<string, BonusEntry[]>()
    for (const e of entries) {
      if (!map.has(e.employee_id)) map.set(e.employee_id, [])
      map.get(e.employee_id)!.push(e)
    }
    return map
  }, [entries])

  function draftFor(empId: string): { amount: string; note: string } {
    return drafts.get(empId) ?? { amount: '', note: '' }
  }

  function setDraft(empId: string, patch: Partial<{ amount: string; note: string }>) {
    setDrafts(prev => {
      const next = new Map(prev)
      next.set(empId, { ...draftFor(empId), ...patch })
      return next
    })
  }

  async function addBonus(empId: string) {
    const d = draftFor(empId)
    const amount = Number(d.amount.replace(',', '.'))
    if (!d.amount.trim() || isNaN(amount) || amount <= 0) {
      setError(t('Zadejte kladnou částku.', 'Enter a positive amount.'))
      return
    }
    setSavingId(empId)
    setError(null)
    try {
      const res = await managerFetch('/api/manager/bonuses', {
        method: 'POST',
        body: JSON.stringify({ employee_id: empId, month, amount, note: d.note }),
      })
      const resp = await res.json()
      if (!res.ok) throw new Error(resp.error ?? 'Uložení selhalo')
      setEntries(prev => [...prev, resp.bonus as BonusEntry])
      setDrafts(prev => { const next = new Map(prev); next.delete(empId); return next })
      fetchSummary()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení selhalo')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteEntry(entryId: string) {
    setDeletingId(entryId)
    setError(null)
    try {
      const res = await managerFetch(`/api/manager/bonuses?id=${entryId}`, { method: 'DELETE' })
      const resp = await res.json()
      if (!res.ok) throw new Error(resp.error ?? 'Smazání selhalo')
      setEntries(prev => prev.filter(e => e.id !== entryId))
      fetchSummary()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Smazání selhalo')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(e => e.name.toLowerCase().includes(q) || (e.department ?? '').toLowerCase().includes(q))
  }, [employees, search])

  const monthTotal = useMemo(() => entries.reduce((s, e) => s + (Number(e.amount) || 0), 0), [entries])

  const grouped = useMemo(() => {
    const map = new Map<string, Employee[]>()
    for (const e of filtered) {
      const key = e.department ?? t('Bez oddělení', 'No department')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'cs'))
  }, [filtered, t])

  return (
    <div className="p-6 max-w-4xl">
      {/* Month navigation */}
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(m => shiftMonth(m, -1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[150px] text-center capitalize">{monthLabel(month)}</span>
          <button
            onClick={() => setMonth(m => shiftMonth(m, 1))}
            disabled={isCurrentMonth}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => setMonth(currentMonth())}
              className="ml-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {t('Aktuální měsíc', 'Current month')}
            </button>
          )}
        </div>

        <button
          onClick={() => setShowHistory(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            showHistory ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          📊 {t('Historie', 'History')}
        </button>

        <div className="relative ml-auto">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('Hledat…', 'Search…')}
            className="pl-7 pr-3 py-1.5 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 w-44"
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        {t('Bonusy pro podřízené — jednomu člověku lze přidat i více bonusů za měsíc. Bonusy se propíší do exportu jako „Bonus od vedoucího“.',
           'Bonuses for your people — one person can receive multiple bonuses per month. Bonuses appear in the export as "Manager bonus".')}
      </p>

      {/* Month-by-month history */}
      {showHistory && (
        <div className="mb-5 border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-widest">
            {t('Historie po měsících', 'Month-by-month history')}
          </div>
          {summary.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-400">{t('Zatím žádné bonusy.', 'No bonuses yet.')}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {summary.map(s => (
                <button
                  key={s.month}
                  onClick={() => { setMonth(s.month); setShowHistory(false) }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${s.month === month ? 'bg-blue-50/60' : 'bg-white'}`}
                >
                  <span className="font-medium text-slate-700 capitalize">{monthLabel(s.month)}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{s.count}× {t('bonus', 'bonus')}</span>
                    <span className="font-bold text-slate-800">{fmtCZK(s.total)} Kč</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!isCurrentMonth && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
          🕐 {t('Prohlížíte historii —', 'Viewing history —')} {monthLabel(month)}
        </div>
      )}

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
      ) : (
        <>
          {grouped.map(([dept, emps]) => (
            <div key={dept} className="mb-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{dept}</h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {emps.map(emp => {
                  const empEntries = entriesByEmployee.get(emp.id) ?? []
                  const empTotal = empEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0)
                  const d = draftFor(emp.id)
                  return (
                    <div key={emp.id} className="px-4 py-2.5 bg-white hover:bg-slate-50/60 transition-colors">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="w-44 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">{emp.name}</div>
                          {empTotal > 0 && (
                            <div className="text-[11px] font-semibold text-emerald-600">{fmtCZK(empTotal)} Kč</div>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="text" inputMode="decimal"
                            value={d.amount}
                            onChange={e => setDraft(emp.id, { amount: e.target.value.replace(/[^0-9.,]/g, '') })}
                            onKeyDown={e => { if (e.key === 'Enter') addBonus(emp.id) }}
                            placeholder="0"
                            className="w-28 pl-3 pr-9 py-1.5 rounded-lg text-sm text-right border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">Kč</span>
                        </div>
                        <input
                          type="text"
                          value={d.note}
                          onChange={e => setDraft(emp.id, { note: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') addBonus(emp.id) }}
                          placeholder={t('Poznámka (nepovinné)', 'Note (optional)')}
                          className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                          onClick={() => addBonus(emp.id)}
                          disabled={savingId === emp.id || !d.amount.trim()}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            d.amount.trim()
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {savingId === emp.id ? '…' : `＋ ${t('Přidat', 'Add')}`}
                        </button>
                      </div>

                      {/* Existing entries for the month */}
                      {empEntries.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1">
                          {empEntries.map(entry => (
                            <div key={entry.id} className="flex items-center gap-2 pl-1 text-xs text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              <span className="font-semibold text-slate-700">{fmtCZK(Number(entry.amount))} Kč</span>
                              {entry.note && <span className="text-slate-400 truncate">— {entry.note}</span>}
                              <span className="text-slate-300 ml-auto shrink-0">
                                {entry.granted_by ? `${entry.granted_by} · ` : ''}
                                {new Date(entry.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
                              </span>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                disabled={deletingId === entry.id}
                                title={t('Smazat bonus', 'Delete bonus')}
                                className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">{t('Žádní zaměstnanci.', 'No employees.')}</div>
          )}

          {/* Summary */}
          <div className="mt-6 flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-sm font-medium text-slate-600">
              {t('Celkem za', 'Total for')} {monthLabel(month)}
            </span>
            <span className="text-base font-bold text-slate-800">{fmtCZK(monthTotal)} Kč</span>
          </div>
        </>
      )}
    </div>
  )
}
