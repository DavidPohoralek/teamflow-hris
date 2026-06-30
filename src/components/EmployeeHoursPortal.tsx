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
  // Benefit counts: { [benefit_key]: count }
  const [benefitCounts, setBenefitCounts] = useState<Record<string, number>>({});
  const [benefitSaving, setBenefitSaving] = useState<string | null>(null);

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
          }) => ({
            date: l.date,
            arrival: l.check_in ?? l.arrival ?? '',
            departure: l.check_out ?? l.departure ?? null,
            worked: l.duration ?? l.worked ?? null,
            category: l.work_type_name ?? l.category ?? '—',
          })),
        };
        setData(normalized);
        fetchRequests(enteredPin);
        if (normalized.thisMonth.monthKey) {
          fetchBenefitCounts(enteredPin, normalized.thisMonth.monthKey);
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

  const handleBack = () => {
    setData(null);
    setPin('');
    setError('');
    setRequests([]);
    setBenefitCounts({});
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

          {/* Benefits section */}
          {data.benefits && data.benefits.length > 0 && (
            <div className="px-4 sm:px-6 pb-3">
              {(() => {
                const totalImpact = data.benefits!.reduce((sum, b) => {
                  const count = benefitCounts[b.key] ?? 0;
                  return sum + count * b.hoursPerUnit;
                }, 0);
                const BENEFIT_ICONS: Record<string, string> = { blood: '🩸', english: '🇬🇧', gym: '🏋️' };
                return (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-white">
                      <span className="text-sm font-semibold text-slate-700">Aktivity tento měsíc</span>
                      {totalImpact !== 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalImpact < 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          Dopad: {totalImpact > 0 ? '+' : ''}{totalImpact.toFixed(2)} h
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {data.benefits!.map((b) => {
                        const count = benefitCounts[b.key] ?? 0;
                        const impact = count * b.hoursPerUnit;
                        const isSaving = benefitSaving === b.key;
                        const max = b.maxPerMonth ?? 99;
                        return (
                          <div key={b.key} className="flex items-center gap-3 px-4 py-3">
                            <span className="text-xl shrink-0">{BENEFIT_ICONS[b.key] ?? '📌'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800">{b.czLabel}</p>
                              {count > 0 && (
                                <p className={`text-xs font-semibold mt-0.5 ${impact < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                  {count}× = {impact > 0 ? '+' : ''}{impact.toFixed(2)} h
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => count > 0 && saveBenefitCount(b.key, count - 1)}
                                disabled={count === 0 || isSaving}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-lg flex items-center justify-center hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-30 transition-colors"
                              >−</button>
                              <span className="w-8 text-center text-sm font-bold text-slate-800">
                                {isSaving ? <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : count}
                              </span>
                              <button
                                onClick={() => count < max && saveBenefitCount(b.key, count + 1)}
                                disabled={count >= max || isSaving}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-lg flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-30 transition-colors"
                              >+</button>
                              {b.maxPerMonth && (
                                <span className="text-xs text-slate-400 ml-1">/ {b.maxPerMonth}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Attendance table */}
          <div className="px-4 sm:px-6 pb-2">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Poslední záznamy</h3>
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
                  {data.records.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                        Žádné záznamy
                      </td>
                    </tr>
                  ) : (
                    data.records.map((rec, i) => {
                      const isComplete = rec.departure !== null;
                      return (
                        <tr key={i} className={`border-b border-slate-100 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-blue-50/40`}>
                          <td className="px-4 py-3 text-slate-900 font-semibold">{formatDate(rec.date)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatTime(rec.arrival)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatTime(rec.departure)}</td>
                          <td className="px-4 py-3 text-slate-700 font-medium">{formatHours(rec.worked)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isComplete ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                {rec.category}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* My requests section */}
          <div className="px-4 sm:px-6 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Moje žádosti</h3>
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
              <div className="flex items-center justify-center py-6">
                <span className="inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-5 bg-slate-50 rounded-xl border border-slate-100">
                Žádné žádosti
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {requests.map((req) => {
                  const badge = STATUS_BADGES[req.status] ?? STATUS_BADGES.pending;
                  return (
                    <div key={req.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {REQUEST_TYPE_LABELS[req.type] ?? req.type}
                        </span>
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
                      <span className={`ml-3 flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
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
