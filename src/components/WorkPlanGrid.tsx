'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { managerFetch } from '@/lib/managerFetch';
import PinPad from './PinPad';
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
}

interface ScheduleDayMeta {
  date: string;
  dayType: string;
  requiredTotal: number;
  assignedCount: number;
  notes?: string | null;
  assigned_employees?: { id: string; name: string }[];
}

interface WorkType {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  category: string | null;
  sort_order: number | null;
}

interface ScheduleData {
  month: string;
  workPlans: WorkPlanEntry[];
  scheduleDays: ScheduleDayMeta[];
}

interface WorkPlanGridProps {
  orgId: string;
  month: string; // YYYY-MM
  isManagerMode: boolean;
  onMonthChange: (month: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// CZ_MONTHS, DAY_NAMES_SHORT and DAY_TYPE_OPTIONS are now computed inside components using t()

function formatMonthLabel(month: string, monthNames: string[]): string {
  const [year, m] = month.split('-').map(Number);
  return `${monthNames[m - 1]} ${year}`;
}

function prevMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Monday of the week containing date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

/** 7 ISO date strings Mon→Sun for a given Monday date */
function getWeekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Returns Monday-based weekday index 0–6 for a date string YYYY-MM-DD */
function mondayWeekday(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  return (d.getDay() + 6) % 7; // 0=Mon … 6=Sun
}

function buildCalendarDays(month: string): string[] {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${month}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  onDone: () => void;
}

function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed top-5 right-5 z-[200] flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-xl shadow-green-900/20 animate-[fadeInDown_0.25s_ease]">
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      {message}
    </div>
  );
}

// ─── AddShiftModal ────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
}

interface AddShiftModalProps {
  orgId: string;
  defaultDate: string;
  workTypes: WorkType[];
  isManagerMode: boolean;
  sessionPin?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddShiftModal({ orgId, defaultDate, workTypes, isManagerMode, sessionPin, onClose, onSuccess }: AddShiftModalProps) {
  const t = useT();
  const [date, setDate] = useState(defaultDate);
  const [workTypeId, setWorkTypeId] = useState(workTypes[0]?.id ?? '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync workTypeId when workTypes loads after modal opens
  useEffect(() => {
    if (!workTypeId && workTypes.length > 0) {
      setWorkTypeId(workTypes[0].id);
    }
  }, [workTypes, workTypeId]);

  // Manager mode: employee picker
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  useEffect(() => {
    if (!isManagerMode) return;
    managerFetch('/api/employees')
      .then((r) => r.json())
      .then((data: { employees?: Employee[] } | Employee[]) => {
        const list = Array.isArray(data) ? data : (data as { employees?: Employee[] }).employees ?? [];
        setEmployees(list);
        if (list[0]) setSelectedEmployeeId(list[0].id);
      })
      .catch(() => {});
  }, [isManagerMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workTypeId) { setError(t('Vyberte prosím typ práce.', 'Please select a work type.')); return; }

    if (isManagerMode) {
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
        if (!res.ok) { setError(json.error ?? t('Nepodařilo se přidat směnu.', 'Failed to add shift.')); }
        else { onSuccess(); onClose(); }
      } catch { setError(t('Síťová chyba. Zkuste to znovu.', 'Network error. Please try again.')); }
      finally { setSubmitting(false); }
    } else {
      const usedPin = sessionPin || pin.trim();
      if (!usedPin) { setError(t('Zadejte prosím svůj PIN.', 'Please enter your PIN.')); return; }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/public/schedule/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, pin: usedPin, date, workTypeId, startTime: startTime || undefined, endTime: endTime || undefined, note: note || undefined }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? t('Nepodařilo se přidat směnu.', 'Failed to add shift.')); }
        else { onSuccess(); onClose(); }
      } catch { setError(t('Síťová chyba. Zkuste to znovu.', 'Network error. Please try again.')); }
      finally { setSubmitting(false); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">{t('Přidat směnu', 'Add shift')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label={t('Zavřít', 'Close')}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Datum', 'Date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" />
          </div>

          {/* Manager: employee dropdown | Employee: PIN (only if no session) */}
          {isManagerMode ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Zaměstnanec', 'Employee')}</label>
              <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {employees.length === 0 && <option value="">{t('Načítám…', 'Loading…')}</option>}
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          ) : !sessionPin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Váš PIN', 'Your PIN')}</label>
              <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••" autoComplete="off" />
            </div>
          ) : null}

          {/* Work type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('Typ práce', 'Work type')}</label>
            <div className="flex flex-wrap gap-2">
              {workTypes.map((wt) => (
                <button key={wt.id} type="button" onClick={() => setWorkTypeId(wt.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border-l-4 transition-colors ${workTypeId === wt.id ? 'bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-300' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                  style={workTypeId !== wt.id && wt.color ? { borderLeftColor: wt.color } : undefined}>
                  {wt.name}
                </button>
              ))}
              {workTypes.length === 0 && <p className="text-sm text-gray-400">{t('Žádné typy práce nenalezeny.', 'No work types found.')}</p>}
            </div>
          </div>

          {/* Times */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Začátek', 'Start')}</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Konec', 'End')}</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Poznámka (nepovinné)', 'Note (optional)')}</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('Volitelná poznámka…', 'Optional note…')} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">{t('Zrušit', 'Cancel')}</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {submitting ? t('Ukládám…', 'Saving…') : t('Přidat směnu', 'Add shift')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── EditDayModal ─────────────────────────────────────────────────────────────

