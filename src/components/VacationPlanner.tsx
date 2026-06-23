'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { managerFetch } from '@/lib/managerFetch';
import { useT } from '@/lib/i18n';

interface VacationRequest {
  id: string;
  employee_id: string;
  employeeName: string;
  date_from: string;
  date_to: string | null;
  status: 'pending' | 'approved' | 'rejected';
  note?: string | null;
}

interface Employee {
  id: string;
  name: string;
  vacation_days_per_year?: number;
}

interface VacationPlannerProps {
  orgId: string;
  isManagerMode: boolean;
}

const CZ_MONTHS = [
  'Leden','Únor','Březen','Duben','Květen','Červen',
  'Červenec','Srpen','Září','Říjen','Listopad','Prosinec',
];
const EN_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DAY_NAMES_SHORT = ['Po','Út','St','Čt','Pá','So','Ne'];

function mondayWeekday(dateStr: string): number {
  return (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7;
}

function buildDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) =>
    `${month}-${String(i + 1).padStart(2, '0')}`
  );
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dateInRange(date: string, from: string, to: string | null): boolean {
  if (!to) return date === from;
  return date >= from && date <= to;
}

function statusColor(status: string) {
  if (status === 'approved') return 'bg-emerald-400';
  if (status === 'rejected') return 'bg-red-300';
  return 'bg-amber-300';
}

function AddVacationModal({ orgId, employees, onClose, onSaved }: {
  orgId: string;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateFrom) { setError(t('Zadejte datum od.', 'Please enter a start date.')); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await managerFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          type: 'vacation',
          date_from: dateFrom,
          date_to: dateTo || null,
          note: note || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Chyba při ukládání');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">{t('Přidat dovolenou', 'Add vacation')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Zaměstnanec', 'Employee')}</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Od *', 'From *')}</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Do', 'To')}</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Poznámka', 'Note')}</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Volitelná poznámka…" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">{t('Zrušit', 'Cancel')}</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {saving ? t('Ukládám…', 'Saving…') : t('Přidat', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Employee Vacation Modal ──────────────────────────────────────────────────
