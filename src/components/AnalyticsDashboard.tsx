'use client';

import { useState, useEffect, useCallback } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import { useLang } from '@/lib/i18n';

interface EmployeeStat {
  id: string;
  name: string;
  workedHours: number;
  plannedHours: number;
  targetHours: number;
  utilizationPct: number;
  daysWorked: number;
  daysPlanned: number;
  avgPunctualityMin: number | null;
  vacationDaysTotal: number;
  vacationDaysUsed: number;
  vacationDaysRemaining: number;
}

interface WorkTypeBreakdown {
  name: string;
  hours: number;
}

interface AnalyticsData {
  month: string;
  stats: EmployeeStat[];
  workTypeBreakdown: WorkTypeBreakdown[];
}

const CZ_MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
}

function Bar({ value, max, color, height = 40 }: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-1" style={{ height: height + 24 }}>
      <div className="flex-1 w-full flex items-end">
        <div className="w-full rounded-t-md transition-all" style={{ height: `${pct}%`, backgroundColor: color, minHeight: pct > 0 ? 3 : 0 }} />
      </div>
      <span className="text-xs text-slate-500 font-mono">{value}h</span>
    </div>
  );
}

function PunctualityBadge({ min }: { min: number | null }) {
  if (min === null) return <span className="text-slate-300 text-xs">—</span>;
  const abs = Math.abs(min);
  const label = min <= 0 ? `${abs}m dříve` : `${abs}m pozdě`;
  const color = min <= 0 ? 'text-emerald-600 bg-emerald-50' : min <= 10 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

export default function AnalyticsDashboard({ orgId }: { orgId: string }) {
  const { lang } = useLang();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await managerFetch(`/api/analytics?month=${month}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await managerFetch(`/api/analytics/export?month=${month}&lang=${lang}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${month}${lang === 'en' ? '-en' : ''}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExportLoading(false); }
  };

  const [y, mo] = month.split('-').map(Number);
  const monthLabel = `${CZ_MONTHS[mo - 1]} ${y}`;

  const filteredStats = data
    ? selectedEmployees.size === 0
      ? data.stats
      : data.stats.filter((s) => selectedEmployees.has(s.id))
    : [];

  const maxTarget = Math.max(...(filteredStats.map((s) => s.targetHours) ?? [160]), 1);

  return (
    <div className="w-full px-6 py-5 space-y-8">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1">
          <button onClick={() => setMonth(prevMonth(month))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[160px] text-center px-2">{monthLabel}</span>
          <button onClick={() => setMonth(nextMonth(month))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          </button>
        </div>
        <button
          onClick={handleExport}
          disabled={exportLoading || loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exportLoading ? 'Generuji…' : 'Export CSV'}
        </button>
      </div>

      {/* Employee filter chips */}
      {data && data.stats.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 font-medium shrink-0">Filtr:</span>
          <button
            onClick={() => setSelectedEmployees(new Set())}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${selectedEmployees.size === 0 ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
          >
            Všichni
          </button>
          {data.stats.map((emp) => {
            const active = selectedEmployees.has(emp.id);
            return (
              <button
                key={emp.id}
                onClick={() => {
                  setSelectedEmployees((prev) => {
                    const next = new Set(prev);
                    if (active) next.delete(emp.id);
                    else next.add(emp.id);
                    return next;
                  });
                }}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}
              >
                {emp.name}
              </button>
            );
          })}
        </div>
      )}

      {loading && <div className="flex justify-center py-16 text-slate-400 text-sm">Načítám analytiku…</div>}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard
              label="Zaměstnanců"
              value={String(filteredStats.length)}
              icon="👥"
              color="bg-blue-50 border-blue-100"
            />
            <SummaryCard
              label="Celkem hodin"
              value={`${filteredStats.reduce((s, e) => s + e.workedHours, 0).toFixed(0)}h`}
              icon="⏱️"
              color="bg-violet-50 border-violet-100"
            />
            <SummaryCard
              label="Průměrná využití"
              value={`${filteredStats.length > 0 ? Math.round(filteredStats.reduce((s, e) => s + e.utilizationPct, 0) / filteredStats.length) : 0}%`}
              icon="📊"
              color="bg-emerald-50 border-emerald-100"
            />
            <SummaryCard
              label="Dochvilnost"
              value={(() => {
                const vals = filteredStats.map((e) => e.avgPunctualityMin).filter((v) => v !== null) as number[];
                if (vals.length === 0) return '—';
                const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
                return avg <= 0 ? `${Math.abs(avg)}m dříve` : `${avg}m pozdě`;
              })()}
              icon="🕐"
              color="bg-amber-50 border-amber-100"
            />
          </div>

          {/* Hours bar chart */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-6">Odpracované vs. plánované hodiny</h3>
            <div className="overflow-x-auto">
              <div className="flex gap-4 min-w-0" style={{ minWidth: filteredStats.length * 80 }}>
                {filteredStats.map((emp) => (
                  <div key={emp.id} className="flex-1 min-w-[64px] flex flex-col gap-2">
                    <div className="flex gap-1 items-end h-[100px]">
                      <div className="flex-1">
                        <Bar value={emp.workedHours} max={maxTarget} color="#3b82f6" height={100} />
                      </div>
                      <div className="flex-1">
                        <Bar value={emp.targetHours} max={maxTarget} color="#e2e8f0" height={100} />
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 text-center truncate font-medium">{emp.name.split(' ')[0]}</p>
                    <p className={`text-xs text-center font-semibold ${emp.utilizationPct >= 100 ? 'text-emerald-600' : emp.utilizationPct >= 80 ? 'text-amber-500' : 'text-red-500'}`}>
                      {emp.utilizationPct}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-4 mt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" />Odpracováno</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200" />Fond (cíl)</span>
            </div>
          </section>

          {/* Punctuality + Attendance table */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">Přehled zaměstnanců</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Zaměstnanec</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Odpracováno</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Fond</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Rozdíl</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-500">Vytížení</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-500">Dochvilnost</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Dovolená</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStats.map((emp) => {
                    const delta = emp.workedHours - emp.targetHours;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                              {emp.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-900">{emp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-700">{emp.workedHours}h</td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-500">{emp.targetHours}h</td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                            {delta >= 0 ? '+' : ''}{Math.round(delta * 10) / 10}h
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${emp.utilizationPct >= 100 ? 'bg-emerald-500' : emp.utilizationPct >= 80 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width: `${Math.min(100, emp.utilizationPct)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-600 w-8">{emp.utilizationPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <PunctualityBadge min={emp.avgPunctualityMin} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-xs text-slate-600">
                            {emp.vacationDaysUsed}/{emp.vacationDaysTotal} dní
                          </span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 ml-auto">
                            <div
                              className="h-full bg-violet-400 rounded-full"
                              style={{ width: `${Math.min(100, (emp.vacationDaysUsed / emp.vacationDaysTotal) * 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Work type breakdown */}
          {data.workTypeBreakdown.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-slate-800 mb-5">Rozložení hodin dle kategorie</h3>
              <div className="space-y-3">
                {data.workTypeBreakdown.map((wt, i) => {
                  const maxH = data.workTypeBreakdown[0].hours;
                  const COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#f97316','#ef4444','#06b6d4'];
                  const color = COLORS[i % COLORS.length];
                  return (
                    <div key={wt.name} className="flex items-center gap-3">
                      <span className="text-sm text-slate-600 w-24 truncate shrink-0">{wt.name}</span>
                      <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all"
                          style={{ width: `${maxH > 0 ? (wt.hours / maxH) * 100 : 0}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-sm font-mono text-slate-700 w-14 text-right shrink-0">{wt.hours}h</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
    </div>
  );
}
