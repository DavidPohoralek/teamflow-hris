'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import { useT } from '@/lib/i18n';
import { NotifyModal, type NotifyTarget } from './ShiftAssistant';
import ShiftAssistantMatrix from './ShiftAssistantMatrix';

// ─── Types (shared shape with ShiftAssistantMatrix) ──────────────────────────

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
  summary: { totalDays: number; problemDays: number; recommendedCount: number };
  problemDays: AnalyzedDay[];
}

interface DraftEntry {
  suggId: string;
  timeLabel: string;
  type: 'FULL_DAY_STORE' | 'CLOSING_ASSIST';
}

interface Props {
  orgId: string;
  month: string;
  onMonthChange?: (month: string) => void;
  onOpenNotifications?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Leden','Únor','Březen','Duben','Květen','Červen',
  'Červenec','Srpen','Září','Říjen','Listopad','Prosinec',
];
const DAY_ABBREVS = ['Ne','Po','Út','St','Čt','Pá','So'];

function getAllDaysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function fmtShort(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  if (h == null || m == null) return time;
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
}

const DRAFT_COLORS: Record<string, string> = {
  FULL_DAY_STORE: '#2563EB',
  CLOSING_ASSIST: '#7C3AED',
};

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div className="fixed top-4 right-4 z-[200] flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-xl">
      ✓ {message}
    </div>
  );
}

// ─── Planner ─────────────────────────────────────────────────────────────────

