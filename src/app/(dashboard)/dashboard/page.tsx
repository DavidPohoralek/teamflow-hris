'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  department?: string | null;
  position?: string | null;
  active: boolean;
}

interface ScheduleDay {
  date: string;
  dayName: string;
  dayType: string;
  requiredTotal: number;
  assignedEmployees: string[];
  assignedCount: number;
  status: string;
  notes?: string | null;
  plannedEmployees: string[];
}

interface Request {
  id: string;
  type: string;
  date_from: string;
  date_to?: string | null;
  note?: string | null;
  status: string;
  created_at: string;
  employees?: {
    id: string;
    name: string;
    department?: string | null;
    position?: string | null;
  } | null;
}

interface AttendanceLog {
  id: string;
  date: string;
  check_in: string;
  check_out?: string | null;
  note?: string | null;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface Stats {
  employeeCount: number | null;
  todayShifts: { assigned: number; required: number } | null;
  todaySchedule: ScheduleDay | null;
  pendingCount: number | null;
  pendingRequests: Request[];
  presentCount: number | null;
  presentEmployees: AttendanceLog[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
  });
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  vacation: 'Dovolená',
  sick: 'Nemocenská',
  correction: 'Oprava',
  other: 'Jiné',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className ?? ''}`}
    />
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number | null;
  icon: React.ReactNode;
  iconBg: string;
  sub?: string;
  badge?: number;
  loading: boolean;
}

function StatCard({ label, value, icon, iconBg, sub, badge, loading }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`relative w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
          {badge != null && badge > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </div>
      </div>
      {loading ? (
        <>
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-32" />
        </>
      ) : (
        <>
          <p className="text-3xl font-bold text-slate-900">
            {value ?? '—'}
          </p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconEmployees() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" stroke="#3b82f6" strokeWidth="2" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="#10b981" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconRequests() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconPresence() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" stroke="#8b5cf6" strokeWidth="2" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 11l1.5 1.5L21 9" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    employeeCount: null,
    todayShifts: null,
    todaySchedule: null,
    pendingCount: null,
    pendingRequests: [],
    presentCount: null,
    presentEmployees: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<Record<string, 'approving' | 'rejecting' | null>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const today = todayISO();
      const month = todayMonth();

      const [empRes, schedRes, reqRes, attRes] = await Promise.all([
        fetch('/api/employees'),
        fetch(`/api/schedule?month=${month}`),
        fetch('/api/requests?status=pending'),
        fetch(`/api/attendance?date=${today}`),
      ]);

      const [empJson, schedJson, reqJson, attJson] = await Promise.all([
        empRes.ok ? empRes.json() : null,
        schedRes.ok ? schedRes.json() : null,
        reqRes.ok ? reqRes.json() : null,
        attRes.ok ? attRes.json() : null,
      ]);

      const employees: Employee[] = empJson?.employees ?? [];
      const schedDays: ScheduleDay[] = schedJson?.days ?? [];
      const requests: Request[] = reqJson?.requests ?? [];
      const attendance: AttendanceLog[] = attJson?.data ?? [];

      const todaySchedule = schedDays.find((d) => d.date === today) ?? null;

      setStats({
        employeeCount: employees.length,
        todayShifts: todaySchedule
          ? { assigned: todaySchedule.assignedCount, required: todaySchedule.requiredTotal }
          : null,
        todaySchedule,
        pendingCount: requests.length,
        pendingRequests: requests.slice(0, 5),
        presentCount: attendance.length,
        presentEmployees: attendance,
      });
    } catch (e) {
      console.error('Dashboard fetch error:', e);
      setError('Nepodařilo se načíst data. Zkuste obnovit stránku.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolve = async (requestId: string, action: 'approved' | 'rejected') => {
    setResolving((prev) => ({ ...prev, [requestId]: action === 'approved' ? 'approving' : 'rejecting' }));
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        setStats((prev) => ({
          ...prev,
          pendingCount: Math.max(0, (prev.pendingCount ?? 1) - 1),
          pendingRequests: prev.pendingRequests.filter((r) => r.id !== requestId),
        }));
      }
    } catch (e) {
      console.error('Resolve request error:', e);
    } finally {
      setResolving((prev) => ({ ...prev, [requestId]: null }));
    }
  };

  const today = new Date().toLocaleDateString('cs-CZ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Přehled</h1>
          <p className="text-slate-500 mt-1 capitalize">{today}</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            className={loading ? 'animate-spin' : ''}
          >
            <path
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Obnovit
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Celkem zaměstnanců"
          value={stats.employeeCount}
          icon={<IconEmployees />}
          iconBg="bg-blue-50"
          sub="aktivní zaměstnanci"
          loading={loading}
        />
        <StatCard
          label="Dnešní směny"
          value={
            stats.todayShifts != null
              ? `${stats.todayShifts.assigned} / ${stats.todayShifts.required}`
              : null
          }
          icon={<IconCalendar />}
          iconBg="bg-green-50"
          sub={
            stats.todayShifts != null
              ? `obsazeno z ${stats.todayShifts.required} požadovaných`
              : 'obsazeno / požadováno'
          }
          loading={loading}
        />
        <StatCard
          label="Čekající žádosti"
          value={stats.pendingCount}
          icon={<IconRequests />}
          iconBg="bg-orange-50"
          sub="čeká na vyřízení"
          badge={stats.pendingCount ?? undefined}
          loading={loading}
        />
        <StatCard
          label="Přítomno dnes"
          value={stats.presentCount}
          icon={<IconPresence />}
          iconBg="bg-purple-50"
          sub="zaměstnanců je dnes přítomno"
          loading={loading}
        />
      </div>

      {/* Two-column bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Dnešní přehled */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Dnešní přehled</h2>
            <Link
              href="/shifts"
              className="text-xs text-blue-600 hover:underline"
            >
              Zobrazit vše
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats.todaySchedule == null ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="#94a3b8" strokeWidth="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">Pro dnešek není naplánovaná žádná směna</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-50">
                <div className="text-center">
                  <span className="text-2xl font-bold text-slate-900">
                    {stats.todayShifts?.assigned ?? 0}
                  </span>
                  <span className="text-slate-400 text-sm"> / {stats.todayShifts?.required ?? 0}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">obsazených míst</p>
                  <p className="text-xs text-slate-400">
                    {stats.todaySchedule.dayName} · {stats.todaySchedule.dayType}
                  </p>
                </div>
                <div className="ml-auto">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      stats.todaySchedule.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : stats.todaySchedule.status === 'open'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {stats.todaySchedule.status === 'confirmed'
                      ? 'Potvrzeno'
                      : stats.todaySchedule.status === 'open'
                      ? 'Otevřeno'
                      : stats.todaySchedule.status}
                  </span>
                </div>
              </div>

              {stats.todaySchedule.assignedEmployees.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                    Přiřazení zaměstnanci
                  </p>
                  {stats.todaySchedule.assignedEmployees.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                        {String(name).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-700">{name}</span>
                    </div>
                  ))}
                </div>
              ) : stats.todaySchedule.plannedEmployees.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                    Plánovaní zaměstnanci
                  </p>
                  {stats.todaySchedule.plannedEmployees.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-semibold flex-shrink-0">
                        {String(entry).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-700">{entry}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Zatím nikdo není přiřazen</p>
              )}

              {stats.todaySchedule.notes && (
                <div className="mt-3 p-2 rounded-lg bg-yellow-50 border border-yellow-100">
                  <p className="text-xs text-yellow-700">{stats.todaySchedule.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Čekající žádosti */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Čekající žádosti</h2>
            <Link
              href="/requests"
              className="text-xs text-blue-600 hover:underline"
            >
              Zobrazit vše
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="p-3 rounded-lg border border-slate-100 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-24" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-7 w-20 rounded-lg" />
                    <Skeleton className="h-7 w-20 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats.pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="9" stroke="#10b981" strokeWidth="2" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">Žádné čekající žádosti</p>
              <p className="text-slate-400 text-xs mt-1">Vše je vyřízeno</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.pendingRequests.map((req) => {
                const isResolving = resolving[req.id] != null;
                return (
                  <div
                    key={req.id}
                    className={`p-3 rounded-lg border transition-opacity ${
                      isResolving ? 'opacity-50' : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {req.employees?.name ?? 'Neznámý zaměstnanec'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700 font-medium">
                            {REQUEST_TYPE_LABELS[req.type] ?? req.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDate(req.date_from)}
                          {req.date_to && req.date_to !== req.date_from
                            ? ` – ${formatDate(req.date_to)}`
                            : ''}
                          {req.employees?.department ? ` · ${req.employees.department}` : ''}
                        </p>
                        {req.note && (
                          <p className="text-xs text-slate-500 mt-1 italic truncate">{req.note}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleResolve(req.id, 'approved')}
                        disabled={isResolving}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                      >
                        {resolving[req.id] === 'approving' ? 'Schvaluji…' : 'Schválit'}
                      </button>
                      <button
                        onClick={() => handleResolve(req.id, 'rejected')}
                        disabled={isResolving}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        {resolving[req.id] === 'rejecting' ? 'Zamítám…' : 'Zamítnout'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {(stats.pendingCount ?? 0) > 5 && (
                <Link
                  href="/requests"
                  className="block text-center text-xs text-blue-600 hover:underline pt-1"
                >
                  + {(stats.pendingCount ?? 0) - 5} dalších žádostí
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