interface EditDayModalProps {
  orgId: string;
  dateStr: string;
  meta: ScheduleDayMeta | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

function EditDayModal({ orgId, dateStr, meta, onClose, onSuccess }: EditDayModalProps) {
  const t = useT();
  const [requiredTotal, setRequiredTotal] = useState<number>(meta?.requiredTotal ?? 1);
  const [dayType, setDayType] = useState<string>(meta?.dayType ?? 'working');
  const [notes, setNotes] = useState<string>(meta?.notes ?? '');
  const [assignedEmployees, setAssignedEmployees] = useState<{ id: string; name: string }[]>(
    meta?.assigned_employees ?? []
  );
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [addEmpId, setAddEmpId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    managerFetch('/api/employees')
      .then((r) => r.json())
      .then((data: { employees?: Employee[] } | Employee[]) => {
        const list = Array.isArray(data) ? data : (data as { employees?: Employee[] }).employees ?? [];
        setAllEmployees(list);
        const firstAvail = list.find((e) => !assignedEmployees.some((a) => a.id === e.id));
        if (firstAvail) setAddEmpId(firstAvail.id);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const handleAddEmployee = () => {
    const emp = allEmployees.find((e) => e.id === addEmpId);
    if (!emp || assignedEmployees.some((a) => a.id === emp.id)) return;
    const name = emp.name;
    setAssignedEmployees((prev) => [...prev, { id: emp.id, name }]);
    const next = allEmployees.find((e) => e.id !== addEmpId && !assignedEmployees.some((a) => a.id === e.id));
    if (next) setAddEmpId(next.id);
  };

  const handleRemoveEmployee = (id: string) => {
    setAssignedEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedule/${encodeURIComponent(dateStr)}?draft=A`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requiredTotal,
          dayType,
          notes: notes || undefined,
          assignedEmployees: assignedEmployees.map((e) => e.id),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t('Nepodařilo se uložit změny.', 'Failed to save changes.'));
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setError(t('Síťová chyba. Zkuste to znovu.', 'Network error. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const DAY_TYPE_OPTIONS = [
    { value: 'working', label: t('Pracovní', 'Working') },
    { value: 'holiday', label: t('Svátek', 'Holiday') },
    { value: 'closed', label: t('Zavřeno', 'Closed') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{t('Upravit den', 'Edit day')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{dateStr}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label={t('Zavřít', 'Close')}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Required staff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Požadovaný počet zaměstnanců', 'Required number of employees')}</label>
            <input
              type="number"
              min={0}
              value={requiredTotal}
              onChange={(e) => setRequiredTotal(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Day type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('Typ dne', 'Day type')}</label>
            <div className="flex gap-2">
              {DAY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDayType(opt.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    dayType === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Poznámky', 'Notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={t('Volitelná poznámka ke dni…', 'Optional note for the day…')}
            />
          </div>

          {/* Assigned employees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('Přiřazení zaměstnanci', 'Assigned employees')}</label>
            {assignedEmployees.length === 0 ? (
              <p className="text-xs text-gray-400 italic mb-2">{t('Žádní přiřazení zaměstnanci.', 'No employees assigned.')}</p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-2">
                {assignedEmployees.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <span className="text-sm text-slate-700">{emp.name}</span>
                    <button type="button" onClick={() => handleRemoveEmployee(emp.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors ml-2" aria-label={`Odebrat ${emp.name}`}>
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Add employee row */}
            {allEmployees.length > 0 && (
              <div className="flex gap-2">
                <select value={addEmpId} onChange={(e) => setAddEmpId(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {allEmployees
                    .filter((e) => !assignedEmployees.some((a) => a.id === e.id))
                    .map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button type="button" onClick={handleAddEmployee}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-lg border border-blue-200 transition-colors whitespace-nowrap">
                  {t('+ Přidat', '+ Add')}
                </button>
              </div>
            )}
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
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('Zrušit', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? t('Ukládám…', 'Saving…') : t('Uložit', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── DayCard ──────────────────────────────────────────────────────────────────

interface ClipboardEntry {
  employeeId: string;
  employeeName: string | null;
  workTypeId: string | null;
  workTypeName: string | null;
  workTypeColor: string | null;
  startTime: string | null;
  endTime: string | null;
}

// ─── EveningCandidatesModal ───────────────────────────────────────────────────

interface EveningCandidate {
  id: string;
  name: string;
  tier: number;
  targetHours: number;
  monthlyHours: number;
  scheduledToday: boolean;
  todayShift: { start_time: string | null; end_time: string | null; work_type: string | null } | null;
}

function EveningCandidatesModal({
  orgId, dateStr, eveningConfig, onClose, onSuccess,
}: {
  orgId: string;
  dateStr: string;
  eveningConfig: { enabled: boolean; start: string; end: string; minStaff: number; label: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const [candidates, setCandidates] = useState<EveningCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [workTypes, setWorkTypes] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      managerFetch(`/api/manager/evening-candidates?date=${dateStr}`).then((r) => r.json()),
      fetch(`/api/public/work-types?orgId=${encodeURIComponent(orgId)}`).then((r) => r.json()),
    ])
      .then(([candData, wtData]) => {
        setCandidates(candData.candidates ?? []);
        const wts = wtData.workTypes ?? [];
        setWorkTypes(wts);
        if (wts.length > 0) setSelectedWorkTypeId(wts[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateStr, orgId]);

  const handleAdd = async (candidate: EveningCandidate) => {
    if (!selectedWorkTypeId) return;
    setAdding(candidate.id);
    try {
      const wt = workTypes.find((w) => w.id === selectedWorkTypeId);
      await managerFetch('/api/work-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          employeeId: candidate.id,
          date: dateStr,
          workTypeId: selectedWorkTypeId,
          workType: wt?.name ?? '',
          startTime: eveningConfig.start,
          endTime: eveningConfig.end,
        }),
      });
      setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
      onSuccess();
    } catch { /* ignore */ }
    finally { setAdding(null); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800">
              🌙 {t('Večerní směna', 'Evening shift')} — {eveningConfig.start}–{eveningConfig.end}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{dateStr} · {t('Min.', 'Min.')} {eveningConfig.minStaff} {t('lidí', 'staff')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Work type selector */}
        {workTypes.length > 0 && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('Typ práce', 'Work type')}</label>
            <select
              value={selectedWorkTypeId}
              onChange={(e) => setSelectedWorkTypeId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            >
              {workTypes.map((wt) => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
            </select>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 italic">
            {t('Žádní dostupní kandidáti se štítkem', 'No available candidates with label')} &quot;{eveningConfig.label}&quot;
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {candidates.map((c) => (
              <div key={c.id} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${c.scheduledToday ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                    {c.scheduledToday && (
                      <span className="text-[9px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        ✓ {t('dnes plánovaný', 'scheduled today')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-0.5 text-[10px] text-gray-400">
                    {c.scheduledToday && c.todayShift?.start_time && (
                      <span>
                        {c.todayShift.start_time.slice(0,5)}–{c.todayShift.end_time?.slice(0,5) ?? '?'}
                        {' → '}
                        <span className="text-orange-500 font-medium">+{eveningConfig.end}</span>
                      </span>
                    )}
                    <span>{c.monthlyHours}h / {c.targetHours}h {t('měsíc', 'month')}</span>
                    {c.tier > 0 && <span>T{c.tier}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleAdd(c)}
                  disabled={adding === c.id}
                  className="ml-2 shrink-0 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                >
                  {adding === c.id ? '…' : t('+ Přidat', '+ Add')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EveningConfig {
  enabled: boolean;
  start: string; // "17:00"
  end: string;   // "19:00"
  minStaff: number;
  label: string;
}

interface DayCardProps {
  dateStr: string;
  entries: WorkPlanEntry[];
  scheduleMeta: ScheduleDayMeta | undefined;
  isManagerMode: boolean;
  isWeekend: boolean;
  isClosed?: boolean;
  clipboard: ClipboardEntry | null;
  sessionEmployeeId?: string;
  dayNamesShort: string[];
  eveningConfig?: EveningConfig | null;
  orgId?: string;
  onClickDay?: (dateStr: string) => void;
  onEditDay?: (dateStr: string) => void;
  onRemoveEmployee?: (dateStr: string, entryId: string) => void;
  onEditEntry?: (entry: WorkPlanEntry) => void;
  onCopyEntry?: (entry: ClipboardEntry) => void;
  onPaste?: (dateStr: string) => void;
  isMyVacation?: boolean;
  isToday?: boolean;
}

function DayCard({
  dateStr,
  entries,
  scheduleMeta,
  isManagerMode,
  isWeekend,
  isClosed,
  clipboard,
  sessionEmployeeId,
  dayNamesShort,
  eveningConfig,
  orgId,
  onClickDay,
  onEditDay,
  onRemoveEmployee,
  onEditEntry,
  onCopyEntry,
  onPaste,
  isMyVacation,
  isToday,
}: DayCardProps) {
  const t = useT();
  const day = new Date(dateStr + 'T00:00:00');
  const dayNum = day.getDate();
  const dayName = dayNamesShort[mondayWeekday(dateStr)];
  const isEmpty = entries.length === 0;
  const isWeekendEmpty = isWeekend && isEmpty;
  const isPasteMode = !!clipboard;
  const [showEveningPanel, setShowEveningPanel] = useState(false);

  // Split entries into morning / evening based on start_time
  const eveningStartH = eveningConfig?.enabled
    ? parseInt((eveningConfig.start ?? '17:00').split(':')[0])
    : null;
  const morningEntries = eveningStartH !== null
    ? entries.filter((e) => !e.startTime || parseInt(e.startTime.split(':')[0]) < eveningStartH)
    : entries;
  const eveningEntries = eveningStartH !== null
    ? entries.filter((e) => e.startTime && parseInt(e.startTime.split(':')[0]) >= eveningStartH)
    : [];

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking a button inside
    if ((e.target as HTMLElement).closest('button')) return;
    if (isPasteMode && onPaste) {
      onPaste(dateStr);
    } else if (onClickDay) {
      onClickDay(dateStr);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group rounded-xl border h-[106px] p-2.5 flex flex-col gap-1.5 transition-colors relative overflow-hidden ${
        isMyVacation
          ? 'bg-pink-50 border-pink-300 shadow-sm cursor-pointer hover:border-pink-400'
          : isPasteMode
          ? 'cursor-copy border-blue-300 hover:border-blue-500 hover:bg-blue-50/50 bg-blue-50/20'
          : isToday
          ? 'bg-white border-rose-400 shadow-sm shadow-rose-100 cursor-pointer hover:border-rose-500 ring-1 ring-rose-300'
          : isWeekend
          ? 'bg-blue-50/30 border-blue-100 hover:border-blue-200 cursor-pointer hover:bg-blue-50/50'
          : 'bg-white border-slate-200 shadow-sm hover:shadow-md cursor-pointer hover:border-blue-300'
      }`}
    >
      {/* Closed day hatching — purely decorative, sits behind content */}
      {isClosed && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(-45deg, rgba(148,163,184,0.15) 0px, rgba(148,163,184,0.15) 3px, transparent 3px, transparent 10px)',
          }}
        />
      )}
      {/* Manager edit button */}
      {isManagerMode && !isPasteMode && onEditDay && (
        <button
          onClick={(e) => { e.stopPropagation(); onEditDay(dateStr); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600"
          aria-label={`${t('Upravit den', 'Edit day')} ${dateStr}`}
          title={t('Upravit den', 'Edit day')}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
      )}

      {/* Header row */}
      <div className="relative z-10 flex items-center justify-between mb-0.5">
        <span className={`text-xs font-semibold ${isWeekend ? 'text-slate-400' : 'text-slate-500'}`}>
          {dayName}{isClosed && <span className="ml-1 text-[9px] font-bold text-slate-400 bg-slate-200 px-1 py-0.5 rounded-full uppercase tracking-wide">{t('Zavřeno', 'Closed')}</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {isManagerMode && scheduleMeta && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                scheduleMeta.assignedCount >= scheduleMeta.requiredTotal
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-600'
              }`}
            >
              {scheduleMeta.assignedCount}/{scheduleMeta.requiredTotal}
            </span>
          )}
          <span className={`text-sm font-bold ${isManagerMode ? 'mr-5' : ''} ${
            isToday ? 'bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs'
            : isWeekend ? 'text-slate-400' : 'text-slate-700'
          }`}>
            {dayNum}
          </span>
        </div>
      </div>

      {/* Chips — scrollable, above hatching */}
      <div className="relative z-10 flex flex-col gap-1 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
        {/* Morning entries */}
        {morningEntries.map((entry, idx) => (
          <EntryChip
            key={`m-${idx}`}
            entry={entry}
            isManagerMode={isManagerMode}
            sessionEmployeeId={sessionEmployeeId}
            dateStr={dateStr}
            onRemoveEmployee={onRemoveEmployee}
            onEditEntry={onEditEntry}
            onCopyEntry={onCopyEntry}
            t={t}
          />
        ))}

        {/* Evening divider — only when evening shift is enabled */}
        {eveningConfig?.enabled && (
          <div className="flex items-center gap-1 my-0.5">
            <div className="flex-1 border-t border-orange-200" />
            <button
              onClick={(e) => { e.stopPropagation(); if (isManagerMode && orgId) setShowEveningPanel(true); }}
              className={`flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded ${
                eveningEntries.length >= eveningConfig.minStaff
                  ? 'text-orange-500 bg-orange-50'
                  : 'text-orange-400 bg-orange-50 hover:bg-orange-100'
              } ${isManagerMode ? 'cursor-pointer' : 'cursor-default'}`}
              title={isManagerMode ? t('Zobrazit kandidáty pro večerní směnu', 'Show evening shift candidates') : ''}
            >
              🌙 {eveningEntries.length}/{eveningConfig.minStaff}
            </button>
            <div className="flex-1 border-t border-orange-200" />
          </div>
        )}

        {/* Evening entries */}
        {eveningEntries.map((entry, idx) => (
          <EntryChip
            key={`e-${idx}`}
            entry={entry}
            isManagerMode={isManagerMode}
            sessionEmployeeId={sessionEmployeeId}
            dateStr={dateStr}
            onRemoveEmployee={onRemoveEmployee}
            onEditEntry={onEditEntry}
            onCopyEntry={onCopyEntry}
            t={t}
            isEvening
          />
        ))}
      </div>

      {/* Evening candidates panel */}
      {showEveningPanel && orgId && eveningConfig && (
        <EveningCandidatesModal
          orgId={orgId}
          dateStr={dateStr}
          eveningConfig={eveningConfig}
          onClose={() => setShowEveningPanel(false)}
          onSuccess={() => { setShowEveningPanel(false); /* parent will refresh via onClickDay */ }}
        />
      )}
    </div>
  );
}

// ─── EntryChip ────────────────────────────────────────────────────────────────

function EntryChip({
  entry, isManagerMode, sessionEmployeeId, dateStr, onRemoveEmployee, onEditEntry, onCopyEntry, t, isEvening,
}: {
  entry: WorkPlanEntry;
  isManagerMode: boolean;
  sessionEmployeeId?: string;
  dateStr: string;
  onRemoveEmployee?: (dateStr: string, entryId: string) => void;
  onEditEntry?: (entry: WorkPlanEntry) => void;
  onCopyEntry?: (entry: ClipboardEntry) => void;
  t: (cz: string, en: string) => string;
  isEvening?: boolean;
}) {
  const canEdit = isManagerMode || (sessionEmployeeId && entry.employeeId === sessionEmployeeId);
  const color = isEvening ? '#f97316' : (entry.workTypeColor ?? '#94a3b8');
  const timeLabel =
    entry.startTime && entry.endTime
      ? ` ${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}`
      : '';
  const name = entry.employeeName ?? '—';
  const parts = name.trim().split(/\s+/);
  const shortName = parts.length < 2 ? name : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;

  return (
    <div
      className={`group/chip rounded-md text-xs px-2 py-1 font-medium flex items-center justify-between gap-1 min-w-0 ${canEdit && onEditEntry ? 'cursor-context-menu' : ''}`}
      style={{
        borderLeft: `3px solid ${color}`,
        backgroundColor: `${color}22`,
        color: '#1e293b',
      }}
      title={canEdit && onEditEntry ? t('Pravý klik = upravit', 'Right-click = edit') : `${name} · ${entry.workTypeName ?? entry.workType ?? '—'}${timeLabel}`}
      onContextMenu={canEdit && onEditEntry ? (e) => { e.preventDefault(); e.stopPropagation(); onEditEntry(entry); } : undefined}
    >
      <span className="truncate min-w-0">
        <span className="font-semibold">{shortName}</span>
        {timeLabel && <span className="font-normal ml-1" style={{ color: '#475569' }}>{timeLabel.trim()}</span>}
      </span>
      {(isManagerMode ? onRemoveEmployee : (sessionEmployeeId && entry.employeeId === sessionEmployeeId)) && (
        <span className="shrink-0 flex items-center gap-0.5 opacity-60 group-hover/chip:opacity-100 transition-opacity">
          {onCopyEntry && !isManagerMode && sessionEmployeeId && entry.employeeId === sessionEmployeeId && (
            <button
              data-tour="copy-shift"
              onClick={(e) => { e.stopPropagation(); onCopyEntry({ employeeId: entry.employeeId, employeeName: entry.employeeName, workTypeId: entry.workTypeId, workTypeName: entry.workTypeName, workTypeColor: entry.workTypeColor, startTime: entry.startTime, endTime: entry.endTime }); }}
              className="text-slate-400 hover:text-blue-500 p-0.5"
              aria-label={t('Kopírovat směnu', 'Copy shift')}
              title={t('Kopírovat na jiné dny', 'Copy to other days')}
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            </button>
          )}
          {onRemoveEmployee && (isManagerMode || (sessionEmployeeId && entry.employeeId === sessionEmployeeId)) && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemoveEmployee(dateStr, entry.id); }}
              className="text-slate-400 hover:text-red-500"
              aria-label={`Odebrat ${entry.employeeName ?? entry.employeeId}`}
              title={t('Odebrat ze dne', 'Remove from day')}
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </span>
      )}
    </div>
  );
}

// ─── EditShiftModal ───────────────────────────────────────────────────────────

function EditShiftModal({
  entry, workTypes, orgId, isManagerMode, sessionPin, onClose, onSuccess,
}: {
  entry: WorkPlanEntry;
  workTypes: WorkType[];
  orgId: string;
  isManagerMode: boolean;
  sessionPin?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useT();
  const [workTypeId, setWorkTypeId] = useState(entry.workTypeId ?? '');
  const [startTime, setStartTime] = useState(entry.startTime?.slice(0, 5) ?? '');
  const [endTime, setEndTime] = useState(entry.endTime?.slice(0, 5) ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { orgId, workPlanId: entry.id };
      if (workTypeId && workTypeId !== entry.workTypeId) body.workTypeId = workTypeId;
      body.startTime = startTime || null;
      body.endTime = endTime || null;
      if (!isManagerMode && sessionPin) body.pin = sessionPin;

      const res = isManagerMode
        ? await managerFetch('/api/public/work-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/public/work-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      const json = await res.json();
      if (!res.ok) { setError(json.error ?? t('Chyba při ukládání.', 'Save error.')); return; }
      onSuccess();
      onClose();
    } catch { setError(t('Síťová chyba.', 'Network error.')); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">{t('Upravit směnu', 'Edit shift')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-slate-400 mb-4">{entry.employeeName} · {entry.date}</p>

        <div className="space-y-4">
          {/* Work type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Typ práce', 'Work type')}</label>
            <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">{t('— Bez typu —', '— No type —')}</option>
              {workTypes.map((wt) => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
            </select>
          </div>
          {/* Times */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Začátek', 'Start')}</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Konec', 'End')}</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition">
            {t('Zrušit', 'Cancel')}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition disabled:opacity-50">
            {saving ? '…' : t('Uložit', 'Save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

interface LegendProps {
  workTypes: WorkType[];
  isManagerMode: boolean;
  onChanged: () => void;
}

function Legend({ workTypes, isManagerMode, onChanged }: LegendProps) {
  const t = useT();
  const [editing, setEditing] = useState<WorkType | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#3b82f6', category: 'shift' as string });
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setForm({ name: '', color: '#3b82f6', category: 'shift' }); setAdding(true); };
  const openEdit = (wt: WorkType) => { setForm({ name: wt.name, color: wt.color ?? '#94a3b8', category: wt.category ?? 'shift' }); setEditing(wt); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await managerFetch(`/api/work-types/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        await managerFetch('/api/work-types', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      setEditing(null); setAdding(false);
      onChanged();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('Smazat tento typ práce?', 'Delete this work type?'))) return;
    await managerFetch(`/api/work-types/${id}`, { method: 'DELETE' });
    onChanged();
  };

  const CATEGORIES = [
    { value: 'shift', label: t('Směna', 'Shift') },
    { value: 'presence', label: t('Docházka', 'Attendance') },
    { value: 'absence', label: 'Absence' },
  ];

  return (
    <div className="mt-4 px-1">
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
        {workTypes.map((wt) => (
          <div key={wt.id} className="flex items-center gap-1.5 group">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: wt.color ?? '#94a3b8' }} />
            <span className="text-xs text-slate-600">{wt.name}</span>
            {isManagerMode && (
              <div className="hidden group-hover:flex items-center gap-1 ml-0.5">
                <button onClick={() => openEdit(wt)} className="text-slate-400 hover:text-blue-600 transition-colors" title={t('Upravit', 'Edit')}>
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                </button>
                <button onClick={() => handleDelete(wt.id)} className="text-slate-400 hover:text-red-500 transition-colors" title={t('Smazat', 'Delete')}>
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                </button>
              </div>
            )}
          </div>
        ))}
        {isManagerMode && (
          <button onClick={openAdd} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 hover:border-blue-500 rounded px-2 py-0.5 transition-colors">
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
            {t('Přidat typ', 'Add type')}
          </button>
        )}
      </div>

      {/* Edit/Add modal */}
      {(editing || adding) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">{editing ? t('Upravit typ práce', 'Edit work type') : t('Přidat typ práce', 'Add work type')}</h2>
              <button onClick={() => { setEditing(null); setAdding(false); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Název *', 'Name *')}</label>
                <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="např. Prodejna" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Kategorie', 'Category')}</label>
                <div className="flex gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.value} type="button" onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.category === c.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Barva', 'Color')}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                  <span className="text-sm text-gray-500">{form.color}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => { setEditing(null); setAdding(false); }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">{t('Zrušit', 'Cancel')}</button>
              <button type="button" onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? t('Ukládám…', 'Saving…') : editing ? t('Uložit', 'Save') : t('Přidat', 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ICS helpers ──────────────────────────────────────────────────────────────

function icsEscape(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsDateTime(date: string, time: string): string {
  // date = YYYY-MM-DD, time = HH:MM → 20260601T090000
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

function toIcsDate(date: string): string {
  return date.replace(/-/g, '');
}

/** Generate and trigger .ics download for an employee's shifts */
async function downloadShiftsIcs(orgId: string, employeeId: string, employeeName: string, currentMonth: string, customLabel?: string) {
  // Fetch shifts for current month + next 5 months
  const [y, m] = currentMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(y, m - 1 + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const allPlans: { date: string; start_time: string | null; end_time: string | null; work_type: string | null }[] = [];
  await Promise.all(months.map(async (mo) => {
    try {
      const res = await fetch(`/api/public/work-plans?orgId=${encodeURIComponent(orgId)}&employeeId=${encodeURIComponent(employeeId)}&month=${encodeURIComponent(mo)}`);
      if (res.ok) {
        const json = await res.json() as { plans?: { date: string; start_time: string | null; end_time: string | null; work_type: string | null }[] };
        allPlans.push(...(json.plans ?? []));
      }
    } catch { /* ignore */ }
  }));

  allPlans.sort((a, b) => a.date.localeCompare(b.date));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TeamFlow HRIS//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(`Směny — ${employeeName}`)}`,
    'X-WR-TIMEZONE:Europe/Prague',
  ];

  for (const plan of allPlans) {
    const start = plan.start_time ? toIcsDateTime(plan.date, plan.start_time) : `${toIcsDate(plan.date)}T080000`;
    const end   = plan.end_time   ? toIcsDateTime(plan.date, plan.end_time)   : `${toIcsDate(plan.date)}T160000`;
    const summary = icsEscape(customLabel || plan.work_type || 'Směna');
    lines.push(
      'BEGIN:VEVENT',
      `UID:teamflow-shift-${plan.date}-${employeeId}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${icsEscape(`${employeeName} · ${summary}`)}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smeny-${employeeName.replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── WorkPlanGrid ─────────────────────────────────────────────────────────────

export default function WorkPlanGrid({
  orgId,
  month,
  isManagerMode,
  onMonthChange,
}: WorkPlanGridProps) {
  const t = useT();

  const MONTH_NAMES = [
    t('Leden', 'January'), t('Únor', 'February'), t('Březen', 'March'),
    t('Duben', 'April'), t('Květen', 'May'), t('Červen', 'June'),
    t('Červenec', 'July'), t('Srpen', 'August'), t('Září', 'September'),
    t('Říjen', 'October'), t('Listopad', 'November'), t('Prosinec', 'December'),
  ];

  const DAY_NAMES_SHORT = [
    t('Po', 'Mon'), t('Út', 'Tue'), t('St', 'Wed'),
    t('Čt', 'Thu'), t('Pá', 'Fri'), t('So', 'Sat'), t('Ne', 'Sun'),
  ];

  const [data, setData] = useState<ScheduleData | null>(null);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [addShiftDate, setAddShiftDate] = useState<string>(() => todayISO());
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null);
  // Closed days from company settings
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set());
  const [closedWeekdays, setClosedWeekdays] = useState<Set<number>>(new Set());
  // Evening shift config from company settings
  const [eveningConfig, setEveningConfig] = useState<{ enabled: boolean; start: string; end: string; minStaff: number; label: string } | null>(null);
  // Employee PIN session — set once in header, unlocks actions
  const [sessionPin, setSessionPin] = useState('');
  const [sessionEmployee, setSessionEmployee] = useState<{ id: string; name: string } | null>(null);
  const [pinInputValue, setPinInputValue] = useState('');
  const [pinInputError, setPinInputError] = useState(false);
  const [pinInputLoading, setPinInputLoading] = useState(false);
  // Day detail — shown when clicking a day without PIN (read-only overview)
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  // Edit shift modal
  const [editingEntry, setEditingEntry] = useState<WorkPlanEntry | null>(null);
  // "Pouze mé směny" — filter grid to show only session employee's entries
  const [myShiftsOnly, setMyShiftsOnly] = useState(false);
  const [showIcsModal, setShowIcsModal] = useState(false);
  const [icsLabel, setIcsLabel] = useState('');
  // "Má dovolená" — highlight vacation days pink
  const [myVacation, setMyVacation] = useState(false);
  const [vacationDates, setVacationDates] = useState<Set<string>>(new Set());

  // Shift-type filter (pills show unique work type names from current month's schedule)
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);

  // Mobile week view — start on Monday of current week
  const [mobileWeekStart, setMobileWeekStart] = useState<Date>(() => getWeekStart(new Date()));

  const fetchMyVacation = useCallback(async (employeeId: string) => {
    try {
      const res = await fetch(`/api/public/vacation-calendar?orgId=${encodeURIComponent(orgId)}`);
      const json = await res.json();
      const dates = new Set<string>();
      for (const req of json.requests ?? []) {
        if (req.employee_id !== employeeId) continue;
        const from = new Date(req.date_from);
        const to = req.date_to ? new Date(req.date_to) : from;
        const cur = new Date(from);
        while (cur <= to) {
          dates.add(cur.toISOString().slice(0, 10));
          cur.setDate(cur.getDate() + 1);
        }
      }
      setVacationDates(dates);
    } catch { /* non-critical */ }
  }, [orgId]);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/schedule?orgId=${encodeURIComponent(orgId)}&month=${encodeURIComponent(month)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t('Nepodařilo se načíst rozvrh.', 'Failed to load schedule.'));
      } else {
        setData(json);
      }
    } catch {
      setError(t('Síťová chyba. Zkuste obnovit stránku.', 'Network error. Please refresh the page.'));
    } finally {
      setLoading(false);
    }
  }, [orgId, month]);

  const fetchWorkTypes = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/work-types?orgId=${encodeURIComponent(orgId)}`);
      const json = await res.json();
      if (res.ok) setWorkTypes(json.workTypes ?? []);
    } catch {
      // non-critical
    }
  }, [orgId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  useEffect(() => {
    fetchWorkTypes();
  }, [fetchWorkTypes]);

  // Build pill list from unique work type names in the current month's schedule
  useEffect(() => {
    if (!data) return;
    const depts = new Set<string>();
    for (const entry of data.workPlans) {
      if (entry.workTypeName) depts.add(entry.workTypeName);
    }
    setDepartments(Array.from(depts).sort());
  }, [data]);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/public/company-settings?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((s: Record<string, unknown>) => {
        const dates = (typeof s.closed_dates === 'string' ? s.closed_dates : '').split(',').map((d) => d.trim()).filter(Boolean);
        setClosedDates(new Set(dates));
        const keyMap: Record<string, number> = {
          hours_mon: 1, hours_tue: 2, hours_wed: 3, hours_thu: 4,
          hours_fri: 5, hours_sat: 6, hours_sun: 0,
        };
        const closed = new Set<number>();
        for (const [key, wd] of Object.entries(keyMap)) {
          if (key in s && !s[key]) closed.add(wd);
        }
        setClosedWeekdays(closed);
        // Evening shift config
        const enabled = s.evening_shift_enabled === true || s.evening_shift_enabled === 'true';
        setEveningConfig({
          enabled,
          start: typeof s.evening_shift_start === 'string' && s.evening_shift_start ? s.evening_shift_start : '17:00',
          end: typeof s.evening_shift_end === 'string' && s.evening_shift_end ? s.evening_shift_end : '19:00',
          minStaff: Number(s.evening_shift_min_staff) || 2,
          label: typeof s.evening_shift_label === 'string' && s.evening_shift_label ? s.evening_shift_label : 'Prodejna',
        });
      })
      .catch(() => {});
  }, [orgId]);

  const handleShiftSuccess = useCallback(() => {
    fetchSchedule();
    setToastMessage(t('✓ Směna přidána', '✓ Shift added'));
    setShowToast(true);
  }, [fetchSchedule, t]);

  const handleClickDay = useCallback((dateStr: string) => {
    if (isManagerMode || sessionEmployee) {
      // Manager or PIN-authenticated employee → open add-shift modal
      setAddShiftDate(dateStr);
      setShowModal(true);
    } else {
      // Read-only visitor → show day detail overview
      setDayDetailDate(dateStr);
    }
  }, [isManagerMode, sessionEmployee]);

  const handleCopyEntry = useCallback((entry: ClipboardEntry) => {
    setClipboard(entry);
  }, []);

  const handlePinLogin = useCallback(async () => {
    if (pinInputValue.length < 4) return;
    setPinInputLoading(true);
    setPinInputError(false);
    try {
      const res = await fetch(`/api/public/presence?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(pinInputValue)}`);
      if (!res.ok) { setPinInputError(true); setPinInputValue(''); return; }
      const json = await res.json();
      setSessionPin(pinInputValue);
      setSessionEmployee({ id: json.employeeId, name: json.employeeName });
      setPinInputValue('');
    } catch {
      setPinInputError(true);
      setPinInputValue('');
    } finally {
      setPinInputLoading(false);
    }
  }, [pinInputValue, orgId]);

  const handlePaste = useCallback(async (dateStr: string) => {
    if (!clipboard) return;
    if (isManagerMode) {
      try {
        const res = await managerFetch('/api/public/work-plans', {
          method: 'POST',
          body: JSON.stringify({
            orgId,
            employeeId: clipboard.employeeId,
            date: dateStr,
            workTypeId: clipboard.workTypeId,
            startTime: clipboard.startTime || undefined,
            endTime: clipboard.endTime || undefined,
          }),
        });
        if (res.ok) {
          await fetchSchedule();
          setToastMessage(`✓ ${t('Zkopírováno na', 'Copied to')} ${dateStr.slice(8)}.${dateStr.slice(5, 7)}.`);
          setShowToast(true);
        }
      } catch { /* ignore */ }
    } else if (sessionPin) {
      // Employee with active session: paste directly
      try {
        const res = await fetch('/api/public/schedule/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId,
            pin: sessionPin,
            date: dateStr,
            workTypeId: clipboard.workTypeId,
            startTime: clipboard.startTime || undefined,
            endTime: clipboard.endTime || undefined,
          }),
        });
        if (res.ok) {
          await fetchSchedule();
          setToastMessage(`✓ ${t('Zkopírováno na', 'Copied to')} ${dateStr.slice(8)}.${dateStr.slice(5, 7)}.`);
          setShowToast(true);
        }
      } catch { /* ignore */ }
    }
  }, [clipboard, orgId, isManagerMode, sessionPin, fetchSchedule]);

  const handleRemoveEmployee = useCallback(async (_dateStr: string, entryId: string) => {
    if (!entryId) return;
    const res = await managerFetch(`/api/public/work-plans?workPlanId=${entryId}&orgId=${orgId}`, {
      method: 'DELETE',
    });
    if (res.ok) await fetchSchedule();
  }, [orgId, fetchSchedule]);

  // PIN-authenticated delete: employee removes only their own shift
  const handleRemoveEmployeeSelf = useCallback(async (_dateStr: string, entryId: string) => {
    if (!sessionPin || !sessionEmployee || !entryId) return;
    const entry = data?.workPlans.find((wp) => wp.id === entryId);
    if (!entry || entry.employeeId !== sessionEmployee.id) return;
    const res = await fetch(
      `/api/public/work-plans?workPlanId=${entryId}&orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(sessionPin)}`,
      { method: 'DELETE' }
    );
    if (res.ok) await fetchSchedule();
  }, [data, orgId, sessionPin, sessionEmployee, fetchSchedule]);

  // Mobile week navigation — sync month when week crosses boundary
  const handlePrevWeek = () => {
    const prev = new Date(mobileWeekStart);
    prev.setDate(prev.getDate() - 7);
    setMobileWeekStart(prev);
    const newMonth = monthOf(dateToISO(prev));
    if (newMonth !== month) onMonthChange(newMonth);
  };

  const handleNextWeek = () => {
    const next = new Date(mobileWeekStart);
    next.setDate(next.getDate() + 7);
    setMobileWeekStart(next);
    const newMonth = monthOf(dateToISO(next));
    if (newMonth !== month) onMonthChange(newMonth);
  };

  const mobileWeekDays = getWeekDays(mobileWeekStart);
  const mobileWeekEnd = mobileWeekDays[6];

  // Format week label: "2. – 8. června 2026" or cross-month "30. května – 5. června 2026"
  const CZ_MONTHS_LONG_SHORT = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  const wsDate = new Date(mobileWeekDays[0] + 'T00:00:00');
  const weDate = new Date(mobileWeekEnd + 'T00:00:00');
  const mobileWeekLabel = wsDate.getMonth() === weDate.getMonth()
    ? `${wsDate.getDate()}. – ${weDate.getDate()}. ${CZ_MONTHS_LONG_SHORT[wsDate.getMonth()]} ${wsDate.getFullYear()}`
    : `${wsDate.getDate()}. ${CZ_MONTHS_LONG_SHORT[wsDate.getMonth()]} – ${weDate.getDate()}. ${CZ_MONTHS_LONG_SHORT[weDate.getMonth()]} ${weDate.getFullYear()}`;

  const todayStr = todayISO();

  const calendarDays = buildCalendarDays(month);
  const firstDayOffset = calendarDays.length > 0 ? mondayWeekday(calendarDays[0]) : 0;

  // Build sort order map from work types
  const workTypeSortOrder = new Map<string, number>();
  workTypes.forEach((wt, idx) => workTypeSortOrder.set(wt.id, wt.sort_order ?? idx));

  const entriesByDate = new Map<string, WorkPlanEntry[]>();
  const metaByDate = new Map<string, ScheduleDayMeta>();

  if (data) {
    for (const entry of data.workPlans) {
      const list = entriesByDate.get(entry.date) ?? [];
      list.push(entry);
      entriesByDate.set(entry.date, list);
    }
    // Sort each day's entries by work type sort_order
    entriesByDate.forEach((list: WorkPlanEntry[], date: string) => {
      list.sort((a: WorkPlanEntry, b: WorkPlanEntry) => (workTypeSortOrder.get(a.workTypeId ?? '') ?? 999) - (workTypeSortOrder.get(b.workTypeId ?? '') ?? 999));
      entriesByDate.set(date, list);
    });
    for (const meta of data.scheduleDays) {
      metaByDate.set(meta.date, meta);
    }
  }

  const editingMeta = editingDate ? metaByDate.get(editingDate) : undefined;

  const DAY_NAMES_LONG = [
    t('Neděle', 'Sunday'), t('Pondělí', 'Monday'), t('Úterý', 'Tuesday'),
    t('Středa', 'Wednesday'), t('Čtvrtek', 'Thursday'), t('Pátek', 'Friday'), t('Sobota', 'Saturday'),
  ];

  return (
    <div className="w-full">
      {/* Toast */}
      {showToast && (
        <Toast message={toastMessage} onDone={() => setShowToast(false)} />
      )}

      {/* Clipboard banner */}
      {clipboard && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-blue-700 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl shadow-blue-900/40">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
          </svg>
          <span>
            {t('Kopírování:', 'Copying:')} <span className="font-bold">{clipboard.employeeName ?? '—'}</span>
            {clipboard.workTypeName ? ` · ${clipboard.workTypeName}` : ''}
            {` — ${t('klikněte na den pro vložení', 'click on a day to paste')}`}
          </span>
          <button
            onClick={() => setClipboard(null)}
            className="ml-2 text-blue-200 hover:text-white transition-colors"
            title={t('Zrušit kopírování', 'Cancel copy')}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* ── MOBILE WEEK VIEW ─────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col h-full">
        {/* Mobile toolbar: PIN session */}
        {!isManagerMode && (
          <div className="px-4 pt-3 pb-2 border-b border-slate-200 bg-white">
            {sessionEmployee ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setMyShiftsOnly((v) => !v)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${myShiftsOnly ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'}`}
                >
                  📅 {t('Mé směny', 'My shifts')}
                </button>
                <button
                  onClick={() => {
                    const next = !myVacation;
                    setMyVacation(next);
                    if (next && sessionEmployee) fetchMyVacation(sessionEmployee.id);
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${myVacation ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-slate-700 border-slate-200'}`}
                >
                  🌴 {t('Dovolená', 'Vacation')}
                </button>
                <div className="ml-auto flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-700 text-xs font-semibold">{sessionEmployee.name}</span>
                  <button onClick={() => { setSessionEmployee(null); setSessionPin(''); setClipboard(null); setMyShiftsOnly(false); }} className="text-emerald-400 hover:text-emerald-700 text-xs">✕</button>
                </div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handlePinLogin(); }} className="flex items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinInputValue}
                  onChange={(e) => { setPinInputValue(e.target.value.replace(/\D/g, '')); setPinInputError(false); }}
                  placeholder={t('Váš PIN kód', 'Your PIN')}
                  className={`flex-1 text-sm px-3 py-2 rounded-lg border ${pinInputError ? 'border-red-400 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-blue-400 tracking-widest`}
                />
                <button type="submit" disabled={pinInputValue.length < 4 || pinInputLoading}
                  className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
                  {pinInputLoading ? '…' : 'OK'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Week navigation */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <button onClick={handlePrevWeek} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors" aria-label={t('Předchozí týden', 'Previous week')}>
            <svg className="w-4 h-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800">{mobileWeekLabel}</div>
            {mobileWeekDays.includes(todayStr) && (
              <div className="text-xs text-blue-500 font-medium mt-0.5">{t('Aktuální týden', 'Current week')}</div>
            )}
          </div>
          <button onClick={handleNextWeek} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors" aria-label={t('Další týden', 'Next week')}>
            <svg className="w-4 h-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Week days list */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            {t('Načítám…', 'Loading…')}
          </div>
        ) : (
          <div className="flex-1 overflow-auto divide-y divide-slate-100">
            {mobileWeekDays.map((dateStr) => {
              const d = new Date(dateStr + 'T00:00:00');
              const wd = d.getDay(); // 0=Sun
              const isWeekend = wd === 0 || wd === 6;
              const isClosed = closedDates.has(dateStr) || closedWeekdays.has(wd);
              const isToday = dateStr === todayStr;
              const isVacation = myVacation && vacationDates.has(dateStr);
              const allEntries = entriesByDate.get(dateStr) ?? [];
              const visibleEntries = (() => {
                let es = myShiftsOnly && sessionEmployee
                  ? allEntries.filter((e) => e.employeeId === sessionEmployee.id)
                  : allEntries;
                if (deptFilter) es = es.filter((e) => e.workTypeName === deptFilter);
                return es;
              })();
              const dayLong = DAY_NAMES_LONG[wd];
              const dayNum = d.getDate();
              const monName = CZ_MONTHS_LONG_SHORT[d.getMonth()];

              return (
                <button
                  key={dateStr}
                  onClick={() => handleClickDay(dateStr)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 active:bg-slate-50 transition-colors ${
                    isVacation ? 'bg-pink-50' :
                    isToday ? 'bg-blue-50' :
                    isWeekend ? 'bg-slate-50/60' : 'bg-white'
                  }`}
                >
                  {/* Date column */}
                  <div className={`shrink-0 w-12 flex flex-col items-center justify-center rounded-xl py-1.5 ${
                    isToday ? 'bg-blue-600 text-white' :
                    isWeekend ? 'bg-slate-200 text-slate-500' :
                    isClosed ? 'bg-slate-100 text-slate-400' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">{DAY_NAMES_SHORT[mondayWeekday(dateStr)]}</span>
                    <span className="text-xl font-bold leading-tight">{dayNum}</span>
                    <span className="text-[10px] leading-none opacity-70">{monName}</span>
                  </div>

                  {/* Content column */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    {isClosed && !visibleEntries.length ? (
                      <span className="inline-block text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {t('Zavřeno', 'Closed')}
                      </span>
                    ) : visibleEntries.length === 0 ? (
                      <span className="text-sm text-slate-400 italic">{t('Žádné směny', 'No shifts')}</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {visibleEntries.slice(0, 4).map((entry, idx) => {
                          const color = entry.workTypeColor ?? '#94a3b8';
                          const parts = (entry.employeeName ?? '—').trim().split(/\s+/);
                          const shortName = parts.length < 2 ? (entry.employeeName ?? '—') : `${parts[0]} ${parts[parts.length - 1][0]}.`;
                          const timeLabel = entry.startTime && entry.endTime
                            ? `${entry.startTime.slice(0,5)}–${entry.endTime.slice(0,5)}`
                            : '';
                          return (
                            <div key={idx} className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-sm font-medium text-slate-800 truncate">{shortName}</span>
                              {timeLabel && <span className="text-xs text-slate-400 shrink-0">{timeLabel}</span>}
                              <span className="text-xs text-slate-400 shrink-0 truncate max-w-[80px]">{entry.workTypeName ?? entry.workType ?? ''}</span>
                            </div>
                          );
                        })}
                        {visibleEntries.length > 4 && (
                          <span className="text-xs text-slate-400">+{visibleEntries.length - 4} {t('dalších', 'more')}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg className="w-4 h-4 text-slate-300 shrink-0 mt-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}

        {/* Mobile add button */}
        <div className="shrink-0 p-4 bg-white border-t border-slate-200">
          <button
            onClick={() => { setAddShiftDate(todayISO()); setShowModal(true); }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all active:scale-95"
          >
            <span className="text-lg font-light">+</span>
            {t('Přidat směnu', 'Add shift')}
          </button>
        </div>
      </div>

      {/* ── DESKTOP MONTH VIEW ───────────────────────────────────────────── */}
      <div className="hidden md:block px-6 py-5">

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        {/* Month navigation */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1">
          <button
            onClick={() => onMonthChange(prevMonth(month))}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            aria-label={t('Předchozí měsíc', 'Previous month')}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[150px] text-center px-2">
            {formatMonthLabel(month, MONTH_NAMES)}
          </span>
          <button
            onClick={() => onMonthChange(nextMonth(month))}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            aria-label={t('Následující měsíc', 'Next month')}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Department filter pills */}
        {departments.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setDeptFilter(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${deptFilter === null ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
            >
              {t('Vše', 'All')}
            </button>
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setDeptFilter(deptFilter === dept ? null : dept)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${deptFilter === dept ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'}`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}

        {/* Right side: PIN session + add button */}
        <div className="flex items-center gap-2">
          {/* Employee PIN session widget */}
          {!isManagerMode && (
            sessionEmployee ? (
              <div className="flex items-center gap-2 flex-wrap">
                {/* "Pouze mé směny" toggle */}
                <button
                  onClick={() => setMyShiftsOnly((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${myShiftsOnly ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-600'}`}
                >
                  📅 {t('Pouze mé směny', 'My shifts only')}
                </button>
                {/* "Má dovolená" toggle */}
                <button
                  onClick={() => {
                    const next = !myVacation;
                    setMyVacation(next);
                    if (next && sessionEmployee) fetchMyVacation(sessionEmployee.id);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${myVacation ? 'bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-500/20' : 'bg-white text-slate-700 border-slate-200 hover:border-pink-400 hover:text-pink-600'}`}
                >
                  🌴 {t('Má dovolená', 'My vacation')}
                </button>
                {/* .ics download */}
                {myShiftsOnly && (
                  <>
                    <button
                      onClick={() => { setIcsLabel(sessionEmployee.name); setShowIcsModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-white text-slate-700 border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 transition-all"
                      title={t('Stáhnout jako kalendář (.ics)', 'Download as calendar (.ics)')}
                    >
                      ⬇ .ics
                    </button>
                    {showIcsModal && typeof window !== 'undefined' && createPortal(
                      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowIcsModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 mx-4" onClick={e => e.stopPropagation()}>
                          <h3 className="text-base font-bold text-slate-800 mb-1">{t('Název směny v kalendáři', 'Shift name in calendar')}</h3>
                          <p className="text-xs text-slate-400 mb-4">{t('Takto se zobrazí každá směna ve vašem Apple/Google kalendáři.', 'This is how each shift will appear in your Apple/Google calendar.')}</p>
                          <input
                            type="text"
                            value={icsLabel}
                            onChange={e => setIcsLabel(e.target.value)}
                            placeholder={t('Např. Práce, Směna…', 'E.g. Work, Shift…')}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-4"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') { setShowIcsModal(false); downloadShiftsIcs(orgId, sessionEmployee.id, sessionEmployee.name, month, icsLabel.trim() || sessionEmployee.name); }
                              if (e.key === 'Escape') setShowIcsModal(false);
                            }}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setShowIcsModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition">
                              {t('Zrušit', 'Cancel')}
                            </button>
                            <button
                              onClick={() => { setShowIcsModal(false); downloadShiftsIcs(orgId, sessionEmployee.id, sessionEmployee.name, month, icsLabel.trim() || sessionEmployee.name); }}
                              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition"
                            >
                              ⬇ {t('Stáhnout', 'Download')}
                            </button>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}
                  </>
                )}
                {/* Session badge */}
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-700 text-sm font-semibold">{sessionEmployee.name}</span>
                  <button
                    onClick={() => { setSessionEmployee(null); setSessionPin(''); setClipboard(null); setMyShiftsOnly(false); }}
                    className="text-emerald-400 hover:text-emerald-700 transition-colors text-xs"
                    title={t('Odhlásit', 'Log out')}
                  >✕</button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); handlePinLogin(); }}
                className="flex items-center gap-1.5"
              >
                <input
                  data-tour="pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinInputValue}
                  onChange={(e) => { setPinInputValue(e.target.value.replace(/\D/g, '')); setPinInputError(false); }}
                  placeholder={t('Váš kód', 'Your code')}
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

          {/* Add shift button */}
          <button
            data-tour="add-shift"
            onClick={() => { setAddShiftDate(todayISO()); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-95"
          >
            <span className="text-lg leading-none font-light">+</span>
            {t('Přidat směnu', 'Add shift')}
          </button>
        </div>
      </div>

      {/* Loading / error states */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
          {t('Načítám rozvrh…', 'Loading schedule…')}
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={fetchSchedule}
            className="px-4 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm hover:bg-red-100 transition-colors"
          >
            {t('Zkusit znovu', 'Try again')}
          </button>
        </div>
      )}

      {/* Calendar grid */}
      {!loading && !error && (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1.5 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl px-1 py-2">
            {DAY_NAMES_SHORT.map((d, idx) => (
              <div
                key={idx}
                className={`text-center text-xs font-semibold py-0.5 ${
                  idx >= 5 ? 'text-slate-500' : 'text-slate-300'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Leading empty cells */}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-start-${i}`} />
            ))}

            {calendarDays.map((dateStr) => {
              const wd = mondayWeekday(dateStr);
              const isWeekend = wd === 5 || wd === 6;
              const isClosed = closedDates.has(dateStr) || closedWeekdays.has(new Date(dateStr + 'T00:00:00').getDay());
              const allEntries = entriesByDate.get(dateStr) ?? [];
              const visibleEntries = (() => {
                let es = myShiftsOnly && sessionEmployee
                  ? allEntries.filter((e) => e.employeeId === sessionEmployee.id)
                  : allEntries;
                if (deptFilter) es = es.filter((e) => e.workTypeName === deptFilter);
                return es;
              })();
              return (
                <DayCard
                  key={dateStr}
                  dateStr={dateStr}
                  entries={visibleEntries}
                  scheduleMeta={metaByDate.get(dateStr)}
                  isManagerMode={isManagerMode}
                  isWeekend={isWeekend}
                  isClosed={isClosed}
                  clipboard={clipboard}
                  sessionEmployeeId={sessionEmployee?.id}
                  dayNamesShort={DAY_NAMES_SHORT}
                  eveningConfig={eveningConfig}
                  orgId={orgId}
                  onClickDay={handleClickDay}
                  onEditDay={isManagerMode ? setEditingDate : undefined}
                  onRemoveEmployee={isManagerMode ? handleRemoveEmployee : (sessionEmployee ? handleRemoveEmployeeSelf : undefined)}
                  onEditEntry={(isManagerMode || sessionEmployee) ? setEditingEntry : undefined}
                  onCopyEntry={handleCopyEntry}
                  onPaste={handlePaste}
                  isMyVacation={myVacation && vacationDates.has(dateStr)}
                  isToday={dateStr === todayStr}
                />
              );
            })}
          </div>

          {/* Legend */}
          <Legend workTypes={workTypes} isManagerMode={isManagerMode} onChanged={fetchWorkTypes} />
        </>
      )}
      </div>{/* end desktop */}

      {/* Shared modals — fixed position, visible on both mobile and desktop */}
      {showModal && (
        <AddShiftModal
          orgId={orgId}
          defaultDate={addShiftDate}
          workTypes={workTypes}
          isManagerMode={isManagerMode}
          sessionPin={sessionPin || undefined}
          onClose={() => setShowModal(false)}
          onSuccess={handleShiftSuccess}
        />
      )}

      {editingEntry && typeof window !== 'undefined' && (
        <EditShiftModal
          entry={editingEntry}
          workTypes={workTypes}
          orgId={orgId}
          isManagerMode={isManagerMode}
          sessionPin={sessionPin || undefined}
          onClose={() => setEditingEntry(null)}
          onSuccess={() => { setEditingEntry(null); fetchSchedule(); }}
        />
      )}

      {editingDate && (
        <EditDayModal
          orgId={orgId}
          dateStr={editingDate}
          meta={editingMeta}
          onClose={() => setEditingDate(null)}
          onSuccess={fetchSchedule}
        />
      )}

      {dayDetailDate && (
        <DayDetailModal
          dateStr={dayDetailDate}
          entries={entriesByDate.get(dayDetailDate) ?? []}
          workTypes={workTypes}
          dayNamesShort={DAY_NAMES_SHORT}
          onClose={() => setDayDetailDate(null)}
        />
      )}
    </div>
  );
}

// ─── DayDetailModal ───────────────────────────────────────────────────────────

const CZ_MONTHS_LONG = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
const DAY_NAMES_LONG_CZ = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

function DayDetailModal({
  dateStr, entries, workTypes, dayNamesShort, onClose,
}: {
  dateStr: string;
  entries: WorkPlanEntry[];
  workTypes: WorkType[];
  dayNamesShort: string[];
  onClose: () => void;
}) {
  const t = useT();
  const d = new Date(dateStr + 'T00:00:00');
  const dayLong = DAY_NAMES_LONG_CZ[d.getDay()];
  const dateLabel = `${d.getDate()}. ${CZ_MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;

  // Group entries by work type
  const byType = new Map<string, WorkPlanEntry[]>();
  for (const e of entries) {
    const key = e.workTypeName ?? e.workType ?? t('Ostatní', 'Other');
    byType.set(key, [...(byType.get(key) ?? []), e]);
  }

  // Sort groups by work type sort_order
  const wtOrder = new Map(workTypes.map((wt, i) => [wt.name, wt.sort_order ?? i]));
  const groups = Array.from(byType.entries()).sort(
    (a: [string, WorkPlanEntry[]], b: [string, WorkPlanEntry[]]) =>
      (wtOrder.get(a[0]) ?? 999) - (wtOrder.get(b[0]) ?? 999)
  );

  const colorFor = (typeName: string | null) =>
    workTypes.find((wt) => wt.name === typeName)?.color ?? '#94a3b8';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{dayLong}</p>
            <h2 className="text-white text-xl font-bold">{dateLabel}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {entries.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">{t('Žádné směny tento den.', 'No shifts this day.')}</p>
          ) : (
            groups.map(([typeName, groupEntries]) => {
              const color = colorFor(typeName);
              return (
                <div key={typeName}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{typeName}</span>
                    <span className="text-xs text-slate-400">({groupEntries.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {groupEntries
                      .slice()
                      .sort((a: WorkPlanEntry, b: WorkPlanEntry) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
                      .map((e: WorkPlanEntry) => {
                        const timeLabel = e.startTime && e.endTime
                          ? `${e.startTime.slice(0, 5)} – ${e.endTime.slice(0, 5)}`
                          : null;
                        return (
                          <div
                            key={e.id}
                            className="flex items-center justify-between px-3 py-2 rounded-xl"
                            style={{ backgroundColor: `${color}18`, borderLeft: `3px solid ${color}` }}
                          >
                            <span className="text-sm font-semibold text-slate-800">{e.employeeName ?? '—'}</span>
                            {timeLabel && (
                              <span className="text-xs font-mono text-slate-500 bg-white/60 px-2 py-0.5 rounded-lg">
                                {timeLabel}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t bg-slate-50 rounded-b-2xl">
          <p className="text-xs text-slate-400 text-center">
            {t('Zadejte kód pro přidání nebo odebrání vlastní směny', 'Enter your code to add or remove your own shift')}
          </p>
        </div>
      </div>
    </div>
  );
}
