'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import { useT } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  department: string | null;
}

interface WorkPlanEntry {
  id: string;
  date: string;
  employeeId: string;
  workType: string | null;
  workTypeName: string | null;
  workTypeColor: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface WorkType {
  id: string;
  name: string;
  color: string | null;
  sort_order: number | null;
}

interface Suggestion {
  id: string;
  employeeName: string;
  timeLabel: string;
  suggestionType: 'FULL_DAY_STORE' | 'CLOSING_ASSIST';
  score: number;
}

interface AnalyzedDay {
  date: string;
  dateLabel: string;
  dayName: string;
  requiredTotal: number;
  assignedCount: number;
  missingCount: number;
  status: 'OK' | 'MISSING' | 'CLOSED';
  statusLabel: string;
  suggestions: Suggestion[];
  recommendedSuggestionIds: string[];
}

interface AssistantResult {
  ok: boolean;
  month: string;
  summary: {
    totalDays: number;
    problemDays: number;
    recommendedCount: number;
  };
  problemDays: AnalyzedDay[];
}

interface DraftEntry {
  suggId: string;
  timeLabel: string;
  type: 'FULL_DAY_STORE' | 'CLOSING_ASSIST';
}

interface ShiftAssistantMatrixProps {
  orgId: string;
  month: string;
  onMonthChange?: (month: string) => void;
  onOpenNotifications?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Leden','Únor','Březen','Duben','Květen','Červen',
  'Červenec','Srpen','Září','Říjen','Listopad','Prosinec',
];
const DAY_ABBREVS = ['Ne','Po','Út','St','Čt','Pá','So'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllDaysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) =>
    `${month}-${String(i + 1).padStart(2, '0')}`
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div className="fixed top-4 right-4 z-[200] flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-xl">
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
      </svg>
      {message}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ShiftAssistantMatrix({
  orgId,
  month,
  onMonthChange,
  onOpenNotifications,
}: ShiftAssistantMatrixProps) {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlanEntry[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Assistant state ─────────────────────────────────────────────────────────
  const [analyzeResult, setAnalyzeResult] = useState<AssistantResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // empId|date → draft info
  const [pendingDrafts, setPendingDrafts] = useState<Map<string, DraftEntry>>(new Map());

  // ── LocalStorage draft key ──────────────────────────────────────────────────
  const draftStorageKey = `sa_draft_${orgId}_${month}`;

  // Load saved drafts + analyzeResult from localStorage on mount / month change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const { result, drafts } = JSON.parse(saved) as {
          result: AssistantResult;
          drafts: [string, DraftEntry][];
        };
        setAnalyzeResult(result);
        setPendingDrafts(new Map(drafts));
      } else {
        setAnalyzeResult(null);
        setPendingDrafts(new Map());
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey]);

  // Helper: persist drafts to localStorage
  const saveDraftsToStorage = useCallback((result: AssistantResult, drafts: Map<string, DraftEntry>) => {
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify({
        result,
        drafts: Array.from(drafts.entries()),
      }));
    } catch { /* ignore */ }
  }, [draftStorageKey]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const [y, m] = month.split('-').map(Number);
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`;
  const allDays = useMemo(() => getAllDaysInMonth(month), [month]);

  const wtColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const wt of workTypes) {
      if (wt.name && wt.color) map.set(wt.name, wt.color);
      if (wt.id && wt.color) map.set(wt.id, wt.color);
    }
    return map;
  }, [workTypes]);

  const plansMap = useMemo(() => {
    const map = new Map<string, WorkPlanEntry[]>();
    for (const p of workPlans) {
      const key = `${p.employeeId}|${p.date}`;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [workPlans]);

  const crisisDays = useMemo(() => {
    if (!analyzeResult) return new Set<string>();
    return new Set(analyzeResult.problemDays.map(d => d.date));
  }, [analyzeResult]);

  // Per-day crisis info from analyze result for the column header badge
  const crisisMeta = useMemo(() => {
    const map = new Map<string, { missing: number; eveningMissing: number }>();
    if (!analyzeResult) return map;
    for (const d of analyzeResult.problemDays) {
      const eveningMissing = (d as unknown as Record<string, unknown>).closingCoverage
        ? ((d as unknown as Record<string, { missingStaff?: number }>).closingCoverage?.missingStaff ?? 0)
        : 0;
      map.set(d.date, {
        missing: d.missingCount ?? 0,
        eveningMissing,
      });
    }
    return map;
  }, [analyzeResult]);

  const deptColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const wt of workTypes) {
      if (wt.name && wt.color) map.set(wt.name, wt.color);
    }
    return map;
  }, [workTypes]);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, plansRes, wtRes] = await Promise.all([
        managerFetch('/api/employees').then(r => r.json()),
        fetch(`/api/public/schedule?orgId=${encodeURIComponent(orgId)}&month=${encodeURIComponent(month)}`).then(r => r.json()),
        fetch(`/api/public/work-types?orgId=${encodeURIComponent(orgId)}`).then(r => r.json()),
      ]);
      const empList: Employee[] = Array.isArray(empRes) ? empRes : (empRes.employees ?? []);
      setEmployees(empList);
      setWorkPlans(plansRes.workPlans ?? []);
      setWorkTypes(wtRes.workTypes ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [orgId, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setAnalyzeResult(null);
    setPendingDrafts(new Map());
    setAnalyzeError(null);
    setApplyError(null);
  }, [month]);

  // ── Analyze ─────────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await managerFetch(`/api/shift-assistant/analyze?month=${encodeURIComponent(month)}`);
      const data: AssistantResult & { error?: string } = await res.json();
      if (!res.ok || data.error) {
        setAnalyzeError(data.error ?? t('Chyba analýzy', 'Analysis error'));
        return;
      }
      setAnalyzeResult(data);

      // Build pendingDrafts from recommended suggestion IDs
      // ID format: date__empId__TYPE
      const drafts = new Map<string, DraftEntry>();
      for (const day of data.problemDays) {
        for (const suggId of day.recommendedSuggestionIds) {
          const parts = suggId.split('__');
          if (parts.length < 2) continue;
          const empId = parts[1];
          const sugg = day.suggestions.find(s => s.id === suggId);
          if (!sugg) continue;
          const key = `${empId}|${day.date}`;
          if (!drafts.has(key)) {
            drafts.set(key, {
              suggId,
              timeLabel: sugg.timeLabel,
              type: sugg.suggestionType,
            });
          }
        }
      }
      setPendingDrafts(drafts);
      saveDraftsToStorage(data, drafts);
    } catch {
      setAnalyzeError(t('Síťová chyba', 'Network error'));
    } finally {
      setAnalyzing(false);
    }
  }, [month, t, saveDraftsToStorage]);

  // ── Apply a single suggestion ────────────────────────────────────────────────
  const [applyingSingle, setApplyingSingle] = useState<string | null>(null);

  const handleApplySingle = useCallback(async (suggId: string) => {
    setApplyingSingle(suggId);
    setApplyError(null);
    try {
      const res = await managerFetch('/api/shift-assistant/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIds: [suggId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyError(data.error ?? t('Chyba při aplikaci', 'Apply error'));
        return;
      }
      setToast(t('Směna přidána', 'Shift added'));
      // Remove this single draft from state
      setPendingDrafts(prev => {
        const next = new Map(prev);
        const keyToDelete = Array.from(next.entries()).find(([, e]) => e.suggId === suggId)?.[0];
        if (keyToDelete) next.delete(keyToDelete);
        // Also update stored analyzeResult recommendedSuggestionIds
        if (analyzeResult) {
          const updatedResult: AssistantResult = {
            ...analyzeResult,
            problemDays: analyzeResult.problemDays.map(d => ({
              ...d,
              recommendedSuggestionIds: d.recommendedSuggestionIds.filter(id => id !== suggId),
            })),
          };
          saveDraftsToStorage(updatedResult, next);
        }
        return next;
      });
      fetchData();
    } catch {
      setApplyError(t('Síťová chyba', 'Network error'));
    } finally {
      setApplyingSingle(null);
    }
  }, [t, analyzeResult, saveDraftsToStorage, fetchData]);

  // ── Remove a single draft (dismiss without applying) ─────────────────────────
  const handleDismissSingle = useCallback((suggId: string) => {
    setPendingDrafts(prev => {
      const next = new Map(prev);
      const keyToDelete = Array.from(next.entries()).find(([, e]) => e.suggId === suggId)?.[0];
      if (keyToDelete) next.delete(keyToDelete);
      if (analyzeResult) {
        const updatedResult: AssistantResult = {
          ...analyzeResult,
          problemDays: analyzeResult.problemDays.map(d => ({
            ...d,
            recommendedSuggestionIds: d.recommendedSuggestionIds.filter(id => id !== suggId),
          })),
        };
        saveDraftsToStorage(updatedResult, next);
      }
      return next;
    });
  }, [analyzeResult, saveDraftsToStorage]);

  // ── Apply all recommendations ────────────────────────────────────────────────
  const handleApplyAll = useCallback(async () => {
    if (!analyzeResult) return;
    const ids = Array.from(pendingDrafts.values()).map(d => d.suggId);
    if (!ids.length) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await managerFetch('/api/shift-assistant/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyError(data.error ?? t('Chyba při aplikaci', 'Apply error'));
        return;
      }
      const appliedCount: number = Array.isArray(data.applied) ? data.applied.length : ids.length;
      setToast(`${appliedCount} ${t('směn přidáno', 'shifts added')}`);
      setAnalyzeResult(null);
      setPendingDrafts(new Map());
      try { localStorage.removeItem(draftStorageKey); } catch { /* ignore */ }
      fetchData();
    } catch {
      setApplyError(t('Síťová chyba', 'Network error'));
    } finally {
      setApplying(false);
    }
  }, [analyzeResult, pendingDrafts, t, fetchData, draftStorageKey]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        {t('Načítám…', 'Loading…')}
      </div>
    );
  }

  const DRAFT_COLORS: Record<string, string> = {
    FULL_DAY_STORE: '#2563EB',
    CLOSING_ASSIST: '#7C3AED',
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0">
        <button
          onClick={() => onMonthChange?.(shiftMonth(month, -1))}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          aria-label="Předchozí měsíc"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">{monthLabel}</span>
        <button
          onClick={() => onMonthChange?.(shiftMonth(month, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          aria-label="Následující měsíc"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="flex-1" />

        {analyzeResult && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">
              {analyzeResult.summary.totalDays} {t('prac. dnů', 'work days')}
            </span>
            {analyzeResult.summary.problemDays > 0 ? (
              <span className="font-semibold text-red-600">
                ⚠ {analyzeResult.summary.problemDays} {t('krizových', 'crisis')}
              </span>
            ) : (
              <span className="font-semibold text-emerald-600">✓ {t('Vše obsazeno', 'All covered')}</span>
            )}
            {pendingDrafts.size > 0 && (
              <span className="font-semibold text-indigo-600">
                {pendingDrafts.size} {t('návrhů', 'drafts')}
              </span>
            )}
          </div>
        )}

        <div className="text-[10px] text-slate-400 font-medium hidden sm:block">
          {employees.length} {t('zaměstnanců', 'employees')} · {allDays.length} {t('dnů', 'days')}
        </div>
      </div>

      {/* ── Body: matrix + sidepanel ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Scrollable matrix ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          <table
            className="border-collapse text-xs"
            style={{ tableLayout: 'fixed', minWidth: `${168 + allDays.length * 46}px` }}
          >
            <colgroup>
              <col style={{ width: '168px', minWidth: '168px' }} />
              {allDays.map(d => <col key={d} style={{ width: '46px', minWidth: '46px' }} />)}
            </colgroup>

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <thead>
              <tr className="bg-slate-50">
                {/* Sticky corner */}
                <th className="sticky left-0 top-0 z-30 bg-slate-50 border-r border-b border-slate-200 px-2 py-1.5 text-left">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('Zaměstnanec', 'Employee')}
                  </span>
                </th>

                {allDays.map(date => {
                  const dateObj = new Date(date + 'T00:00:00');
                  const dow = dateObj.getDay();
                  const dayNum = parseInt(date.slice(8), 10);
                  const dayAbbr = DAY_ABBREVS[dow];
                  const isToday = date === today;
                  const isCrisis = crisisDays.has(date);
                  const isWeekend = dow === 0 || dow === 6;
                  const crisis = crisisMeta.get(date);

                  // Build crisis badge: show total missing (prodejna + evening)
                  const totalMissing = crisis ? crisis.missing + crisis.eveningMissing : 0;
                  const crisisBadge = totalMissing > 0 ? `−${totalMissing}` : null;

                  return (
                    <th
                      key={date}
                      className={`sticky top-0 z-20 px-0.5 py-1 text-center border-r border-b font-medium transition-colors ${
                        isCrisis
                          ? 'bg-red-50 border-slate-200'
                          : isToday
                          ? 'bg-blue-50 border-slate-200'
                          : isWeekend
                          ? 'bg-slate-100/80 border-slate-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className={`text-[12px] font-bold leading-none ${
                        isCrisis ? 'text-red-600' : isToday ? 'text-blue-600' : isWeekend ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {dayNum}
                      </div>
                      <div className="text-[8px] font-medium text-slate-400 leading-none mt-0.5">{dayAbbr}</div>
                      {isCrisis && crisisBadge && (
                        <div className="text-[7px] font-bold bg-red-500 text-white rounded px-0.5 leading-tight mt-0.5 mx-0.5 whitespace-nowrap">
                          {crisisBadge}
                        </div>
                      )}
                      {!isCrisis && isToday && (
                        <div className="w-1 h-1 rounded-full bg-blue-500 mx-auto mt-0.5" />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* ── Body ────────────────────────────────────────────────────────── */}
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td colSpan={allDays.length + 1} className="py-12 text-center text-slate-400 text-sm">
                    {t('Žádní zaměstnanci', 'No employees')}
                  </td>
                </tr>
              )}
              {employees.map((emp, ri) => {
                const deptColor = emp.department ? deptColorMap.get(emp.department) : null;

                return (
                  <tr
                    key={emp.id}
                    className={`border-b border-slate-100 group transition-colors duration-75 ${
                      ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    } hover:bg-blue-50/50`}
                  >
                    {/* Sticky name column */}
                    <td className="sticky left-0 z-10 px-2 py-0.5 border-r border-slate-200 bg-inherit group-hover:bg-blue-50/60 transition-colors duration-75">
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className="text-[10px] font-semibold text-slate-700 truncate leading-snug"
                          title={emp.name}
                        >
                          {emp.name}
                        </span>
                        {emp.department && deptColor && (
                          <span
                            className="flex-shrink-0 text-[8px] font-bold text-black px-1 py-0.5 rounded-full whitespace-nowrap leading-none"
                            style={{ background: deptColor + '35' }}
                          >
                            {emp.department}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Day cells */}
                    {allDays.map(date => {
                      const key = `${emp.id}|${date}`;
                      const entries = plansMap.get(key) ?? [];
                      const draft = pendingDrafts.get(key);
                      const isCrisis = crisisDays.has(date);
                      const dow = new Date(date + 'T00:00:00').getDay();
                      const isWeekend = dow === 0 || dow === 6;

                      return (
                        <td
                          key={date}
                          className={`px-0.5 py-0.5 border-r border-slate-100 align-middle transition-colors duration-75 group-hover:bg-blue-50/20 ${
                            isCrisis ? 'bg-red-50/20' : isWeekend ? 'bg-slate-50/60' : ''
                          }`}
                          style={{ height: '28px' }}
                        >
                          <div className="flex flex-col gap-0.5 h-full justify-center">
                            {entries.map(entry => {
                              const color =
                                entry.workTypeColor ??
                                wtColorMap.get(entry.workTypeName ?? '') ??
                                '#94a3b8';
                              const label = (entry.workTypeName ?? entry.workType ?? '?')
                                .slice(0, 3)
                                .toUpperCase();
                              return (
                                <div
                                  key={entry.id}
                                  className="flex items-center justify-center rounded leading-none"
                                  style={{
                                    background: color + '22',
                                    borderLeft: `2px solid ${color}`,
                                    minHeight: '18px',
                                  }}
                                  title={`${entry.workTypeName ?? entry.workType}${entry.startTime ? ` ${entry.startTime}–${entry.endTime}` : ''}`}
                                >
                                  <span
                                    className="text-[8px] font-bold px-0.5"
                                    style={{ color }}
                                  >
                                    {label}
                                  </span>
                                </div>
                              );
                            })}

                            {/* Draft overlay — empty cell (FDS) or alongside existing shift (CA) */}
                            {entries.length === 0 && draft && (
                              <div
                                className="flex flex-col items-center justify-center rounded leading-none gap-0"
                                style={{
                                  background: DRAFT_COLORS[draft.type] + '2e',
                                  border: `2px dashed ${DRAFT_COLORS[draft.type]}`,
                                  boxShadow: `inset 0 0 0 1px ${DRAFT_COLORS[draft.type]}18`,
                                  minHeight: '22px',
                                }}
                                title={`AI ${draft.type === 'CLOSING_ASSIST' ? 'Večerní' : 'Prodejna'}: ${draft.timeLabel || ''}`}
                              >
                                <span
                                  className="text-[8px] font-extrabold leading-none"
                                  style={{ color: DRAFT_COLORS[draft.type] }}
                                >
                                  {draft.type === 'CLOSING_ASSIST' ? 'CA' : 'PRO'}
                                </span>
                                {draft.timeLabel && (
                                  <span className="text-[7px] leading-none mt-0.5" style={{ color: DRAFT_COLORS[draft.type] + 'cc' }}>
                                    {draft.timeLabel.replace(/:00/g, '').slice(0, 8)}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* CA draft badge on top of existing shift (employee extending into evening) */}
                            {entries.length > 0 && draft?.type === 'CLOSING_ASSIST' && (
                              <div
                                className="flex items-center justify-center rounded-sm leading-none"
                                style={{
                                  background: DRAFT_COLORS.CLOSING_ASSIST + '2a',
                                  border: `1.5px dashed ${DRAFT_COLORS.CLOSING_ASSIST}`,
                                  minHeight: '10px',
                                }}
                                title={`AI Večerní: ${draft.timeLabel}`}
                              >
                                <span className="text-[6px] font-extrabold" style={{ color: DRAFT_COLORS.CLOSING_ASSIST }}>
                                  +CA
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Sidepanel ──────────────────────────────────────────────────────── */}
        <aside className="w-72 border-l border-slate-200 flex flex-col overflow-hidden bg-slate-50 shrink-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="text-base">🤖</span>
              {t('Asistent směn', 'Shift Assistant')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Puzzle Matice · {monthLabel}
            </p>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                analyzing
                  ? 'bg-indigo-100 text-indigo-400 cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[.98] text-white shadow-indigo-200'
              }`}
            >
              {analyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  {t('Analyzuji…', 'Analyzing…')}
                </>
              ) : (
                <>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                    <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {t('Dopočítat vše', 'Analyze coverage')}
                </>
              )}
            </button>

            {analyzeError && (
              <div className="bg-red-50 text-red-700 text-xs px-3 py-2.5 rounded-xl border border-red-200 leading-relaxed">
                {analyzeError}
              </div>
            )}

            {/* Results */}
            {analyzeResult && (
              <>
                {/* Summary card */}
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-slate-500">{t('Pracovní dny', 'Work days')}</span>
                    <span className="font-semibold text-slate-700">{analyzeResult.summary.totalDays}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-slate-500">{t('Krizové dny', 'Crisis days')}</span>
                    <span className={`font-bold ${analyzeResult.summary.problemDays > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {analyzeResult.summary.problemDays}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-indigo-500">{t('AI návrhy', 'AI drafts')}</span>
                    <span className="font-bold text-indigo-600">{pendingDrafts.size}</span>
                  </div>
                </div>

                {/* Apply button */}
                {pendingDrafts.size > 0 && (
                  <div className="space-y-1.5">
                    <button
                      onClick={handleApplyAll}
                      disabled={applying}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        applying
                          ? 'bg-emerald-100 text-emerald-400 cursor-wait'
                          : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[.98] text-white shadow-sm'
                      }`}
                    >
                      {applying ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                          {t('Aplikuji…', 'Applying…')}
                        </span>
                      ) : (
                        `✓ ${t('Použít', 'Apply')} ${pendingDrafts.size} ${t('návrhů', 'drafts')}`
                      )}
                    </button>
                    {applyError && (
                      <p className="text-xs text-red-600 text-center px-1">{applyError}</p>
                    )}
                  </div>
                )}

                {/* Crisis day list */}
                {analyzeResult.problemDays.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      {t('Krizové dny', 'Crisis days')}
                    </p>
                    <div className="space-y-1.5">
                      {analyzeResult.problemDays.map(day => {
                        const recommended = day.suggestions.filter(s =>
                          day.recommendedSuggestionIds.includes(s.id)
                        );
                        return (
                        <div
                          key={day.date}
                          className="bg-white rounded-lg border border-red-100 overflow-hidden"
                        >
                          {/* Day header */}
                          <div className="flex items-start gap-2 px-2.5 py-2">
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex flex-col items-center justify-center flex-shrink-0 border border-red-100">
                              <span className="text-[11px] font-bold text-red-600 leading-none">
                                {parseInt(day.date.slice(8), 10)}
                              </span>
                              <span className="text-[8px] text-red-400 leading-none">
                                {DAY_ABBREVS[new Date(day.date + 'T00:00:00').getDay()]}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-semibold text-slate-700 leading-tight">
                                {day.statusLabel}
                              </div>
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                {day.assignedCount}/{day.requiredTotal} {t('obsazeno', 'assigned')} ·{' '}
                                {recommended.length} {t('navrhov.', 'suggested')}
                              </div>
                            </div>
                          </div>
                          {/* Candidate list */}
                          {recommended.length > 0 && (
                            <div className="border-t border-slate-100 divide-y divide-slate-50">
                              {recommended.map(sugg => {
                                const color = sugg.suggestionType === 'CLOSING_ASSIST'
                                  ? '#7C3AED' : '#2563EB';
                                const initials = sugg.employeeName
                                  .split(' ').filter(Boolean).slice(0, 2)
                                  .map(n => n[0]).join('').toUpperCase();
                                const isSingleApplying = applyingSingle === sugg.id;
                                return (
                                  <div key={sugg.id} className="flex items-center gap-1.5 px-2.5 py-1.5">
                                    <div
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0"
                                      style={{ background: color }}
                                    >
                                      {initials}
                                    </div>
                                    <span className="text-[10px] font-medium text-slate-700 truncate flex-1 min-w-0">
                                      {sugg.employeeName}
                                    </span>
                                    <span
                                      className="text-[8px] font-semibold shrink-0 px-1 py-0.5 rounded"
                                      style={{ background: color + '18', color }}
                                    >
                                      {sugg.suggestionType === 'CLOSING_ASSIST'
                                        ? (sugg.timeLabel || '17–19')
                                        : 'PRO'}
                                    </span>
                                    {/* Dismiss button */}
                                    <button
                                      type="button"
                                      onClick={() => handleDismissSingle(sugg.id)}
                                      className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                                      title={t('Odebrat návrh', 'Dismiss')}
                                    >
                                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M2 2l8 8M10 2l-8 8"/>
                                      </svg>
                                    </button>
                                    {/* Apply single button */}
                                    <button
                                      type="button"
                                      onClick={() => handleApplySingle(sugg.id)}
                                      disabled={isSingleApplying || applying}
                                      className="w-5 h-5 flex items-center justify-center rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors flex-shrink-0"
                                      title={t('Potvrdit tuto směnu', 'Confirm this shift')}
                                    >
                                      {isSingleApplying ? (
                                        <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth="2.5">
                                          <path d="M2 6l3 3 5-5"/>
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-4 text-center">
                    <div className="text-2xl mb-1.5">✓</div>
                    <p className="text-xs font-semibold text-emerald-700">
                      {t('Vše je obsazeno!', 'All days covered!')}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      {t('Žádné krizové dny', 'No crisis days')}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Legend (shown before analyze) */}
            {!analyzeResult && !analyzing && (
              <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('Legenda', 'Legend')}
                </p>
                <div className="space-y-2">
                  {[
                    { color: '#2563EB', label: t('Potvrzená směna', 'Confirmed shift'), dashed: false },
                    { color: '#7C3AED', label: t('AI návrh (CA)', 'AI draft (closing)'), dashed: true },
                    { color: '#2563EB', label: t('AI návrh (FDS)', 'AI draft (full day)'), dashed: true },
                    { color: '#ef4444', label: t('Krizový den', 'Crisis day'), isSquare: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      {item.isSquare ? (
                        <div className="w-6 h-3 rounded flex-shrink-0 bg-red-50 border border-red-200" />
                      ) : (
                        <div
                          className="w-6 h-3 rounded flex-shrink-0"
                          style={{
                            background: item.color + (item.dashed ? '14' : '22'),
                            border: item.dashed ? `1.5px dashed ${item.color}` : `2px solid ${item.color}33`,
                            borderLeft: `2px solid ${item.color}`,
                          }}
                        />
                      )}
                      <span className="text-[10px] text-slate-500 leading-tight">{item.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-100 leading-relaxed">
                  {t(
                    'Kliknutím na „Dopočítat vše" asistent navrhne doplnění krizových dnů. AI návrhy jsou zobrazeny přerušovanou čarou a lze je hromadně potvrdit.',
                    'Click "Analyze coverage" to let the assistant suggest shifts for crisis days. AI drafts appear with a dashed border and can be applied in bulk.',
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Notifications button */}
          {onOpenNotifications && (
            <div className="px-3 py-2.5 border-t border-slate-200 shrink-0">
              <button
                onClick={onOpenNotifications}
                className="w-full py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('Notifikace zaměstnancům', 'Notify employees')}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
