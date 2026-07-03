'use client';

import { useState, useCallback, useEffect } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import { useT } from '@/lib/i18n';
import NotificationsPanel from './NotificationsPanel';
import ShiftConfirmationsDashboard from './ShiftConfirmationsDashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PartialAvailability {
  type: 'CLOSING_ASSIST';
  from: string;
  to: string;
  hours: number;
  reason: string;
}

interface Suggestion {
  id: string;
  employeeName: string;
  firstName: string;
  dateLabel: string;
  timeLabel: string;
  suggestionType: 'FULL_DAY_STORE' | 'CLOSING_ASSIST';
  canAutoApply: boolean;
  actionLabel: string;
  score: number;
  confidence: number;
  badges: string[];
  reasons: string[];
  warnings: string[];
  partialAvailability: PartialAvailability | null;
  projectedHours: number;
  assignedHours: number;
  assignedDays: number;
}

interface ClosingCoverage {
  enabled: boolean;
  from: string;
  to: string;
  requiredStaff: number;
  assignedStaff: number;
  missingStaff: number;
}

interface AnalyzedDay {
  date: string;
  dateLabel: string;
  dayName: string;
  requiredTotal: number;
  assignedEmployees: string[];
  assignedCount: number;
  missingCount: number;
  status: 'OK' | 'MISSING' | 'CLOSED';
  statusLabel: string;
  storeHoursLabel: string;
  shiftHours: number;
  closingCoverage: ClosingCoverage;
  suggestions: Suggestion[];
  recommendedSuggestionIds: string[];
}

interface AssistantResult {
  ok: boolean;
  month: string;
  draft: string;
  summary: {
    totalDays: number;
    problemDays: number;
    recommendedCount: number;
    allSuggestionCount: number;
  };
  problemDays: AnalyzedDay[];
}

// ─── Notify modal ─────────────────────────────────────────────────────────────

interface NotifyTarget {
  employeeId: string;
  employeeName: string;
  shift: { date: string; dayName: string; startTime?: string; endTime?: string };
}

interface NotifyModalProps {
  target: NotifyTarget;
  onClose: () => void;
}