// Assumes employee is already authenticated via PIN session in toolbar.
// shiftDays: set of YYYY-MM-DD strings where the employee has planned shifts.
function EmployeeVacationModal({ orgId, pin, employee, initialDate, shiftDays, onClose, onSaved }: {
  orgId: string;
  pin: string;
  employee: { id: string; name: string };
  initialDate?: string;
  shiftDays: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [dateFrom, setDateFrom] = useState(initialDate ?? '');
  const [dateTo, setDateTo] = useState('');
  const [note, setNote] = useState('');
  const [dayType, setDayType] = useState<'full' | 'partial'>('full');
  const [hours, setHours] = useState<string>('4');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Compute conflicting shift days in the requested range
  function getConflicts(from: string, to: string): string[] {
    if (!from) return [];
    const end = to || from;
    const result: string[] = [];
    const cur = new Date(from + 'T00:00:00');
    const last = new Date(end + 'T00:00:00');
    while (cur <= last) {
      const d = cur.toISOString().slice(0, 10);
      if (shiftDays.has(d)) result.push(d);
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  const conflicts = getConflicts(dateFrom, dateTo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateFrom) { setError(t('Zadejte datum od.', 'Please enter a start date.')); return; }
    if (conflicts.length > 0) {
      setError(`Máte naplánované směny na: ${conflicts.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('cs-CZ')).join(', ')}. Nejprve si nechte zrušit směny a pak teprve požádejte o dovolenou.`);
      return;
    }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/public/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId, pin, type: 'vacation', dateFrom,
          dateTo: dateTo || undefined,
          note: note || undefined,
          hours: dayType === 'partial' ? parseFloat(hours) : undefined,
        }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Chyba'); return; }
      setSuccess(true);
      onSaved();
      setTimeout(() => onClose(), 1800);
    } catch { setError(t('Chyba sítě.', 'Network error.')); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('Žádat o dovolenou', 'Request vacation')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{employee.name}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 text-lg leading-none">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Typ — Celý den / Část dne */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('Typ', 'Type')}</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
              <input type="radio" value="full" checked={dayType === 'full'} onChange={() => setDayType('full')} className="accent-emerald-600" />
              {t('Celý den', 'Full day')}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
              <input type="radio" value="partial" checked={dayType === 'partial'} onChange={() => setDayType('partial')} className="accent-emerald-600" />
              {t('Část dne', 'Part day')}
            </label>
          </div>
          {dayType === 'partial' && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('Počet hodin (1–8)', 'Hours (1–8)')}</label>
              <input
                type="number"
                min={1}
                max={8}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Od *', 'From *')}</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('Do', 'To')}</label>
            <input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('Poznámka', 'Note')}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            placeholder="Volitelná poznámka…" />
        </div>
        {/* Live conflict warning */}
        {conflicts.length > 0 && !success && (
          <div className="flex gap-2 items-start bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5 text-sm text-amber-800">
            <span className="text-base leading-none shrink-0">⚠️</span>
            <span>Máte naplánovanou směnu na {conflicts.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('cs-CZ')).join(', ')}. Žádost nepůjde odeslat, dokud směny trvají.</span>
          </div>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center font-medium">{t('✓ Žádost odeslána ke schválení', '✓ Request submitted for approval')}</p>}
        {!success && (
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">{t('Zrušit', 'Cancel')}</button>
            <button type="submit" disabled={saving || conflicts.length > 0} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? t('Odesílám…', 'Submitting…') : t('Odeslat žádost', 'Submit request')}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default function VacationPlanner({ orgId, isManagerMode }: VacationPlannerProps) {
  const t = useT();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  // Employee PIN session
  const [sessionPin, setSessionPin] = useState('');
  const [sessionEmployee, setSessionEmployee] = useState<{ id: string; name: string } | null>(null);
  const [showEmployeeVacModal, setShowEmployeeVacModal] = useState(false);
  const [clickedDate, setClickedDate] = useState<string | undefined>(undefined);
  // Toolbar PIN widget state (same UX as WorkPlanGrid)
  const [pinInputValue, setPinInputValue] = useState('');
  const [pinInputError, setPinInputError] = useState(false);
  const [pinInputLoading, setPinInputLoading] = useState(false);
  // "Mé směny" overlay
  const [showMyShifts, setShowMyShifts] = useState(false);
  const [myShiftDays, setMyShiftDays] = useState<Set<string>>(new Set());
  const [myShiftsLoading, setMyShiftsLoading] = useState(false);
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set());
  const portalRootRef = useRef<HTMLElement | null>(null);
  useEffect(() => { portalRootRef.current = document.body; }, []);

  useEffect(() => {
    fetch(`/api/public/company-settings?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((s) => {
        const dates = (s.closed_dates ?? '').split(',').map((d: string) => d.trim()).filter(Boolean);
        setClosedDates(new Set(dates));
      })
      .catch(() => {});
  }, [orgId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (isManagerMode) {
        const [empRes, approvedRes, pendingRes] = await Promise.all([
          managerFetch('/api/employees'),
          managerFetch(`/api/requests?status=approved`),
          managerFetch(`/api/requests?status=pending`),
        ]);
        const empJson = await empRes.json();
        const approvedJson = await approvedRes.json();
        const pendingJson = await pendingRes.json();

        const empList: Employee[] = empJson.employees ?? [];
        setEmployees(empList);

        const combined = [
          ...(approvedJson.requests ?? []),
          ...(pendingJson.requests ?? []),
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allReqs: VacationRequest[] = combined.map((r: any) => ({
          id: r.id,
          employee_id: r.employee_id,
          employeeName: r.employees?.name ?? empList.find((e: Employee) => e.id === r.employee_id)?.name ?? '—',
          date_from: r.date_from,
          date_to: r.date_to ?? null,
          status: r.status,
          note: r.note ?? null,
        }));
        setRequests(allReqs);
      } else {
        // Public endpoint — no auth needed
        const res = await fetch(`/api/public/vacation-calendar?orgId=${encodeURIComponent(orgId)}`);
        if (res.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json = await res.json() as { requests: any[]; employees: Employee[] };
          setEmployees(json.employees ?? []);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allReqs: VacationRequest[] = (json.requests ?? []).map((r: any) => ({
            id: r.id,
            employee_id: r.employee_id,
            employeeName: r.employees?.name ?? (json.employees ?? []).find((e: Employee) => e.id === r.employee_id)?.name ?? '—',
            date_from: r.date_from,
            date_to: r.date_to ?? null,
            status: r.status,
            note: r.note ?? null,
          }));
          setRequests(allReqs);
        }
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [isManagerMode, orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const days = buildDays(month);
  const [year, mo] = month.split('-').map(Number);
  const firstOffset = days.length > 0 ? mondayWeekday(days[0]) : 0;

  // For each employee, collect their vacation days in this month
  const empVacMap = new Map<string, Set<string>>();
  const empStatusMap = new Map<string, Map<string, string>>();
  for (const req of requests) {
    for (const day of days) {
      if (dateInRange(day, req.date_from, req.date_to)) {
        if (!empVacMap.has(req.employee_id)) empVacMap.set(req.employee_id, new Set());
        empVacMap.get(req.employee_id)!.add(day);
        if (!empStatusMap.has(req.employee_id)) empStatusMap.set(req.employee_id, new Map());
        empStatusMap.get(req.employee_id)!.set(day, req.status);
      }
    }
  }

  // Count how many employees are on vacation on each day
  const dayCountMap = new Map<string, number>();
  empVacMap.forEach((daySet) => {
    daySet.forEach((day) => {
      dayCountMap.set(day, (dayCountMap.get(day) ?? 0) + 1);
    });
  });

  const handlePinLogin = async () => {
    if (pinInputValue.length < 4) return;
    setPinInputLoading(true); setPinInputError(false);
    try {
      const res = await fetch(`/api/public/presence?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(pinInputValue)}`);
      if (!res.ok) { setPinInputError(true); setPinInputValue(''); return; }
      const json = await res.json();
      setSessionPin(pinInputValue);
      setSessionEmployee({ id: json.employeeId, name: json.employeeName });
      setPinInputValue('');
    } catch { setPinInputError(true); setPinInputValue(''); }
    finally { setPinInputLoading(false); }
  };

  const loadMyShifts = useCallback(async (empId: string, m: string) => {
    setMyShiftsLoading(true);
    try {
      const res = await fetch(`/api/public/work-plans?orgId=${encodeURIComponent(orgId)}&employeeId=${encodeURIComponent(empId)}&month=${encodeURIComponent(m)}`);
      if (res.ok) {
        const json = await res.json() as { plans?: { date: string }[] };
        setMyShiftDays(new Set((json.plans ?? []).map((p) => p.date)));
      }
    } catch { /* ignore */ }
    finally { setMyShiftsLoading(false); }
  }, [orgId]);

  const handleToggleMyShifts = () => {
    if (!sessionEmployee) return;
    if (!showMyShifts) {
      loadMyShifts(sessionEmployee.id, month);
      setShowMyShifts(true);
    } else {
      setShowMyShifts(false);
    }
  };

  // Reload shifts when month changes and overlay is active
  useEffect(() => {
    if (showMyShifts && sessionEmployee) {
      loadMyShifts(sessionEmployee.id, month);
    }
  }, [month, showMyShifts, sessionEmployee, loadMyShifts]);

  return (
    <div className="w-full px-6 py-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1">
          <button onClick={() => setMonth(prevMonth(month))}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[150px] text-center px-2">
            {t(CZ_MONTHS[mo - 1], EN_MONTHS[mo - 1])} {year}
          </span>
          <button onClick={() => setMonth(nextMonth(month))}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* PIN session — same UX as WorkPlanGrid */}
          {!isManagerMode && (
            sessionEmployee ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleToggleMyShifts}
                  disabled={myShiftsLoading}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${showMyShifts ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-600'}`}
                >
                  📅 {myShiftsLoading ? t('Načítám…', 'Loading…') : t('Mé směny', 'My shifts')}
                </button>
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-700 text-sm font-semibold">{sessionEmployee.name}</span>
                  <button
                    onClick={() => { setSessionEmployee(null); setSessionPin(''); setShowMyShifts(false); setMyShiftDays(new Set()); }}
                    className="text-emerald-400 hover:text-emerald-700 transition-colors ml-1"
                    title="Odhlásit"
                  >✕</button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handlePinLogin(); }} className="flex items-center gap-1.5">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinInputValue}
                  onChange={(e) => { setPinInputValue(e.target.value.replace(/\D/g, '')); setPinInputError(false); }}
                  placeholder="Váš PIN"
                  className={`w-24 text-sm px-3 py-2 rounded-xl border ${pinInputError ? 'border-red-400 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-blue-400 text-center tracking-widest`}
                />
                <button
                  type="submit"
                  disabled={pinInputValue.length < 4 || pinInputLoading}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
                >
                  {pinInputLoading ? '…' : 'OK'}
                </button>
              </form>
            )
          )}

          {isManagerMode && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95">
              <span className="text-lg leading-none font-light">+</span>
              {t('Přidat dovolenou', 'Add vacation')}
            </button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">{t('Načítám…', 'Loading…')}</div>
      )}
      <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gradient-to-r from-slate-800 to-slate-700 px-1 py-2">
          {DAY_NAMES_SHORT.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-0.5 ${i >= 5 ? 'text-blue-300' : 'text-slate-300'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-px bg-slate-100">
          {Array.from({ length: firstOffset }).map((_, i) => (
            <div key={`e-${i}`} className="bg-white min-h-[80px]" />
          ))}
          {days.map((dateStr) => {
            const wd = mondayWeekday(dateStr);
            const isWeekend = wd >= 5;
            const isClosed = closedDates.has(dateStr);
            const dayNum = new Date(dateStr + 'T00:00:00').getDate();
            const count = dayCountMap.get(dateStr) ?? 0;
            const onVacation = employees.filter((e) => empVacMap.get(e.id)?.has(dateStr));

            const hasMyShift = showMyShifts && myShiftDays.has(dateStr);

            return (
              <div
                key={dateStr}
                onClick={() => {
                  if (!isClosed && !isManagerMode && sessionEmployee) {
                    setClickedDate(dateStr);
                    setShowEmployeeVacModal(true);
                  }
                }}
                className={`min-h-[80px] p-2 flex flex-col gap-1 relative overflow-hidden ${isClosed ? 'cursor-default' : isWeekend ? 'bg-blue-50/40' : 'bg-white'} ${hasMyShift && !isClosed ? 'ring-2 ring-inset ring-blue-400' : ''} ${!isClosed && !isManagerMode && sessionEmployee ? 'cursor-pointer hover:bg-emerald-50/60 transition-colors group' : ''}`}
              >
                {isClosed && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'repeating-linear-gradient(-45deg, rgba(148,163,184,0.18) 0px, rgba(148,163,184,0.18) 3px, transparent 3px, transparent 10px)',
                      backgroundColor: 'rgb(241 245 249)',
                    }}
                  />
                )}
                <div className="relative z-10 flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-bold ${isClosed ? 'text-slate-400' : isWeekend ? 'text-blue-400' : 'text-slate-700'}`}>{dayNum}</span>
                  {isClosed && <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">{t('Zavřeno', 'Closed')}</span>}
                  <div className="flex items-center gap-1">
                    {hasMyShift && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1 py-0.5 rounded">{t('směna', 'shift')}</span>
                    )}
                    <span className="hidden group-hover:flex items-center text-xs text-emerald-500 font-semibold gap-0.5">
                      <span className="text-base leading-none">+</span>
                    </span>
                    {count > 0 && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        {count}×
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative z-10 flex flex-col gap-0.5">
                  {onVacation.map((emp) => {
                    const st = empStatusMap.get(emp.id)?.get(dateStr) ?? 'pending';
                    return (
                      <div key={emp.id}
                        className={`text-xs px-1.5 py-0.5 rounded font-medium text-white truncate ${statusColor(st)}`}
                        title={`${emp.name} (${st === 'approved' ? t('schváleno', 'approved') : st === 'rejected' ? t('zamítnuto', 'rejected') : t('čeká', 'pending')})`}>
                        {emp.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400" />{t('Schválena', 'Approved')}</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-300" />{t('Čeká na schválení', 'Pending approval')}</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-300" />{t('Zamítnuta', 'Rejected')}</div>
      </div>

      {/* Employee vacation summary */}
      {isManagerMode && employees.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">{t('Přehled dovolených —', 'Vacation overview —')} {year}</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {employees.map((emp) => {
              const total = emp.vacation_days_per_year ?? 20;
              const used = requests
                .filter((r) => r.employee_id === emp.id && r.status === 'approved')
                .reduce((acc, r) => {
                  if (r.date_to && r.date_to > r.date_from) {
                    return acc + Math.round((new Date(r.date_to).getTime() - new Date(r.date_from).getTime()) / 86400000) + 1;
                  }
                  return acc + 1;
                }, 0);
              const remaining = Math.max(0, total - used);
              const pct = Math.min(100, (used / total) * 100);

              return (
                <div key={emp.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-sm font-medium text-slate-800 w-32 shrink-0 truncate">{emp.name}</span>
                  <div className="flex-1">
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                    <span className="font-semibold text-slate-700">{used}</span> / {total} {t('dní', 'days')}
                    {remaining > 0 && <span className="text-emerald-600 ml-1">({remaining} {t('zbývá', 'remaining')})</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && portalRootRef.current && createPortal(
        <AddVacationModal orgId={orgId} employees={employees} onClose={() => setShowModal(false)} onSaved={fetchData} />,
        portalRootRef.current
      )}

      {showEmployeeVacModal && sessionEmployee && portalRootRef.current && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <EmployeeVacationModal
            orgId={orgId}
            pin={sessionPin}
            employee={sessionEmployee}
            initialDate={clickedDate}
            shiftDays={myShiftDays}
            onClose={() => { setShowEmployeeVacModal(false); setClickedDate(undefined); }}
            onSaved={fetchData}
          />
        </div>,
        portalRootRef.current
      )}
    </div>
  );
}
