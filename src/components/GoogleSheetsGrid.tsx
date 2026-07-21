'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import { useT } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkPlanEntry {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string | null;
  employeeDepartment: string | null;
  workType: string | null;
  workTypeId: string | null;
  workTypeName: string | null;
  workTypeColor: string | null;
  startTime: string | null;
  endTime: string | null;
  isEvening?: boolean;
  note?: string | null;
}

interface WorkType {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  category: string | null;
  sort_order: number | null;
}

interface Employee {
  id: string;
  name: string;
  department: string | null;
}

interface GoogleSheetsGridProps {
  orgId: string;
  month: string; // YYYY-MM — used only for initial week alignment
  isManagerMode: boolean;
  onMonthChange: (month: string) => void;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function getWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toISO(d);
  });
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(t: string): string {
  // Trim seconds: "09:00:00" → "9:00"
  const [h, m] = t.split(':');
  return `${parseInt(h, 10)}:${m}`;
}

function getMonthsForWeek(weekDays: string[]): string[] {
  return Array.from(new Set(weekDays.map((d) => d.slice(0, 7))));
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div className="fixed top-5 right-5 z-[200] flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-xl animate-[fadeInDown_0.25s_ease]">
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      {message}
    </div>
  );
}

// ─── AddShiftModal (minimal, manager-only) ────────────────────────────────────

interface AddShiftModalProps {
  orgId: string;
  defaultDate: string;
  workTypes: WorkType[];
  defaultEmployeeId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddShiftModal({ orgId, defaultDate, workTypes, defaultEmployeeId, onClose, onSuccess }: AddShiftModalProps) {
  const t = useT();
  const [date, setDate] = useState(defaultDate);
  const [workTypeId, setWorkTypeId] = useState(workTypes[0]?.id ?? '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(defaultEmployeeId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workTypeId && workTypes.length > 0) setWorkTypeId(workTypes[0].id);
  }, [workTypes, workTypeId]);

