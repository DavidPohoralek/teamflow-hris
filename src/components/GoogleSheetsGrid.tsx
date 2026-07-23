'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  month: string;
  isManagerMode: boolean;
  onMonthChange: (month: string) => void;
  hiddenElements?: string[];
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
  const [h, m] = t.split(':');
  return `${parseInt(h, 10)}:${m}`;
}

function getMonthsForWeek(weekDays: string[]): string[] {
  return Array.from(new Set(weekDays.map((d) => d.slice(0, 7))));
}

function dedup(entries: WorkPlanEntry[]): WorkPlanEntry[] {
  const hasTyped = entries.some((e) => e.workTypeId != null);
  let cleaned = hasTyped ? entries.filter((e) => e.workTypeId != null) : entries;
  const timedTypeIds = new Set(
    cleaned.filter((e) => e.startTime && e.endTime && e.workTypeId).map((e) => e.workTypeId!)
  );
  cleaned = cleaned.filter(
    (e) => (e.startTime && e.endTime) || !timedTypeIds.has(e.workTypeId ?? '__none__')
  );
  return cleaned.length > 0 ? cleaned : entries;
}

function buildMap(plans: WorkPlanEntry[], dateFilter?: (d: string) => boolean): Map<string, WorkPlanEntry[]> {
  const raw = new Map<string, WorkPlanEntry[]>();
  for (const p of plans) {
    if (dateFilter && !dateFilter(p.date)) continue;
    const key = `${p.employeeId}|${p.date}`;
    const arr = raw.get(key) ?? [];
    arr.push(p);
    raw.set(key, arr);
  }
  const out = new Map<string, WorkPlanEntry[]>();
  raw.forEach((entries, key) => out.set(key, dedup(entries)));
  return out;
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

// ─── AddShiftModal ────────────────────────────────────────────────────────────

interface AddShiftModalProps {
  orgId: string;
  defaultDate: string;
  workTypes: WorkType[];
  isManagerMode: boolean;
  sessionPin?: string;
  defaultEmployeeId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddShiftModal({ orgId, defaultDate, workTypes, isManagerMode, sessionPin, defaultEmployeeId, onClose, onSuccess }: AddShiftModalProps) {
  const t = useT();
  const [date, setDate] = useState(defaultDate);
  const [workTypeId, setWorkTypeId] = useState(workTypes[0]?.id ?? '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [isEvening, setIsEvening] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(defaultEmployeeId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workTypeId && workTypes.length > 0) setWorkTypeId(workTypes[0].id);
  }, [workTypes, workTypeId]);

  useEffect(() => {
    if (!isManagerMode) return;
    managerFetch('/api/employees')
      .then((r) => r.json())
      .then((data: { employees?: Employee[] } | Employee[]) => {
        const list = Array.isArray(data) ? data : (data as { employees?: Employee[] }).employees ?? [];
        setEmployees(list);
        if (!defaultEmployeeId && list[0]) setSelectedEmployeeId(list[0].id);
      })
      .catch(() => {});
  }, [isManagerMode, defaultEmployeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workTypeId) { setError(t('Vyberte prosím typ práce.', 'Please select a work type.')); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (isManagerMode) {
        if (!selectedEmployeeId) { setError(t('Vyberte zaměstnance.', 'Please select an employee.')); setSubmitting(false); return; }
        const res = await managerFetch('/api/public/work-plans', {
          method: 'POST',
          body: JSON.stringify({ orgId, employeeId: selectedEmployeeId, date, workTypeId, startTime: startTime || undefined, endTime: endTime || undefined, note: note || undefined, isEvening }),
        });
        const json = await res.json();
        if (!res.ok) setError(json.error ?? t('Nepodařilo se přidat směnu.', 'Failed to add shift.'));
        else { onSuccess(); onClose(); }
      } else {
        const res = await fetch('/api/public/schedule/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, pin: sessionPin, date, workTypeId, startTime: startTime || undefined, endTime: endTime || undefined, note: note || undefined, isEvening }),
        });
        const json = await res.json();
        if (!res.ok) setError(json.error ?? t('Nepodařilo se přidat směnu.', 'Failed to add shift.'));
        else { onSuccess(); onClose(); }
      }
    } catch { setError(t('Síťová chyba.', 'Network error.')); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 overflow-y-auto max-h-[92dvh]">
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
          {isManagerMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Zaměstnanec', 'Employee')}</label>
              <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {employees.length === 0 && <option value="">{t('Načítám…', 'Loading…')}</option>}
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
          )}
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isEvening} onChange={(e) => setIsEvening(e.target.checked)}
              className="w-4 h-4 accent-orange-500" />
            <span className="text-sm font-medium text-gray-700">🌙 {t('Večerní', 'Evening')}</span>
          </label>
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

// ─── EditShiftModal ───────────────────────────────────────────────────────────

interface EditShiftModalProps {
  orgId: string;
  entry: WorkPlanEntry;
  workTypes: WorkType[];
  isManagerMode: boolean;
  sessionPin?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function EditShiftModal({ orgId, entry, workTypes, isManagerMode, sessionPin, onClose, onSuccess }: EditShiftModalProps) {
  const t = useT();
  const [workTypeId, setWorkTypeId] = useState(entry.workTypeId ?? workTypes[0]?.id ?? '');
  const [startTime, setStartTime] = useState(entry.startTime?.slice(0, 5) ?? '');
  const [endTime, setEndTime] = useState(entry.endTime?.slice(0, 5) ?? '');
  const [isEvening, setIsEvening] = useState(entry.isEvening ?? false);
  const [note, setNote] = useState((entry as unknown as Record<string, unknown>).note as string ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const bodyObj: Record<string, unknown> = {
        orgId,
        workPlanId: entry.id,
        workTypeId: workTypeId || undefined,
        startTime: startTime || null,
        endTime: endTime || null,
        isEvening,
        note: note.trim() || null,
      };
      if (!isManagerMode) bodyObj.pin = sessionPin;
      const res = isManagerMode
        ? await managerFetch('/api/public/work-plans', { method: 'PATCH', body: JSON.stringify(bodyObj) })
        : await fetch('/api/public/work-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj) });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? t('Nepodařilo se upravit.', 'Update failed.'));
      else { onSuccess(); onClose(); }
    } catch { setError(t('Síťová chyba.', 'Network error.')); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 overflow-y-auto max-h-[92dvh]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{t('Upravit směnu', 'Edit shift')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{entry.employeeName} · {entry.date}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Typ práce', 'Work type')}</label>
            <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)}
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isEvening} onChange={(e) => setIsEvening(e.target.checked)} className="w-4 h-4 accent-orange-500" />
            <span className="text-sm font-medium text-gray-700">🌙 {t('Večerní', 'Evening')}</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Poznámka', 'Note')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t('Volitelná poznámka ke směně…', 'Optional shift note…')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              {t('Zrušit', 'Cancel')}
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {submitting ? '…' : t('Uložit', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── BulkShiftModal ───────────────────────────────────────────────────────────

interface BulkShiftModalProps {
  orgId: string;
  month: string;
  workTypes: WorkType[];
  isManagerMode: boolean;
  sessionEmployee?: { id: string; name: string } | null;
  sessionPin?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const WEEKDAY_LABELS_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

function BulkShiftModal({ orgId, month, workTypes, isManagerMode, sessionEmployee, sessionPin, onClose, onSuccess }: BulkShiftModalProps) {
  const t = useT();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [workTypeId, setWorkTypeId] = useState(workTypes[0]?.id ?? '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isEvening, setIsEvening] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4]));
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isManagerMode) return;
    managerFetch('/api/employees')
      .then((r) => r.json())
      .then((d: { employees?: Employee[] } | Employee[]) => {
        const list = Array.isArray(d) ? d : (d as { employees?: Employee[] }).employees ?? [];
        setEmployees(list);
        if (list[0]) setSelectedEmployeeId(list[0].id);
      })
      .catch(() => {});
  }, [isManagerMode]);

  const targetDays = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const days: string[] = [];
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d);
      const wd = (date.getDay() + 6) % 7;
      if (selectedDays.has(wd)) days.push(`${month}-${String(d).padStart(2, '0')}`);
    }
    return days;
  }, [month, selectedDays]);

  const toggleDay = (wd: number) => {
    setSelectedDays((prev) => { const next = new Set(prev); next.has(wd) ? next.delete(wd) : next.add(wd); return next; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!isManagerMode && !sessionPin) || !workTypeId || targetDays.length === 0) return;
    if (isManagerMode && !selectedEmployeeId) return;
    setProgress(t('Ukládám…', 'Saving…'));
    setError(null);
    let ok = 0, fail = 0, skipped = 0;
    for (const date of targetDays) {
      try {
        let res: Response;
        if (isManagerMode) {
          res = await managerFetch('/api/public/work-plans', {
            method: 'POST',
            body: JSON.stringify({ orgId, employeeId: selectedEmployeeId, date, workTypeId, startTime: startTime || undefined, endTime: endTime || undefined, isEvening }),
          });
        } else {
          res = await fetch('/api/public/schedule/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, pin: sessionPin, date, workTypeId, startTime: startTime || undefined, endTime: endTime || undefined, isEvening }),
          });
        }
        if (res.ok) ok++;
        else if (res.status === 409) skipped++; // duplicate — just skip
        else fail++;
      } catch { fail++; }
      setProgress(`${ok + skipped + fail} / ${targetDays.length}…`);
    }
    if (fail > 0) setError(t(`${fail} dnů se nepodařilo uložit.`, `${fail} days failed.`));
    else { onSuccess(); onClose(); }
    setProgress(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 overflow-y-auto max-h-[92dvh]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">⚡ {t('Plošné zadání směn', 'Bulk shift assignment')}</h2>
            {!isManagerMode && sessionEmployee && (
              <p className="text-xs text-gray-400 mt-0.5">{sessionEmployee.name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isManagerMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Zaměstnanec', 'Employee')}</label>
              <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {employees.length === 0 && <option value="">{t('Načítám…', 'Loading…')}</option>}
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
          )}
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isEvening} onChange={(e) => setIsEvening(e.target.checked)} className="w-4 h-4 accent-orange-500" />
            <span className="text-sm font-medium text-gray-700">🌙 {t('Večerní', 'Evening')}</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('Dny v týdnu', 'Days of week')}</label>
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAY_LABELS_CS.map((label, wd) => (
                <button key={wd} type="button" onClick={() => toggleDay(wd)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${selectedDays.has(wd) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {targetDays.length > 0 && (
            <div className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2 font-medium">
              {t(`Zadá ${targetDays.length} směn v ${month}`, `Creates ${targetDays.length} shifts in ${month}`)}
            </div>
          )}
          {targetDays.length === 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              {t('Vyberte alespoň jeden den.', 'Select at least one day.')}
            </div>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              {t('Zrušit', 'Cancel')}
            </button>
            <button type="submit" disabled={!!progress || targetDays.length === 0}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {progress ?? t('Zadat směny', 'Assign shifts')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GoogleSheetsGrid({ orgId, month, isManagerMode, onMonthChange, hiddenElements = [] }: GoogleSheetsGridProps) {
  const t = useT();

  const DAY_NAMES = [t('Po', 'Mon'), t('Út', 'Tue'), t('St', 'Wed'), t('Čt', 'Thu'), t('Pá', 'Fri'), t('So', 'Sat'), t('Ne', 'Sun')];

  const [weekStart, setWeekStart] = useState<Date>(() => {
    const [y, m] = month.split('-').map(Number);
    return getWeekStart(new Date(y, m - 1, 1));
  });

  const weekDays = getWeekDays(weekStart);

  const prevMonthRef = useRef(month);
  useEffect(() => {
    const midWeek = weekDays[3];
    const weekMonth = midWeek.slice(0, 7);
    if (weekMonth !== prevMonthRef.current) {
      prevMonthRef.current = weekMonth;
      onMonthChange(weekMonth);
    }
  }, [weekDays, onMonthChange]);

  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plansMap, setPlansMap] = useState<Map<string, WorkPlanEntry[]>>(new Map());
  const [monthPlansMap, setMonthPlansMap] = useState<Map<string, WorkPlanEntry[]>>(new Map());
  const [fullPlansMap, setFullPlansMap] = useState<Map<string, WorkPlanEntry[]>>(new Map());
  const [vacationSet, setVacationSet] = useState<Set<string>>(new Set());
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState('');
  const [addModalEmployeeId, setAddModalEmployeeId] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  // Context menu + edit + bulk
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: WorkPlanEntry } | null>(null);
  const [editEntry, setEditEntry] = useState<WorkPlanEntry | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Sticky month-view header
  const [stickyWeekKey, setStickyWeekKey] = useState<string | null>(null);
  const weekSepRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  // Scroll sync: header div scrollLeft follows body div (split-table sticky approach)
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  // Sticky toolbar
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(56);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [deptFilters, setDeptFilters] = useState<string[]>([]);
  const [activityFilter, setActivityFilter] = useState(false);
  const [eveningFilter, setEveningFilter] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [activityDepts, setActivityDepts] = useState<string[]>([]);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  // ── PIN session ──────────────────────────────────────────────────────────
  const [sessionPin, setSessionPin] = useState('');
  const [sessionEmployee, setSessionEmployee] = useState<{ id: string; name: string } | null>(null);
  const [pinInputValue, setPinInputValue] = useState('');
  const [pinInputError, setPinInputError] = useState(false);
  const [pinInputLoading, setPinInputLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hris_employee_session');
      if (stored) {
        const parsed = JSON.parse(stored) as { id: string; name: string; pin: string; orgId: string };
        if (parsed.orgId === orgId && parsed.id && parsed.name && parsed.pin) {
          setSessionPin(parsed.pin);
          setSessionEmployee({ id: parsed.id, name: parsed.name });
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      try { localStorage.setItem('hris_employee_session', JSON.stringify({ id: json.employeeId, name: json.employeeName, pin: pinInputValue, orgId })); } catch { /* ignore */ }
      setPinInputValue('');
    } catch {
      setPinInputError(true);
      setPinInputValue('');
    } finally {
      setPinInputLoading(false);
    }
  }, [pinInputValue, orgId]);

  // ── Fetch employees once (manager mode) ───────────────────────────────────
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

  useEffect(() => {
    fetch(`/api/public/work-types?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d) => setWorkTypes(d.workTypes ?? []))
      .catch(() => {});
  }, [orgId]);

  useEffect(() => {
    fetch(`/api/public/company-settings?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const raw = d['closed_dates'];
        if (Array.isArray(raw)) setClosedDates(new Set(raw as string[]));
      })
      .catch(() => {});
  }, [orgId]);

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

  // ── Fetch schedule — always fetch full month range so month view has data ──
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const currentMonth = weekDays[3].slice(0, 7);
      const [cy, cm] = currentMonth.split('-').map(Number);
      // Months touched by first and last week of the month (handles cross-month weeks)
      const firstWeekDays = getWeekDays(getWeekStart(new Date(cy, cm - 1, 1)));
      const lastWeekDays = getWeekDays(getWeekStart(new Date(cy, cm, 0)));
      const months = Array.from(new Set([
        ...getMonthsForWeek(weekDays),
        ...getMonthsForWeek(firstWeekDays),
        currentMonth,
        ...getMonthsForWeek(lastWeekDays),
      ]));

      const results = await Promise.all(
        months.map((m) =>
          fetch(`/api/public/schedule?orgId=${encodeURIComponent(orgId)}&month=${encodeURIComponent(m)}`)
            .then((r) => r.json())
            .then((d) => (d.workPlans ?? []) as WorkPlanEntry[])
            .catch(() => [] as WorkPlanEntry[])
        )
      );
      const allPlans = results.flat();

      setPlansMap(buildMap(allPlans, (d) => weekDays.includes(d)));
      setMonthPlansMap(buildMap(allPlans, (d) => d.startsWith(currentMonth)));
      setFullPlansMap(buildMap(allPlans));
    } finally {
      setLoading(false);
    }
  }, [orgId, weekDays.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // ── Filter lists ──────────────────────────────────────────────────────────
  useEffect(() => {
    const activityNames = new Set(workTypes.filter((w) => w.category === 'activity').map((w) => w.name));
    const regular = new Set<string>();
    const activity = new Set<string>();
    Array.from(plansMap.values()).forEach((entries) => {
      entries.forEach((e) => {
        if (!e.workTypeName) return;
        if (activityNames.has(e.workTypeName)) activity.add(e.workTypeName);
        else regular.add(e.workTypeName);
      });
    });
    setDepartments(Array.from(regular).sort());
    setActivityDepts(Array.from(activity).sort());
  }, [plansMap, workTypes]);

  // ── Close dept dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setDeptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // ── Close context menu on any click ──────────────────────────────────────
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  // ── Toolbar height tracking for sticky offset ─────────────────────────────
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (toolbarRef.current) setToolbarHeight(toolbarRef.current.offsetHeight);
    });
    ro.observe(el);
    setToolbarHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // ── Sticky header: update dates when scrolling in month view ─────────────
  useEffect(() => {
    if (viewMode !== 'month') {
      setStickyWeekKey(null);
      return;
    }

    const getThreshold = () =>
      headerScrollRef.current
        ? headerScrollRef.current.getBoundingClientRect().bottom
        : 113; // nav ~65 + table header ~48

    const handler = () => {
      const threshold = getThreshold();
      let activeKey: string | null = null;
      let activeTop = -Infinity;
      for (const [key, row] of Array.from(weekSepRowRefs.current.entries())) {
        const top = row.getBoundingClientRect().top;
        // +2px epsilon — at scroll-top the first divider sits exactly at the threshold
        if (top <= threshold + 2 && top > activeTop) { activeKey = key; activeTop = top; }
      }
      setStickyWeekKey(activeKey);
    };

    // Listen both on window (capture) and on the actual scroll container
    const scrollContainer = bodyScrollRef.current?.closest<HTMLElement>('.overflow-auto') ?? null;
    window.addEventListener('scroll', handler, { passive: true, capture: true });
    scrollContainer?.addEventListener('scroll', handler, { passive: true });

    // Wait one frame for the DOM to lay out before computing initial state
    const raf = requestAnimationFrame(handler);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', handler, { capture: true } as EventListenerOptions);
      scrollContainer?.removeEventListener('scroll', handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, weekDays[3]]);

  // ── Department sort order ─────────────────────────────────────────────────
  const deptOrder = useMemo(() => {
    const m = new Map<string, number>();
    workTypes.forEach((wt, i) => m.set(wt.name, wt.sort_order ?? i));
    return m;
  }, [workTypes]);

  // Department colour derived from the matching workType colour (departments share workType names)
  const deptColorMap = useMemo(() => {
    const m = new Map<string, string>();
    workTypes.forEach(wt => { if (wt.color) m.set(wt.name, wt.color); });
    return m;
  }, [workTypes]);

  // ── Weeks of current month (for month view) ───────────────────────────────
  const monthWeeks = useMemo(() => {
    const currentMonth = weekDays[3].slice(0, 7);
    const [y, m] = currentMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const weeks: Date[] = [];
    const cur = getWeekStart(first);
    while (cur <= last) {
      weeks.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
    return weeks;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays[3]]);

  // ── Employee list ─────────────────────────────────────────────────────────
  const baseEmployees: Employee[] = useMemo(() => {
    const sourceMap = viewMode === 'month' ? fullPlansMap : plansMap;
    const list = isManagerMode
      ? employees
      : (() => {
          const seen = new Map<string, Employee>();
          Array.from(sourceMap.values()).forEach((p) => {
            p.forEach((e) => {
              if (!seen.has(e.employeeId)) {
                seen.set(e.employeeId, { id: e.employeeId, name: e.employeeName ?? e.employeeId, department: e.employeeDepartment });
              }
            });
          });
          return Array.from(seen.values());
        })();
    return [...list].sort((a, b) => {
      const da = deptOrder.get(a.department ?? '') ?? 9999;
      const db = deptOrder.get(b.department ?? '') ?? 9999;
      if (da !== db) return da - db;
      return (a.name ?? '').localeCompare(b.name ?? '', 'cs');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, isManagerMode, plansMap, fullPlansMap, viewMode, deptOrder]);

  // ── Apply filters ─────────────────────────────────────────────────────────
  const displayEmployees = useMemo(() => {
    const sourceMap = viewMode === 'month' ? fullPlansMap : plansMap;
    const allDates = viewMode === 'month' ? monthWeeks.flatMap(getWeekDays) : weekDays;
    let result = baseEmployees;

    // Name search always applies
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      result = result.filter((e) => (e.name ?? '').toLowerCase().includes(q));
    }

    // In manager mode: don't filter employee rows by shift content —
    // dept/activity/evening filters only affect which badges render inside cells.
    // This ensures all employees are always visible regardless of whether
    // they have shifts in the selected period.
    if (!isManagerMode) {
      if (deptFilters.length > 0) {
        result = result.filter((emp) =>
          allDates.some((date) => (sourceMap.get(`${emp.id}|${date}`) ?? []).some((e) => deptFilters.includes(e.workTypeName ?? '')))
        );
      }
      if (activityFilter) {
        result = result.filter((emp) =>
          allDates.some((date) => (sourceMap.get(`${emp.id}|${date}`) ?? []).some((e) => activityDepts.includes(e.workTypeName ?? '')))
        );
      }
      if (eveningFilter) {
        result = result.filter((emp) =>
          allDates.some((date) => (sourceMap.get(`${emp.id}|${date}`) ?? []).some((e) => e.isEvening))
        );
      }
    }

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseEmployees, nameSearch, deptFilters, activityFilter, activityDepts, eveningFilter, plansMap, fullPlansMap, viewMode, isManagerMode, weekDays.join(','), monthWeeks]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToPrev = () => {
    if (viewMode === 'month') {
      const [y, m] = weekDays[3].slice(0, 7).split('-').map(Number);
      // Use the 15th of the target month — guarantees weekDays[3] (Thu) lands in that month
      setWeekStart(getWeekStart(new Date(y, m - 2, 15)));
    } else {
      setWeekStart((d) => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd; });
    }
  };
  const goToNext = () => {
    if (viewMode === 'month') {
      const [y, m] = weekDays[3].slice(0, 7).split('-').map(Number);
      // Use the 15th of the target month — guarantees weekDays[3] (Thu) lands in that month
      setWeekStart(getWeekStart(new Date(y, m, 15)));
    } else {
      setWeekStart((d) => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd; });
    }
  };

  const goToToday = () => {
    setWeekStart(getWeekStart(new Date()));
    if (viewMode !== 'month') return;
    // Scroll the divider of today's week under the sticky header. Rows may not be
    // mounted yet (month switch triggers a fetch) — retry across frames for ~2 s.
    const key = toISO(getWeekStart(new Date()));
    let tries = 0;
    const attempt = () => {
      const scrollContainer = bodyScrollRef.current?.closest<HTMLElement>('.overflow-auto');
      // Today in the first week of the month → no divider exists, the sticky header covers it
      if (scrollContainer && monthWeeks[0] && toISO(monthWeeks[0]) === key) {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => scrollContainer.dispatchEvent(new Event('scroll')), 650);
        return;
      }
      const row = weekSepRowRefs.current.get(key);
      if (row && scrollContainer) {
        const threshold = headerScrollRef.current?.getBoundingClientRect().bottom ?? 110;
        scrollContainer.scrollBy({ top: row.getBoundingClientRect().top - threshold, behavior: 'smooth' });
        // Programmatic scrolls don't always reach the sticky-week listener — nudge it
        setTimeout(() => scrollContainer.dispatchEvent(new Event('scroll')), 650);
      } else if (++tries < 120) {
        requestAnimationFrame(attempt);
      }
    };
    requestAnimationFrame(attempt);
  };

  const navLabel = viewMode === 'month'
    ? new Date(weekDays[3] + 'T00:00:00').toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
    : (() => {
        const first = new Date(weekDays[0] + 'T00:00:00');
        const last = new Date(weekDays[6] + 'T00:00:00');
        return `${first.getDate()}. ${first.getMonth() + 1}.–${last.getDate()}. ${last.getMonth() + 1}. ${last.getFullYear()}`;
      })();

  // ── Delete entry ──────────────────────────────────────────────────────────
  const handleDeleteEntry = useCallback(async (entry: WorkPlanEntry) => {
    if (!confirm(t('Smazat tuto směnu?', 'Delete this shift?'))) return;
    try {
      const params = new URLSearchParams({ workPlanId: entry.id, orgId });
      const res = isManagerMode
        ? await managerFetch(`/api/public/work-plans?${params}`, { method: 'DELETE' })
        : await fetch(`/api/public/work-plans?${params}&pin=${encodeURIComponent(sessionPin)}`, { method: 'DELETE' });
      if (res.ok) { setToast(t('Směna smazána', 'Shift deleted')); fetchPlans(); }
    } catch { /* ignore */ }
  }, [orgId, isManagerMode, sessionPin, fetchPlans, t]);

  // ── Cell rendering ────────────────────────────────────────────────────────

  const DOV_HATCH = 'repeating-linear-gradient(-45deg, #eff6ff 0px, #eff6ff 5px, #dbeafe 5px, #dbeafe 7px)';
  const XXX_HATCH = 'repeating-linear-gradient(-45deg, #f9fafb 0px, #f9fafb 6px, #e9eef5 6px, #e9eef5 8px)';

  function renderCell(emp: Employee, date: string, dataMap: Map<string, WorkPlanEntry[]> = plansMap) {
    const key = `${emp.id}|${date}`;
    const rawEntries = dataMap.get(key);

    let entries: WorkPlanEntry[] | undefined = rawEntries;
    if (rawEntries && rawEntries.length > 0 && (deptFilters.length > 0 || activityFilter)) {
      const matching = rawEntries.filter((e) =>
        deptFilters.length > 0 ? deptFilters.includes(e.workTypeName ?? '') : activityDepts.includes(e.workTypeName ?? '')
      );
      entries = matching.length > 0 ? matching : undefined;
    }

    const canInteract = isManagerMode || (sessionEmployee && sessionEmployee.id === emp.id);

    if (!entries || entries.length === 0) {
      const isVacation = vacationSet.has(key);
      if (isVacation) {
        return (
          <div className="flex items-center justify-center h-full w-full" style={{ backgroundImage: DOV_HATCH }}>
            <div title={t('Schválená dovolená', 'Approved vacation')} className="text-[11px] font-bold text-center px-2 py-0.5 leading-tight truncate border border-blue-300" style={{ backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '6px' }}>
              {t('DOV', 'VAC')}
            </div>
          </div>
        );
      }
      return (
        <div className="flex items-center justify-center h-full w-full" style={{ backgroundImage: XXX_HATCH }}>
          <span className="text-[11px] font-semibold tracking-wider select-none" style={{ color: '#c9d3df', userSelect: 'none' }}>XXX</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1 items-stretch justify-center h-full">
        {entries.map((e) => {
          const { bg, text } = pastelizeColor(e.workTypeColor ?? '#94a3b8');
          const label = e.startTime && e.endTime
            ? `${formatTime(e.startTime)}–${formatTime(e.endTime)}`
            : e.workTypeName ?? (e.workType ?? '');
          return (
            <div
              key={e.id}
              title={[e.workTypeName, e.startTime && e.endTime ? `${formatTime(e.startTime)}–${formatTime(e.endTime)}` : null, e.note ? `📝 ${e.note}` : null].filter(Boolean).join(' · ')}
              style={{ backgroundColor: bg, color: text, borderRadius: '7px' }}
              className="w-full text-[11px] font-semibold px-1.5 py-[3px] leading-tight flex items-center justify-center gap-0.5 min-w-0"
              onContextMenu={(ev) => {
                if (!canInteract) return;
                ev.preventDefault();
                ev.stopPropagation();
                setContextMenu({ x: ev.clientX, y: ev.clientY, entry: e });
              }}
            >
              <span className="truncate">{label}</span>
              {e.isEvening && <span className="shrink-0 text-[9px] opacity-70">🌙</span>}
              {e.note && <span className="shrink-0 text-[9px] opacity-70">📝</span>}
            </div>
          );
        })}
      </div>
    );
  }

  function pastelizeColor(hex: string): { bg: string; text: string } {
    const clean = hex.replace('#', '');
    if (clean.length < 6) return { bg: '#f1f5f9', text: '#475569' };
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const pr = Math.round(r * 0.30 + 255 * 0.70);
    const pg = Math.round(g * 0.30 + 255 * 0.70);
    const pb = Math.round(b * 0.30 + 255 * 0.70);
    const bg = `#${pr.toString(16).padStart(2, '0')}${pg.toString(16).padStart(2, '0')}${pb.toString(16).padStart(2, '0')}`;
    const dr = Math.round(r * 0.50);
    const dg = Math.round(g * 0.50);
    const db = Math.round(b * 0.50);
    const text = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
    return { bg, text };
  }

  function computePlannedHours(empId: string, days?: string[]): number {
    let total = 0;
    for (const date of (days ?? weekDays)) {
      for (const e of plansMap.get(`${empId}|${date}`) ?? []) {
        if (e.startTime && e.endTime) {
          const [sh, sm] = e.startTime.split(':').map(Number);
          const [eh, em] = e.endTime.split(':').map(Number);
          const h = (eh * 60 + em - sh * 60 - sm) / 60;
          if (h > 0) total += h;
        }
      }
    }
    return total;
  }

  function computeMonthlyHours(empId: string): number {
    let total = 0;
    for (const [key, entries] of Array.from(monthPlansMap.entries())) {
      if (!key.startsWith(`${empId}|`)) continue;
      for (const e of entries) {
        if (e.startTime && e.endTime) {
          const [sh, sm] = e.startTime.split(':').map(Number);
          const [eh, em] = e.endTime.split(':').map(Number);
          const h = (eh * 60 + em - sh * 60 - sm) / 60;
          if (h > 0) total += h;
        }
      }
    }
    return total;
  }

  // ── Shared cell row renderer ──────────────────────────────────────────────
  function renderEmployeeRows(wDays: string[], dataMap: Map<string, WorkPlanEntry[]>, maskOutsideMonth = false) {
    const currentMonth = weekDays[3].slice(0, 7);
    return displayEmployees.map((emp, ri) => {
      const deptColor = emp.department ? (deptColorMap.get(emp.department) ?? '#94a3b8') : null;
      return (
        <tr key={`${emp.id}-${wDays[0]}`}
          className={`group border-b border-gray-100 last:border-b-0 transition-colors duration-75 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
          <td className="sticky left-0 z-10 px-2 py-1 border-r border-gray-200 bg-inherit group-hover:bg-blue-100/60 transition-colors duration-75">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs font-semibold text-gray-800 leading-tight truncate" title={emp.name}>{emp.name}</span>
              {emp.department && deptColor && (
                <span
                  className="flex-shrink-0 text-[9px] font-semibold text-black leading-none px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: deptColor + '35' }}
                >
                  {emp.department}
                </span>
              )}
            </div>
          </td>
          {wDays.map((date, di) => {
            const isOutside = maskOutsideMonth && date.slice(0, 7) !== currentMonth;
            if (isOutside) {
              return <td key={date} className="border-r border-gray-100 last:border-r-0 bg-gray-50/20" />;
            }
            const isClosed = closedDates.has(date);
            const isWeekend = di >= 5;
            const isToday = date === today;
            return (
              <td key={date}
                className={`px-1.5 py-1 border-r last:border-r-0 align-middle group-hover:bg-blue-100/50 transition-colors duration-75 ${isToday ? 'bg-blue-50 border-blue-200' : 'border-gray-100'} ${isClosed ? 'bg-gray-100/60' : !isToday && isWeekend ? 'bg-slate-50/60' : ''}`}
                onClick={() => {
                  if (isManagerMode) { setAddModalDate(date); setAddModalEmployeeId(emp.id); setShowAddModal(true); }
                  else if (sessionEmployee && sessionEmployee.id === emp.id) { setAddModalDate(date); setAddModalEmployeeId(emp.id); setShowAddModal(true); }
                }}
                style={{ cursor: (isManagerMode || (sessionEmployee && sessionEmployee.id === emp.id)) ? 'pointer' : 'default' }}
              >
                {renderCell(emp, date, dataMap)}
              </td>
            );
          })}
        </tr>
      );
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const today = (() => { const d = new Date(); return toISO(d); })();

  // In month view, the sticky header shows dates from whichever week is scrolled into view.
  // Fallback = first week of the month — matches what's actually visible at scroll top.
  const stickyDays = viewMode === 'month'
    ? stickyWeekKey
      ? getWeekDays(new Date(stickyWeekKey + 'T00:00:00'))
      : getWeekDays(monthWeeks[0])
    : weekDays;

  return (
    <div className="max-w-full">
      {/* Header toolbar — sticky */}
      <div
        ref={toolbarRef}
        className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 px-4 md:px-6 py-3 flex flex-wrap items-center gap-3"
      >
        {/* View mode toggle */}
        <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden text-xs font-semibold">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 transition-colors ${viewMode === 'week' ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
          >
            {t('Týden', 'Week')}
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 transition-colors ${viewMode === 'month' ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
          >
            {t('Měsíc', 'Month')}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button onClick={goToPrev}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[180px] text-center">{navLabel}</span>
          <button onClick={goToNext}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="ml-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            title={t('Přejít na dnešek', 'Go to today')}
          >
            {t('Dnes', 'Today')}
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          {departments.length > 0 && (
            <div className="relative" ref={deptDropdownRef}>
              <button
                onClick={() => setDeptDropdownOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${deptFilters.length > 0 ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'}`}
              >
                {deptFilters.length > 0 ? `${t('Typ práce', 'Work type')} (${deptFilters.length})` : t('Typ práce', 'Work type')}
                <svg className={`w-3 h-3 transition-transform ${deptDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {deptDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-lg z-30 min-w-[160px] py-1 overflow-hidden">
                  {departments.map((dept) => (
                    <label key={dept} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors">
                      <input type="checkbox" checked={deptFilters.includes(dept)}
                        onChange={() => setDeptFilters((prev) => prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept])}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
                      <span className="text-xs font-medium text-slate-700">{dept}</span>
                    </label>
                  ))}
                  {deptFilters.length > 0 && (
                    <button onClick={() => { setDeptFilters([]); setDeptDropdownOpen(false); }}
                      className="w-full px-3 py-1.5 text-xs text-slate-400 hover:text-red-500 text-left border-t border-slate-100 mt-1 transition-colors">
                      {t('Zrušit výběr', 'Clear')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!hiddenElements.includes('schedule_activity_btn') && workTypes.some((w) => w.category === 'activity') && (
            <button
              onClick={() => { setActivityFilter((v) => !v); setDeptFilters([]); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activityFilter ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-400'}`}
            >
              🎯 {t('Aktivity', 'Activities')}
            </button>
          )}

          {!hiddenElements.includes('schedule_evening_btn') && (
            <button
              onClick={() => setEveningFilter((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${eveningFilter ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white text-orange-500 border-orange-200 hover:border-orange-400'}`}
            >
              🌙 {t('Večerní', 'Evening')}
            </button>
          )}

          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input type="text" value={nameSearch} onChange={(e) => setNameSearch(e.target.value)}
              placeholder={t('Hledat…', 'Search…')}
              className="pl-7 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition w-36" />
            {nameSearch && (
              <button onClick={() => setNameSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
            )}
          </div>
        </div>

        {/* PIN session */}
        {!isManagerMode && (
          sessionEmployee ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="text-emerald-700 text-xs font-semibold">{sessionEmployee.name}</span>
                {(() => {
                  const hw = computePlannedHours(sessionEmployee.id, stickyDays);
                  const hm = computeMonthlyHours(sessionEmployee.id);
                  const fmt = (h: number) => Number.isInteger(h) ? String(h) : h.toFixed(1);
                  return (
                    <>
                      {hw > 0 && <span className="text-emerald-500 text-[10px] font-medium">{fmt(hw)} h {t('tento týden', 'this week')}</span>}
                      {hm > 0 && <span className="text-emerald-400 text-[10px]">{fmt(hm)} h {t('tento měsíc', 'this month')}</span>}
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => { setSessionEmployee(null); setSessionPin(''); try { localStorage.removeItem('hris_employee_session'); } catch { /* ignore */ } }}
                className="text-emerald-400 hover:text-emerald-700 text-xs ml-1"
              >✕</button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handlePinLogin(); }} className="flex items-center gap-2 ml-auto">
              <input
                type="password" inputMode="numeric" maxLength={8} value={pinInputValue}
                onChange={(e) => { setPinInputValue(e.target.value.replace(/\D/g, '')); setPinInputError(false); }}
                placeholder={t('Váš PIN', 'Your PIN')}
                className={`w-28 text-sm px-3 py-1.5 rounded-lg border ${pinInputError ? 'border-red-400 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-blue-400 tracking-widest`}
              />
              <button type="submit" disabled={pinInputValue.length < 4 || pinInputLoading}
                className="px-3 py-1.5 bg-slate-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
                {pinInputLoading ? '…' : 'OK'}
              </button>
            </form>
          )
        )}

        {(isManagerMode || sessionEmployee) && !hiddenElements.includes('schedule_bulk_btn') && (
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
            title={t('Plošné zadání směn na celý měsíc', 'Bulk shift assignment for whole month')}
          >
            ⚡ {t('Plošné zadání', 'Bulk assign')}
          </button>
        )}
        {(isManagerMode || sessionEmployee) && !hiddenElements.includes('schedule_add_btn') && (
          <button
            onClick={() => { setAddModalDate(today); setAddModalEmployeeId(isManagerMode ? undefined : sessionEmployee?.id); setShowAddModal(true); }}
            className={`${!isManagerMode ? 'ml-auto' : ''} flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('Přidat směnu', 'Add shift')}
          </button>
        )}
      </div>

      <div className="px-4 md:px-6 pb-4 md:pb-6 pt-4">
      {/* Grid — split into sticky header + scrollable body so position:sticky works
           (overflow-x:auto on any ancestor breaks sticky; the header div has no overflow) */}
      <div className="rounded-xl border border-gray-200 shadow-sm bg-white" style={{ overflow: 'clip' }}>

        {/* Sticky header div — no overflow here, so position:sticky works vs. the window */}
        <div
          ref={headerScrollRef}
          style={{ position: 'sticky', top: toolbarHeight, zIndex: 20, overflow: 'hidden' }}
          className={viewMode === 'month' ? 'rounded-t-xl' : 'bg-gray-50 border-b-2 border-gray-200 rounded-t-xl'}
        >
          <table className="min-w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '160px', minWidth: '140px' }} />
              {DAY_NAMES.map((_, i) => <col key={i} style={{ width: '120px', minWidth: '100px' }} />)}
            </colgroup>
            <thead>
              {viewMode === 'month' ? (
                /* Month view: the dark week bar IS the header — dates follow the visible week */
                <tr>
                  <th
                    className="sticky left-0 z-10 px-3 py-2 text-left border-r border-slate-500"
                    style={{ background: 'linear-gradient(to right, #334155, #3b4f66)' }}
                  >
                    {(() => {
                      const f = new Date(stickyDays[0] + 'T00:00:00');
                      const l = new Date(stickyDays[6] + 'T00:00:00');
                      const crossesMonth = f.getMonth() !== l.getMonth();
                      const wLabel = `${f.getDate()}. ${f.getMonth() + 1}. – ${l.getDate()}. ${l.getMonth() + 1}.`;
                      const monthLabel = crossesMonth
                        ? `${f.toLocaleDateString('cs-CZ', { month: 'short' })} / ${l.toLocaleDateString('cs-CZ', { month: 'short' })}`
                        : f.toLocaleDateString('cs-CZ', { month: 'long' });
                      return (
                        <div className="flex flex-col leading-tight">
                          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{monthLabel}</span>
                          <span className="text-[11px] font-bold text-slate-100">{wLabel}</span>
                        </div>
                      );
                    })()}
                  </th>
                  {stickyDays.map((d, i) => {
                    const isOutside = d.slice(0, 7) !== weekDays[3].slice(0, 7);
                    if (isOutside) {
                      return <th key={d} className="border-r border-slate-600 last:border-r-0" style={{ background: '#1e293b' }} />;
                    }
                    const dayNum = new Date(d + 'T00:00:00').getDate();
                    const isToday = d === today;
                    const isClosed = closedDates.has(d);
                    const isWeekend = i >= 5;
                    const bg = isClosed ? '#475569' : isWeekend ? '#3d4f63' : '#334155';
                    return (
                      <th key={d} className="py-2 text-center border-r border-slate-500 last:border-r-0 font-normal" style={{ background: bg }}>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[9px] uppercase tracking-wider font-semibold ${isWeekend || isClosed ? 'text-slate-500' : 'text-slate-400'}`}>
                            {DAY_NAMES[i]}
                          </span>
                          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                            isToday ? 'bg-blue-500 text-white' : isWeekend || isClosed ? 'text-slate-500' : 'text-slate-200'
                          }`}>
                            {dayNum}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ) : (
                <tr>
                  <th className="sticky left-0 z-10 px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 bg-gray-50">
                    {t('Zaměstnanec', 'Employee')}
                  </th>
                  {DAY_NAMES.map((name, i) => {
                    const date = weekDays[i];
                    const isClosed = closedDates.has(date);
                    const isToday = date === today;
                    const isWeekend = i >= 5;
                    const dayNum = new Date(date + 'T00:00:00').getDate();
                    return (
                      <th key={i}
                        className={`px-1 py-2.5 text-center text-xs font-semibold border-r border-gray-200 last:border-r-0 transition-colors duration-150 ${isClosed ? 'bg-gray-100 text-gray-400' : isWeekend ? 'bg-slate-50 text-gray-400' : 'bg-gray-50 text-gray-600'}`}
                      >
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="text-[10px] uppercase tracking-wider">{name}</span>
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isToday ? 'bg-blue-600 text-white' : 'text-inherit'}`}>
                            {dayNum}
                          </span>
                          {isClosed && <span className="text-[9px] text-red-400 font-normal normal-case">zavřeno</span>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              )}
            </thead>
          </table>
        </div>

        {/* Scrollable body — overflow-x:auto here only, header scrollLeft is synced on scroll */}
        <div
          ref={bodyScrollRef}
          className="overflow-x-auto"
          onScroll={(e) => {
            if (headerScrollRef.current) {
              headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
        >
        <table className="min-w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '160px', minWidth: '140px' }} />
            {DAY_NAMES.map((_, i) => <col key={i} style={{ width: '120px', minWidth: '100px' }} />)}
          </colgroup>

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

            {!loading && viewMode === 'week' && displayEmployees.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                  {t('Žádní zaměstnanci.', 'No employees.')}
                </td>
              </tr>
            )}

            {!loading && viewMode === 'week' && renderEmployeeRows(weekDays, plansMap)}

            {!loading && viewMode === 'month' && monthWeeks.map((weekMon, wi) => {
              const wDays = getWeekDays(weekMon);
              const currentMonth = weekDays[3].slice(0, 7);
              const f = new Date(wDays[0] + 'T00:00:00');
              const l = new Date(wDays[6] + 'T00:00:00');
              const crossesMonth = f.getMonth() !== l.getMonth();
              const wLabel = `${f.getDate()}. ${f.getMonth() + 1}. – ${l.getDate()}. ${l.getMonth() + 1}.`;
              const monthLabel = crossesMonth
                ? `${f.toLocaleDateString('cs-CZ', { month: 'short' })} / ${l.toLocaleDateString('cs-CZ', { month: 'short' })}`
                : f.toLocaleDateString('cs-CZ', { month: 'long' });
              return (
                <>
                  {/* Week separator with dates — first week's dates live in the sticky header,
                       scrolling a separator under the header swaps the sticky dates */}
                  {wi > 0 && (
                    <tr
                      key={`sep-${wDays[0]}`}
                      ref={(el) => { if (el) weekSepRowRefs.current.set(wDays[0], el); else weekSepRowRefs.current.delete(wDays[0]); }}
                    >
                      <td
                        className="sticky left-0 z-10 px-3 py-2 border-r border-slate-500"
                        style={{ background: 'linear-gradient(to right, #334155, #3b4f66)' }}
                      >
                        <div className="flex flex-col leading-tight">
                          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{monthLabel}</span>
                          <span className="text-[11px] font-bold text-slate-100">{wLabel}</span>
                        </div>
                      </td>
                      {wDays.map((d, i) => {
                        const isOutside = d.slice(0, 7) !== currentMonth;
                        if (isOutside) {
                          return <td key={d} className="border-r border-slate-600 last:border-r-0" style={{ background: '#1e293b' }} />;
                        }
                        const dayNum = new Date(d + 'T00:00:00').getDate();
                        const isToday = d === today;
                        const isClosed = closedDates.has(d);
                        const isWeekend = i >= 5;
                        const bg = isClosed ? '#475569' : isWeekend ? '#3d4f63' : '#334155';
                        return (
                          <td key={d} className="py-2 text-center border-r border-slate-500 last:border-r-0" style={{ background: bg }}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-[9px] uppercase tracking-wider font-semibold ${isWeekend || isClosed ? 'text-slate-500' : 'text-slate-400'}`}>
                                {DAY_NAMES[i]}
                              </span>
                              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                                isToday ? 'bg-blue-500 text-white' : isWeekend || isClosed ? 'text-slate-500' : 'text-slate-200'
                              }`}>
                                {dayNum}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )}
                  {renderEmployeeRows(wDays, fullPlansMap, true)}
                </>
              );
            })}
          </tbody>
        </table>
        </div>{/* end overflow-x:auto body scroll div */}
      </div>{/* end grid outer container */}
      </div>{/* end padded content wrapper */}

      {/* Context menu */}
      {contextMenu && (() => {
        const MENU_H = 90, MENU_W = 168;
        const top = contextMenu.y + MENU_H > window.innerHeight ? contextMenu.y - MENU_H : contextMenu.y;
        const left = contextMenu.x + MENU_W > window.innerWidth ? contextMenu.x - MENU_W : contextMenu.x;
        return (
          <div
            style={{ position: 'fixed', top, left, zIndex: 9999 }}
            className="bg-white rounded-xl shadow-xl border border-slate-200 py-1 min-w-[160px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setEditEntry(contextMenu.entry); setContextMenu(null); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              ✏️ {t('Upravit', 'Edit')}
            </button>
            <button
              onClick={() => { handleDeleteEntry(contextMenu.entry); setContextMenu(null); }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              🗑️ {t('Smazat', 'Delete')}
            </button>
          </div>
        );
      })()}

      {showBulkModal && (
        <BulkShiftModal
          orgId={orgId}
          month={weekDays[3].slice(0, 7)}
          workTypes={workTypes}
          isManagerMode={isManagerMode}
          sessionEmployee={sessionEmployee}
          sessionPin={sessionPin || undefined}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => { setToast(t('Směny zadány!', 'Shifts assigned!')); fetchPlans(); }}
        />
      )}

      {showAddModal && (
        <AddShiftModal
          orgId={orgId}
          defaultDate={addModalDate}
          workTypes={workTypes}
          isManagerMode={isManagerMode}
          sessionPin={sessionPin || undefined}
          defaultEmployeeId={addModalEmployeeId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setToast(t('Směna přidána!', 'Shift added!')); fetchPlans(); }}
        />
      )}

      {editEntry && (
        <EditShiftModal
          orgId={orgId}
          entry={editEntry}
          workTypes={workTypes}
          isManagerMode={isManagerMode}
          sessionPin={sessionPin || undefined}
          onClose={() => setEditEntry(null)}
          onSuccess={() => { setToast(t('Směna upravena!', 'Shift updated!')); fetchPlans(); }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
