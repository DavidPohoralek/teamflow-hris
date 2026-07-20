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
  type?: string;
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

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

// Group sorted date strings into contiguous ranges.
function groupConsecutiveDays(days: Set<string>): Array<{ from: string; to: string }> {
  const sorted = Array.from(days).sort();
  if (!sorted.length) return [];
  const groups: Array<{ from: string; to: string }> = [];
  let from = sorted[0], to = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i] + 'T00:00:00').getTime() - new Date(to + 'T00:00:00').getTime()) / 86400000;
    if (diff === 1) { to = sorted[i]; }
    else { groups.push({ from, to }); from = to = sorted[i]; }
  }
  groups.push({ from, to });
  return groups;
}

// ─── VacationDayPicker ───────────────────────────────────────────────────────
// Click = toggle individual day. Shift+click = add range from last click.
function VacationDayPicker({ selectedDays, onChange }: {
  selectedDays: Set<string>;
  onChange: (days: Set<string>) => void;
}) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const initMonth = selectedDays.size > 0
    ? Array.from(selectedDays).sort()[0].slice(0, 7)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [lastClicked, setLastClicked] = useState<string | null>(
    selectedDays.size > 0 ? Array.from(selectedDays).sort()[0] : null
  );

  const [yr, mo] = viewMonth.split('-').map(Number);
  const firstDow = (new Date(yr, mo - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayClick = (dateStr: string, e: React.MouseEvent) => {
    const next = new Set(selectedDays);
    if (e.shiftKey && lastClicked && lastClicked !== dateStr) {
      // Shift+click: add every day in range from lastClicked to dateStr
      const [a, b] = [lastClicked, dateStr].sort();
      const cur = new Date(a + 'T00:00:00');
      const end = new Date(b + 'T00:00:00');
      while (cur <= end) { next.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
    } else {
      // Normal click: toggle individual day
      if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
    }
    setLastClicked(dateStr);
    onChange(next);
  };

  const monthLabel = new Date(yr, mo - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
  const DAY_HDRS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  const groups = groupConsecutiveDays(selectedDays);
  const summaryText = groups.length === 0
    ? 'Klikni na den · Shift+klik pro rozsah'
    : groups.map(g =>
        g.from === g.to
          ? new Date(g.from + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
          : `${new Date(g.from + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} – ${new Date(g.to + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}`
      ).join(', ');

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setViewMonth(prevMonth(viewMonth))}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors leading-none">‹</button>
        <span className="text-sm font-semibold text-slate-700 capitalize">{monthLabel}</span>
        <button type="button" onClick={() => setViewMonth(nextMonth(viewMonth))}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors leading-none">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_HDRS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-medium py-0.5 ${i >= 5 ? 'text-slate-400' : 'text-slate-500'}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} />;
          const dayNum = parseInt(dateStr.slice(-2));
          const isWeekend = (i % 7) >= 5;
          const isSelected = selectedDays.has(dateStr);
          const isToday = dateStr === todayStr;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={(e) => handleDayClick(dateStr, e)}
              className={[
                'text-xs py-1.5 rounded-lg transition-all cursor-pointer font-medium',
                isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'hover:bg-slate-100',
                !isSelected && isWeekend ? 'text-slate-400' : '',
                !isSelected && !isWeekend ? 'text-slate-700' : '',
                isToday && !isSelected ? 'ring-1 ring-inset ring-blue-400' : '',
              ].filter(Boolean).join(' ')}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-xs text-center min-h-[1rem]">
        {groups.length > 0
          ? <span className="text-slate-600">{summaryText} <span className="text-slate-400">({selectedDays.size} {selectedDays.size === 1 ? 'den' : selectedDays.size < 5 ? 'dny' : 'dní'})</span></span>
          : <span className="text-slate-400">{summaryText}</span>}
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
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() =>
    initialDate ? new Set([initialDate]) : new Set()
  );
  const [note, setNote] = useState('');
  const [dayType, setDayType] = useState<'full' | 'partial'>('full');
  const [hours, setHours] = useState<string>('4');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const conflicts = Array.from(selectedDays).filter(d => shiftDays.has(d));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDays.size === 0) { setError(t('Vyberte alespoň jeden den.', 'Please select at least one day.')); return; }
    if (conflicts.length > 0) {
      setError(`Máte naplánované směny na: ${conflicts.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('cs-CZ')).join(', ')}. Nejprve si nechte zrušit směny a pak teprve požádejte o dovolenou.`);
      return;
    }
    setSaving(true); setError(null);
    try {
      const groups = groupConsecutiveDays(selectedDays);
      for (const group of groups) {
        const res = await fetch('/api/public/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId, pin, type: 'vacation',
            dateFrom: group.from,
            dateTo: group.to !== group.from ? group.to : undefined,
            note: note || undefined,
            hours: dayType === 'partial' ? parseFloat(hours) : undefined,
          }),
        });
        if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Chyba'); return; }
      }
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
        <VacationDayPicker
          selectedDays={selectedDays}
          onChange={setSelectedDays}
        />
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

