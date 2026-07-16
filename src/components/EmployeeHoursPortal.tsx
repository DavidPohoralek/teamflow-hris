'use client';

import { useState } from 'react';
import EmployeeRequestModal from './EmployeeRequestModal';
import PinPad from './PinPad';

interface EmployeeHoursPortalProps {
  orgId: string;
  onClose: () => void;
}

interface AttendanceRecord {
  date: string;
  arrival: string;
  departure: string | null;
  worked: number | null;
  category: string;
  satBonusHours?: number | null;
}

interface BenefitDef {
  key: string;
  czLabel: string;
  enLabel: string;
  hoursPerUnit: number;
  maxPerMonth: number | null;
}

interface EmployeeHoursData {
  name: string;
  thisMonth: {
    hours: number;
    days: number;
    monthKey?: string;
    saturdayBonusHours?: number;
  };
  lastMonth: {
    hours: number;
    days: number;
    monthKey?: string;
  };
  records: AttendanceRecord[];
  vacation?: {
    total: number;
    used: number;
    remaining: number;
  };
  benefits?: BenefitDef[];
}

type RequestStatus = 'pending' | 'approved' | 'rejected';

interface EmployeeRequest {
  id: string;
  type: string;
  dateFrom: string;
  dateTo?: string;
  note?: string;
  status: RequestStatus;
  createdAt: string;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  vacation: '🏖️ Dovolená',
  sick: '🤒 Nemoc',
  correction: '✏️ Oprava docházky',
  other: '📝 Ostatní',
};

