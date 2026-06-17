'use client';

import { useState } from 'react';

interface EmployeeRequestModalProps {
  orgId: string;
  pin: string;
  employeeName: string;
  onClose: () => void;
}

type RequestType = 'sick' | 'correction' | 'other';

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

  const showDateTo = selectedType === 'sick';
  const isCorrection = selectedType === 'correction';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !dateFrom) return;
    if (isCorrection && (!timeIn || !timeOut)) return;

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
          // Correction times sent as dedicated fields
          ...(isCorrection ? { timeIn, timeOut } : {}),
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
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
                  onClick={() => setSelectedType(type)}
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
              Datum od <span className="text-red-500">*</span>
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

          {/* Time fields — only for correction */}
          {isCorrection && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Příchod <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-slate-800 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Odchod <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-slate-800 transition text-sm"
                />
              </div>
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
            disabled={loading || !selectedType || !dateFrom || (isCorrection && (!timeIn || !timeOut))}
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
