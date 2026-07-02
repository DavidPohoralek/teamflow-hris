'use client';
import { useState, useEffect, useCallback } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import { useT } from '@/lib/i18n';

interface EmployeeConfirmation {
  id: string;
  name: string;
  department: string | null;
  confirmed: boolean;
  confirmedAt: string | null;
}

interface Props {
  month: string; // YYYY-MM
  onUnconfirmedCount?: (n: number) => void;
}

export default function ShiftConfirmationsDashboard({ month, onUnconfirmedCount }: Props) {
  const t = useT();
  const [data, setData] = useState<{
    employees: EmployeeConfirmation[];
    confirmedCount: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmed, setShowConfirmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await managerFetch(`/api/manager/shift-confirmations?month=${encodeURIComponent(month)}`);
      if (r.ok) {
        const d = await r.json();
        setData(d);
        onUnconfirmedCount?.((d.total ?? 0) - (d.confirmedCount ?? 0));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [month, onUnconfirmedCount]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-5 border-b border-slate-100">
        <div className="h-3 w-36 bg-slate-100 animate-pulse rounded mb-3" />
        <div className="h-2 bg-slate-100 animate-pulse rounded mb-1.5" />
        <div className="h-2 w-3/4 bg-slate-100 animate-pulse rounded" />
      </div>
    );
  }

  if (!data) return null;

  const { employees, confirmedCount, total } = data;
  const notConfirmed = employees.filter(e => !e.confirmed);
  const confirmed = employees.filter(e => e.confirmed);
  const pct = total > 0 ? Math.round((confirmedCount / total) * 100) : 0;
  const allConfirmed = total > 0 && confirmedCount === total;

  const [y, m] = month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });

  return (
    <div className="p-5 border-b border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{t('Potvrzení směn', 'Shift confirmations')}</h3>
            <p className="text-xs text-slate-400 capitalize">{monthLabel}</p>
          </div>
        </div>
        <button
          onClick={load}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100"
          title={t('Obnovit', 'Refresh')}
        >↻</button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className={`font-semibold ${allConfirmed ? 'text-emerald-600' : 'text-amber-600'}`}>
            {confirmedCount} / {total} {t('potvrzeno', 'confirmed')}
          </span>
          <span className={`font-medium ${allConfirmed ? 'text-emerald-500' : 'text-amber-500'}`}>{pct}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${allConfirmed ? 'bg-emerald-500' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* All confirmed */}
      {allConfirmed && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl mb-2">
          <span className="text-emerald-500 text-base">✅</span>
          <span className="text-sm text-emerald-700 font-semibold">{t('Všichni potvrdili!', 'Everyone confirmed!')}</span>
        </div>
      )}

      {/* Not confirmed — highlighted amber */}
      {notConfirmed.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-amber-500 text-sm">⏳</span>
            <p className="text-xs font-semibold text-amber-700">
              {t('Ještě nepotvrdili', 'Pending')} ({notConfirmed.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {notConfirmed.map(emp => (
              <span
                key={emp.id}
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-medium"
              >
                {emp.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confirmed — collapsible */}
      {confirmed.length > 0 && (
        <div>
          <button
            onClick={() => setShowConfirmed(v => !v)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="text-[10px]">{showConfirmed ? '▴' : '▾'}</span>
            {t('Potvrzeno', 'Confirmed')} ({confirmed.length})
          </button>
          {showConfirmed && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {confirmed.map(emp => (
                <span
                  key={emp.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs"
                >
                  ✓ {emp.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