function PlannerView({ orgId, month, onMonthChange, onOpenNotifications, onSwitchView }: Props & { onSwitchView: () => void }) {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlanEntry[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);

  const [analyzeResult, setAnalyzeResult] = useState<AssistantResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyingSingle, setApplyingSingle] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<Map<string, DraftEntry>>(new Map());
  const [notifyTarget, setNotifyTarget] = useState<NotifyTarget | null>(null);

  // Same storage key as the matrix view — switching views keeps drafts
  const draftStorageKey = `sa_draft_${orgId}_${month}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const { result, drafts } = JSON.parse(saved) as { result: AssistantResult; drafts: [string, DraftEntry][] };
        setAnalyzeResult(result);
        setPendingDrafts(new Map(drafts));
      } else {
        setAnalyzeResult(null);
        setPendingDrafts(new Map());
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey]);

  const saveDraftsToStorage = useCallback((result: AssistantResult, drafts: Map<string, DraftEntry>) => {
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify({ result, drafts: Array.from(drafts.entries()) }));
    } catch { /* ignore */ }
  }, [draftStorageKey]);

  const allDays = useMemo(() => getAllDaysInMonth(month), [month]);
  const [y, m] = month.split('-').map(Number);
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`;

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [empRes, plansRes, wtRes] = await Promise.all([
        managerFetch('/api/employees').then(r => r.json()),
        fetch(`/api/public/schedule?orgId=${encodeURIComponent(orgId)}&month=${encodeURIComponent(month)}`).then(r => r.json()),
        fetch(`/api/public/work-types?orgId=${encodeURIComponent(orgId)}`).then(r => r.json()),
      ]);
      setEmployees(Array.isArray(empRes) ? empRes : (empRes.employees ?? []));
      setWorkPlans(plansRes.workPlans ?? []);
      setWorkTypes(wtRes.workTypes ?? []);
    } catch { /* ignore */ }
  }, [orgId, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const wtColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const wt of workTypes) if (wt.name && wt.color) map.set(wt.name, wt.color);
    return map;
  }, [workTypes]);

  const empById = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

  // date → entries with employee names, sorted (Prodejna first)
  const staffByDay = useMemo(() => {
    const map = new Map<string, (WorkPlanEntry & { employeeName: string; department: string | null })[]>();
    for (const p of workPlans) {
      const emp = empById.get(p.employeeId);
      const arr = map.get(p.date) ?? [];
      arr.push({ ...p, employeeName: emp?.name ?? '—', department: emp?.department ?? null });
      map.set(p.date, arr);
    }
    for (const arr of Array.from(map.values())) {
      arr.sort((a, b) => {
        const pa = (a.workTypeName ?? '').toLowerCase() === 'prodejna' ? 0 : 1;
        const pb = (b.workTypeName ?? '').toLowerCase() === 'prodejna' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (a.startTime ?? '').localeCompare(b.startTime ?? '');
      });
    }
    return map;
  }, [workPlans, empById]);

  const crisisDays = useMemo(
    () => new Set((analyzeResult?.problemDays ?? []).map(d => d.date)),
    [analyzeResult],
  );

  const sortedEmployees = useMemo(() => {
    const rank = (d: string | null) => !d ? 2 : d.trim().toLowerCase() === 'prodejna' ? 0 : 1;
    return [...employees].sort((a, b) => {
      const ra = rank(a.department), rb = rank(b.department);
      if (ra !== rb) return ra - rb;
      const c = (a.department ?? '').localeCompare(b.department ?? '', 'cs');
      if (c !== 0) return c;
      return a.name.localeCompare(b.name, 'cs');
    });
  }, [employees]);

  // ── Analyze ────────────────────────────────────────────────────────────────
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
      const drafts = new Map<string, DraftEntry>();
      for (const day of data.problemDays) {
        for (const suggId of day.recommendedSuggestionIds) {
          const empId = suggId.split('__')[1];
          const sugg = day.suggestions.find(s => s.id === suggId);
          if (!empId || !sugg) continue;
          const key = `${empId}|${day.date}`;
          if (!drafts.has(key)) drafts.set(key, { suggId, timeLabel: sugg.timeLabel, type: sugg.suggestionType });
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

  // ── Apply / dismiss ────────────────────────────────────────────────────────
  const optimisticInsert = useCallback((suggIds: string[]) => {
    const color = wtColorMap.get('Prodejna') ?? '#ec4899';
    setWorkPlans(prev => {
      const additions: WorkPlanEntry[] = [];
      for (const id of suggIds) {
        const [date, empId] = id.split('__');
        if (!date || !empId) continue;
        const draft = pendingDrafts.get(`${empId}|${date}`);
        const mt = (draft?.timeLabel ?? '').match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
        additions.push({
          id: `optimistic-${id}`, date, employeeId: empId,
          workType: 'Prodejna', workTypeName: 'Prodejna', workTypeColor: color,
          startTime: mt?.[1] ?? null, endTime: mt?.[2] ?? null,
        });
      }
      return [...prev, ...additions];
    });
  }, [wtColorMap, pendingDrafts]);

  const removeSuggFromState = useCallback((suggId: string) => {
    setPendingDrafts(prev => {
      const next = new Map(prev);
      const keyToDelete = Array.from(next.entries()).find(([, e]) => e.suggId === suggId)?.[0];
      if (keyToDelete) next.delete(keyToDelete);
      setAnalyzeResult(prevResult => {
        if (!prevResult) return prevResult;
        const updated: AssistantResult = {
          ...prevResult,
          problemDays: prevResult.problemDays.map(d => ({
            ...d,
            recommendedSuggestionIds: d.recommendedSuggestionIds.filter(id => id !== suggId),
          })),
        };
        saveDraftsToStorage(updated, next);
        return updated;
      });
      return next;
    });
  }, [saveDraftsToStorage]);

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
      if (!res.ok) { setApplyError(data.error ?? t('Chyba při aplikaci', 'Apply error')); return; }
      setToast(t('Směna přidána', 'Shift added'));
      optimisticInsert([suggId]);
      removeSuggFromState(suggId);
      fetchData();
    } catch {
      setApplyError(t('Síťová chyba', 'Network error'));
    } finally {
      setApplyingSingle(null);
    }
  }, [t, optimisticInsert, removeSuggFromState, fetchData]);

  const handleApplyAll = useCallback(async () => {
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
      if (!res.ok) { setApplyError(data.error ?? t('Chyba při aplikaci', 'Apply error')); return; }
      const appliedCount: number = Array.isArray(data.applied) ? data.applied.length : ids.length;
      setToast(`${appliedCount} ${t('směn přidáno', 'shifts added')}`);
      optimisticInsert(ids);
      setAnalyzeResult(null);
      setPendingDrafts(new Map());
      try { localStorage.removeItem(draftStorageKey); } catch { /* ignore */ }
      fetchData();
    } catch {
      setApplyError(t('Síťová chyba', 'Network error'));
    } finally {
      setApplying(false);
    }
  }, [pendingDrafts, t, optimisticInsert, fetchData, draftStorageKey]);

  // ── Custom pick ────────────────────────────────────────────────────────────
  const handleAddCustomPick = useCallback((date: string, empId: string) => {
    if (!empId || !analyzeResult) return;
    const emp = empById.get(empId);
    if (!emp) return;
    const suggId = `${date}__${empId}__CUSTOM`;
    const updated: AssistantResult = {
      ...analyzeResult,
      problemDays: analyzeResult.problemDays.map(d => {
        if (d.date !== date || d.recommendedSuggestionIds.includes(suggId)) return d;
        return {
          ...d,
          suggestions: [...d.suggestions, { id: suggId, employeeName: emp.name, timeLabel: '', suggestionType: 'FULL_DAY_STORE' as const, score: 0 }],
          recommendedSuggestionIds: [...d.recommendedSuggestionIds, suggId],
        };
      }),
    };
    setAnalyzeResult(updated);
    setPendingDrafts(prev => {
      const next = new Map(prev);
      const key = `${empId}|${date}`;
      if (!next.has(key)) next.set(key, { suggId, timeLabel: '', type: 'FULL_DAY_STORE' });
      saveDraftsToStorage(updated, next);
      return next;
    });
  }, [analyzeResult, empById, saveDraftsToStorage]);

  // ── Bell ───────────────────────────────────────────────────────────────────
  const [bellOpen, setBellOpen] = useState(false);
  const [bellItems, setBellItems] = useState<{ id: string; title: string; message: string; read: boolean; created_at: string }[]>([]);

  const fetchBell = useCallback(() => {
    managerFetch('/api/notifications')
      .then(r => r.json())
      .then(d => setBellItems(d.notifications ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBell();
    const iv = setInterval(fetchBell, 60_000);
    return () => clearInterval(iv);
  }, [fetchBell]);

  const unreadBellCount = bellItems.filter(n => !n.read).length;
  const markBellRead = useCallback(async () => {
    try {
      await managerFetch('/api/notifications', { method: 'PATCH' });
      setBellItems(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* ignore */ }
  }, []);

  // ── Render helpers ─────────────────────────────────────────────────────────
  const scrollToCard = (date: string) => {
    document.getElementById(`plan-day-${date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const problemDays = analyzeResult?.problemDays ?? [];
  const draftCount = pendingDrafts.size;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-white shrink-0">
        <button onClick={() => onMonthChange?.(shiftMonth(month, -1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" aria-label="Předchozí měsíc">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">{monthLabel}</span>
        <button onClick={() => onMonthChange?.(shiftMonth(month, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" aria-label="Následující měsíc">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <button
          onClick={onSwitchView}
          className="ml-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
          title={t('Přepnout na tabulkové zobrazení', 'Switch to table view')}
        >
          🗓 {t('Tabulka', 'Table')}
        </button>

        <div className="flex-1" />

        {analyzeResult && (
          <div className="hidden md:flex items-center gap-3 text-xs mr-1">
            {problemDays.length > 0 ? (
              <span className="font-semibold text-red-600">⚠ {problemDays.length} {t('krizových dnů', 'crisis days')}</span>
            ) : (
              <span className="font-semibold text-emerald-600">✓ {t('Vše obsazeno', 'All covered')}</span>
            )}
            {draftCount > 0 && <span className="font-semibold text-indigo-600">{draftCount} {t('návrhů', 'drafts')}</span>}
          </div>
        )}

        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setBellOpen(v => !v)}
            className="relative p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title={t('Notifikace — reakce na nabídky směn', 'Notifications')}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {unreadBellCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                {unreadBellCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">🔔 {t('Notifikace', 'Notifications')}</span>
                  {unreadBellCount > 0 && (
                    <button onClick={markBellRead} className="text-[10px] text-blue-600 hover:underline font-medium">
                      {t('Označit vše jako přečtené', 'Mark all read')}
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {bellItems.length === 0 ? (
                    <div className="px-3.5 py-6 text-center text-xs text-slate-400">{t('Zatím žádné notifikace', 'No notifications yet')}</div>
                  ) : (
                    bellItems.slice(0, 10).map(n => (
                      <div key={n.id} className={`px-3.5 py-2.5 ${n.read ? 'bg-white' : 'bg-amber-50/70'}`}>
                        <div className="text-[11px] font-semibold text-slate-700 leading-tight">{n.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{n.message}</div>
                        <div className="text-[9px] text-slate-300 mt-1">
                          {new Date(n.created_at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {onOpenNotifications && (
                  <button
                    onClick={() => { setBellOpen(false); onOpenNotifications(); }}
                    className="w-full px-3.5 py-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 border-t border-slate-100 transition-colors"
                  >
                    {t('Otevřít všechny ve Správě →', 'Open all in Management →')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Mini calendar overview ──────────────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white shrink-0 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {allDays.map(date => {
            const dow = new Date(date + 'T00:00:00').getDay();
            const isCrisis = crisisDays.has(date);
            const isToday = date === today;
            const isWeekend = dow === 0 || dow === 6;
            const hasStaff = (staffByDay.get(date)?.length ?? 0) > 0;
            return (
              <button
                key={date}
                onClick={() => isCrisis && scrollToCard(date)}
                title={`${parseInt(date.slice(8), 10)}. ${m}. — ${DAY_ABBREVS[dow]}${isCrisis ? ` · ${t('krizový den', 'crisis day')}` : ''}`}
                className={`flex flex-col items-center justify-center w-8 h-9 rounded-lg text-[10px] font-bold leading-none transition-all shrink-0 ${
                  isCrisis
                    ? 'bg-red-500 text-white shadow-sm hover:bg-red-600 cursor-pointer'
                    : analyzeResult && hasStaff && !isWeekend
                      ? 'bg-emerald-100 text-emerald-700'
                      : isWeekend
                        ? 'bg-slate-100 text-slate-300'
                        : 'bg-slate-100 text-slate-500'
                } ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''} ${!isCrisis ? 'cursor-default' : ''}`}
              >
                <span>{parseInt(date.slice(8), 10)}</span>
                <span className="text-[7px] font-medium opacity-70 mt-0.5">{DAY_ABBREVS[dow]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Action strip ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            analyzing ? 'bg-indigo-100 text-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
          }`}
        >
          {analyzing ? t('Počítám…', 'Analyzing…') : `🧮 ${t('Dopočítat záskoky', 'Find cover')}`}
        </button>
        {draftCount > 0 && (
          <button
            onClick={handleApplyAll}
            disabled={applying}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              applying ? 'bg-emerald-100 text-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
            }`}
          >
            {applying ? t('Aplikuji…', 'Applying…') : `✓ ${t('Schválit všech', 'Apply all')} ${draftCount}`}
          </button>
        )}
        {(analyzeError || applyError) && (
          <span className="text-xs text-red-600 font-medium">{analyzeError ?? applyError}</span>
        )}
        <div className="flex-1" />
        {analyzeResult && (
          <span className="text-[10px] text-slate-400">
            {analyzeResult.summary.totalDays} {t('prac. dnů', 'work days')} · {employees.length} {t('zaměstnanců', 'employees')}
          </span>
        )}
      </div>

      {/* ── Day cards ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

          {!analyzeResult && !analyzing && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">🤖</div>
              <h3 className="text-base font-bold text-slate-700">{t('Plánovač záskoků', 'Cover planner')}</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                {t('Spusťte výpočet — asistent projde měsíc, najde dny, kde chybí lidi, a navrhne, kdo může zaskočit.',
                   'Run the analysis — the assistant scans the month, finds understaffed days and suggests who can cover.')}
              </p>
              <button
                onClick={handleAnalyze}
                className="mt-5 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all"
              >
                🧮 {t('Dopočítat záskoky', 'Find cover')}
              </button>
            </div>
          )}

          {analyzing && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400 mt-4">{t('Analyzuji obsazení měsíce…', 'Analyzing coverage…')}</p>
            </div>
          )}

          {analyzeResult && problemDays.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-base font-bold text-emerald-700">{t('Vše je obsazeno!', 'All days covered!')}</p>
              <p className="text-sm text-emerald-600 mt-1">{t('Žádné krizové dny v tomto měsíci.', 'No crisis days this month.')}</p>
            </div>
          )}

          {problemDays.map(day => {
            const dow = new Date(day.date + 'T00:00:00').getDay();
            const recommended = day.suggestions.filter(s => day.recommendedSuggestionIds.includes(s.id));
            const staff = staffByDay.get(day.date) ?? [];
            const usedIds = new Set(staff.map(s => s.employeeId));
            for (const [key] of Array.from(pendingDrafts.entries())) {
              const [empId, d] = key.split('|');
              if (d === day.date) usedIds.add(empId);
            }

            return (
              <div key={day.date} id={`plan-day-${day.date}`} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm scroll-mt-4">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50/60 border-b border-red-100">
                  <div className="w-11 h-11 rounded-xl bg-white border border-red-200 flex flex-col items-center justify-center shrink-0 shadow-sm">
                    <span className="text-base font-extrabold text-red-600 leading-none">{parseInt(day.date.slice(8), 10)}</span>
                    <span className="text-[9px] text-red-400 leading-none mt-0.5">{DAY_ABBREVS[dow]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800">{day.statusLabel}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {day.assignedCount}/{day.requiredTotal} {t('obsazeno', 'assigned')}
                      {recommended.length > 0 && <> · {recommended.length} {t('návrhů', 'suggested')}</>}
                    </div>
                  </div>
                  {day.missingCount > 0 && (
                    <span className="shrink-0 px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-bold">
                      −{day.missingCount}
                    </span>
                  )}
                </div>

                {/* Suggestions */}
                <div className="divide-y divide-slate-50">
                  {recommended.length === 0 && (
                    <div className="px-4 py-3 text-xs text-slate-400">
                      {t('Žádné návrhy — přidejte někoho ručně níže.', 'No suggestions — add someone manually below.')}
                    </div>
                  )}
                  {recommended.map(sugg => {
                    const empId = sugg.id.split('__')[1];
                    const emp = empId ? empById.get(empId) : undefined;
                    const color = sugg.suggestionType === 'CLOSING_ASSIST' ? DRAFT_COLORS.CLOSING_ASSIST : DRAFT_COLORS.FULL_DAY_STORE;
                    const busy = applyingSingle === sugg.id;
                    return (
                      <div key={sugg.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: color }}>
                          {initials(sugg.employeeName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">{sugg.employeeName}</div>
                          <div className="text-[11px] text-slate-400">
                            {emp?.department ?? ''}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: color + '15', color }}>
                          {sugg.suggestionType === 'CLOSING_ASSIST'
                            ? `🌙 ${sugg.timeLabel || '17–19'}`
                            : `🏪 ${t('Prodejna', 'Store')}`}
                        </span>
                        <button
                          onClick={() => {
                            if (!empId) return;
                            setNotifyTarget({
                              employeeId: empId,
                              employeeName: sugg.employeeName,
                              shift: { date: day.date, dayName: DAY_ABBREVS[dow] },
                            });
                          }}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title={t('Oslovit (Slack / e-mail)', 'Notify (Slack / email)')}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeSuggFromState(sugg.id)}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title={t('Odebrat návrh', 'Dismiss')}
                        >
                          ✕
                        </button>
                        <button
                          onClick={() => handleApplySingle(sugg.id)}
                          disabled={busy || applying}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                        >
                          {busy ? '…' : `✓ ${t('Schválit', 'Approve')}`}
                        </button>
                      </div>
                    );
                  })}

                  {/* Custom pick */}
                  <div className="px-4 py-2.5">
                    <select
                      value=""
                      onChange={(e) => { handleAddCustomPick(day.date, e.target.value); e.target.value = ''; }}
                      className="w-full text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg px-2.5 py-2 bg-white hover:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 cursor-pointer"
                    >
                      <option value="">＋ {t('Přidat vlastní výběr…', 'Add your own pick…')}</option>
                      {sortedEmployees.filter(emp => !usedIds.has(emp.id)).map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}{emp.department ? ` (${emp.department})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Current staffing */}
                <details className="border-t border-slate-100 group">
                  <summary className="px-4 py-2 text-[11px] font-semibold text-slate-400 cursor-pointer hover:bg-slate-50 select-none list-none flex items-center gap-1.5">
                    <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                    {t('Kdo už ten den pracuje', 'Who already works that day')} ({staff.length})
                  </summary>
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {staff.length === 0 && <span className="text-xs text-slate-300">{t('Nikdo', 'Nobody')}</span>}
                    {staff.map(s => {
                      const color = s.workTypeColor ?? wtColorMap.get(s.workTypeName ?? '') ?? '#94a3b8';
                      return (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium"
                          style={{ background: color + '15', color: '#334155', borderLeft: `3px solid ${color}` }}
                          title={s.workTypeName ?? ''}
                        >
                          {s.employeeName}
                          {s.startTime && s.endTime && (
                            <span className="text-slate-400">{fmtShort(s.startTime)}–{fmtShort(s.endTime)}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </div>

      {notifyTarget && <NotifyModal target={notifyTarget} onClose={() => setNotifyTarget(null)} />}
    </div>
  );
}

// ─── Switcher: planner (default) ↔ classic matrix ────────────────────────────

export default function ShiftAssistantPlanner(props: Props) {
  const [view, setView] = useState<'planner' | 'matrix'>(() => {
    try { return (localStorage.getItem('sa_view_mode') as 'planner' | 'matrix') ?? 'planner'; } catch { return 'planner'; }
  });

  const switchTo = (v: 'planner' | 'matrix') => {
    setView(v);
    try { localStorage.setItem('sa_view_mode', v); } catch { /* ignore */ }
  };

  if (view === 'matrix') {
    return (
      <div className="relative h-full">
        <ShiftAssistantMatrix {...props} />
        <button
          onClick={() => switchTo('planner')}
          className="absolute bottom-4 left-4 z-40 px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold shadow-xl hover:bg-slate-700 transition-colors"
        >
          📋 Přepnout na Plánovač
        </button>
      </div>
    );
  }

  return <PlannerView {...props} onSwitchView={() => switchTo('matrix')} />;
}
