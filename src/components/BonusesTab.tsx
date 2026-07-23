'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { managerFetch } from '@/lib/managerFetch'
import { useT } from '@/lib/i18n'

interface Employee {
  id: string
  name: string
  department: string | null
}

interface BonusRow {
  id: string
  employee_id: string
  month: string
  amount: number
  note: string | null
  granted_by: string | null
  updated_at: string
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string, lang: string): string {
  return new Date(month + '-15T00:00:00').toLocaleDateString(lang === 'en' ? 'en-GB' : 'cs-CZ', { month: 'long', year: 'numeric' })
}

export default function BonusesTab() {
  const t = useT()
  const [month, setMonth] = useState(currentMonth())
  const [employees, setEmployees] = useState<Employee[]>([])
  const [bonuses, setBonuses] = useState<Map<string, BonusRow>>(new Map())
  const [loading, setLoading] = useState(true)
  // Draft inputs keyed by employee id
  const [drafts, setDrafts] = useState<Map<string, { amount: string; note: string }>>(new Map())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const isCurrentMonth = month === currentMonth()

  // Scoped list — a manager only hands out bonuses to their own people
  useEffect(() => {
    managerFetch('/api/employees')
      .then(r => r.json())
      .then(d => setEmployees((d.employees ?? []).map((e: Employee) => ({ id: e.id, name: e.name, department: e.department }))))
      .catch(() => {})
  }, [])

  const fetchBonuses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await managerFetch(`/api/manager/bonuses?month=${month}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Chyba načítání')
      const map = new Map<string, BonusRow>()
      for (const b of (d.bonuses ?? []) as BonusRow[]) map.set(b.employee_id, b)
      setBonuses(map)
      setDrafts(new Map())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { fetchBonuses() }, [fetchBonuses])

  function draftFor(empId: string): { amount: string; note: string } {
    const d = drafts.get(empId)
    if (d) return d
    const saved = bonuses.get(empId)
    return { amount: saved ? String(saved.amount) : '', note: saved?.note ?? '' }
  }

  function setDraft(empId: string, patch: Partial<{ amount: string; note: string }>) {
    setDrafts(prev => {
      const next = new Map(prev)
      next.set(empId, { ...draftFor(empId), ...patch })
      return next
    })
  }

  function isDirty(empId: string): boolean {
    const d = drafts.get(empId)
    if (!d) return false
    const saved = bonuses.get(empId)
    const savedAmount = saved ? String(saved.amount) : ''
    const savedNote = saved?.note ?? ''
    return d.amount !== savedAmount || d.note !== savedNote
  }

  async function save(empId: string) {
    const d = draftFor(empId)
    const amount = d.amount.trim() === '' ? 0 : Number(d.amount.replace(',', '.'))
    if (isNaN(amount) || amount < 0) {
      setError(t('Částka musí být nezáporné číslo.', 'Amount must be a non-negative number.'))
      return
    }
    setSavingId(empId)
    setError(null)
    try {
      const res = await managerFetch('/api/manager/bonuses', {
        method: 'PUT',
        body: JSON.stringify({ employee_id: empId, month, amount, note: d.note }),
      })
      const resp = await res.json()
      if (!res.ok) throw new Error(resp.error ?? 'Uložení selhalo')
      setBonuses(prev => {
        const next = new Map(prev)
        if (resp.cleared) next.delete(empId)
        else next.set(empId, resp.bonus as BonusRow)
        return next
      })
      setDrafts(prev => { const next = new Map(prev); next.delete(empId); return next })
      setSavedId(empId)
      setTimeout(() => setSavedId(s => (s === empId ? null : s)), 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení selhalo')
    } finally {
      setSavingId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(e => e.name.toLowerCase().includes(q) || (e.department ?? '').toLowerCase().includes(q))
  }, [employees, search])

  const total = useMemo(() => {
    let sum = 0
    for (const b of Array.from(bonuses.values())) sum += b.amount
    return sum
  }, [bonuses])

  const grouped = useMemo(() => {
    const map = new Map<string, Employee[]>()
    for (const e of filtered) {
      const key = e.department ?? t('Bez oddělení', 'No department')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'cs'))
  }, [filtered, t])

  const fmtCZK = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })

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
          <span className="text-sm font-semibold text-gray-700 min-w-[150px] text-center capitalize">{monthLabel(month, 'cs')}</span>
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
        {t('Měsíční bonusy pro podřízené. Každý měsíc začíná od nuly, historii najdete šipkou zpět. Bonus se propíše do exportu jako „Bonus od vedoucího“.',
           'Monthly bonuses for your people. Each month starts from zero; use the arrows for history. Bonuses appear in the export as "Manager bonus".')}
      </p>

      {!isCurrentMonth && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
          🕐 {t('Prohlížíte historii —', 'Viewing history —')} {monthLabel(month, 'cs')}
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
                  const saved = bonuses.get(emp.id)
                  const d = draftFor(emp.id)
                  const dirty = isDirty(emp.id)
                  return (
                    <div key={emp.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 transition-colors">
                      <div className="w-44 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{emp.name}</div>
                        {saved?.granted_by && (
                          <div className="text-[10px] text-slate-400">{t('Zadal/a', 'By')}: {saved.granted_by}</div>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text" inputMode="decimal"
                          value={d.amount}
                          onChange={e => setDraft(emp.id, { amount: e.target.value.replace(/[^0-9.,]/g, '') })}
                          onKeyDown={e => { if (e.key === 'Enter') save(emp.id) }}
                          placeholder="0"
                          className="w-28 pl-3 pr-9 py-1.5 rounded-lg text-sm text-right border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">Kč</span>
                      </div>
                      <input
                        type="text"
                        value={d.note}
                        onChange={e => setDraft(emp.id, { note: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') save(emp.id) }}
                        placeholder={t('Poznámka (nepovinné)', 'Note (optional)')}
                        className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button
                        onClick={() => save(emp.id)}
                        disabled={!dirty || savingId === emp.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          savedId === emp.id
                            ? 'bg-emerald-100 text-emerald-700'
                            : dirty
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {savingId === emp.id ? '…' : savedId === emp.id ? `✓ ${t('Uloženo', 'Saved')}` : t('Uložit', 'Save')}
                      </button>
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
              {t('Celkem za', 'Total for')} {monthLabel(month, 'cs')}
            </span>
            <span className="text-base font-bold text-slate-800">{fmtCZK(total)} Kč</span>
          </div>
        </>
      )}
    </div>
  )
}
