'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface AttendanceLog {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  created_at: string;
  employee: Employee;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalTimeStr(isoOrTime: string | null): string {
  if (!isoOrTime) return '—';
  // If already HH:MM
  if (/^\d{2}:\d{2}$/.test(isoOrTime)) return isoOrTime;
  // ISO string
  try {
    return new Date(isoOrTime).toLocaleTimeString('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoOrTime;
  }
}

function calcDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return '—';
  try {
    const inMs = new Date(checkIn).getTime();
    const outMs = new Date(checkOut).getTime();
    const diffMin = Math.round((outMs - inMs) / 60000);
    if (diffMin < 0) return '—';
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  } catch {
    return '—';
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeStr(): string {
  return new Date().toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function currentMonthISO(): string {
  return new Date().toISOString().slice(0, 7);
}

function initials(emp: Employee): string {
  return `${emp.first_name[0] ?? ''}${emp.last_name[0] ?? ''}`.toUpperCase();
}

function fullName(emp: Employee): string {
  return `${emp.first_name} ${emp.last_name}`;
}

function statusForLog(log: AttendanceLog): 'present' | 'left' | 'absent' {
  if (!log.check_in) return 'absent';
  if (log.check_out) return 'left';
  return 'present';
}

// ─── Summary for month view ───────────────────────────────────────────────────

interface MonthlySummary {
  employeeId: string;
  name: string;
  daysPresent: number;
  daysAbsent: number;
  totalMinutes: number;
}

function buildMonthlySummary(
  logs: AttendanceLog[],
  daysInMonth: number
): MonthlySummary[] {
  const map = new Map<
    string,
    { name: string; daysPresent: number; totalMinutes: number }
  >();

  for (const log of logs) {
    const key = log.employee.id;
    if (!map.has(key)) {
      map.set(key, {
        name: fullName(log.employee),
        daysPresent: 0,
        totalMinutes: 0,
      });
    }
    const entry = map.get(key)!;
    if (log.check_in) {
      entry.daysPresent += 1;
      if (log.check_out) {
        const diff = Math.round(
          (new Date(log.check_out).getTime() -
            new Date(log.check_in).getTime()) /
            60000
        );
        if (diff > 0) entry.totalMinutes += diff;
      }
    }
  }

  return Array.from(map.entries())
    .map(([employeeId, v]) => ({
      employeeId,
      name: v.name,
      daysPresent: v.daysPresent,
      daysAbsent: Math.max(0, daysInMonth - v.daysPresent),
      totalMinutes: v.totalMinutes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface CheckInModalProps {
  date: string;
  employees: Employee[];
  onClose: () => void;
  onSuccess: () => void;
}

function CheckInModal({ date, employees, onClose, onSuccess }: CheckInModalProps) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [time, setTime] = useState(nowTimeStr());
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      setError('Vyberte zaměstnance.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Build ISO check_in: combine date + time
      const checkInISO = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          date,
          check_in: checkInISO,
          note: note || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Chyba při záznamu příchodu.');
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setError('Chyba sítě. Zkuste znovu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Zaznamenat příchod
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Zaměstnanec
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {fullName(emp)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Datum
            </label>
            <input
              type="date"
              value={date}
              disabled
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 bg-slate-50 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Čas příchodu
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Poznámka{' '}
              <span className="text-slate-400 font-normal">(volitelná)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Např. práce z domova"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Ukládám…' : 'Zaznamenat příchod'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const [view, setView] = useState<'day' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthISO());

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [monthLogs, setMonthLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // ── Fetch employees list (for modal + absent rows) ────────────────────────
  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setEmployees(
            json.data.map((e: { id: string; first_name: string; last_name: string }) => ({
              id: e.id,
              first_name: e.first_name,
              last_name: e.last_name,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // ── Fetch daily logs ──────────────────────────────────────────────────────
  const fetchDayLogs = useCallback(async () => {
    setLoadingDay(true);
    setFetchError('');
    try {
      const res = await fetch(`/api/attendance?date=${selectedDate}`);
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json.error ?? 'Chyba při načítání dat.');
      } else {
        setLogs(json.data ?? []);
      }
    } catch {
      setFetchError('Chyba sítě.');
    } finally {
      setLoadingDay(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (view === 'day') fetchDayLogs();
  }, [view, fetchDayLogs]);

  // ── Fetch monthly logs ────────────────────────────────────────────────────
  const fetchMonthLogs = useCallback(async () => {
    setLoadingMonth(true);
    setFetchError('');
    try {
      const res = await fetch(`/api/attendance?month=${selectedMonth}`);
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json.error ?? 'Chyba při načítání dat.');
      } else {
        setMonthLogs(json.data ?? []);
      }
    } catch {
      setFetchError('Chyba sítě.');
    } finally {
      setLoadingMonth(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (view === 'month') fetchMonthLogs();
  }, [view, fetchMonthLogs]);

  // ── Check-out ─────────────────────────────────────────────────────────────
  async function handleCheckOut(log: AttendanceLog) {
    setLoadingCheckout(log.id);
    try {
      const checkOutISO = new Date().toISOString();
      const res = await fetch(`/api/attendance/${log.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_out: checkOutISO }),
      });
      if (res.ok) {
        await fetchDayLogs();
      }
    } catch {
      // silent
    } finally {
      setLoadingCheckout(null);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  // Build a unified row list: logs + absent employees (those without a log)
  const loggedEmployeeIds = new Set(logs.map((l) => l.employee.id));

  interface DisplayRow {
    key: string;
    log: AttendanceLog | null;
    employee: Employee;
  }

  const rows: DisplayRow[] = [
    ...logs.map((l) => ({ key: l.id, log: l, employee: l.employee })),
    ...employees
      .filter((e) => !loggedEmployeeIds.has(e.id))
      .map((e) => ({ key: `absent-${e.id}`, log: null, employee: e })),
  ].sort((a, b) =>
    fullName(a.employee).localeCompare(fullName(b.employee), 'cs')
  );

  const presentCount = logs.filter((l) => l.check_in && !l.check_out).length;
  const leftCount = logs.filter((l) => l.check_in && l.check_out).length;
  const absentCount = employees.filter((e) => !loggedEmployeeIds.has(e.id)).length;

  // Month summary
  const [year, mon] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const monthlySummary = buildMonthlySummary(monthLogs, daysInMonth);

  const monthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString('cs-CZ', {
    month: 'long',
    year: 'numeric',
  });

  // Day label
  const dayLabel = new Date(selectedDate).toLocaleDateString('cs-CZ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Docházka</h1>
          <p className="text-slate-500 text-sm mt-1 capitalize">
            {view === 'day' ? dayLabel : monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Den
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-slate-200 ${
                view === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Měsíc
            </button>
          </div>

          {/* Date / month picker */}
          {view === 'day' ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {view === 'day' && (
            <button
              onClick={() => setShowCheckInModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Zaznamenat příchod
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {fetchError}
        </div>
      )}

      {/* ── DAY VIEW ─────────────────────────────────────────────────── */}
      {view === 'day' && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-2xl font-bold text-green-700">{presentCount}</p>
              <p className="text-sm font-medium text-green-700 mt-0.5">Přítomní</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-2xl font-bold text-blue-700">{leftCount}</p>
              <p className="text-sm font-medium text-blue-700 mt-0.5">Odešli</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-600">{absentCount}</p>
              <p className="text-sm font-medium text-slate-600 mt-0.5">Chybí</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Záznamy za{' '}
                {new Date(selectedDate).toLocaleDateString('cs-CZ', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
              {loadingDay && (
                <span className="text-xs text-slate-400 animate-pulse">
                  Načítám…
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 font-medium text-slate-500">
                      Zaměstnanec
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">
                      Příchod
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">
                      Odchod
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">
                      Odpracováno
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">
                      Stav
                    </th>
                    <th className="text-right px-5 py-3 font-medium text-slate-500">
                      Akce
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.length === 0 && !loadingDay && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-10 text-center text-slate-400"
                      >
                        Žádné záznamy pro vybraný den.
                      </td>
                    </tr>
                  )}
                  {rows.map(({ key, log, employee }) => {
                    const status = log ? statusForLog(log) : 'absent';

                    return (
                      <tr key={key} className="hover:bg-slate-50/60 transition-colors">
                        {/* Employee */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                              {initials(employee)}
                            </div>
                            <span className="font-medium text-slate-900">
                              {fullName(employee)}
                            </span>
                          </div>
                        </td>

                        {/* Příchod */}
                        <td className="px-4 py-3.5">
                          {log?.check_in ? (
                            <span className="font-mono text-slate-700">
                              {toLocalTimeStr(log.check_in)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Odchod */}
                        <td className="px-4 py-3.5">
                          {log?.check_out ? (
                            <span className="font-mono text-slate-700">
                              {toLocalTimeStr(log.check_out)}
                            </span>
                          ) : status === 'present' ? (
                            <span className="text-green-600 text-xs font-medium animate-pulse">
                              Probíhá…
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Odpracováno */}
                        <td className="px-4 py-3.5">
                          {log ? (
                            <span className="text-slate-700">
                              {calcDuration(log.check_in, log.check_out)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Stav */}
                        <td className="px-4 py-3.5">
                          {status === 'present' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              Přítomen/na
                            </span>
                          )}
                          {status === 'left' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              Odešel/a
                            </span>
                          )}
                          {status === 'absent' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Chybí
                            </span>
                          )}
                        </td>

                        {/* Akce */}
                        <td className="px-5 py-3.5 text-right">
                          {status === 'present' && log && (
                            <button
                              onClick={() => handleCheckOut(log)}
                              disabled={loadingCheckout === log.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-60"
                            >
                              {loadingCheckout === log.id ? (
                                'Ukládám…'
                              ) : (
                                <>
                                  <svg
                                    width="14"
                                    height="14"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                  Zaznamenat odchod
                                </>
                              )}
                            </button>
                          )}
                          {status === 'left' && (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                          {status === 'absent' && (
                            <button
                              onClick={() => setShowCheckInModal(true)}
                              className="text-slate-400 hover:text-blue-600 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
                            >
                              Zaznamenat
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── MONTH VIEW ───────────────────────────────────────────────── */}
      {view === 'month' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 capitalize">
              Přehled za {monthLabel}
            </h2>
            {loadingMonth && (
              <span className="text-xs text-slate-400 animate-pulse">
                Načítám…
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 font-medium text-slate-500">
                    Zaměstnanec
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Dní přítomen/na
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Dní chyběl/a
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Celkem odpracováno
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">
                    Průměr/den
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {monthlySummary.length === 0 && !loadingMonth && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-slate-400"
                    >
                      Žádné záznamy pro vybraný měsíc.
                    </td>
                  </tr>
                )}
                {monthlySummary.map((row) => (
                  <tr
                    key={row.employeeId}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-900">
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {row.daysPresent} dní
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          row.daysAbsent > 0
                            ? 'bg-red-100 text-red-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.daysAbsent} dní
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {row.totalMinutes > 0
                        ? formatMinutes(row.totalMinutes)
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {row.daysPresent > 0
                        ? formatMinutes(
                            Math.round(row.totalMinutes / row.daysPresent)
                          )
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Check-in Modal ───────────────────────────────────────────── */}
      {showCheckInModal && (
        <CheckInModal
          date={selectedDate}
          employees={employees}
          onClose={() => setShowCheckInModal(false)}
          onSuccess={fetchDayLogs}
        />
      )}
    </div>
  );
}