function NotifyModal({ target, onClose }: NotifyModalProps) {
  const t = useT();
  const [channel, setChannel] = useState<'slack' | 'email' | 'both'>('email');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await managerFetch('/api/shift-assistant/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          employee: { id: target.employeeId, name: target.employeeName },
          shift: { ...target.shift, dayName: target.shift.dayName },
          customMessage: customMessage || undefined,
        }),
      });
      const data = await res.json();
      const results: { channel: string; ok: boolean; error?: string }[] = data.results ?? [];
      const failed = results.filter(r => !r.ok);
      if (failed.length === 0) {
        setResult({ ok: true, text: `${t('Zpráva odeslána přes', 'Message sent via')} ${results.map(r => r.channel).join(' a ')}` });
      } else {
        setResult({ ok: false, text: failed.map(r => `${r.channel}: ${r.error}`).join('; ') });
      }
    } catch {
      setResult({ ok: false, text: t('Chyba sítě', 'Network error') });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{t('Oslovit zaměstnance', 'Notify employee')}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {target.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">{target.employeeName}</div>
            <div className="text-xs text-slate-400">{target.shift.date} · {target.shift.dayName}</div>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-2 block">{t('Kanál', 'Channel')}</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'email', icon: '📧', label: 'Email' },
              { id: 'slack', icon: '💬', label: 'Slack' },
              { id: 'both',  icon: '📡', label: t('Oboje', 'Both') },
            ] as { id: 'slack' | 'email' | 'both'; icon: string; label: string }[]).map(opt => (
              <button key={opt.id} onClick={() => setChannel(opt.id)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm transition-all ${channel === opt.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}
              >
                <span className="text-lg">{opt.icon}</span>
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 mb-2 block">
            {t('Vlastní zpráva', 'Custom message')} <span className="text-slate-400 font-normal">{t('(volitelné)', '(optional)')}</span>
          </label>
          <textarea
            value={customMessage}
            onChange={e => setCustomMessage(e.target.value)}
            rows={3}
            placeholder={`Ahoj ${target.employeeName.split(' ')[0]}, můžeš nastoupit na směnu ${target.shift.date}?`}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none text-slate-700 placeholder:text-slate-300"
          />
        </div>

        {result && (
          <div className={`text-sm px-3 py-2.5 rounded-xl ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {result.text}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition font-medium">
            {t('Zrušit', 'Cancel')}
          </button>
          <button onClick={send} disabled={sending}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
          >
            {sending ? t('Odesílám…', 'Sending…') : t('Odeslat', 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── License state ─────────────────────────────────────────────────────────────

interface LicenseState {
  checked: boolean;
  licensed: boolean;
  reason?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  month: string;
  onMonthChange?: (month: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function matchColor(c: number): string {
  if (c >= 80) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (c >= 50) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  return 'bg-red-50 text-red-600 ring-1 ring-red-200';
}

function badgeStyle(badge: string): string {
  if (badge.includes('Tier 1'))   return 'bg-emerald-50 text-emerald-700';
  if (badge.includes('Tier 2'))   return 'bg-blue-50 text-blue-700';
  if (badge.includes('Tier 3'))   return 'bg-amber-50 text-amber-700';
  if (badge.includes('Mimo'))     return 'bg-red-50 text-red-600';
  if (badge.includes('Prodejna')) return 'bg-indigo-50 text-indigo-700';
  if (badge.includes('Soboty') || badge.includes('Priorita')) return 'bg-purple-50 text-purple-700';
  if (badge.includes('IČO'))      return 'bg-orange-50 text-orange-700';
  if (badge.includes('Večerní'))  return 'bg-sky-50 text-sky-700';
  return 'bg-slate-100 text-slate-500';
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ShiftAssistant({ orgId, month, onMonthChange, onOpenNotifications }: Props & { onOpenNotifications?: () => void }) {
  const t = useT();
  const [license, setLicense] = useState<LicenseState>({ checked: false, licensed: false });
  const [draft, setDraft] = useState<'A' | 'B'>('A');
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ applied: number; skipped: { id: string; reason: string }[] } | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<NotifyTarget | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    managerFetch('/api/notifications')
      .then(r => r.json())
      .then(d => setUnreadCount((d.notifications ?? []).filter((n: { read: boolean }) => !n.read).length))
      .catch(() => {});
  }, [orgId]);

  const storageKey = `tf_assistant_${orgId}_${month}_${draft}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { result: AssistantResult; selected: string[] };
        setResult(parsed.result);
        setSelected(new Set(parsed.selected));
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!result) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ result, selected: Array.from(selected) }));
    } catch { /* ignore */ }
  }, [result, selected, storageKey]);

  useEffect(() => {
    managerFetch('/api/shift-assistant/license')
      .then(r => r.json())
      .then(d => setLicense({ checked: true, licensed: !!d.licensed, reason: d.reason }))
      .catch(() => setLicense({ checked: true, licensed: false, reason: 'error' }));
  }, [orgId]);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setApplyResult(null);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    try {
      const res = await managerFetch(`/api/shift-assistant/analyze?month=${month}&draft=${draft}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Chyba analýzy');
      setResult(data);
      const autoIds = new Set<string>();
      for (const day of (data.problemDays ?? [])) {
        for (const id of (day.recommendedSuggestionIds ?? [])) autoIds.add(id);
      }
      setSelected(autoIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  }, [month, draft]);

  const toggleSuggestion = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const apply = async () => {
    if (!result || selected.size === 0) return;
    setApplying(true);
    setError(null);
    try {
      const suggestionTimes: Record<string, { startTime: string; endTime: string }> = {};
      for (const day of result.problemDays) {
        for (const s of day.suggestions) {
          if (!selected.has(s.id)) continue;
          if (s.partialAvailability) {
            suggestionTimes[s.id] = { startTime: s.partialAvailability.from, endTime: s.partialAvailability.to };
          } else {
            const parts = s.timeLabel.split(/[–-]/).map((p: string) => p.trim());
            if (parts.length === 2) suggestionTimes[s.id] = { startTime: parts[0], endTime: parts[1] };
          }
        }
      }
      const res = await managerFetch('/api/shift-assistant/apply', {
        method: 'POST',
        body: JSON.stringify({ month, draft, suggestionIds: Array.from(selected), suggestionTimes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Chyba při aplikaci');
      setApplyResult(data);
      await analyze();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba');
    } finally {
      setApplying(false);
    }
  };

  // ── License loading ──────────────────────────────────────────────────────────
  if (!license.checked) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400 gap-3">
        <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full" />
        <span className="text-sm">{t('Ověřuji licenci…', 'Verifying license…')}</span>
      </div>
    );
  }

  // ── Upsell ──────────────────────────────────────────────────────────────────
  if (!license.licensed) {
    const reasonMsg: Record<string, string> = {
      no_license: t('Vaše organizace nemá aktivovaný Asistent směn.', 'Your organization does not have Shift Assistant activated.'),
      inactive:   t('Licence Asistenta směn není aktivní.', 'Shift Assistant license is not active.'),
      expired:    t('Platnost licence Asistenta směn vypršela.', 'Shift Assistant license has expired.'),
      error:      t('Nepodařilo se ověřit licenci. Zkuste to znovu.', 'Failed to verify license. Please try again.'),
    };
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center max-w-lg mx-auto space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl">🤖</div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">{t('Asistent směn', 'Shift Assistant')}</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            {reasonMsg[license.reason ?? ''] ?? t('Asistent směn není aktivován.', 'Shift Assistant is not activated.')}
          </p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-5 w-full space-y-2 text-left">
          {[
            t('✅ Analýza chybějících směn v reálném čase', '✅ Real-time missing shift analysis'),
            t('✅ Scoring kandidátů podle tieru, sobot a hodin', '✅ Candidate scoring by tier, Saturdays and hours'),
            t('✅ Automatické i manuální schvalování návrhů', '✅ Automatic and manual proposal approval'),
            t('✅ Večerní záskok – closing coverage logika', '✅ Evening cover – closing coverage logic'),
          ].map(f => <div key={f} className="text-sm text-slate-600">{f}</div>)}
        </div>
        <a href="https://selbicky.dev/assistant" target="_blank" rel="noopener noreferrer"
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition text-sm">
          {t('Aktivovat Asistenta směn →', 'Activate Shift Assistant →')}
        </a>
      </div>
    );
  }

  // ── Month helpers ────────────────────────────────────────────────────────────
  const [y, m] = month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString(t('cs-CZ', 'en-US'), { month: 'long', year: 'numeric' });
  const prevMonth = () => { if (!onMonthChange) return; const d = new Date(y, m - 2, 1); onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setResult(null); };
  const nextMonth = () => { if (!onMonthChange) return; const d = new Date(y, m, 1); onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setResult(null); };

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">

        {/* Notify modal */}
        {notifyTarget && <NotifyModal target={notifyTarget} onClose={() => setNotifyTarget(null)} />}

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800">{t('Asistent směn', 'Shift Assistant')}</h1>
                <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">DLC</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t('Automatické doplnění chybějících směn', 'Automatic missing shift filler')}</p>
            </div>
            {/* Month nav */}
            {onMonthChange && (
              <div className="flex items-center gap-1 ml-3 border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                <button onClick={prevMonth} className="px-2.5 py-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors text-sm">‹</button>
                <span className="text-xs font-semibold text-slate-700 capitalize px-2 min-w-[110px] text-center">{monthLabel}</span>
                <button onClick={nextMonth} className="px-2.5 py-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors text-sm">›</button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Bell */}
            <button onClick={() => setShowNotifications(true)}
              className={`relative w-9 h-9 flex items-center justify-center rounded-lg border transition-all text-base
                ${unconfirmedCount > 0 ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
            >
              🔔
              {(unreadCount > 0 || unconfirmedCount > 0) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unreadCount || unconfirmedCount}
                </span>
              )}
            </button>
            {/* Draft */}
            <select value={draft} onChange={e => setDraft(e.target.value as 'A' | 'B')} disabled={loading}
              className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="A">Draft A</option>
              <option value="B">Draft B</option>
            </select>
            {/* Analyze button */}
            <button onClick={analyze} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t('Analyzuji…', 'Analyzing…')}</>
              ) : (
                <><svg width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="m21 21-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>{t('Analyzovat měsíc', 'Analyze month')}</>
              )}
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" className="mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            {error}
          </div>
        )}

        {/* ── Apply result ── */}
        {applyResult && (
          <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm border ${applyResult.applied > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <span>{applyResult.applied > 0 ? '✅' : '⚠️'}</span>
            <div>
              {applyResult.applied > 0
                ? <span>{t('Zapsáno', 'Written')} <strong>{applyResult.applied}</strong> {t('směn do kalendáře.', 'shifts to calendar.')}</span>
                : <span>{t('Žádná směna nebyla zapsána.', 'No shifts were written.')}</span>}
              {applyResult.skipped.length > 0 && (
                <div className="mt-1 text-xs opacity-75">{t('Přeskočeno', 'Skipped')} {applyResult.skipped.length}: {applyResult.skipped.map(s => s.reason).join(' · ')}</div>
              )}
            </div>
          </div>
        )}

        {/* ── KPI cards ── */}
        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('Dnů v měsíci', 'Days in month'), value: result.summary.totalDays,       accent: 'bg-slate-300',   num: 'text-slate-700' },
              { label: t('Problémových', 'Problematic'),    value: result.summary.problemDays,      accent: 'bg-red-400',     num: 'text-red-600' },
              { label: t('Doporučených', 'Recommended'),    value: result.summary.recommendedCount, accent: 'bg-indigo-400',  num: 'text-indigo-700' },
              { label: t('Vybráno', 'Selected'),            value: selected.size,                   accent: 'bg-emerald-400', num: 'text-emerald-700' },
            ].map(card => (
              <div key={card.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex items-center gap-3 shadow-sm">
                <div className={`w-1 h-9 rounded-full flex-shrink-0 ${card.accent}`} />
                <div>
                  <div className={`text-2xl font-bold leading-none ${card.num}`}>{card.value}</div>
                  <div className="text-xs text-slate-400 mt-1">{card.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Action bar ── */}
        {result && result.summary.problemDays > 0 && (
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <div className="text-sm text-slate-500">
              <span className="font-bold text-slate-800">{selected.size}</span> {t('návrhů vybráno', 'proposals selected')}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { const all = new Set<string>(); result.problemDays.forEach(d => d.recommendedSuggestionIds.forEach(id => all.add(id))); setSelected(all); }}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-600 font-medium"
              >
                {t('Doporučené', 'Recommended')}
              </button>
              <button onClick={() => setSelected(new Set())}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-600 font-medium">
                {t('Zrušit výběr', 'Clear')}
              </button>
              <button onClick={apply} disabled={applying || selected.size === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors">
                {applying
                  ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t('Zapisuji…', 'Writing…')}</>
                  : <><svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{t('Zapsat', 'Write')} {selected.size} {t('směn', 'shifts')}</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── All clear ── */}
        {result && result.problemDays.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-3xl mb-4">🎉</div>
            <div className="font-semibold text-slate-700">{t('Všechny směny jsou obsazené!', 'All shifts are filled!')}</div>
            <div className="text-sm text-slate-400 mt-1">Draft {result.draft} · {result.month}</div>
          </div>
        )}

        {/* ── Problem day cards ── */}
        {result && result.problemDays.map((day, idx) => {
          const isOpen = expandedDay === day.date;
          const hasMissing = day.missingCount > 0;
          const hasEveningMissing = day.closingCoverage.enabled && day.closingCoverage.missingStaff > 0;

          return (
            <div key={day.date} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Day header */}
              <button
                onClick={() => setExpandedDay(isOpen ? null : day.date)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors text-left"
              >
                {/* Index */}
                <span className="text-xs text-slate-300 font-semibold w-5 text-right flex-shrink-0">{idx + 1}</span>

                {/* Date */}
                <div className="flex-shrink-0 min-w-[90px]">
                  <div className="text-sm font-bold text-slate-800">{day.dateLabel}</div>
                  <div className="text-xs text-slate-400">{day.dayName}</div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasMissing && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full">
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="2"/></svg>
                      {t('Chybí', 'Missing')} {day.missingCount}
                    </span>
                  )}
                  {hasEveningMissing && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-1 rounded-full">
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2"/></svg>
                      {t('Večer', 'Eve')} -{day.closingCoverage.missingStaff}
                    </span>
                  )}
                </div>

                {/* Filled count */}
                <div className="flex-1 text-xs text-slate-400">
                  {day.assignedCount} / {day.requiredTotal} {t('obsazeno', 'filled')}
                  {day.storeHoursLabel && <span className="ml-2 text-slate-300">· {day.storeHoursLabel}</span>}
                </div>

                {/* Suggestion count pill */}
                {day.suggestions.length > 0 && (
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {day.suggestions.length} {t('kandidátů', 'candidates')}
                  </span>
                )}

                {/* Chevron */}
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
                  className={`text-slate-300 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Suggestions panel */}
              {isOpen && (
                <div className="border-t border-slate-100">
                  {day.suggestions.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <div className="text-slate-300 text-2xl mb-2">🤷</div>
                      <div className="text-sm text-slate-400">{t('Žádní dostupní kandidáti pro tento den.', 'No available candidates for this day.')}</div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {day.suggestions.map(s => {
                        const isSelected    = selected.has(s.id);
                        const isRecommended = day.recommendedSuggestionIds.includes(s.id);
                        const isClosing     = s.suggestionType === 'CLOSING_ASSIST';

                        return (
                          <div
                            key={s.id}
                            onClick={() => toggleSuggestion(s.id)}
                            className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'}`}
                          >
                            {/* Checkbox */}
                            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                              {isSelected && (
                                <svg width="8" height="8" fill="none" viewBox="0 0 24 24">
                                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>

                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                              {getInitials(s.employeeName)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-800">{s.employeeName}</span>
                                {s.timeLabel && (
                                  <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{s.timeLabel}</span>
                                )}
                                {isClosing && (
                                  <span className="text-[11px] font-medium bg-sky-50 text-sky-600 border border-sky-200 px-1.5 py-0.5 rounded-full">{t('Večerní záskok', 'Evening cover')}</span>
                                )}
                                {isRecommended && !isClosing && (
                                  <span className="text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full">★ {t('Doporučeno', 'Recommended')}</span>
                                )}
                              </div>

                              {/* Tags row */}
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                {s.badges.map(b => (
                                  <span key={b} className={`text-[11px] px-1.5 py-0.5 rounded ${badgeStyle(b)}`}>{b}</span>
                                ))}
                                {s.warnings.map(w => (
                                  <span key={w} className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">⚠ {w}</span>
                                ))}
                              </div>

                              {/* Reasons — subtle */}
                              {s.reasons.length > 0 && (
                                <div className="text-[11px] text-slate-400 mt-1">{s.reasons.join(' · ')}</div>
                              )}
                            </div>

                            {/* Match % */}
                            <div className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${matchColor(s.confidence)}`}>
                              {s.confidence}%
                            </div>

                            {/* Notify icon button */}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setNotifyTarget({
                                  employeeId: s.id.split('__')[1] ?? s.id,
                                  employeeName: s.employeeName,
                                  shift: { date: day.date, dayName: day.dayName },
                                });
                              }}
                              title={t('Oslovit zaměstnance', 'Notify employee')}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors flex-shrink-0"
                            >
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.8"/>
                                <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Empty state ── */}
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">🤖</div>
            <div className="font-semibold text-slate-700">{t('Asistent směn připraven', 'Shift Assistant ready')}</div>
            <div className="text-sm text-slate-400 mt-2 max-w-xs">
              {t('Klikni na "Analyzovat měsíc" a bot najde chybějící směny a navrhne optimální obsazení.', 'Click "Analyze month" to find missing shifts and get optimal staffing suggestions.')}
            </div>
          </div>
        )}

      </div>

      {/* ── Notifications drawer ── */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowNotifications(false)} />
          <div className="relative bg-white w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">🔔 {t('Notifikace', 'Notifications')}</h2>
              <button onClick={() => setShowNotifications(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ShiftConfirmationsDashboard month={month} onUnconfirmedCount={setUnconfirmedCount} />
              <NotificationsPanel onUnreadChange={setUnreadCount} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