  useEffect(() => {
    managerFetch('/api/employees')
      .then((r) => r.json())
      .then((data: { employees?: Employee[] } | Employee[]) => {
        const list = Array.isArray(data) ? data : (data as { employees?: Employee[] }).employees ?? [];
        setEmployees(list);
        if (!defaultEmployeeId && list[0]) setSelectedEmployeeId(list[0].id);
      })
      .catch(() => {});
  }, [defaultEmployeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workTypeId) { setError(t('Vyberte prosím typ práce.', 'Please select a work type.')); return; }
    if (!selectedEmployeeId) { setError(t('Vyberte zaměstnance.', 'Please select an employee.')); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await managerFetch('/api/public/work-plans', {
        method: 'POST',
        body: JSON.stringify({
          orgId,
          employeeId: selectedEmployeeId,
          date,
          workTypeId,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          note: note || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? t('Nepodařilo se přidat směnu.', 'Failed to add shift.'));
      else { onSuccess(); onClose(); }
    } catch { setError(t('Síťová chyba.', 'Network error.')); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">{t('Přidat směnu', 'Add shift')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Datum', 'Date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Zaměstnanec', 'Employee')}</label>
            <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {employees.length === 0 && <option value="">{t('Načítám…', 'Loading…')}</option>}
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Typ práce', 'Work type')}</label>
            <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {workTypes.map((wt) => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Začátek', 'Start')}</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Konec', 'End')}</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Poznámka', 'Note')}</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Volitelná…', 'Optional…')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {t('Zrušit', 'Cancel')}
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {submitting ? '…' : t('Přidat', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GoogleSheetsGrid({ orgId, month, isManagerMode, onMonthChange }: GoogleSheetsGridProps) {
  const t = useT();

  const DAY_NAMES = [t('Po', 'Mon'), t('Út', 'Tue'), t('St', 'Wed'), t('Čt', 'Thu'), t('Pá', 'Fri'), t('So', 'Sat'), t('Ne', 'Sun')];

  // Week navigation — start on the Monday of the month's first week
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const [y, m] = month.split('-').map(Number);
    return getWeekStart(new Date(y, m - 1, 1));
  });

  const weekDays = getWeekDays(weekStart);

  // Notify parent when week moves into a different month
  const prevMonthRef = useRef(month);
  useEffect(() => {
    const midWeek = weekDays[3]; // Thursday
    const weekMonth = midWeek.slice(0, 7);
    if (weekMonth !== prevMonthRef.current) {
      prevMonthRef.current = weekMonth;
      onMonthChange(weekMonth);
    }
  }, [weekDays, onMonthChange]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  // plans indexed by "employeeId|date" → entries array
  const [plansMap, setPlansMap] = useState<Map<string, WorkPlanEntry[]>>(new Map());
  // approved vacation dates: Set of "employeeId|date"
  const [vacationSet, setVacationSet] = useState<Set<string>>(new Set());
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState('');
  const [addModalEmployeeId, setAddModalEmployeeId] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  // ── Fetch employees once ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isManagerMode) return;
    managerFetch('/api/employees')
      .then((r) => r.json())
      .then((data: { employees?: Employee[] } | Employee[]) => {
        const list = Array.isArray(data) ? data : (data as { employees?: Employee[] }).employees ?? [];
        setEmployees(list);
      })
      .catch(() => {});
  }, [isManagerMode]);

  // ── Fetch work types ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/public/work-types?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d) => setWorkTypes(d.workTypes ?? []))
      .catch(() => {});
  }, [orgId]);

  // ── Fetch company settings (closed dates) ─────────────────────────────────
  useEffect(() => {
    fetch(`/api/public/company-settings?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const raw = d['closed_dates'];
        if (Array.isArray(raw)) setClosedDates(new Set(raw as string[]));
      })
      .catch(() => {});
  }, [orgId]);

  // ── Fetch approved vacations ──────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/public/vacation-calendar?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d: { requests?: { employee_id: string; date_from: string; date_to: string | null; status: string }[] }) => {
        const set = new Set<string>();
        for (const req of d.requests ?? []) {
          if (req.status !== 'approved') continue;
          const from = new Date(req.date_from + 'T00:00:00');
          const to = req.date_to ? new Date(req.date_to + 'T00:00:00') : new Date(from);
          const cur = new Date(from);
          while (cur <= to) {
            set.add(`${req.employee_id}|${toISO(cur)}`);
            cur.setDate(cur.getDate() + 1);
          }
        }
        setVacationSet(set);
      })
      .catch(() => {});
  }, [orgId]);

  // ── Fetch schedule for the week's months ─────────────────────────────────
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const months = getMonthsForWeek(weekDays);
      const results = await Promise.all(
        months.map((m) =>
          fetch(`/api/public/schedule?orgId=${encodeURIComponent(orgId)}&month=${encodeURIComponent(m)}`)
            .then((r) => r.json())
            .then((d) => (d.workPlans ?? []) as WorkPlanEntry[])
            .catch(() => [] as WorkPlanEntry[])
        )
      );
      const allPlans = results.flat();
      // Build map: "employeeId|date" → entries[]
      const map = new Map<string, WorkPlanEntry[]>();
      for (const p of allPlans) {
        if (!weekDays.includes(p.date)) continue;
        const key = `${p.employeeId}|${p.date}`;
        const arr = map.get(key) ?? [];
        arr.push(p);
        map.set(key, arr);
      }
      setPlansMap(map);
    } finally {
      setLoading(false);
    }
  }, [orgId, weekDays.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // ── Compute employee list ─────────────────────────────────────────────────
  // Manager: all active employees; non-manager: employees with plans this week
  const displayEmployees: Employee[] = isManagerMode
    ? employees
    : (() => {
        const seen = new Map<string, Employee>();
        Array.from(plansMap.values()).forEach((p) => {
          p.forEach((e) => {
            if (!seen.has(e.employeeId)) {
              seen.set(e.employeeId, {
                id: e.employeeId,
                name: e.employeeName ?? e.employeeId,
                department: e.employeeDepartment,
              });
            }
          });
        });
        return Array.from(seen.values()).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'cs'));
      })();

  // ── Week navigation ───────────────────────────────────────────────────────
  const goToPrevWeek = () => {
    setWeekStart((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() - 7);
      return nd;
    });
  };

  const goToNextWeek = () => {
    setWeekStart((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + 7);
      return nd;
    });
  };

  const weekLabel = (() => {
    const first = new Date(weekDays[0] + 'T00:00:00');
    const last = new Date(weekDays[6] + 'T00:00:00');
    const fmt = (d: Date) =>
      `${d.getDate()}. ${d.getMonth() + 1}.`;
    return `${fmt(first)}–${fmt(last)} ${last.getFullYear()}`;
  })();

  // ── Cell rendering ────────────────────────────────────────────────────────
  function renderCell(emp: Employee, date: string) {
    const key = `${emp.id}|${date}`;
    const entries = plansMap.get(key);
    const isClosed = closedDates.has(date);
    const dow = new Date(date + 'T00:00:00').getDay(); // 0=Sun,6=Sat
    const isWeekend = dow === 0 || dow === 6;

    if (!entries || entries.length === 0) {
      const isVacation = vacationSet.has(key);
      if (isVacation) {
        return (
          <div className="flex items-center justify-center h-full">
            <div
              title={t('Schválená dovolená', 'Approved vacation')}
              className="w-full rounded text-[11px] font-bold text-center px-1 py-0.5 leading-tight truncate"
              style={{ backgroundColor: '#bfdbfe', color: '#1d4ed8' }}
            >
              {t('DOV', 'VAC')}
            </div>
          </div>
        );
      }
      return (
        <div
          className="flex items-center justify-center h-full text-xs font-semibold tracking-wide select-none text-gray-300"
          style={{ userSelect: 'none' }}
        >
          XXX
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-0.5 items-center justify-center h-full px-0.5">
        {entries.map((e) => {
          const bg = e.workTypeColor ?? '#e2e8f0';
          // Determine text color based on background brightness
          const textColor = isLight(bg) ? '#1e293b' : '#ffffff';
          const label =
            e.startTime && e.endTime
              ? `${formatTime(e.startTime)}–${formatTime(e.endTime)}`
              : e.workTypeName ?? (e.workType ?? '');
          return (
            <div
              key={e.id}
              title={[e.workTypeName, e.note].filter(Boolean).join(' · ')}
              style={{ backgroundColor: bg, color: textColor }}
              className="w-full rounded text-[11px] font-semibold text-center px-1 py-0.5 leading-tight truncate"
            >
              {label}
            </div>
          );
        })}
      </div>
    );
  }

  function isLight(hex: string): boolean {
    const clean = hex.replace('#', '');
    if (clean.length < 6) return true;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 130;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const today = (() => { const d = new Date(); return toISO(d); })();

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={goToPrevWeek}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[180px] text-center">{weekLabel}</span>
          <button onClick={goToNextWeek}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {isManagerMode && (
          <button
            onClick={() => { setAddModalDate(today); setAddModalEmployeeId(undefined); setShowAddModal(true); }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('Přidat směnu', 'Add shift')}
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="min-w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '160px', minWidth: '140px' }} />
            {weekDays.map((d) => <col key={d} style={{ width: '120px', minWidth: '100px' }} />)}
          </colgroup>

          {/* Header row */}
          <thead>
            <tr className="border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                {t('Zaměstnanec', 'Employee')}
              </th>
              {weekDays.map((d, i) => {
                const isClosed = closedDates.has(d);
                const isToday = d === today;
                const isWeekend = i >= 5;
                const dayNum = new Date(d + 'T00:00:00').getDate();
                return (
                  <th key={d}
                    className={`px-1 py-2.5 text-center text-xs font-semibold border-r border-gray-200 last:border-r-0
                      ${isClosed ? 'bg-gray-100 text-gray-400' : isWeekend ? 'bg-slate-50 text-gray-400' : 'bg-gray-50 text-gray-600'}`}
                  >
                    <div className={`inline-flex flex-col items-center gap-0.5`}>
                      <span className="text-[10px] uppercase tracking-wider">{DAY_NAMES[i]}</span>
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                        ${isToday ? 'bg-blue-600 text-white' : 'text-inherit'}`}>
                        {dayNum}
                      </span>
                      {isClosed && <span className="text-[9px] text-red-400 font-normal normal-case tracking-normal">zavřeno</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    {t('Načítám…', 'Loading…')}
                  </div>
                </td>
              </tr>
            )}

            {!loading && displayEmployees.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                  {t('Žádní zaměstnanci.', 'No employees.')}
                </td>
              </tr>
            )}

            {!loading && displayEmployees.map((emp, ri) => (
              <tr key={emp.id}
                className={`border-b border-gray-100 last:border-b-0 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                {/* Employee name cell */}
                <td className="sticky left-0 z-10 px-3 py-1.5 border-r border-gray-200 bg-inherit">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-800 leading-tight truncate" title={emp.name}>
                      {emp.name}
                    </span>
                    {emp.department && (
                      <span className="text-[10px] text-gray-400 leading-tight truncate">{emp.department}</span>
                    )}
                  </div>
                </td>

                {/* Day cells */}
                {weekDays.map((date, di) => {
                  const isClosed = closedDates.has(date);
                  const isWeekend = di >= 5;
                  return (
                    <td key={date}
                      className={`h-10 px-0.5 py-0.5 border-r border-gray-100 last:border-r-0 align-middle
                        ${isClosed ? 'bg-gray-100/60' : isWeekend ? 'bg-slate-50/60' : ''}`}
                      onClick={() => {
                        if (isManagerMode) {
                          setAddModalDate(date);
                          setAddModalEmployeeId(emp.id);
                          setShowAddModal(true);
                        }
                      }}
                      style={{ cursor: isManagerMode ? 'pointer' : 'default' }}
                      title={isManagerMode ? t('Kliknout pro přidání směny', 'Click to add shift') : undefined}
                    >
                      {renderCell(emp, date)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add shift modal */}
      {showAddModal && (
        <AddShiftModal
          orgId={orgId}
          defaultDate={addModalDate}
          workTypes={workTypes}
          defaultEmployeeId={addModalEmployeeId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setToast(t('Směna přidána!', 'Shift added!'));
            fetchPlans();
          }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
