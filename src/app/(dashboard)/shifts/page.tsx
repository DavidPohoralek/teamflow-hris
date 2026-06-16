'use client';

import { useState, useEffect, useCallback } from 'react';

const DAY_NAMES = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

type DayType = 'Pracovní' | 'Zavřeno' | 'Svátek';

interface Employee {
  id: string;
  name: string;
  timeFrom: string;
  timeTo: string;
}

interface DayData {
  date: string;
  dayType: DayType;
  requiredStaff: number;
  employees: Employee[];
  notes: string;
}

type ScheduleData = Record<string, DayData>;

// --- Mock API helpers ---
function buildMockData(year: number, month: number, draft: 'A' | 'B'): ScheduleData {
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  const stored = typeof window !== 'undefined' ? localStorage.getItem(`schedule-${key}-${draft}`) : null;
  if (stored) return JSON.parse(stored);

  const data: ScheduleData = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const sampleEmployees: Employee[][] = [
    [
      { id: '1', name: 'Jan Novák', timeFrom: '09:00', timeTo: '17:00' },
      { id: '2', name: 'Marie Horáková', timeFrom: '07:00', timeTo: '15:00' },
      { id: '3', name: 'Petr Sedláček', timeFrom: '13:00', timeTo: '21:00' },
    ],
    [
      { id: '2', name: 'Marie Horáková', timeFrom: '07:00', timeTo: '15:00' },
    ],
    [
      { id: '1', name: 'Jan Novák', timeFrom: '09:00', timeTo: '17:00' },
      { id: '3', name: 'Petr Sedláček', timeFrom: '13:00', timeTo: '21:00' },
    ],
    [],
  ];

  const holidays: number[] = draft === 'A' ? [1, 8] : [1, 15];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month, d).getDay(); // 0=Sun
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidays.includes(d);

    let dayType: DayType = 'Pracovní';
    if (isHoliday) dayType = 'Svátek';
    else if (isWeekend) dayType = 'Zavřeno';

    const empSet = isWeekend || isHoliday ? [] : sampleEmployees[(d - 1) % sampleEmployees.length];

    data[date] = {
      date,
      dayType,
      requiredStaff: isWeekend || isHoliday ? 0 : 3,
      employees: empSet,
      notes: '',
    };
  }
  return data;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// --- Day card color logic ---
function dayCardClass(data: DayData | undefined): string {
  if (!data) return 'bg-slate-50';
  if (data.dayType === 'Zavřeno') return 'bg-slate-100';
  if (data.dayType === 'Svátek') return 'bg-amber-50';
  if (data.requiredStaff === 0) return 'bg-white';
  if (data.employees.length >= data.requiredStaff) return 'bg-green-50';
  return 'bg-red-50';
}

function dayBadgeClass(dayType: DayType): string {
  if (dayType === 'Zavřeno') return 'bg-slate-200 text-slate-600';
  if (dayType === 'Svátek') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
}

function staffCountClass(data: DayData): string {
  if (data.dayType !== 'Pracovní' || data.requiredStaff === 0) return 'text-slate-400';
  if (data.employees.length >= data.requiredStaff) return 'text-green-600 font-semibold';
  return 'text-red-600 font-semibold';
}

// --- Modal component ---
interface ModalProps {
  dayData: DayData;
  onClose: () => void;
  onSave: (updated: DayData) => void;
}

const ALL_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Jan Novák', timeFrom: '09:00', timeTo: '17:00' },
  { id: '2', name: 'Marie Horáková', timeFrom: '07:00', timeTo: '15:00' },
  { id: '3', name: 'Petr Sedláček', timeFrom: '13:00', timeTo: '21:00' },
  { id: '4', name: 'Lucie Křížková', timeFrom: '06:00', timeTo: '14:00' },
  { id: '5', name: 'Tomáš Beneš', timeFrom: '14:00', timeTo: '22:00' },
];

