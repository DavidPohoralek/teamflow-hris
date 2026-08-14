'use client';

import { useState, useEffect } from 'react';
import TimeSelect from '@/components/TimeSelect';

interface EmployeeRequestModalProps {
  orgId: string;
  pin: string;
  employeeName: string;
  onClose: () => void;
}

type RequestType = 'sick' | 'correction' | 'other';
type CorrectionField = 'check_in' | 'check_out' | 'both';

interface LogEntry {
  id: string;
  check_in: string | null;
  check_out: string | null;
  work_type_name: string | null;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

const REQUEST_TYPES: { type: RequestType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'sick',
    label: 'Nemoc',
    icon: <><path d="M12 8v8M8 12h8" /><rect x="4" y="4" width="16" height="16" rx="4" /></>,
  },
  {
    type: 'correction',
    label: 'Oprava docházky',
    icon: <><path d="M4 20h4L18.4 9.6a2 2 0 00-2.8-2.8L4 18.2V20z" /><path d="M14.5 7.5l2.8 2.8" /></>,
  },
  {
    type: 'other',
    label: 'Ostatní',
    icon: <><path d="M6 3.5h8l4 4V20.5H6zM14 3.5v4h4" /><path d="M9 12h6M9 15.5h4" /></>,
  },
];

export default function EmployeeRequestModal({ orgId, pin, employeeName, onClose }: EmployeeRequestModalProps) {
  const [selectedType, setSelectedType] = useState<RequestType | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [note, setNote] = useState('');
  // "Ostatní" — výjimečná událost s hodinami + bonusem
  const [otherHours, setOtherHours] = useState('');
  const [otherBonusPct, setOtherBonusPct] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Correction log linking
  const [dateLogs, setDateLogs] = useState<LogEntry[]>([]);
  const [dateLogsLoading, setDateLogsLoading] = useState(false);
  const [linkedLog, setLinkedLog] = useState<LogEntry | null>(null);
  const [correctionField, setCorrectionField] = useState<CorrectionField>('both');

  const showDateTo = selectedType === 'sick';
  const isCorrection = selectedType === 'correction';
  const isOther = selectedType === 'other';

  const otherHoursNum = parseFloat(otherHours.replace(',', '.'));
  const otherBonusNum = otherBonusPct.trim() === '' ? 0 : parseFloat(otherBonusPct.replace(',', '.'));
  const otherValid = !isOther || (!isNaN(otherHoursNum) && otherHoursNum > 0 && otherHoursNum <= 24 && !isNaN(otherBonusNum) && otherBonusNum >= 0);
  const otherCredited = !isNaN(otherHoursNum) && otherHoursNum > 0
    ? Math.round(otherHoursNum * (1 + (isNaN(otherBonusNum) ? 0 : otherBonusNum) / 100) * 100) / 100
    : 0;

  // Fetch employee's own logs for the selected date (correction mode only)
  useEffect(() => {
    if (!isCorrection || !dateFrom || !orgId || !pin) {
      setDateLogs([]);
      setLinkedLog(null);
      setCorrectionField('both');
      return;
    }
    let cancelled = false;
    setDateLogsLoading(true);
    setLinkedLog(null);
    setCorrectionField('both');
    setTimeIn('');
    setTimeOut('');
    fetch(`/api/public/attendance-logs?orgId=${orgId}&pin=${encodeURIComponent(pin)}&date=${dateFrom}`)
      .then((r) => r.json())
      .then((d: { logs?: LogEntry[] }) => { if (!cancelled) setDateLogs(d.logs ?? []); })
      .catch(() => { if (!cancelled) setDateLogs([]); })
      .finally(() => { if (!cancelled) setDateLogsLoading(false); });
    return () => { cancelled = true; };
  }, [dateFrom, isCorrection, orgId, pin]);

  const handleSelectLog = (log: LogEntry) => {
    if (linkedLog?.id === log.id) {
      setLinkedLog(null);
      setCorrectionField('both');
      setTimeIn('');
      setTimeOut('');
      return;
    }
    setLinkedLog(log);
    setTimeIn('');
    setTimeOut('');
    if (!log.check_in) {
      setCorrectionField('check_in');
    } else {
      // Default to 'both' so user can pick; for open sessions check_out field stays empty
      setCorrectionField('both');
    }
  };

  const openSession = !!(linkedLog?.check_in && !linkedLog?.check_out);
  const correctionValid =
    correctionField === 'check_in' ? !!timeIn
    : correctionField === 'check_out' ? !!timeOut
    : openSession ? !!(timeIn || timeOut)   // open session: aspoň jeden čas stačí
    : !!(timeIn && timeOut);

  // Convert local HH:MM time on a given date to UTC ISO string so the server
  // stores the correct timestamp regardless of server/DB timezone.
  const localTimeToUtcIso = (date: string, time: string): string =>
    new Date(`${date}T${time}`).toISOString();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !dateFrom) return;
    if (isCorrection && !correctionValid) return;
    if (isOther && !otherValid) { setError('Zadejte platný počet hodin (1–24) a bonus (0 a více %).'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/public/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          pin,
          type: selectedType,
          dateFrom,
          dateTo: showDateTo ? dateTo || undefined : undefined,
          note: note || undefined,
          ...(isOther ? { hours: otherHoursNum, bonus_pct: otherBonusNum } : {}),
          ...(isCorrection ? {
            correctionField,
            timeIn: (correctionField === 'check_in' || correctionField === 'both') && timeIn
              ? localTimeToUtcIso(dateFrom, timeIn) : undefined,
            timeOut: (correctionField === 'check_out' || correctionField === 'both') && timeOut
              ? localTimeToUtcIso(dateFrom, timeOut) : undefined,
            linkedLogId: linkedLog?.id ?? undefined,
          } : {}),
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(onClose, 2000);
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Nepodařilo se odeslat žádost. Zkuste to znovu.');
      }
    } catch {
      setError('Chyba připojení. Zkuste to znovu.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col items-center justify-center gap-4 py-16 px-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-xl font-bold text-emerald-700">Žádost odeslána</p>
          <p className="text-sm text-slate-500 text-center">Vaše žádost byla úspěšně podána a čeká na schválení.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Nová žádost</h2>
            <p className="text-sm text-slate-500 mt-0.5">{employeeName}</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto px-6 py-5 flex flex-col gap-5">
          {/* Request type */}
          <div>
            <label className="block text-sm font-semibold text-[#111820] mb-3">Typ žádosti</label>
            <div className="grid grid-cols-2 gap-3">
              {REQUEST_TYPES.map(({ type, label, icon }) => {
                const isSel = selectedType === type;
                return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSelectedType(type);
                    setDateFrom('');
                    setDateLogs([]);
                    setLinkedLog(null);
                    setCorrectionField('both');
                    setTimeIn('');
                    setTimeOut('');
                    setOtherHours('');
                    setOtherBonusPct('');
                    setError('');
                  }}
                  className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-[10px] border font-semibold text-sm transition-colors ${
                    isSel ? 'border-[#111820] bg-[#f1efe9] text-[#111820]' : 'border-[#e2e0dc] bg-white text-[#5c6672] hover:bg-[#f4f2ef] hover:text-[#111820]'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                  <span>{label}</span>
                </button>
                );
              })}
            </div>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="dateFrom">
              Datum {isCorrection ? '' : 'od'} <span className="text-red-500">*</span>
            </label>
            <input
              id="dateFrom"
              type="date"
              required
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onClick={(e) => { try { (e.target as HTMLInputElement).showPicker(); } catch { /* unsupported */ } }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#8a929c] focus:ring-2 focus:ring-[#111820]/10 outline-none text-slate-800 transition text-sm cursor-pointer"
            />
          </div>

          {/* Correction section */}
          {isCorrection && (
            <>
              {/* Log selector — appears when date is chosen */}
              {dateFrom && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Existující záznam
                    <span className="ml-1.5 text-xs font-normal text-slate-400">(vyberte, co chcete opravit)</span>
                  </label>

                  {dateLogsLoading ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
                      <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-[#111820] rounded-full animate-spin" />
                      Načítám záznamy…
                    </div>
                  ) : dateLogs.length === 0 ? (
                    <p className="text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-3">
                      Pro tento den nebyly nalezeny žádné záznamy docházky.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {dateLogs.map((log) => {
                        const missingOut = log.check_in && !log.check_out;
                        const isSelected = linkedLog?.id === log.id;
                        return (
                          <button
                            key={log.id}
                            type="button"
                            onClick={() => handleSelectLog(log)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                              isSelected
                                ? 'border-[#111820] bg-[#f1efe9]'
                                : 'border-slate-200 bg-slate-50 hover:border-[#d5d2cc] hover:bg-[#f4f2ef]'
                            }`}
                          >
                            <span className="text-base shrink-0">{missingOut ? '⚠️' : '✅'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-semibold text-sm ${isSelected ? 'text-[#111820]' : 'text-slate-700'}`}>
                                  {fmtTime(log.check_in)} → {fmtTime(log.check_out)}
                                </span>
                                {missingOut && (
                                  <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    odchod chybí
                                  </span>
                                )}
                              </div>
                              {log.work_type_name && (
                                <div className="text-xs text-slate-400 mt-0.5">{log.work_type_name}</div>
                              )}
                            </div>
                            <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'border-[#111820] bg-[#111820]' : 'border-slate-300'
                            }`}>
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Field selector — shown whenever a log is selected */}
              {linkedLog && linkedLog.check_in && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Co chcete opravit?</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'check_in' as CorrectionField, label: 'Příchod' },
                      { value: 'check_out' as CorrectionField, label: 'Odchod' },
                      { value: 'both' as CorrectionField, label: 'Oboje' },
                    ]).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setCorrectionField(value); setTimeIn(''); setTimeOut(''); }}
                        className={`flex-1 py-2 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          correctionField === value
                            ? 'border-[#111820] bg-[#f1efe9] text-[#111820]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-[#d5d2cc]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time inputs — only show relevant fields */}
              {dateFrom && (
                <div className={`grid gap-3 ${
                  correctionField === 'both' ? 'grid-cols-2' : 'grid-cols-1'
                }`}>
                  {(correctionField === 'check_in' || correctionField === 'both') && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Příchod <span className="text-red-500">*</span>
                        {linkedLog?.check_in && (
                          <span className="ml-1.5 text-xs font-normal text-slate-400">
                            (bylo {fmtTime(linkedLog.check_in)})
                          </span>
                        )}
                      </label>
                      <TimeSelect value={timeIn} onChange={setTimeIn} selectClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#8a929c] focus:ring-2 focus:ring-[#111820]/10 outline-none text-slate-800 transition text-sm bg-white" />
                    </div>
                  )}
                  {(correctionField === 'check_out' || correctionField === 'both') && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Odchod <span className="text-red-500">*</span>
                        {linkedLog?.check_out && (
                          <span className="ml-1.5 text-xs font-normal text-slate-400">
                            (bylo {fmtTime(linkedLog.check_out)})
                          </span>
                        )}
                      </label>
                      <TimeSelect value={timeOut} onChange={setTimeOut} selectClassName="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#8a929c] focus:ring-2 focus:ring-[#111820]/10 outline-none text-slate-800 transition text-sm bg-white" />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Other — exceptional event: hours + bonus % */}
          {isOther && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-3">
              <p className="text-xs text-slate-500 -mb-1">
                Výjimečná událost (např. veletrh). Zadejte odpracované hodiny a případný bonus. Manažer obojí schválí.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Počet hodin <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" inputMode="decimal" value={otherHours}
                    onChange={(e) => setOtherHours(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="8"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#8a929c] focus:ring-2 focus:ring-[#111820]/10 outline-none text-slate-800 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Bonus (%) <span className="text-slate-400 text-xs font-normal">(volitelné)</span>
                  </label>
                  <input
                    type="text" inputMode="decimal" value={otherBonusPct}
                    onChange={(e) => setOtherBonusPct(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#8a929c] focus:ring-2 focus:ring-[#111820]/10 outline-none text-slate-800 transition text-sm"
                  />
                </div>
              </div>
              {otherCredited > 0 && (
                <div className="text-xs text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-200">
                  K připsání: <strong className="text-slate-800">{otherHoursNum} h</strong>
                  {otherBonusNum > 0 && <> + {otherBonusNum} % bonus = <strong className="text-emerald-600">{otherCredited} h</strong></>}
                </div>
              )}
            </div>
          )}

          {/* Date to — only for vacation/sick */}
          {showDateTo && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="dateTo">
                Datum do <span className="text-slate-400 text-xs font-normal">(volitelné)</span>
              </label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                onClick={(e) => { try { (e.target as HTMLInputElement).showPicker(); } catch { /* unsupported */ } }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#8a929c] focus:ring-2 focus:ring-[#111820]/10 outline-none text-slate-800 transition text-sm cursor-pointer"
              />
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="note">
              Poznámka <span className="text-slate-400 text-xs font-normal">(volitelné)</span>
            </label>
            <textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Doplňující informace…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-[#8a929c] focus:ring-2 focus:ring-[#111820]/10 outline-none text-slate-800 transition text-sm resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition"
          >
            Zrušit
          </button>
          <button
            type="submit"
            form=""
            disabled={loading || !selectedType || !dateFrom || (isCorrection && !correctionValid) || (isOther && !otherValid)}
            onClick={handleSubmit}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-[#111820] hover:bg-[#2a333e] disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Odesílám…
              </>
            ) : (
              'Odeslat žádost'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