const STATUS_BADGES: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: 'Čeká', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  approved: { label: 'Schváleno', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  rejected: { label: 'Zamítnuto', className: 'bg-red-100 text-red-700 border border-red-200' },
};

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatHours(h: number | null): string {
  if (h === null) return '—';
  if (h < 1 / 60) return '< 1 min';
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(2)} h`;
}

export default function EmployeeHoursPortal({ orgId, onClose }: EmployeeHoursPortalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<EmployeeHoursData | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [benefitCounts, setBenefitCounts] = useState<Record<string, number>>({});
  const [benefitSaving, setBenefitSaving] = useState<string | null>(null);
  const [benefitEntries, setBenefitEntries] = useState<{ id: string; benefit_key: string; date: string }[]>([]);
  const [deletingBenefitId, setDeletingBenefitId] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  // Bottom tab: 'logs' | 'requests'
  const [activeTab, setActiveTab] = useState<'logs' | 'requests'>('logs');
  // Log filter: 'today' | '7d' | '30d' | 'all'
  const [logFilter, setLogFilter] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  const handleNumpad = (key: string) => {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (!key) return;
    if (pin.length >= 8) return;
    setPin((p) => p + key);
    setError('');
  };

  const handlePinSubmit = async (enteredPin: string) => {
    setPin(enteredPin);
    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/api/public/employee-hours?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(enteredPin)}`
      );

      if (res.ok) {
        const json = await res.json();
        // Normalize API response to EmployeeHoursData shape
        const normalized: EmployeeHoursData = {
          name: json.employee?.name ?? json.name ?? '—',
          thisMonth: {
            hours: json.thisMonth?.hours ?? 0,
            days: json.thisMonth?.days ?? 0,
            monthKey: json.thisMonth?.monthKey,
            saturdayBonusHours: json.thisMonth?.saturdayBonusHours ?? 0,
          },
          lastMonth: {
            hours: json.lastMonth?.hours ?? 0,
            days: json.lastMonth?.days ?? 0,
            monthKey: json.lastMonth?.monthKey,
          },
          vacation: json.vacation ?? undefined,
          benefits: json.benefits ?? [],
          records: (json.recentLogs ?? json.records ?? []).map((l: {
            date: string; check_in?: string | null; arrival?: string | null;
            check_out?: string | null; departure?: string | null;
            duration?: number | null; worked?: number | null;
            work_type_name?: string | null; category?: string | null;
            sat_bonus_hours?: number | null;
          }) => ({
            date: l.date,
            arrival: l.check_in ?? l.arrival ?? '',
            departure: l.check_out ?? l.departure ?? null,
            worked: l.duration ?? l.worked ?? null,
            category: l.work_type_name ?? l.category ?? '—',
            satBonusHours: l.sat_bonus_hours ?? null,
          })),
        };
        setData(normalized);
        fetchRequests(enteredPin);
        if (normalized.thisMonth.monthKey) {
          fetchBenefitCounts(enteredPin, normalized.thisMonth.monthKey);
          fetchBenefitEntries(enteredPin, normalized.thisMonth.monthKey);
        }
      } else if (res.status === 401 || res.status === 404) {
        setError('Nesprávný PIN. Zkuste to znovu.');
        setPin('');
      } else {
        setError('Chyba serveru. Zkuste to znovu.');
        setPin('');
      }
    } catch {
      setError('Chyba připojení. Zkuste to znovu.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async (currentPin: string) => {
    setRequestsLoading(true);
    try {
      const res = await fetch(
        `/api/public/requests?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(currentPin)}`
      );
      if (res.ok) {
        const json = await res.json();
        // normalize snake_case from API to camelCase
        const raw: { id: string; type: string; date_from: string; date_to?: string; note?: string; status: RequestStatus; created_at: string }[] = json.requests ?? json ?? [];
        setRequests(raw.map((r) => ({ id: r.id, type: r.type, dateFrom: r.date_from, dateTo: r.date_to, note: r.note, status: r.status, createdAt: r.created_at })));
      }
    } catch {
      // silently ignore
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchBenefitEntries = async (currentPin: string, month: string) => {
    try {
      const res = await fetch(`/api/public/benefit-entries?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(currentPin)}&month=${encodeURIComponent(month)}`);
      if (res.ok) {
        const json = await res.json();
        setBenefitEntries(json.entries ?? []);
      }
    } catch { /* ignore */ }
  };

  const logBenefitToday = async (benefitKey: string) => {
    if (!data?.thisMonth.monthKey) return;
    setBenefitSaving(benefitKey);
    try {
      const res = await fetch('/api/public/benefit-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, pin, benefit_key: benefitKey }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.entry) setBenefitEntries((prev) => [json.entry, ...prev]);
        setBenefitCounts((prev) => ({ ...prev, [benefitKey]: (prev[benefitKey] ?? 0) + 1 }));
      }
    } catch { /* ignore */ }
    finally { setBenefitSaving(null); }
  };

  const deleteBenefitEntry = async (entryId: string, benefitKey: string) => {
    setDeletingBenefitId(entryId);
    try {
      const res = await fetch(
        `/api/public/benefit-entries?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(pin)}&entryId=${encodeURIComponent(entryId)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setBenefitEntries((prev) => prev.filter((e) => e.id !== entryId));
        setBenefitCounts((prev) => ({ ...prev, [benefitKey]: Math.max(0, (prev[benefitKey] ?? 1) - 1) }));
      }
    } catch { /* ignore */ }
    finally { setDeletingBenefitId(null); }
  };

  const fetchBenefitCounts = async (currentPin: string, month: string) => {
    try {
      const res = await fetch(`/api/public/employee-benefits?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(currentPin)}&month=${encodeURIComponent(month)}`);
      if (res.ok) {
        const json = await res.json();
        setBenefitCounts(json.counts ?? {});
      }
    } catch { /* ignore */ }
  };

  const saveBenefitCount = async (benefitKey: string, count: number) => {
    if (!data?.thisMonth.monthKey) return;
    setBenefitSaving(benefitKey);
    try {
      await fetch('/api/public/employee-benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, pin, month: data.thisMonth.monthKey, benefit_key: benefitKey, count }),
      });
      setBenefitCounts((prev) => ({ ...prev, [benefitKey]: count }));
    } catch { /* ignore */ }
    finally { setBenefitSaving(null); }
  };

  const handleDeleteRequest = async (requestId: string) => {
    setDeletingRequestId(requestId);
    try {
      const res = await fetch(
        `/api/public/requests?orgId=${encodeURIComponent(orgId)}&pin=${encodeURIComponent(pin)}&requestId=${encodeURIComponent(requestId)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch { /* ignore */ }
    finally { setDeletingRequestId(null); }
  };

  const handleBack = () => {
    setData(null);
    setPin('');
    setError('');
    setRequests([]);
    setBenefitCounts({});
    setBenefitEntries([]);
  };

  // Get current month name
  const now = new Date();
  const thisMonthName = now.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });

  // Step 2 — Employee hours dashboard
  if (data) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header — fixed, never scrolls */}
          <div className="shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-slate-700 bg-clip-text text-transparent">
                  {data.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Přehled odpracovaných hodin</p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition"
                aria-label="Zavřít"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable body — everything below header */}
          <div className="flex-1 overflow-y-auto">

          {/* Stat cards */}
          {(() => {
            const benefitImpact = (data.benefits ?? []).reduce((sum, b) => sum + (benefitCounts[b.key] ?? 0) * b.hoursPerUnit, 0);
            const adjustedHours = data.thisMonth.hours + benefitImpact;
            return (
          <div className="grid grid-cols-2 gap-3 px-4 sm:px-6 py-4 sm:py-5">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/60 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-blue-100">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1 sm:mb-3">Tento měsíc</p>
              <p className="text-2xl sm:text-4xl font-bold text-blue-700 leading-none">{adjustedHours.toFixed(2)}<span className="text-base sm:text-xl ml-1 font-medium">h</span></p>
              {benefitImpact !== 0 && (
                <p className={`text-xs font-semibold mt-0.5 ${benefitImpact < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {data.thisMonth.hours.toFixed(2)} h {benefitImpact > 0 ? '+' : ''}{benefitImpact.toFixed(2)} h aktivity
                </p>
              )}
              <p className="text-xs sm:text-sm text-blue-600 mt-1 font-medium">{data.thisMonth.days} dní</p>
              <p className="text-xs text-blue-400 mt-0.5 capitalize hidden sm:block">{thisMonthName}</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 sm:mb-3">Minulý měsíc</p>
              <p className="text-2xl sm:text-4xl font-bold text-slate-700 leading-none">{data.lastMonth.hours.toFixed(2)}<span className="text-base sm:text-xl ml-1 font-medium">h</span></p>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 sm:mt-1.5 font-medium">{data.lastMonth.days} dní</p>
              <p className="text-xs text-slate-400 mt-0.5 capitalize hidden sm:block">{lastMonthName}</p>
            </div>
          </div>
            );
          })()}

          {/* Saturday bonus card */}
          {(data.thisMonth.saturdayBonusHours ?? 0) > 0 && (
            <div className="px-4 sm:px-6 pb-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-0.5">Bonus za soboty</p>
                  <p className="text-xs text-amber-500">aktuální měsíc</p>
                </div>
                <p className="text-2xl font-bold text-amber-700">+{data.thisMonth.saturdayBonusHours!.toFixed(2)}<span className="text-sm ml-1 font-medium">h</span></p>
              </div>
            </div>
          )}

          {/* Benefits section */}
          {data.benefits && data.benefits.length > 0 && (
            <div className="px-4 sm:px-6 pb-3">
              {(() => {
                const BENEFIT_ICONS: Record<string, string> = { blood: '🩸', english: '🇬🇧', gym: '🏋️' };
                const today = new Date().toISOString().slice(0, 10);
                return (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-white">
                      <span className="text-sm font-semibold text-slate-700">Aktivity tento měsíc</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {data.benefits!.map((b) => {
                        const myEntries = benefitEntries.filter((e) => e.benefit_key === b.key);
                        const count = myEntries.length;
                        const impact = count * b.hoursPerUnit;
                        const isSaving = benefitSaving === b.key;
                        const max = b.maxPerMonth ?? 99;
                        const loggedToday = myEntries.some((e) => e.date === today);
                        const canLog = !loggedToday && count < max;
                        return (
                          <div key={b.key} className="px-4 py-3 space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xl shrink-0">{BENEFIT_ICONS[b.key] ?? '📌'}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800">{b.czLabel}</p>
                                {count > 0 && (
                                  <p className={`text-xs font-semibold mt-0.5 ${impact < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {count}×{b.maxPerMonth ? ` / ${b.maxPerMonth}` : ''} = {impact > 0 ? '+' : ''}{impact.toFixed(2)} h
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => canLog && logBenefitToday(b.key)}
                                disabled={!canLog || isSaving}
                                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  loggedToday
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                                    : canLog
                                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {isSaving
                                  ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  : loggedToday ? '✓ Dnes' : count >= max ? 'Max' : '+ Dnes'}
                              </button>
                            </div>
                            {myEntries.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pl-9">
                                {myEntries.map((e) => {
                                  const isToday = e.date === today;
                                  const isDeleting = deletingBenefitId === e.id;
                                  return (
                                    <span key={e.id} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${isToday ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                      {new Date(e.date + 'T00:00:00').toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' })}
                                      {isToday && (
                                        <button
                                          onClick={() => !isDeleting && deleteBenefitEntry(e.id, e.benefit_key)}
                                          disabled={isDeleting}
                                          className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors disabled:opacity-40"
                                          title="Zrušit dnešní záznam"
                                        >
                                          {isDeleting ? '…' : '×'}
                                        </button>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tabs: Záznamy / Žádosti */}
          <div className="px-4 sm:px-6 pt-1 pb-4">
            {/* Tab bar */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'logs' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Záznamy docházky
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'requests' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Moje žádosti
                {requests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-amber-400 text-white rounded-full">{requests.filter(r => r.status === 'pending').length}</span>
                )}
              </button>
            </div>

            {/* LOGS TAB */}
            {activeTab === 'logs' && (() => {
              const now = new Date();
              const cutoff: Record<string, Date> = {
                today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                '7d': new Date(now.getTime() - 7 * 86400000),
                '30d': new Date(now.getTime() - 30 * 86400000),
                all: new Date(0),
              };
              const filtered = data.records.filter(rec => new Date(rec.date + 'T00:00:00') >= cutoff[logFilter]);
              return (
                <>
                  {/* Filter pills */}
                  <div className="flex gap-1.5 mb-3 flex-wrap">
                    {(['today', '7d', '30d', 'all'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setLogFilter(f)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${logFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {f === 'today' ? 'Dnes' : f === '7d' ? '7 dní' : f === '30d' ? '30 dní' : 'Vše'}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-slate-400 self-center">{filtered.length} záznamů</span>
                  </div>
                  {(() => {
                    const totalSatBonus = filtered.reduce((s, r) => s + (r.satBonusHours ?? 0), 0);
                    return (
                  <div className="rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="bg-slate-800 text-xs font-semibold text-slate-300 uppercase tracking-wide">
                          <th className="px-4 py-3 text-left">Datum</th>
                          <th className="px-4 py-3 text-left">Příchod</th>
                          <th className="px-4 py-3 text-left">Odchod</th>
                          <th className="px-4 py-3 text-left">Odpracováno</th>
                          <th className="px-4 py-3 text-left">Kategorie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">Žádné záznamy</td></tr>
                        ) : (
                          filtered.map((rec, i) => {
                            const isComplete = rec.departure !== null;
                            return (
                              <tr key={i} className={`border-b border-slate-100 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-blue-50/40`}>
                                <td className="px-4 py-3 text-slate-900 font-semibold">{formatDate(rec.date)}</td>
                                <td className="px-4 py-3 text-slate-600">{formatTime(rec.arrival)}</td>
                                <td className="px-4 py-3 text-slate-600">{formatTime(rec.departure)}</td>
                                <td className="px-4 py-3 text-slate-700 font-medium">{formatHours(rec.worked)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isComplete ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{rec.category}</span>
                                    {(rec.satBonusHours ?? 0) > 0 && (
                                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                        +{rec.satBonusHours!.toFixed(2)}h bonus
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {totalSatBonus > 0 && (
                          <tr className="bg-amber-50 border-t-2 border-amber-200">
                            <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-amber-700">Bonus za soboty (zobrazené období)</td>
                            <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-amber-700">+{totalSatBonus.toFixed(2)} h</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                    );
                  })()}
                </>
              );
            })()}

            {/* REQUESTS TAB */}
            {activeTab === 'requests' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500">{requests.length} žádostí celkem</span>
                  <button
                    onClick={() => setShowRequestModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-sm"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    Podat žádost
                  </button>
                </div>
                {requestsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : requests.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8 bg-slate-50 rounded-xl border border-slate-100">Žádné žádosti</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {requests.map((req) => {
                      const badge = STATUS_BADGES[req.status] ?? STATUS_BADGES.pending;
                      return (
                        <div key={req.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm font-semibold text-slate-800 truncate">{REQUEST_TYPE_LABELS[req.type] ?? req.type}</span>
                            <span className="text-xs text-slate-500">
                              {formatDate(req.dateFrom)}{req.dateTo ? ` — ${formatDate(req.dateTo)}` : ''}
                            </span>
                            {req.note && (
                              <span className="text-xs text-slate-400 truncate">
                                {(() => {
                                  try {
                                    const p = JSON.parse(req.note!);
                                    if (p.timeIn && p.timeOut) return `Příchod: ${p.timeIn} – Odchod: ${p.timeOut}${p.userNote ? ' · ' + p.userNote : ''}`;
                                  } catch { /* not JSON */ }
                                  return req.note;
                                })()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                            {req.status === 'pending' && (
                              <button
                                onClick={() => handleDeleteRequest(req.id)}
                                disabled={deletingRequestId === req.id}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                title="Stáhnout žádost"
                              >
                                {deletingRequestId === req.id
                                  ? <span className="inline-block w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                                }
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          </div>{/* end scrollable body */}

          {/* Footer — fixed at bottom */}
          <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Zpět na přihlášení
            </button>
          </div>
        </div>

        {/* Request Modal */}
        {showRequestModal && (
          <EmployeeRequestModal
            orgId={orgId}
            pin={pin}
            employeeName={data.name}
            onClose={() => {
              setShowRequestModal(false);
              fetchRequests(pin);
            }}
          />
        )}
      </div>
    );
  }

  // Step 1 — PIN input
  return (
    <PinPad
      title="Zaměstnanec"
      subtitle=""
      onConfirm={handlePinSubmit}
      loading={loading}
      error={error || null}
    />
  );
}
