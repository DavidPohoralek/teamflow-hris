'use client';

import { useState, useEffect, useCallback } from 'react';
import AttendanceKiosk from './AttendanceKiosk';
import { managerFetch } from '@/lib/managerFetch';
import { useT } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  
}

interface WorkType {
  id: string;
  name: string;
  color?: string;
}

interface AttendanceLog {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
  work_type_id: string | null;
  work_type_name: string | null;
  created_at: string;
  employee: Employee;
}

interface EditState {
  check_in: string;
  check_out: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeStr(): string {
  return new Date().toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toTimeInput(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function toLocalTimeDisplay(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function calcDurationMinutes(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  try {
    const diff = Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000
    );
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

function formatMinutes(min: number): string {
  if (min === 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function fullName(emp: Employee): string {
  return emp.name;
}

function initials(emp: Employee): string {
  return emp.name.slice(0,2).toUpperCase();
}

// Builds an ISO string combining a YYYY-MM-DD date and HH:MM time string.
function buildISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

// ─── Add Record Modal ─────────────────────────────────────────────────────────

interface AddRecordModalProps {
  date: string;
  employees: Employee[];
  workTypes: WorkType[];
  onClose: () => void;
  onSuccess: () => void;
}

function AddRecordModal({ date, employees, workTypes, onClose, onSuccess }: AddRecordModalProps) {
  const t = useT();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? '');
  const [checkInTime, setCheckInTime] = useState(nowTimeStr());
  const [checkOutTime, setCheckOutTime] = useState('');
  const [workTypeId, setWorkTypeId] = useState(workTypes[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      setError('Vyberte zaměstnance.');
      return;
    }
    if (!checkInTime) {
      setError('Zadejte čas příchodu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const selectedWt = workTypes.find((wt) => wt.id === workTypeId);
      const body: Record<string, string> = {
        employee_id: employeeId,
        date,
        check_in: buildISO(date, checkInTime),
      };
      if (checkOutTime) body.check_out = buildISO(date, checkOutTime);
      if (note.trim()) body.note = note.trim();
      if (workTypeId) body.work_type_id = workTypeId;
      if (selectedWt) body.work_type_name = selectedWt.name;

      const res = await managerFetch('/api/attendance', {
        method: 'POST',
        body: JSON.stringify(body),
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
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">{t('Přidat záznam', 'Add record')}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('Zaměstnanec', 'Employee')}
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
              {t('Datum', 'Date')}
            </label>
            <input
              type="date"
              value={date}
              disabled
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 bg-slate-50 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('Příchod', 'Clock in')}
              </label>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('Odchod', 'Clock out')} <span className="text-slate-400 font-normal">{t('(volitelný)', '(optional)')}</span>
              </label>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {workTypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('Oddělení / typ práce', 'Department / work type')}
              </label>
              <div className="flex flex-wrap gap-2">
                {workTypes.map((wt) => (
                  <button
                    key={wt.id}
                    type="button"
                    onClick={() => setWorkTypeId(wt.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border-l-4 transition-colors ${workTypeId === wt.id ? 'bg-blue-50 text-blue-800 ring-1 ring-blue-300' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                    style={{ borderLeftColor: wt.color ?? '#94a3b8' }}
                  >
                    {wt.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('Poznámka (volitelná)', 'Note (optional)')}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Např. homeoffice, práce z terénu…"
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
              {t('Zrušit', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? t('Ukládám…', 'Saving…') : t('Přidat záznam', 'Add record')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

interface DeleteConfirmProps {
  employeeName: string;
  onClose: () => void;
}

function DeleteConfirmDialog({ employeeName, onClose }: DeleteConfirmProps) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" className="text-red-600">
              <path
                d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t('Smazat záznam', 'Delete record')}</h3>
            <p className="text-sm text-slate-500 mt-1">
              Mazání záznamu pro <span className="font-medium text-slate-700">{employeeName}</span> není dosud podporováno v API.
              Tato funkce bude dostupná v příští verzi.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            {t('Zavřít', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Edit Row ──────────────────────────────────────────────────────────

interface EditRowProps {
  log: AttendanceLog;
  date: string;
  onCancel: () => void;
  onSaved: () => void;
}

function EditRow({ log, date, onCancel, onSaved }: EditRowProps) {
  const t = useT();
  const [checkIn, setCheckIn] = useState(toTimeInput(log.check_in));
  const [checkOut, setCheckOut] = useState(toTimeInput(log.check_out));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!checkIn) {
      setError('Příchod je povinný.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body: Record<string, string> = {
        check_in: buildISO(date, checkIn),
      };
      if (checkOut) body.check_out = buildISO(date, checkOut);

      const res = await managerFetch(`/api/attendance/${log.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Chyba při ukládání.');
      } else {
        onSaved();
      }
    } catch {
      setError('Chyba sítě.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <td className="px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
            {initials(log.employee)}
          </div>
          <span className="font-medium text-slate-900">{fullName(log.employee)}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <input
          type="time"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="border border-blue-300 rounded-md px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          type="time"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
        />
      </td>
      {/* Duration — shows preview while editing */}
      <td className="px-4 py-2.5 text-slate-500 text-sm">
        {checkIn && checkOut
          ? formatMinutes(
              calcDurationMinutes(
                buildISO(date, checkIn),
                buildISO(date, checkOut)
              )
            )
          : '—'}
      </td>
      {/* Note column placeholder */}
      <td className="px-4 py-2.5">
        {log.note && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {log.note}
          </span>
        )}
      </td>
      <td className="px-5 py-2.5">
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {error && (
            <span className="text-xs text-red-600">{error}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {saving ? t('Ukládám…', 'Saving…') : t('Uložit', 'Save')}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            {t('Zrušit', 'Cancel')}
          </button>
        </div>
      </td>
    </>
  );
}

// ─── Manager View ─────────────────────────────────────────────────────────────

interface ManagerViewProps {
  orgId: string;
}

function ManagerView({ orgId: _orgId }: ManagerViewProps) {
  const t = useT();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingLog, setDeletingLog] = useState<AttendanceLog | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);

  // Fetch work types
  useEffect(() => {
    const orgId = _orgId;
    if (!orgId) return;
    fetch(`/api/public/work-types?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((data: WorkType[]) => setWorkTypes(Array.isArray(data) ? data.filter((wt) => wt.id) : []))
      .catch(() => {});
  }, [_orgId]);

  // Fetch employees
  useEffect(() => {
    managerFetch('/api/employees')
      .then((r) => r.json())
      .then((json) => {
        const list = json.employees ?? json.data ?? [];
        setEmployees(list.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));
      })
      .catch(() => {});
  }, []);

  // Fetch logs for selected date
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await managerFetch(`/api/attendance?date=${selectedDate}`);
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json.error ?? 'Chyba při načítání dat.');
      } else {
        setLogs(json.data ?? []);
      }
    } catch {
      setFetchError('Chyba sítě.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Summary: total employee-minutes for the day
  const totalMinutes = logs.reduce(
    (sum, log) => sum + calcDurationMinutes(log.check_in, log.check_out),
    0
  );

  const dayLabel = new Date(selectedDate).toLocaleDateString('cs-CZ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('Správa docházky', 'Attendance Management')}</h2>
          <p className="text-slate-500 text-sm mt-0.5 capitalize">{dayLabel}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t('Přidat záznam', 'Add record')}
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {fetchError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">
            {t('Záznamy za', 'Records for')}{' '}
            {new Date(selectedDate).toLocaleDateString('cs-CZ', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h3>
          {loading && (
            <span className="text-xs text-slate-400 animate-pulse">{t('Načítám…', 'Loading…')}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-500">{t('Zaměstnanec', 'Employee')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">{t('Příchod', 'Clock in')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">{t('Odchod', 'Clock out')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">{t('Odpracováno', 'Hours worked')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">{t('Kategorie', 'Category')}</th>
                <th className="text-right px-5 py-3 font-medium text-slate-500">{t('Akce', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    {t('Žádné záznamy pro vybraný den.', 'No records for the selected day.')}
                  </td>
                </tr>
              )}

              {logs.map((log) => {
                const isEditing = editingId === log.id;
                const duration = calcDurationMinutes(log.check_in, log.check_out);
                const isPresent = log.check_in && !log.check_out;

                if (isEditing) {
                  return (
                    <tr key={log.id} className="bg-blue-50/40">
                      <EditRow
                        log={log}
                        date={selectedDate}
                        onCancel={() => setEditingId(null)}
                        onSaved={() => {
                          setEditingId(null);
                          fetchLogs();
                        }}
                      />
                    </tr>
                  );
                }

                return (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Zaměstnanec */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                          {initials(log.employee)}
                        </div>
                        <span className="font-medium text-slate-900">{fullName(log.employee)}</span>
                      </div>
                    </td>

                    {/* Příchod */}
                    <td className="px-4 py-3.5">
                      {log.check_in ? (
                        <span className="font-mono text-slate-700">
                          {toLocalTimeDisplay(log.check_in)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Odchod */}
                    <td className="px-4 py-3.5">
                      {log.check_out ? (
                        <span className="font-mono text-slate-700">
                          {toLocalTimeDisplay(log.check_out)}
                        </span>
                      ) : isPresent ? (
                        <span className="text-green-600 text-xs font-medium animate-pulse">
                          {t('Probíhá…', 'In progress…')}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Odpracováno */}
                    <td className="px-4 py-3.5 text-slate-700">
                      {formatMinutes(duration)}
                    </td>

                    {/* Kategorie */}
                    <td className="px-4 py-3.5">
                      {log.work_type_name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {log.work_type_name}
                        </span>
                      ) : isPresent ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {t('Přítomen/na', 'Present')}
                        </span>
                      ) : log.check_out ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {t('Odešel/a', 'Left')}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Akce */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setEditingId(log.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors"
                        >
                          {t('Upravit', 'Edit')}
                        </button>
                        <button
                          onClick={() => setDeletingLog(log)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
                        >
                          {t('Smazat', 'Delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Summary row */}
              {logs.length > 0 && (
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-700" colSpan={3}>
                    {t('Celkem zaměstnanec-hodin', 'Total employee-hours')}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">
                    {formatMinutes(totalMinutes)}
                  </td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddRecordModal
          date={selectedDate}
          employees={employees}
          workTypes={workTypes}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchLogs}
        />
      )}

      {deletingLog && (
        <DeleteConfirmDialog
          employeeName={fullName(deletingLog.employee)}
          onClose={() => setDeletingLog(null)}
        />
      )}
    </div>
  );
}

// ─── AttendanceManager ────────────────────────────────────────────────────────

interface AttendanceManagerProps {
  orgId: string;
}

type ManagerTab = 'kiosk' | 'sprava';

export default function AttendanceManager({ orgId }: AttendanceManagerProps) {
  const t = useT();
  const [tab, setTab] = useState<ManagerTab>('kiosk');

  return (
    <div>
      {/* Pill toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 gap-1 shadow-sm">
          <button
            onClick={() => setTab('kiosk')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
              tab === 'kiosk'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>🖥️</span>
            Kiosk
          </button>
          <button
            onClick={() => setTab('sprava')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
              tab === 'sprava'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>📋</span>
            {t('Správa', 'Management')}
          </button>
        </div>
      </div>

      {/* Views */}
      {tab === 'kiosk' && <AttendanceKiosk orgId={orgId} />}
      {tab === 'sprava' && <ManagerView orgId={orgId} />}
    </div>
  );
}
