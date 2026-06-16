'use client';

import { useState, useCallback, useEffect } from 'react';
import { managerFetch } from '@/lib/managerFetch';

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
        setResult({ ok: true, text: `Zpráva odeslána přes ${results.map(r => r.channel).join(' a ')}` });
      } else {
        setResult({ ok: false, text: failed.map(r => `${r.channel}: ${r.error}`).join('; ') });
      }
    } catch {
      setResult({ ok: false, text: 'Chyba sítě' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">📨 Oslovit zaměstnance</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm">
          <span className="font-semibold text-slate-800">{target.employeeName}</span>
          <span className="text-slate-500 ml-2">→ směna {target.shift.date} ({target.shift.dayName})</span>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Kanál</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'email', icon: '📧', label: 'Email' },
              { id: 'slack', icon: '💬', label: 'Slack' },
              { id: 'both',  icon: '📡', label: 'Oboje' },
            ] as { id: 'slack' | 'email' | 'both'; icon: string; label: string }[]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setChannel(opt.id)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-sm transition
                  ${channel === opt.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'}
                `}
              >
                <span className="text-xl">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">
            Vlastní zpráva <span className="text-slate-400 font-normal">(volitelné – jinak se použije automatická)</span>
          </label>
          <textarea
            value={customMessage}
            onChange={e => setCustomMessage(e.target.value)}
            rows={3}
            placeholder={`Ahoj ${target.employeeName.split(' ')[0]}, můžeš nastoupit na směnu ${target.shift.date}?`}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
        </div>

        {result && (
          <div className={`text-sm px-3 py-2 rounded-lg ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {result.text}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            Zrušit
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition"
          >
            {sending ? 'Odesílám…' : '📨 Odeslat zprávu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── License check ────────────────────────────────────────────────────────────

interface LicenseState {
  checked: boolean;
  licensed: boolean;
  reason?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  month: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badgeColor(badge: string): string {
  if (badge.includes('Tier 1'))  return 'bg-emerald-100 text-emerald-800';
  if (badge.includes('Tier 2'))  return 'bg-blue-100 text-blue-800';
  if (badge.includes('Tier 3'))  return 'bg-amber-100 text-amber-800';
  if (badge.includes('Mimo'))    return 'bg-red-100 text-red-700';
  if (badge.includes('Prodejna')) return 'bg-indigo-100 text-indigo-700';
  if (badge.includes('Soboty') || badge.includes('Priorita')) return 'bg-purple-100 text-purple-700';
  if (badge.includes('IČO'))     return 'bg-orange-100 text-orange-700';
  if (badge.includes('Večerní')) return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-600';
}

function confidenceColor(c: number): string {
  if (c >= 80) return 'text-emerald-600';
  if (c >= 50) return 'text-amber-600';
  return 'text-red-500';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShiftAssistant({ orgId, month }: Props) {
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

  // Check license on mount
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

    try {
      const res = await managerFetch(`/api/shift-assistant/analyze?month=${month}&draft=${draft}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Chyba analýzy');
      setResult(data);

      // Auto-select all recommended
      const autoIds = new Set<string>();
      for (const day of (data.problemDays ?? [])) {
        for (const id of (day.recommendedSuggestionIds ?? [])) {
          autoIds.add(id);
        }
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
      const res = await managerFetch('/api/shift-assistant/apply', {
        method: 'POST',
        body: JSON.stringify({ month, draft, suggestionIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Chyba při aplikaci');
      setApplyResult(data);
      // Refresh analysis
      await analyze();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba');
    } finally {
      setApplying(false);
    }
  };

  // ── License check loading ────────────────────────────────────────────────
  if (!license.checked) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-indigo-500 rounded-full mr-3" />
        Ověřuji licenci…
      </div>
    );
  }

  // ── Upsell wall ──────────────────────────────────────────────────────────
  if (!license.licensed) {
    const reasonMsg: Record<string, string> = {
      no_license: 'Vaše organizace nemá aktivovaný Asistent směn.',
      inactive:   'Licence Asistenta směn není aktivní.',
      expired:    'Platnost licence Asistenta směn vypršela.',
      error:      'Nepodařilo se ověřit licenci. Zkuste to znovu.',
    };
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center max-w-lg mx-auto space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl">🤖</div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Asistent směn</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            {reasonMsg[license.reason ?? ''] ?? 'Asistent směn není aktivován.'}
          </p>
          <p className="text-slate-400 text-sm mt-2">
            Automaticky doplní chybějící směny na základě dostupnosti, tierů a preferencí zaměstnanců.
          </p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-5 w-full space-y-2 text-left">
          {[
            '✅ Analýza chybějících směn v reálném čase',
            '✅ Scoring kandidátů podle tieru, sobot a hodin',
            '✅ Automatické i manuální schvalování návrhů',
            '✅ Večerní záskok – closing coverage logika',
          ].map(f => (
            <div key={f} className="text-sm text-slate-600">{f}</div>
          ))}
        </div>
        <a
          href="https://selbicky.dev/assistant"
          target="_blank"
          rel="noopener noreferrer"
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition text-sm"
        >
          Aktivovat Asistenta směn →
        </a>
        <p className="text-xs text-slate-400">Po zakoupení bude licence aktivována automaticky.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Notify modal */}
      {notifyTarget && (
        <NotifyModal target={notifyTarget} onClose={() => setNotifyTarget(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            🤖 Asistent směn
            <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">DLC</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Automatické doplnění chybějících směn na základě dostupnosti a preferencí
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600 font-medium">Draft:</label>
          <select
            value={draft}
            onChange={e => setDraft(e.target.value as 'A' | 'B')}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            disabled={loading}
          >
            <option value="A">Draft A</option>
            <option value="B">Draft B</option>
          </select>
          <button
            onClick={analyze}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
          >
            {loading ? 'Analyzuji…' : '🔍 Analyzovat měsíc'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
          ✅ Zapsáno {applyResult.applied} směn.
          {applyResult.skipped.length > 0 && (
            <span className="text-amber-700 ml-2">
              Přeskočeno {applyResult.skipped.length}: {applyResult.skipped.map(s => s.reason).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      {result && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Dnů v měsíci',   value: result.summary.totalDays,        color: 'bg-slate-100 text-slate-700' },
            { label: 'Problémových',    value: result.summary.problemDays,       color: 'bg-red-50 text-red-700' },
            { label: 'Doporučených',    value: result.summary.recommendedCount,  color: 'bg-indigo-50 text-indigo-700' },
            { label: 'Vybráno',         value: selected.size,                    color: 'bg-amber-50 text-amber-700' },
          ].map(card => (
            <div key={card.label} className={`${card.color} rounded-xl p-4 text-center`}>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs font-medium mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      {result && result.summary.problemDays > 0 && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{selected.size}</span> návrhů vybráno k zapsání
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const allIds = new Set<string>();
                result.problemDays.forEach(d => d.recommendedSuggestionIds.forEach(id => allIds.add(id)));
                setSelected(allIds);
              }}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Vybrat doporučené
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Zrušit výběr
            </button>
            <button
              onClick={apply}
              disabled={applying || selected.size === 0}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
            >
              {applying ? 'Zapisuji…' : `✅ Zapsat ${selected.size} směn`}
            </button>
          </div>
        </div>
      )}

      {/* Problem days */}
      {result && result.problemDays.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">🎉</div>
          <div className="font-semibold text-slate-600">Všechny směny jsou obsazené!</div>
          <div className="text-sm mt-1">Draft {result.draft} pro {result.month} nemá žádná chybějící místa.</div>
        </div>
      )}

      {result && result.problemDays.map(day => (
        <div key={day.date} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Day header */}
          <button
            onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-left"
          >
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold text-slate-800">{day.dateLabel}</div>
              <div className="text-sm text-slate-500">{day.dayName}</div>
              {day.storeHoursLabel && (
                <div className="text-xs text-slate-400">{day.storeHoursLabel}</div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {day.missingCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                  Chybí {day.missingCount} {day.missingCount === 1 ? 'člověk' : 'lidé'}
                </span>
              )}
              {day.closingCoverage.enabled && day.closingCoverage.missingStaff > 0 && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                  Večer -{day.closingCoverage.missingStaff}
                </span>
              )}
              <div className="text-xs text-slate-400">
                Obsazeno: {day.assignedEmployees.join(', ') || '—'}
              </div>
              <span className="text-slate-400 text-sm">{expandedDay === day.date ? '▲' : '▼'}</span>
            </div>
          </button>

          {/* Suggestions */}
          {expandedDay === day.date && (
            <div className="border-t border-slate-100 divide-y divide-slate-50">
              {day.suggestions.length === 0 ? (
                <div className="px-5 py-6 text-sm text-slate-400 text-center">
                  Žádní dostupní kandidáti pro tento den.
                </div>
              ) : day.suggestions.map(s => {
                const isSelected  = selected.has(s.id);
                const isRecommended = day.recommendedSuggestionIds.includes(s.id);
                const isClosing   = s.suggestionType === 'CLOSING_ASSIST';

                return (
                  <div
                    key={s.id}
                    onClick={() => toggleSuggestion(s.id)}
                    className={`px-5 py-4 flex items-start gap-4 cursor-pointer transition
                      ${isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : 'hover:bg-slate-50'}
                    `}
                  >
                    {/* Checkbox */}
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition
                      ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}
                    `}>
                      {isSelected && <span className="text-white text-xs">✓</span>}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{s.employeeName}</span>
                        {s.timeLabel && (
                          <span className="text-xs text-slate-500">{s.timeLabel}</span>
                        )}
                        {isClosing && (
                          <span className="text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">Večerní záskok</span>
                        )}
                        {isRecommended && !isClosing && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">★ Doporučeno</span>
                        )}
                        <span className={`text-xs font-medium ml-auto ${confidenceColor(s.confidence)}`}>
                          {s.confidence}% shoda
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {s.badges.map(b => (
                          <span key={b} className={`text-xs px-1.5 py-0.5 rounded ${badgeColor(b)}`}>{b}</span>
                        ))}
                      </div>

                      {/* Warnings */}
                      {s.warnings.length > 0 && (
                        <div className="mt-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                          ⚠ {s.warnings.join(' · ')}
                        </div>
                      )}

                      {/* Reasons */}
                      <div className="mt-1 text-xs text-slate-400">
                        {s.reasons.join(' · ')}
                      </div>
                    </div>

                    {/* Action label + Oslovit */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full
                        ${s.canAutoApply
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'}
                      `}>
                        {s.actionLabel}
                      </span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setNotifyTarget({
                              employeeId: s.id.split('__')[1] ?? s.id,
                              employeeName: s.employeeName,
                              shift: { date: day.date, dayName: day.dayName },
                            });
                          }}
                          className="text-xs px-2 py-1 bg-white border border-slate-300 hover:border-indigo-400 hover:text-indigo-600 rounded-lg transition"
                        >
                          📨 Oslovit
                        </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Empty state before analysis */}
      {!result && !loading && (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-4">🤖</div>
          <div className="font-semibold text-slate-600 text-lg">Asistent směn připraven</div>
          <div className="text-sm mt-2 max-w-sm mx-auto">
            Klikni na "Analyzovat měsíc" a bot najde chybějící směny a navrhne optimální obsazení.
          </div>
        </div>
      )}
    </div>
  );
}
