'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { managerFetch } from '@/lib/managerFetch';
import { useLang } from '@/lib/i18n';

interface EmployeeStat {
  id: string;
  name: string;
  department: string | null;
  workedHours: number;
  plannedHours: number;
  targetHours: number;
  utilizationPct: number;
  daysWorked: number;
  daysPlanned: number;
  avgPunctualityMin: number | null;
  overtimeHours: number;
  debtHours: number;
  vacationDaysTotal: number;
  vacationDaysUsed: number;
  vacationDaysRemaining: number;
  saturdayHours?: number;
  saturdayBonusHours?: number;
  workTypes?: WorkTypeBreakdown[];
}

interface WorkTypeBreakdown { name: string; hours: number; }

interface AnalyticsData {
  month: string;
  stats: EmployeeStat[];
  workTypeBreakdown: WorkTypeBreakdown[];
}

interface TrendPoint {
  month: string;
  monthLabel: string;
  workedHours: number;
  targetHours: number;
  utilizationPct: number;
}

interface WeekdayPoint {
  day: string;
  avgLateMin: number;
  sampleCount: number;
}

interface DailyPoint {
  date: string;
  dayLabel: string;
  isWeekend: boolean;
  plannedHours: number;
  workedHours: number;
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

function balanceColor(delta: number) {
  if (delta > 16) return '#ef4444';
  if (delta >= 0) return '#22c55e';
  if (delta > -16) return '#f59e0b';
  return '#ef4444';
}

function weekdayColor(avg: number, count: number) {
  if (count < 3) return '#e2e8f0';
  if (avg > 10) return '#ef4444';
  if (avg > 0) return '#f59e0b';
  return '#22c55e';
}

function PunctualityBadge({ min }: { min: number | null }) {
  if (min === null) return <span className="text-slate-300 text-xs">—</span>;
  const abs = Math.abs(min);
  const label = min <= 0 ? `${abs}m dříve` : `${abs}m pozdě`;
  const color = min <= 0 ? 'text-emerald-600 bg-emerald-50' : min <= 10 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>;
}

function SummaryCard({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color: string; sub?: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartShell({ title, badge, children, minH = 240 }: { title: string; badge?: React.ReactNode; children: React.ReactNode; minH?: number }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {badge}
      </div>
      <div style={{ minHeight: minH }}>{children}</div>
    </section>
  );
}

const EXPORT_COLS = [
  { key: 'employmentType', label: 'Pracovní poměr' },
  { key: 'source',         label: 'Zdroj dat' },
  { key: 'workedHours',   label: 'Odpracováno (h)' },
  { key: 'saturdayHours', label: 'Z toho soboty (h)' },
  { key: 'satBonusHours', label: 'Bonus soboty (h)' },
  { key: 'otBonusHours',  label: 'Bonus přesčas (h)' },
  { key: 'benefits',      label: 'Benefity (h)' },
  { key: 'totalBonusHours', label: 'Bonus celkem (h)' },
  { key: 'finalHours',    label: 'Výsledek (h)' },
  { key: 'targetHours',   label: 'Fond hodin (h)' },
  { key: 'delta',         label: 'Rozdíl (h)' },
  { key: 'vacDays',       label: 'Dovolená čerpáno (dní)' },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, unit = 'h' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs space-y-1 min-w-[140px]">
      {label && <p className="font-semibold text-slate-700 mb-2">{label}</p>}
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-slate-500">{p.name}</span>
          </span>
          <span className="font-mono font-semibold text-slate-800">{p.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard({ orgId }: { orgId: string }) {
  const { lang } = useLang();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [activeView, setActiveView] = useState<'overview' | 'benefits'>('overview');
  const [month, setMonth] = useState(currentMonth);
  const [selectedDept, setSelectedDept] = useState('Prodejna');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [weekdayData, setWeekdayData] = useState<WeekdayPoint[]>([]);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [weekdayLoading, setWeekdayLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportEmpIds, setExportEmpIds] = useState<Set<string>>(new Set());
  const [exportColKeys, setExportColKeys] = useState<Set<string>>(new Set<string>(EXPORT_COLS.map((c) => c.key)));
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [nameSearch, setNameSearch] = useState('');
  // allDepts: fetched once at mount from unfiltered response so dropdown always shows all options
  const [allDepts, setAllDepts] = useState<string[]>([]);

  useEffect(() => {
    managerFetch(`/api/analytics?month=${currentMonth}`)
      .then((r) => r.json())
      .then((d: AnalyticsData) => {
        const seen = new Set<string>();
        const list: string[] = [];
        for (const s of d.stats) {
          if (s.department && !seen.has(s.department)) { seen.add(s.department); list.push(s.department); }
        }
        setAllDepts(list.sort());
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch main stats with dept filter so workTypeBreakdown is also scoped to dept
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dept = selectedDept !== '__all__' ? `&department=${encodeURIComponent(selectedDept)}` : '';
      const res = await managerFetch(`/api/analytics?month=${month}${dept}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [month, selectedDept]);

  // Fetch trend (server-side dept filter for 12-month aggregation)
  const fetchTrend = useCallback(async () => {
    setTrendLoading(true);
    try {
      const dept = selectedDept !== '__all__' ? `&department=${encodeURIComponent(selectedDept)}` : '';
      const res = await managerFetch(`/api/analytics/trend?month=${month}${dept}`);
      if (res.ok) setTrendData(await res.json());
    } catch { /* ignore */ }
    finally { setTrendLoading(false); }
  }, [month, selectedDept]);

  // Fetch daily plan vs worked for current month
  const fetchDaily = useCallback(async () => {
    setDailyLoading(true);
    try {
      const dept = selectedDept !== '__all__' ? `&department=${encodeURIComponent(selectedDept)}` : '';
      const res = await managerFetch(`/api/analytics/daily?month=${month}${dept}`);
      if (res.ok) setDailyData(await res.json());
    } catch { /* ignore */ }
    finally { setDailyLoading(false); }
  }, [month, selectedDept]);

  // Fetch weekday punctuality (server-side dept filter)
  const fetchWeekday = useCallback(async () => {
    setWeekdayLoading(true);
    try {
      const dept = selectedDept !== '__all__' ? `&department=${encodeURIComponent(selectedDept)}` : '';
      const res = await managerFetch(`/api/analytics/weekday?month=${month}${dept}`);
      if (res.ok) setWeekdayData(await res.json());
    } catch { /* ignore */ }
    finally { setWeekdayLoading(false); }
  }, [month, selectedDept]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchTrend(); }, [fetchTrend]);
  useEffect(() => { fetchWeekday(); }, [fetchWeekday]);
  useEffect(() => { fetchDaily(); }, [fetchDaily]);

  // Reset employee chips when dept changes
  useEffect(() => { setSelectedEmployees(new Set()); }, [selectedDept]);

  // API already filters by dept — client-side only handles employee chips + name search
  const filteredStats = useMemo(() => {
    if (!data) return [];
    return data.stats.filter((s) => {
      if (selectedEmployees.size > 0 && !selectedEmployees.has(s.id)) return false;
      if (nameSearch.trim()) return s.name.toLowerCase().includes(nameSearch.trim().toLowerCase());
      return true;
    });
  }, [data, selectedEmployees, nameSearch]);

  // Chip row shows all employees returned by API (already scoped to dept)
  const deptEmployees = data?.stats ?? [];

  // KPI values from filtered stats
  const totalWorked = filteredStats.reduce((s, e) => s + e.workedHours, 0);
  const totalTarget = filteredStats.reduce((s, e) => s + e.targetHours, 0);
  // Per-shift overtime/debt: time worked past (or before) planned end_time
  const totalOvertime = filteredStats.reduce((s, e) => s + (e.overtimeHours ?? 0), 0);
  const totalDebt = filteredStats.reduce((s, e) => s + (e.debtHours ?? 0), 0);
  const avgUtil = filteredStats.length > 0 ? Math.round(filteredStats.reduce((s, e) => s + e.utilizationPct, 0) / filteredStats.length) : 0;
  const punctVals = filteredStats.map((e) => e.avgPunctualityMin).filter((v) => v !== null) as number[];
  const avgPunct = punctVals.length > 0 ? Math.round(punctVals.reduce((s, v) => s + v, 0) / punctVals.length) : null;

  // Balance data for horizontal bar chart — per-shift delta (overtime − debt per person)
  const balanceData = useMemo(() =>
    filteredStats
      .map((e) => ({
        name: e.name,
        firstName: e.name.split(' ')[0],
        delta: Math.round(((e.overtimeHours ?? 0) - (e.debtHours ?? 0)) * 10) / 10,
      }))
      .sort((a, b) => b.delta - a.delta),
    [filteredStats]
  );

  // Rozložení hodin dle kategorie — respektuje filtr zaměstnance (sečteno přes filteredStats)
  const workTypeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredStats) {
      for (const wt of s.workTypes ?? []) {
        map.set(wt.name, (map.get(wt.name) ?? 0) + wt.hours);
      }
    }
    return Array.from(map.entries())
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredStats]);

  const [y, mo] = month.split('-').map(Number);
  const monthLabel = `${CZ_MONTHS[mo - 1]} ${y}`;

  const openExportModal = () => {
    setExportEmpIds(new Set((data?.stats ?? []).map((s) => s.id)));
    setExportColKeys(new Set<string>(EXPORT_COLS.map((c) => c.key)));
    setShowExportModal(true);
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const emps = Array.from(exportEmpIds).join(',');
      const cols = Array.from(exportColKeys).join(',');
      const params = new URLSearchParams({ month, lang });
      if (emps) params.set('employees', emps);
      if (cols) params.set('cols', cols);
      const res = await managerFetch(`/api/analytics/export?${params.toString()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${month}${lang === 'en' ? '-en' : ''}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch { /* ignore */ }
    finally { setExportLoading(false); }
  };

  return (
    <div className="w-full px-6 py-5 space-y-6">

      {/* ── View tab switcher ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveView('overview')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeView === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          📊 Přehled
        </button>
        <button onClick={() => setActiveView('benefits')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeView === 'benefits' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          🏋️ Benefity
        </button>
      </div>

      {activeView === 'benefits' && <BenefitEntriesView month={month} setMonth={setMonth} prevMonth={prevMonth} nextMonth={nextMonth} monthLabel={monthLabel} />}

      {activeView === 'overview' && <>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Month navigator */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1">
          <button onClick={() => setMonth(prevMonth(month))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[148px] text-center px-1">{monthLabel}</span>
          <button onClick={() => setMonth(nextMonth(month))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* Department filter */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none cursor-pointer font-medium text-slate-700"
          >
            <option value="__all__">Všechna oddělení</option>
            {allDepts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
            {/* Show selectedDept immediately even before allDepts loads */}
            {selectedDept !== '__all__' && !allDepts.includes(selectedDept) && (
              <option value={selectedDept}>{selectedDept}</option>
            )}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Name search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="Hledat zaměstnance…"
            className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
          />
        </div>

        <button
          onClick={openExportModal}
          disabled={loading}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* ── Employee chips ── */}
      {data && deptEmployees.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500 font-medium shrink-0">Zaměstnanec:</span>
          <button
            onClick={() => setSelectedEmployees(new Set())}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${selectedEmployees.size === 0 ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
          >
            Všichni
          </button>
          {deptEmployees.map((emp) => {
            const active = selectedEmployees.has(emp.id);
            return (
              <button
                key={emp.id}
                onClick={() => setSelectedEmployees((prev) => {
                  const next = new Set(prev);
                  if (active) next.delete(emp.id); else next.add(emp.id);
                  return next;
                })}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}
              >
                {emp.name}
              </button>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Načítám analytiku…</div>
      )}

      {!loading && data && (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Zaměstnanců" value={String(filteredStats.length)} icon="👥" color="bg-blue-50 border-blue-100"
              sub={selectedDept !== '__all__' ? selectedDept : undefined} />
            <SummaryCard label="Odpracováno / Fond" icon="⏱️" color="bg-violet-50 border-violet-100"
              value={`${totalWorked.toFixed(0)}h`}
              sub={totalTarget > 0 ? `z ${totalTarget}h (${avgUtil}%)` : undefined} />
            <SummaryCard label="Přesčasy / Dluhy" icon="📊" color={totalOvertime > totalDebt ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}
              value={`+${totalOvertime.toFixed(0)}h / -${totalDebt.toFixed(0)}h`}
              sub="přesčasy / dluh" />
            <SummaryCard label="Prům. dochvilnost" icon="🕐" color="bg-slate-50 border-slate-100"
              value={avgPunct === null ? '—' : avgPunct <= 0 ? `${Math.abs(avgPunct)}m dříve` : `${avgPunct}m pozdě`}
              sub={punctVals.length > 0 ? `${punctVals.length} měření` : undefined} />
          </div>

          {/* ── Graf 1: Denní přehled hodin (plán vs odpracováno) ── */}
          <ChartShell
            title="Denní přehled hodin"
            badge={
              <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
                {monthLabel} · {selectedDept !== '__all__' ? selectedDept : 'vše'}
              </span>
            }
            minH={220}
          >
            {dailyLoading ? (
              <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">Načítám…</div>
            ) : dailyData.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-slate-300 text-sm">Žádná data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={dailyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="dayLabel"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false}
                      interval={1}
                    />
                    <YAxis unit="h" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip content={<CustomTooltip unit="h" />} />
                    <Bar dataKey="workedHours" name="Odpracováno" radius={[3, 3, 0, 0]} maxBarSize={18}>
                      {dailyData.map((d, i) => (
                        <Cell key={i} fill={d.isWeekend ? '#bfdbfe' : '#3b82f6'} />
                      ))}
                    </Bar>
                    <Line
                      type="stepAfter"
                      dataKey="plannedHours"
                      name="Plán"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                      activeDot={{ r: 4, fill: '#94a3b8' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex gap-5 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-blue-500" />Odpracováno</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-blue-200" />Sobota</span>
                  <span className="flex items-center gap-1.5 ml-1">
                    <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3"/></svg>
                    Plán
                  </span>
                </div>
              </>
            )}
          </ChartShell>

          {/* ── Grafy 2 + 3 v řadě ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Graf 2: Bilance hodin (přesčasy / dluhy) */}
            <ChartShell title="Bilance hodin" badge={
              <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
                přesčas − dluh
              </span>
            } minH={Math.max(160, balanceData.length * 44)}>
              {balanceData.length === 0 ? (
                <div className="flex items-center justify-center h-[160px] text-slate-300 text-sm">Žádná data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(160, balanceData.length * 44)}>
                    <BarChart data={balanceData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis
                        type="number"
                        unit="h"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        domain={[
                          (min: number) => Math.min(-8, Math.floor(min - 2)),
                          (max: number) => Math.max(8, Math.ceil(max + 2)),
                        ]}
                      />
                      <YAxis
                        type="category"
                        dataKey="firstName"
                        tick={{ fontSize: 12, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                        width={64}
                      />
                      <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={1.5} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as { name: string; delta: number };
                          return (
                            <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
                              <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
                              <p className={`font-mono font-bold ${d.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {d.delta >= 0 ? `+${d.delta}h přesčas` : `${d.delta}h dluh`}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="delta" maxBarSize={22} radius={[0, 4, 4, 0]}>
                        {balanceData.map((entry, i) => (
                          <Cell key={i} fill={balanceColor(entry.delta)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-red-400" /> {'>'}+16h riziko vyhoření</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-emerald-500" />0–16h OK</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-amber-400" />dluh do 16h</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-red-400" />{'>'} −16h velký dluh</span>
                  </div>
                </>
              )}
            </ChartShell>

            {/* Graf 3: Dochvilnost po dnech v týdnu */}
            <ChartShell title="Dochvilnost dle dne" badge={
              <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
                3 měsíce · {selectedDept !== '__all__' ? selectedDept : 'vše'}
              </span>
            } minH={200}>
              {weekdayLoading ? (
                <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">Načítám…</div>
              ) : weekdayData.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-slate-300 text-sm">Žádná data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weekdayData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                      <YAxis unit="m" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
                      <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as WeekdayPoint;
                          return (
                            <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
                              <p className="font-semibold text-slate-700 mb-1">{label}</p>
                              {d.sampleCount < 3 ? (
                                <p className="text-slate-400">Nedostatek dat ({d.sampleCount})</p>
                              ) : (
                                <>
                                  <p className={`font-mono font-bold ${d.avgLateMin <= 0 ? 'text-emerald-600' : d.avgLateMin <= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                                    {d.avgLateMin > 0 ? `+${d.avgLateMin}m pozdě` : `${Math.abs(d.avgLateMin)}m dříve`}
                                  </p>
                                  <p className="text-slate-400 mt-0.5">{d.sampleCount} měření</p>
                                </>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="avgLateMin" maxBarSize={40} radius={[4, 4, 0, 0]}>
                        {weekdayData.map((entry, i) => (
                          <Cell key={i} fill={weekdayColor(entry.avgLateMin, entry.sampleCount)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-emerald-500" />včas / dříve</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-amber-400" />0–10m pozdě</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-red-400" /> {'>'}10m pozdě</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-slate-200" />málo dat</span>
                  </div>
                </>
              )}
            </ChartShell>
          </div>

          {/* ── Tabulka zaměstnanců ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Přehled zaměstnanců</h3>
              <span className="text-xs text-slate-400">{filteredStats.length} záznamů</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 font-medium text-slate-500">Zaměstnanec</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500">Oddělení</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Odpracováno</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Fond</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Rozdíl</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Bonus So</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-500">Vytížení</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-500">Dochvilnost</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500">Dovolená</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStats.map((emp) => {
                    const ot = emp.overtimeHours ?? 0;
                    const debt = emp.debtHours ?? 0;
                    const delta = Math.round((ot - debt) * 10) / 10;
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
                        <td className="px-4 py-3.5">
                          {emp.department
                            ? <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-medium">{emp.department}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-700">{emp.workedHours}h</td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-500">{emp.targetHours}h</td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          <span className={delta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                            {delta >= 0 ? '+' : ''}{delta}h
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          {(emp.saturdayBonusHours ?? 0) > 0
                            ? <span className="text-amber-600">+{emp.saturdayBonusHours}h</span>
                            : <span className="text-slate-300">—</span>}
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
                          <span className="text-xs text-slate-600">{emp.vacationDaysUsed}/{emp.vacationDaysTotal} dní</span>
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
                  {filteredStats.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-slate-400 text-sm">
                        Žádní zaměstnanci pro vybraný filtr
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Rozložení dle kategorie práce ── */}
          {workTypeBreakdown.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-slate-800 mb-5">Rozložení hodin dle kategorie</h3>
              <div className="space-y-3">
                {workTypeBreakdown.map((wt, i) => {
                  const maxH = workTypeBreakdown[0].hours;
                  const COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#f97316','#ef4444','#06b6d4'];
                  const color = COLORS[i % COLORS.length];
                  return (
                    <div key={wt.name} className="flex items-center gap-3">
                      <span className="text-sm text-slate-600 w-24 truncate shrink-0">{wt.name}</span>
                      <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                        <div className="h-full rounded-lg transition-all" style={{ width: `${maxH > 0 ? (wt.hours / maxH) * 100 : 0}%`, backgroundColor: color }} />
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

      {/* ── Export Modal ── */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Export CSV</h2>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Body — two columns */}
            <div className="flex-1 overflow-auto p-6 grid grid-cols-2 gap-6">
              {/* Employees */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Zaměstnanci</span>
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={() => setExportEmpIds(new Set((data?.stats ?? []).map((s) => s.id)))} className="text-blue-600 hover:underline">Vše</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={() => setExportEmpIds(new Set())} className="text-slate-400 hover:underline">Žádný</button>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-auto max-h-64 divide-y divide-slate-50">
                  {(data?.stats ?? []).map((emp) => (
                    <label key={emp.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={exportEmpIds.has(emp.id)}
                        onChange={(e) => {
                          const next = new Set(exportEmpIds);
                          if (e.target.checked) next.add(emp.id); else next.delete(emp.id);
                          setExportEmpIds(next);
                        }}
                        className="accent-blue-600 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-slate-700 truncate">{emp.name}</span>
                      {emp.department && <span className="text-xs text-slate-400 ml-auto shrink-0">{emp.department}</span>}
                    </label>
                  ))}
                </div>
                <span className="text-xs text-slate-400">{exportEmpIds.size} / {(data?.stats ?? []).length} vybráno</span>
              </div>

              {/* Columns */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Sloupce</span>
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={() => setExportColKeys(new Set<string>(EXPORT_COLS.map((c) => c.key)))} className="text-blue-600 hover:underline">Vše</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={() => setExportColKeys(new Set())} className="text-slate-400 hover:underline">Žádný</button>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-auto max-h-64 divide-y divide-slate-50">
                  {EXPORT_COLS.map((col) => (
                    <label key={col.key} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={exportColKeys.has(col.key)}
                        onChange={(e) => {
                          const next = new Set(exportColKeys);
                          if (e.target.checked) next.add(col.key); else next.delete(col.key);
                          setExportColKeys(next);
                        }}
                        className="accent-blue-600 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-slate-700">{col.label}</span>
                    </label>
                  ))}
                </div>
                <span className="text-xs text-slate-400">{exportColKeys.size} / {EXPORT_COLS.length} vybráno</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
                Zrušit
              </button>
              <button
                onClick={handleExport}
                disabled={exportLoading || exportEmpIds.size === 0 || exportColKeys.size === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {exportLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {exportLoading ? 'Generuji…' : 'Exportovat CSV'}
              </button>
            </div>
          </div>
        </div>
      )}

      </>}
    </div>
  );
}

// ─── Benefit Entries View ─────────────────────────────────────────────────────

const BE_ICONS: Record<string, string> = { blood: '🩸', english: '🇬🇧', gym: '🏋️' };
const BE_LABELS: Record<string, string> = { blood: 'Darování krve', english: 'Angličtina', gym: 'Cvičení' };

interface BEntry {
  id: string;
  benefit_key: string;
  date: string;
  employees: { name: string; department: string | null } | null;
}

function BenefitEntriesView({ month, setMonth, prevMonth, nextMonth, monthLabel }: {
  month: string;
  setMonth: (m: string) => void;
  prevMonth: (m: string) => string;
  nextMonth: (m: string) => string;
  monthLabel: string;
}) {
  const [entries, setEntries] = useState<BEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterKey, setFilterKey] = useState('all');

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await managerFetch(`/api/manager/benefit-entries?month=${m}`);
      if (res.ok) setEntries((await res.json()).entries ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await managerFetch(`/api/manager/benefit-entries?entryId=${id}`, { method: 'DELETE' });
      if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  const benefitKeys = Array.from(new Set(entries.map((e) => e.benefit_key))).sort();
  const filtered = filterKey === 'all' ? entries : entries.filter((e) => e.benefit_key === filterKey);

  const summary: Record<string, Record<string, number>> = {};
  for (const e of entries) {
    const name = e.employees?.name ?? '—';
    if (!summary[name]) summary[name] = {};
    summary[name][e.benefit_key] = (summary[name][e.benefit_key] ?? 0) + 1;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1">
          <button onClick={() => setMonth(prevMonth(month))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[148px] text-center px-1">{monthLabel}</span>
          <button onClick={() => setMonth(nextMonth(month))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', ...benefitKeys].map((k) => (
            <button key={k} onClick={() => setFilterKey(k)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filterKey === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}>
              {k === 'all' ? 'Vše' : `${BE_ICONS[k] ?? ''} ${BE_LABELS[k] ?? k}`}
            </button>
          ))}
        </div>
      </div>

      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(summary).sort(([a], [b]) => a.localeCompare(b, 'cs')).map(([name, counts]) => (
            <div key={name} className="bg-white rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-700 truncate mb-1.5">{name}</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(counts).map(([k, n]) => (
                  <span key={k} className="inline-flex items-center gap-0.5 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                    {BE_ICONS[k] ?? ''} {n}×
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Záznamy návštěv</span>
          <div className="flex items-center gap-3">
            {loading && <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />}
            <span className="text-xs text-slate-400">{filtered.length} záznamů</span>
          </div>
        </div>
        {filtered.length === 0 && !loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Zatím žádné záznamy. Zaměstnanci je přidají přes Moje hodiny.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <span className="text-lg shrink-0">{BE_ICONS[e.benefit_key] ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{e.employees?.name ?? '—'}</p>
                  <p className="text-xs text-slate-400">{e.employees?.department ?? ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-slate-700">
                    {new Date(e.date + 'T00:00:00').toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-slate-400">{BE_LABELS[e.benefit_key] ?? e.benefit_key}</p>
                </div>
                <button onClick={() => handleDelete(e.id)} disabled={deletingId === e.id}
                  className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  title="Smazat záznam">
                  {deletingId === e.id
                    ? <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
