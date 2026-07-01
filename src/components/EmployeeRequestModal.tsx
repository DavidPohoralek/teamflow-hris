'use client';

import { useState, useEffect } from 'react';

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

const REQUEST_TYPES: { type: RequestType; emoji: string; label: string; color: string; selected: string }[] = [
  {
    type: 'sick',
    emoji: '🤒',
    label: 'Nemoc',
    color: 'border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700',
    selected: 'border-orange-500 bg-orange-100 text-orange-800 ring-2 ring-orange-400',
  },
  {
    type: 'correction',
    emoji: '✏️',
    label: 'Oprava docházky',
    color: 'border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700',
    selected: 'border-purple-500 bg-purple-100 text-purple-800 ring-2 ring-purple-400',
  },
  {
    type: 'other',
    emoji: '📝',
    label: 'Ostatní',
    color: 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700',
    selected: 'border-slate-500 bg-slate-100 text-slate-800 ring-2 ring-slate-400',
  },
];

export default function EmployeeRequestModal({ orgId, pin, employeeName, onClose }: EmployeeRequestModalProps) {
  const [selectedType, setSelectedType] = useState<RequestType | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [note, setNote] = useState('');
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
      // Deselect → back to full correction
      setLinkedLog(null);
      setCorrectionField('both');
      setTimeIn('');
      setTimeOut('');
      return;
    }
    setLinkedLog(log);
    setTimeIn('');
    setTimeOut('');
    if (log.check_in && !log.check_out) {
      // Most common: forgot to clock out → only ask for Odchod
      setCorrectionField('check_out');
    } else if (!log.check_in) {
      setCorrectionField('check_in');
    } else {
      // Both present — user picks which to correct; default to both
      setCorrectionField('both');
    }
  };

  const correctionValid =
    correctionField === 'check_in' ? !!timeIn
    : correctionField === 'check_out' ? !!timeOut
    : !!(timeIn && timeOut);

  // Convert local HH:MM time on a given date to UTC ISO string so the server
  // stores the correct timestamp regardless of server/DB timezone.
  const localTimeToUtcIso = (date: string, time: string): string =>
    new Date(`${date}T${time}`).toISOString();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !dateFrom) return;
    if (isCorrection && !correctionValid) return;

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
            <label className="block text-sm font-semibold text-slate-700 mb-3">Typ žádosti</label>
            <div className="grid grid-cols-2 gap-3">
              {REQUEST_TYPES.map(({ type, emoji, label, color, selected }) => (
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
                  }}
                  className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    selectedType === type ? selected : color
                  }`}
                >
                  <span className="text-2xl leading-none">{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
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
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition text-sm"
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
                      <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-purple-500 rounded-full animate-spin" />
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
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-slate-200 bg-slate-50 hover:border-purple-300 hover:bg-purple-50/40'
                            }`}
                          >
                            <span className="text-base shrink-0">{missingOut ? '⚠️' : '✅'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-semibold text-sm ${isSelected ? 'text-purple-800' : 'text-slate-700'}`}>
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
                              isSelected ? 'border-purple-500 bg-purple-500' : 'border-slate-300'
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

              {/* Field selector — only shown when linked log has both times */}
              {linkedLog && linkedLog.check_in && linkedLog.check_out && (
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
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300'
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
                      <input
                        type="time"
                        value={timeIn}
                        onChange={(e) => setTimeIn(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-slate-800 transition text-sm"
                      />
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
                      <input
                        type="time"
                        value={timeOut}
                        onChange={(e) => setTimeOut(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-slate-800 transition text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
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
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition text-sm"
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
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 transition text-sm resize-none"
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
            disabled={loading || !selectedType || !dateFrom || (isCorrection && !correctionValid)}
            onClick={handleSubmit}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition flex items-center justify-center gap-2"
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
