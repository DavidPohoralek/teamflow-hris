'use client';

import { useEffect, useState, useCallback } from 'react';

type WorkType = 'Prodejna' | 'HO' | 'Kancelář' | string;

interface PresenceRecord {
  id: string;
  employeeId: string;
  name: string;
  workType: WorkType;
  checkInTime: string; // ISO string
}

interface PresenceDashboardProps {
  orgId: string;
  isManagerMode: boolean;
}

const WORK_TYPE_COLORS: Record<string, { border: string; badge: string; summary: string; avatar: string; summaryCard: string }> = {
  Prodejna: {
    border: 'border-l-blue-500',
    badge: 'bg-blue-100 text-blue-800',
    summary: 'bg-blue-100 text-blue-800',
    avatar: 'from-blue-500 to-blue-600',
    summaryCard: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  HO: {
    border: 'border-l-purple-500',
    badge: 'bg-purple-100 text-purple-800',
    summary: 'bg-purple-100 text-purple-800',
    avatar: 'from-purple-500 to-purple-600',
    summaryCard: 'bg-purple-50 border-purple-200 text-purple-700',
  },
  Kancelář: {
    border: 'border-l-amber-500',
    badge: 'bg-amber-100 text-amber-800',
    summary: 'bg-amber-100 text-amber-800',
    avatar: 'from-amber-500 to-orange-500',
    summaryCard: 'bg-amber-50 border-amber-200 text-amber-700',
  },
};

const DEFAULT_COLORS = {
  border: 'border-l-slate-400',
  badge: 'bg-slate-100 text-slate-700',
  summary: 'bg-slate-100 text-slate-700',
  avatar: 'from-slate-500 to-slate-600',
  summaryCard: 'bg-slate-50 border-slate-200 text-slate-600',
};

function getColors(workType: string) {
  return WORK_TYPE_COLORS[workType] ?? DEFAULT_COLORS;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

function formatDuration(checkInTime: string): { since: string; duration: string } {
  const checkIn = new Date(checkInTime);
  const now = new Date();
  const diffMs = now.getTime() - checkIn.getTime();
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const hh = checkIn.getHours().toString().padStart(2, '0');
  const mm = checkIn.getMinutes().toString().padStart(2, '0');
  const since = `od ${hh}:${mm}`;

  let duration = '';
  if (hours > 0 && minutes > 0) {
    duration = `(${hours} hodin ${minutes} min)`;
  } else if (hours > 0) {
    duration = `(${hours} hodin)`;
  } else {
    duration = `(${minutes} min)`;
  }

  return { since, duration };
}

function sortRecords(records: PresenceRecord[]): PresenceRecord[] {
  const workTypeOrder: Record<string, number> = { Prodejna: 0, HO: 1, Kancelář: 2 };
  return [...records].sort((a, b) => {
    const orderA = workTypeOrder[a.workType] ?? 99;
    const orderB = workTypeOrder[b.workType] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, 'cs');
  });
}

export default function PresenceDashboard({ orgId, isManagerMode }: PresenceDashboardProps) {
  const [records, setRecords] = useState<PresenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchPresence = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/presence?orgId=${encodeURIComponent(orgId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const raw = Array.isArray(json) ? json : (json.present ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: PresenceRecord[] = raw.map((r: any) => ({
        id: r.id ?? r.employeeId,
        employeeId: r.employeeId,
        name: r.employeeName ?? r.name ?? 'Neznámý',
        workType: r.workTypeName ?? r.workType ?? 'Neurčeno',
        checkInTime: r.checkIn ?? r.checkInTime,
      }));
      setRecords(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Nepodařilo se načíst data o přítomnosti.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchPresence();
    const interval = setInterval(fetchPresence, 60000);
    return () => clearInterval(interval);
  }, [fetchPresence]);

  const sorted = sortRecords(records);

  const totalCount = records.length;
  const countByType = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.workType] = (acc[r.workType] ?? 0) + 1;
    return acc;
  }, {});

  const summaryTypes = ['Prodejna', 'HO', 'Kancelář'];

  return (
    <div className="w-full px-6 py-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Aktuální přítomnost</h2>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-400">
              Aktualizováno:{' '}
              {lastUpdated.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchPresence}
            className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            Obnovit
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 min-w-[140px]">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm shadow-emerald-300/50">
            <span className="w-2 h-2 bg-white rounded-full" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-700 leading-none">{totalCount}</div>
            <div className="text-xs text-emerald-600 mt-0.5">Celkem přítomno</div>
          </div>
        </div>
        {summaryTypes.map((type) => {
          const count = countByType[type] ?? 0;
          const colors = getColors(type);
          return (
            <div
              key={type}
              className={`flex items-center gap-3 border rounded-xl px-4 py-3 min-w-[120px] ${colors.summaryCard}`}
            >
              <div>
                <div className="text-xl font-bold leading-none">{count}</div>
                <div className="text-xs mt-0.5 opacity-80">{type}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-l-4 border-gray-100 border-l-gray-200 bg-gray-50"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-5 shadow-inner">
            <svg
              className="h-10 w-10 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a2 2 0 100-4 2 2 0 000 4zM3 16a2 2 0 100-4 2 2 0 000 4z"
              />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-700">Nikdo není aktuálně přihlášen</p>
          <p className="mt-1.5 text-sm text-slate-400">Zaměstnanci se zobrazí po příchodu na pracoviště</p>
        </div>
      )}

      {/* Employee cards grid */}
      {!loading && sorted.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((record) => {
            const colors = getColors(record.workType);
            const { since, duration } = formatDuration(record.checkInTime);
            const isEditing = editingId === record.id;

            return (
              <div
                key={record.id}
                className={`relative rounded-lg border border-l-4 border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${colors.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-3">
                    {/* Avatar circle */}
                    <div className="relative flex-shrink-0">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${colors.avatar} text-sm font-bold text-white shadow-sm`}>
                        {getInitials(record.name)}
                      </div>
                      {/* Green presence dot */}
                      <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
                    </div>

                    {/* Name + timing */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{record.name}</p>
                      <p className="text-xs text-gray-500">
                        {since}{' '}
                        <span className="text-gray-400">{duration}</span>
                      </p>
                    </div>
                  </div>

                  {/* Work type badge */}
                  <span
                    className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colors.badge}`}
                  >
                    {record.workType}
                  </span>
                </div>

                {/* Manager extras */}
                {isManagerMode && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        <span className="font-medium text-gray-600">ID:</span> {record.employeeId}
                      </div>
                      <button
                        onClick={() => setEditingId(isEditing ? null : record.id)}
                        className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      >
                        {isEditing ? 'Zavřít' : 'Upravit'}
                      </button>
                    </div>

                    {isEditing && (
                      <div className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-600 space-y-2">
                        <p className="font-medium text-gray-700">Ruční úprava příchodu/odchodu</p>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block mb-1 text-gray-500">Příchod</label>
                            <input
                              type="time"
                              defaultValue={new Date(record.checkInTime)
                                .toTimeString()
                                .slice(0, 5)}
                              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block mb-1 text-gray-500">Odchod</label>
                            <input
                              type="time"
                              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                              placeholder="—"
                            />
                          </div>
                        </div>
                        <button className="mt-1 w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
                          Uložit změny
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