// ─── ICS helpers ──────────────────────────────────────────────────────────────

function icsEscapeVac(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function downloadVacationIcs(myRequests: VacationRequest[], employeeName: string) {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TeamFlow HRIS//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscapeVac(`Dovolená — ${employeeName}`)}`,
    'X-WR-TIMEZONE:Europe/Prague',
  ];

  const approved = myRequests.filter((r) => r.status === 'approved');
  for (const req of approved) {
    const dtStart = req.date_from.replace(/-/g, '');
    // DTEND in all-day events = exclusive (date_to + 1 day)
    const dtEnd = req.date_to ? addDays(req.date_to, 1) : addDays(req.date_from, 1);
    const summary = icsEscapeVac('Dovolená');
    const desc = req.note ? icsEscapeVac(req.note) : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:teamflow-vacation-${req.id}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${summary}`,
      ...(desc ? [`DESCRIPTION:${desc}`] : []),
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dovolena-${employeeName.replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
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

  // Restore session from localStorage on mount (persists across tab switches)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hris_employee_session');
      if (stored) {
        const parsed = JSON.parse(stored) as { id: string; name: string; pin: string; orgId: string };
        if (parsed.orgId === orgId && parsed.id && parsed.name && parsed.pin) {
          setSessionPin(parsed.pin);
          setSessionEmployee({ id: parsed.id, name: parsed.name });
          fetch(`/api/public/vacation-balance?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(parsed.pin)}`)
            .then(r => r.json()).then(b => setVacBalance(b)).catch(() => {});
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  // "Pouze má dovolená" filter
  const [myVacationOnly, setMyVacationOnly] = useState(false);
  // Vacation balance
  const [vacBalance, setVacBalance] = useState<{ hasPaidVacation: boolean; totalDays: number; totalHours: number; consumedDays: number; consumedHours: number; futurePlannedDays: number; futurePlannedHours: number; usedDays: number; usedHours: number; pendingDays: number; pendingHours: number; remainingDays: number; remainingHours: number; remainingAfterPendingDays: number; remainingAfterPendingHours: number } | null>(null);
  // My requests panel
  const [myRequests, setMyRequests] = useState<VacationRequest[]>([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set());
  const [closedWeekdays, setClosedWeekdays] = useState<Set<number>>(new Set());
  const portalRootRef = useRef<HTMLElement | null>(null);
  useEffect(() => { portalRootRef.current = document.body; }, []);

  useEffect(() => {
    fetch(`/api/public/company-settings?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((s: Record<string, string>) => {
        const dates = (s.closed_dates ?? '').split(',').map((d: string) => d.trim()).filter(Boolean);
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
          type: r.type ?? 'vacation',
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

  // Apply "Pouze má dovolená" filter
  const visibleRequests = myVacationOnly && sessionEmployee
    ? requests.filter((r) => r.employee_id === sessionEmployee.id)
    : requests;

  // For each employee, collect their vacation days in this month
  const empVacMap = new Map<string, Set<string>>();
  const empStatusMap = new Map<string, Map<string, string>>();
  for (const req of visibleRequests) {
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
      try { localStorage.setItem('hris_employee_session', JSON.stringify({ id: json.employeeId, name: json.employeeName, pin: pinInputValue, orgId })); } catch { /* ignore */ }
      // Load vacation balance
      fetch(`/api/public/vacation-balance?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(pinInputValue)}`)
        .then(r => r.json()).then(b => setVacBalance(b)).catch(() => {});
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

  const loadMyRequests = useCallback(async (pin: string) => {
    setMyRequestsLoading(true);
    try {
      const res = await fetch(`/api/public/requests?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(pin)}`);
      if (res.ok) {
        const json = await res.json() as { requests: VacationRequest[] };
        setMyRequests(json.requests ?? []);
      }
    } catch { /* ignore */ }
    finally { setMyRequestsLoading(false); }
  }, [orgId]);

  useEffect(() => {
    if (sessionPin) loadMyRequests(sessionPin);
    else setMyRequests([]);
  }, [sessionPin, loadMyRequests]);

  const handleDeleteRequest = async (requestId: string) => {
    if (!sessionPin) return;
    setDeletingId(requestId);
    try {
      const res = await fetch(
        `/api/public/requests?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(sessionPin)}&requestId=${encodeURIComponent(requestId)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setMyRequests((prev) => prev.filter((r) => r.id !== requestId));
        fetchData();
      }
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  return (
    <div className="w-full px-3 sm:px-6 py-4 sm:py-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* PIN session — same UX as WorkPlanGrid */}
          {!isManagerMode && (
            sessionEmployee ? (
              <div className="flex items-center gap-2 flex-wrap">
                {/* "Pouze má dovolená" toggle */}
                <button
                  onClick={() => setMyVacationOnly((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${myVacationOnly ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'}`}
                >
                  🏖️ {t('Pouze má dovolená', 'My vacation only')}
                </button>
                {/* .ics download for vacation */}
                {myVacationOnly && (
                  <button
                    onClick={() => downloadVacationIcs(requests.filter((r) => r.employee_id === sessionEmployee.id), sessionEmployee.name)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-white text-slate-700 border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 transition-all"
                    title={t('Stáhnout jako kalendář (.ics)', 'Download as calendar (.ics)')}
                  >
                    ⬇ .ics
                  </button>
                )}
                <button
                  onClick={handleToggleMyShifts}
                  disabled={myShiftsLoading}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${showMyShifts ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-600'}`}
                >
                  📅 {myShiftsLoading ? t('Načítám…', 'Loading…') : t('Mé směny', 'My shifts')}
                </button>
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-emerald-700 text-sm font-semibold leading-tight">{sessionEmployee.name}</span>
                    {vacBalance && vacBalance.totalDays > 0 && (() => {
                      const usedPct = Math.min(100, ((vacBalance.totalDays - vacBalance.remainingDays) / vacBalance.totalDays) * 100);
                      const barColor = usedPct >= 90 ? 'bg-red-400' : usedPct >= 70 ? 'bg-amber-400' : 'bg-emerald-500';
                      return (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-20 h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${usedPct}%` }} />
                          </div>
                          <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">
                            {vacBalance.remainingDays} / {vacBalance.totalDays} dní
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => { setSessionEmployee(null); setSessionPin(''); setShowMyShifts(false); setMyShiftDays(new Set()); setMyVacationOnly(false); setVacBalance(null); localStorage.removeItem('hris_employee_session'); }}
                    className="text-emerald-400 hover:text-emerald-700 transition-colors ml-1 shrink-0"
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
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95">
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
      <div className={loading ? 'opacity-40 pointer-events-none' : ''}>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1.5 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl px-1 py-2">
          {DAY_NAMES_SHORT.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-0.5 ${i >= 5 ? 'text-slate-500' : 'text-slate-300'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstOffset }).map((_, i) => (
            <div key={`e-${i}`} className="rounded-xl" />
          ))}
          {days.map((dateStr) => {
            const wd = mondayWeekday(dateStr);
            const isWeekend = wd >= 5;
            const isClosed = closedDates.has(dateStr) || closedWeekdays.has(new Date(dateStr + 'T00:00:00').getDay());
            const dayNum = new Date(dateStr + 'T00:00:00').getDate();
            const dayName = DAY_NAMES_SHORT[wd];
            const count = dayCountMap.get(dateStr) ?? 0;
            const onVacation = employees.filter((e) => empVacMap.get(e.id)?.has(dateStr));
            const isToday = dateStr === todayISO();

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
                className={`group rounded-xl border min-h-[80px] sm:min-h-[106px] p-2 sm:p-2.5 flex flex-col gap-1 transition-colors relative overflow-hidden ${
                  isClosed
                    ? 'bg-slate-50 border-slate-100 cursor-default'
                    : isToday
                    ? 'bg-white border-rose-400 shadow-sm shadow-rose-100 ring-1 ring-rose-300 cursor-pointer hover:border-rose-500'
                    : hasMyShift
                    ? 'bg-blue-50/20 border-blue-300 cursor-pointer hover:border-blue-400'
                    : isWeekend
                    ? 'bg-blue-50/30 border-blue-100 hover:border-blue-200 cursor-pointer hover:bg-blue-50/50'
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md cursor-pointer hover:border-blue-300'
                } ${!isClosed && !isManagerMode && sessionEmployee ? 'group' : ''}`}
              >
                {isClosed && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'repeating-linear-gradient(-45deg, rgba(148,163,184,0.15) 0px, rgba(148,163,184,0.15) 3px, transparent 3px, transparent 10px)',
                    }}
                  />
                )}
                <div className="relative z-10 flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-semibold ${isWeekend ? 'text-slate-400' : 'text-slate-500'}`}>
                    {dayName}{isClosed && <span className="ml-1 text-[9px] font-bold text-slate-400 bg-slate-200 px-1 py-0.5 rounded-full uppercase tracking-wide">{t('Zavřeno', 'Closed')}</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    {hasMyShift && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1 py-0.5 rounded">{t('směna', 'shift')}</span>
                    )}
                    {!isClosed && !isManagerMode && sessionEmployee && (
                      <span className="hidden group-hover:flex items-center text-xs text-emerald-500 font-semibold gap-0.5">
                        <span className="text-base leading-none">+</span>
                      </span>
                    )}
                    {count > 0 && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        {count}×
                      </span>
                    )}
                    <span className={`text-sm font-bold ${
                      isToday ? 'bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs'
                      : isWeekend ? 'text-slate-400' : 'text-slate-700'
                    }`}>
                      {dayNum}
                    </span>
                  </div>
                </div>
                <div className="relative z-10 flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0">
                  {/* On mobile: show coloured dot per person; on sm+: show name chip */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {onVacation.map((emp) => {
                      const st = empStatusMap.get(emp.id)?.get(dateStr) ?? 'pending';
                      return (
                        <span key={emp.id} className={`w-2 h-2 rounded-full inline-block ${statusColor(st)}`}
                          title={emp.name} />
                      );
                    })}
                  </div>
                  <div className="hidden sm:flex flex-col gap-0.5">
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400" />{t('Schválena', 'Approved')}</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-300" />{t('Čeká na schválení', 'Pending approval')}</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-300" />{t('Zamítnuta', 'Rejected')}</div>
      </div>

      {/* Vacation balance widget — only when PIN logged in */}
      {!isManagerMode && sessionEmployee && vacBalance && vacBalance.totalDays > 0 && (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-slate-700">🏖️ {t('Fond dovolené', 'Vacation balance')}</span>
            <span className="text-xs text-slate-400">{new Date().getFullYear()}</span>
          </div>
          {(() => {
            const usedPct = Math.min(100, ((vacBalance.totalDays - vacBalance.remainingDays) / vacBalance.totalDays) * 100);
            const barColor = usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-400' : usedPct >= 40 ? 'bg-blue-500' : 'bg-emerald-500';
            const remainColor = usedPct >= 90 ? 'text-red-600' : usedPct >= 70 ? 'text-amber-600' : usedPct >= 40 ? 'text-blue-600' : 'text-emerald-700';
            return (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">{t('Vyčerpáno', 'Used')} {vacBalance.consumedDays} / {vacBalance.totalDays} {t('dní', 'days')}</span>
                  <span className={`text-xs font-bold ${remainColor}`}>{vacBalance.remainingDays} {t('dní zbývá', 'days remaining')}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${usedPct}%` }} />
                </div>
              </>
            );
          })()}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 rounded-xl p-2.5">
              <div className="text-lg font-bold text-emerald-700">{vacBalance.remainingDays}</div>
              <div className="text-xs text-emerald-600 mt-0.5">{t('Zbývá', 'Remaining')}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-2.5">
              <div className="text-lg font-bold text-blue-600">{vacBalance.futurePlannedDays}</div>
              <div className="text-xs text-blue-500 mt-0.5">{t('Naplánováno', 'Planned')}</div>
            </div>
            <div className="bg-red-50 rounded-xl p-2.5">
              <div className="text-lg font-bold text-red-600">{vacBalance.consumedDays}</div>
              <div className="text-xs text-red-500 mt-0.5">{t('Vyčerpáno', 'Used')}</div>
            </div>
          </div>
          {vacBalance.pendingDays > 0 && (
            <div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
              ⏳ {t('Čeká na schválení:', 'Pending approval:')} <strong>{vacBalance.pendingDays} {t('dní', 'days')}</strong>
              {' · '}{t('Po schválení zbyde:', 'After approval remaining:')} <strong>{vacBalance.remainingAfterPendingDays} {t('dní', 'days')}</strong>
            </div>
          )}
        </div>
      )}

      {/* My vacation requests — below calendar, only when PIN logged in */}
      {!isManagerMode && sessionEmployee && (() => {
        const vacationOnly = myRequests.filter((r) => !r.type || r.type === 'vacation');
        const STATUS_STYLE: Record<string, string> = {
          approved: 'bg-emerald-100 text-emerald-700',
          rejected: 'bg-red-100 text-red-600',
          pending: 'bg-amber-100 text-amber-700',
        };
        const STATUS_LABEL: Record<string, string> = {
          approved: t('Schváleno', 'Approved'),
          rejected: t('Zamítnuto', 'Rejected'),
          pending: t('Čeká', 'Pending'),
        };
        return (
          <div className="mt-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">🏖️ {t('Moje žádosti o dovolenou', 'My vacation requests')}</span>
              {myRequestsLoading && <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin inline-block" />}
            </div>
            {vacationOnly.length === 0 && !myRequestsLoading ? (
              <p className="text-sm text-slate-400 text-center py-5">{t('Žádné žádosti o dovolenou', 'No vacation requests')}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {vacationOnly.map((req) => {
                  const from = new Date(req.date_from + 'T00:00:00').toLocaleDateString('cs-CZ', { day: '2-digit', month: 'long', year: 'numeric' });
                  const to = req.date_to && req.date_to !== req.date_from
                    ? new Date(req.date_to + 'T00:00:00').toLocaleDateString('cs-CZ', { day: '2-digit', month: 'long', year: 'numeric' })
                    : null;
                  const days = req.date_to
                    ? Math.round((new Date(req.date_to + 'T00:00:00').getTime() - new Date(req.date_from + 'T00:00:00').getTime()) / 86400000) + 1
                    : 1;
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const isPast = req.date_from < todayStr;
                  return (
                    <div key={req.id} className="flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-slate-50 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-base">
                        🏖️
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{from}{to ? ` — ${to}` : ''}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{days} {days === 1 ? t('den', 'day') : days < 5 ? t('dny', 'days') : t('dní', 'days')}</p>
                      </div>
                      {!isPast && (req.status === 'pending' || req.status === 'approved') && (
                        <button
                          onClick={() => handleDeleteRequest(req.id)}
                          disabled={deletingId === req.id}
                          className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          title={t('Stáhnout žádost', 'Withdraw request')}
                        >
                          {deletingId === req.id
                            ? <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                          }
                        </button>
                      )}
                      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[req.status] ?? STATUS_STYLE.pending}`}>
                        {STATUS_LABEL[req.status] ?? req.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
                <div key={emp.id} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3">
                  <span className="text-sm font-medium text-slate-800 w-24 sm:w-32 shrink-0 truncate">{emp.name}</span>
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