function DayModal({ dayData, onClose, onSave }: ModalProps) {
  const [form, setForm] = useState<DayData>({ ...dayData, employees: dayData.employees.map(e => ({ ...e })) });
  const [saving, setSaving] = useState(false);

  const toggleEmployee = (emp: Employee) => {
    const exists = form.employees.find(e => e.id === emp.id);
    if (exists) {
      setForm(f => ({ ...f, employees: f.employees.filter(e => e.id !== emp.id) }));
    } else {
      setForm(f => ({ ...f, employees: [...f.employees, { ...emp }] }));
    }
  };

  const updateEmployeeTime = (id: string, field: 'timeFrom' | 'timeTo', value: string) => {
    setForm(f => ({
      ...f,
      employees: f.employees.map(e => e.id === id ? { ...e, [field]: value } : e),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/schedule/${form.date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).catch(() => {}); // ignore if API doesn't exist yet
      onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const dateObj = new Date(form.date + 'T12:00:00');
  const dayName = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'][dateObj.getDay()];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {dayName}, {form.date.split('-').reverse().join('.')}
            </h2>
            <p className="text-sm text-slate-500">Editace dne</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Day type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Typ dne</label>
            <div className="flex gap-2">
              {(['Pracovní', 'Zavřeno', 'Svátek'] as DayType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...f, dayType: t }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.dayType === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Required staff */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Požadovaný počet zaměstnanců
            </label>
            <input
              type="number"
              min={0}
              max={20}
              value={form.requiredStaff}
              onChange={e => setForm(f => ({ ...f, requiredStaff: parseInt(e.target.value) || 0 }))}
              className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Employee assignment */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Přiřazení zaměstnanci
            </label>
            <div className="space-y-2">
              {ALL_EMPLOYEES.map(emp => {
                const assigned = form.employees.find(e => e.id === emp.id);
                return (
                  <div
                    key={emp.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      assigned ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <button
                      onClick={() => toggleEmployee(emp)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        assigned ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {assigned && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm font-medium text-slate-700 flex-1">{emp.name}</span>
                    {assigned && (
                      <div className="flex items-center gap-1 text-xs">
                        <input
                          type="time"
                          value={assigned.timeFrom}
                          onChange={e => updateEmployeeTime(emp.id, 'timeFrom', e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <span className="text-slate-400">–</span>
                        <input
                          type="time"
                          value={assigned.timeTo}
                          onChange={e => updateEmployeeTime(emp.id, 'timeTo', e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Poznámky</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Volitelná poznámka k tomuto dni…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? 'Ukládám…' : 'Uložit změny'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main page ---
export default function ShiftsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [draft, setDraft] = useState<'A' | 'B'>('A');
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?month=${monthKey}&draft=${draft}`);
      if (res.ok) {
        const json = await res.json();
        setScheduleData(json);
      } else {
        throw new Error('API not available');
      }
    } catch {
      // Fall back to mock data
      const mock = buildMockData(year, month, draft);
      setScheduleData(mock);
    } finally {
      setLoading(false);
    }
  }, [year, month, draft, monthKey]);

  useEffect(() => { loadData(); }, [loadData]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = now.toISOString().slice(0, 10);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDaySave = (updated: DayData) => {
    setScheduleData(prev => ({ ...prev, [updated.date]: updated }));
    // Persist mock to localStorage
    const storageKey = `schedule-${monthKey}-${draft}`;
    const current = { ...scheduleData, [updated.date]: updated };
    if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(current));
    setSelectedDate(null);
  };

  const selectedDayData = selectedDate ? scheduleData[selectedDate] : null;

  // Stats for header
  const workDays = Object.values(scheduleData).filter(d => d.dayType === 'Pracovní');
  const understaffedDays = workDays.filter(d => d.employees.length < d.requiredStaff).length;
  const fullyStaffedDays = workDays.filter(d => d.requiredStaff > 0 && d.employees.length >= d.requiredStaff).length;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kalendář směn</h1>
          <p className="text-slate-500 text-sm mt-1">Měsíční přehled plánovaných směn zaměstnanců</p>
        </div>
        {/* Draft selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 font-medium">Návrh:</span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(['A', 'B'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDraft(d)}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  draft === d
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Pracovní dny</p>
          <p className="text-2xl font-bold text-slate-900">{workDays.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Plně obsazeno</p>
          <p className="text-2xl font-bold text-green-600">{fullyStaffedDays}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Podstav</p>
          <p className="text-2xl font-bold text-red-500">{understaffedDays}</p>
        </div>
      </div>

      {/* Calendar card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <button
            onClick={prevMonth}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 text-sm font-medium"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Předchozí
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-900">
              {MONTH_NAMES[month]} {year}
            </h2>
            {loading && <p className="text-xs text-slate-400 mt-0.5">Načítám…</p>}
          </div>
          <button
            onClick={nextMonth}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 text-sm font-medium"
          >
            Následující
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Day name headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAY_NAMES.map((day, i) => (
            <div
              key={day}
              className={`py-3 text-center text-xs font-bold uppercase tracking-wider ${
                i >= 5 ? 'text-red-400' : 'text-slate-500'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 divide-x divide-slate-100">
          {cells.map((day, idx) => {
            const dateStr = day ? formatDate(year, month, day) : null;
            const isToday = dateStr === today;
            const isWeekend = idx % 7 >= 5;
            const data: DayData | undefined = dateStr ? scheduleData[dateStr] : undefined;
            const colClass = dayCardClass(data);

            return (
              <div
                key={idx}
                onClick={() => dateStr && setSelectedDate(dateStr)}
                className={`min-h-[120px] p-2 border-b border-slate-100 transition-colors ${colClass} ${
                  day ? 'cursor-pointer hover:brightness-95' : ''
                } ${isWeekend && day ? '' : ''}`}
              >
                {day && (
                  <>
                    {/* Date number + badge row */}
                    <div className="flex items-start justify-between mb-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-md'
                          : isWeekend
                          ? 'text-red-500'
                          : 'text-slate-700'
                      }`}>
                        {day}
                      </div>
                      {data && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${dayBadgeClass(data.dayType)}`}>
                          {data.dayType}
                        </span>
                      )}
                    </div>

                    {/* Staff count */}
                    {data && data.dayType === 'Pracovní' && data.requiredStaff > 0 && (
                      <div className={`text-xs mb-1.5 ${staffCountClass(data)}`}>
                        {data.employees.length}/{data.requiredStaff} obsazeno
                      </div>
                    )}

                    {/* Employee list */}
                    {data && data.employees.length > 0 && (
                      <div className="space-y-0.5">
                        {data.employees.slice(0, 3).map((emp, si) => (
                          <div
                            key={emp.id + si}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700 truncate leading-tight"
                          >
                            <span className="font-medium">{emp.name.split(' ')[0]} {emp.name.split(' ')[1]?.[0]}.</span>
                            <span className="text-slate-400 ml-1">{emp.timeFrom}–{emp.timeTo}</span>
                          </div>
                        ))}
                        {data.employees.length > 3 && (
                          <div className="text-[10px] text-slate-400 pl-1">+{data.employees.length - 3} další</div>
                        )}
                      </div>
                    )}

                    {/* Notes indicator */}
                    {data?.notes && (
                      <div className="mt-1">
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">📝 Poznámka</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-50 border border-green-200" />
          <span>Plně obsazeno</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-50 border border-red-200" />
          <span>Podstav</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200" />
          <span>Zavřeno / víkend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200" />
          <span>Svátek</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-blue-600" />
          <span>Dnes</span>
        </div>
      </div>

      {/* Edit modal */}
      {selectedDate && selectedDayData && (
        <DayModal
          dayData={selectedDayData}
          onClose={() => setSelectedDate(null)}
          onSave={handleDaySave}
        />
      )}
    </div>
  );
}
