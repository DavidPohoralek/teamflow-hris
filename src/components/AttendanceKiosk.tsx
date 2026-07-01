'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PinPad from './PinPad';
import { useT } from '@/lib/i18n';

interface WorkType {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  category: string;
}

interface PresenceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  checkIn: string;
  workTypeId?: string;
  workTypeName?: string;
}

type KioskScreen =
  | 'pin'
  | 'checkin'
  | 'checkout'
  | 'success-checkin'
  | 'success-checkout'
  | 'ho-activity'
  | 'ho-form'
  | 'error';

function isHomeOffice(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase().replace(/\s+/g, '');
  return n === 'ho' || n === 'homeoffice';
}

function localDateStr(daysBack = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

interface AttendanceKioskProps {
  orgId: string;
}

const WORK_TYPE_ICONS: Record<string, string> = {
  Prodejna: '🏪',
  Kancelář: '🏢',
  HO: '🏠',
  Expedice: '📦',
  Sklad: '🏭',
  Výroba: '⚙️',
  Servis: '🔧',
};

const WORK_TYPE_COLORS: Record<string, string> = {
  Prodejna: 'bg-blue-600 hover:bg-blue-500',
  Kancelář: 'bg-purple-600 hover:bg-purple-500',
  HO: 'bg-green-600 hover:bg-green-500',
  Expedice: 'bg-orange-600 hover:bg-orange-500',
  Sklad: 'bg-yellow-600 hover:bg-yellow-500',
  Výroba: 'bg-red-600 hover:bg-red-500',
  Servis: 'bg-teal-600 hover:bg-teal-500',
};

const DEFAULT_COLORS = [
  'bg-blue-600 hover:bg-blue-500',
  'bg-purple-600 hover:bg-purple-500',
  'bg-green-600 hover:bg-green-500',
  'bg-orange-600 hover:bg-orange-500',
  'bg-pink-600 hover:bg-pink-500',
  'bg-teal-600 hover:bg-teal-500',
];

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(checkIn: string): string {
  const start = new Date(checkIn).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default function AttendanceKiosk({ orgId }: AttendanceKioskProps) {
  const t = useT();
  const [screen, setScreen] = useState<KioskScreen>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeDepartment, setEmployeeDepartment] = useState<string | null>(null);
  const [showAllWorkTypes, setShowAllWorkTypes] = useState(false);
  const [presence, setPresence] = useState<PresenceRecord | null>(null);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [selectedWorkType, setSelectedWorkType] = useState<WorkType | null>(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // HomeOffice activity report (post-checkout note)
  const [requireHoReport, setRequireHoReport] = useState(false);
  const [hoLogId, setHoLogId] = useState<string | null>(null);
  const [hoNote, setHoNote] = useState('');
  const [hoLoading, setHoLoading] = useState(false);

  // HomeOffice retrospective form
  const [hoFormDate, setHoFormDate] = useState('');
  const [hoFormStart, setHoFormStart] = useState('');
  const [hoFormEnd, setHoFormEnd] = useState('');
  const [hoFormSummary, setHoFormSummary] = useState('');
  const [hoFormError, setHoFormError] = useState('');
  const [hoFormWorkTypeId, setHoFormWorkTypeId] = useState('');
  const [hoFormWorkTypeName, setHoFormWorkTypeName] = useState('');

  // Load work types + settings
  useEffect(() => {
    fetch(`/api/public/work-types?orgId=${orgId}`)
      .then((r) => r.json())
      .then((json: { workTypes?: WorkType[] } | WorkType[]) => {
        const list = Array.isArray(json) ? json : (json.workTypes ?? []);
        setWorkTypes(list.filter((wt) => wt.category === 'shift' || wt.category === 'presence'));
      })
      .catch(() => {});
    fetch(`/api/public/company-settings?orgId=${orgId}`)
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (d.require_ho_activity_report) setRequireHoReport(true);
      })
      .catch(() => {});
  }, [orgId]);

  const resetKiosk = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setScreen('pin');
      setPin('');
      setEmployeeName('');
      setEmployeeId('');
      setPresence(null);
      setSelectedWorkType(null);
      setSuccessMessage('');
      setErrorMessage('');
      setPinError(false);
      setHoLogId(null);
      setHoNote('');
      setHoFormDate('');
      setHoFormStart('');
      setHoFormEnd('');
      setHoFormSummary('');
      setHoFormError('');
      setHoFormWorkTypeId('');
      setHoFormWorkTypeName('');
    }, 3000);
  }, []);

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 8) return;
    setPinError(false);
    setPin((prev) => prev + digit);
  };

  const handlePinDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  const handlePinConfirm = async (enteredPin: string) => {
    // Cancel any pending reset from a previous session
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setLoading(true);
    setPinError(false);
    setPin(enteredPin);

    try {
      const res = await fetch(
        `/api/public/presence?orgId=${orgId}&pin=${encodeURIComponent(enteredPin)}`
      );
      if (!res.ok) {
        setPinError(true);
        setPin('');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEmployeeName(data.employeeName ?? 'Zaměstnanec');
      setEmployeeId(data.employeeId ?? '');
      const dept = data.employeeDepartment ?? null;
      setEmployeeDepartment(dept);
      setShowAllWorkTypes(false);
      // Auto-select the primary department work type if it exists
      if (dept) {
        const match = workTypes.find((wt) => wt.name.toLowerCase() === dept.toLowerCase());
        setSelectedWorkType(match ?? null);
      } else {
        setSelectedWorkType(null);
      }
      if (data.presence) {
        setPresence(data.presence);
        setScreen('checkout');
      } else {
        setPresence(null);
        setScreen('checkin');
      }
    } catch {
      setPinError(true);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!selectedWorkType) return;
    setLoading(true);
    try {
      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin',
          orgId,
          employeeId,
          pin,
          workTypeId: selectedWorkType.id,
          workTypeName: selectedWorkType.name,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(json.error ?? t('Chyba při záznamu příchodu. Zkuste to prosím znovu.', 'Error recording clock-in. Please try again.'));
        setScreen('error');
        resetKiosk();
        return;
      }
      const now = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      setSuccessMessage(`${t('Příchod zaznamenán v', 'Clocked in at')} ${now}`);
      setScreen('success-checkin');
      resetKiosk();
    } catch {
      setErrorMessage(t('Síťová chyba. Zkuste to prosím znovu.', 'Network error. Please try again.'));
      setScreen('error');
      resetKiosk();
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', orgId, employeeId, pin }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json() as { logId?: string; workTypeName?: string };
      const duration = presence ? formatDuration(presence.checkIn) : '';
      const checkoutWt = json.workTypeName ?? presence?.workTypeName;

      if (requireHoReport && isHomeOffice(checkoutWt) && json.logId) {
        setHoLogId(json.logId);
        setHoNote('');
        setSuccessMessage(`${t('Odchod zaznamenán. Odpracováno:', 'Clocked out. Time worked:')} ${duration}`);
        setScreen('ho-activity');
      } else {
        setSuccessMessage(`${t('Odchod zaznamenán. Odpracováno:', 'Clocked out. Time worked:')} ${duration}`);
        setScreen('success-checkout');
        resetKiosk();
      }
    } catch {
      setErrorMessage(t('Chyba při záznamu odchodu. Zkuste to prosím znovu.', 'Error recording clock-out. Please try again.'));
      setScreen('error');
      resetKiosk();
    } finally {
      setLoading(false);
    }
  };

  const handleHoNoteSubmit = async (skip = false) => {
    if (!skip && hoLogId && hoNote.trim()) {
      setHoLoading(true);
      try {
        await fetch('/api/public/attendance-note', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId: hoLogId, orgId, pin, note: hoNote.trim() }),
        });
      } catch { /* show success regardless */ }
      finally { setHoLoading(false); }
    }
    setScreen('success-checkout');
    resetKiosk();
  };

  const handleHoRecord = async () => {
    setHoFormError('');
    if (!hoFormStart || !hoFormEnd) {
      setHoFormError(t('Zadejte čas příchodu i odchodu.', 'Enter both start and end time.'));
      return;
    }
    if (hoFormEnd <= hoFormStart) {
      setHoFormError(t('Čas odchodu musí být po čase příchodu.', 'End time must be after start time.'));
      return;
    }
    setHoLoading(true);
    try {
      const res = await fetch('/api/public/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ho-record',
          orgId,
          pin,
          workTypeId: hoFormWorkTypeId || undefined,
          workTypeName: hoFormWorkTypeName || 'HomeOffice',
          date: hoFormDate,
          startTime: hoFormStart,
          endTime: hoFormEnd,
          note: hoFormSummary.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; durationLabel?: string };
      if (!res.ok) {
        setHoFormError(json.error ?? t('Chyba při zápisu záznamu.', 'Error saving record.'));
        setHoLoading(false);
        return;
      }
      setSuccessMessage(`HomeOffice zaznamenán ✓ ${json.durationLabel ?? ''}`);
      setScreen('success-checkin');
      resetKiosk();
    } catch {
      setHoFormError(t('Síťová chyba. Zkuste to prosím znovu.', 'Network error. Please try again.'));
    } finally {
      setHoLoading(false);
    }
  };

  const pinButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', '✓'];

  if (screen === 'pin') {
    return (
      <PinPad
        title={t('Zadejte svůj PIN', 'Enter your PIN')}
        onConfirm={handlePinConfirm}
        loading={loading}
        error={pinError ? t('Nesprávný PIN. Zkuste to znovu.', 'Incorrect PIN. Please try again.') : null}
      />
    );
  }

  return (
    <div className="flex-1 bg-[#1e293b] text-white flex flex-col items-center justify-center p-4 select-none overflow-auto">
      {/* Check-in Screen */}
      {screen === 'checkin' && (
        <div className="w-full max-w-2xl flex flex-col items-center gap-4 sm:gap-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-100 text-center">
            {t('Dobrý den', 'Hello')}, {employeeName}!
          </h1>
          <p className="text-slate-400 text-sm sm:text-xl">{t('Vyberte typ pracovního místa:', 'Select work location:')}</p>

          {/* Work type selection */}
          {(() => {
            const hoWorkTypes = workTypes.filter((wt) => isHomeOffice(wt.name));
            const regularTypes = workTypes.filter((wt) => !isHomeOffice(wt.name));
            const primaryWt = employeeDepartment
              ? regularTypes.find((wt) => wt.name.toLowerCase() === employeeDepartment.toLowerCase())
              : null;
            const visibleRegular = (primaryWt && !showAllWorkTypes) ? [primaryWt] : regularTypes;
            return (
              <div className="w-full flex flex-col items-center gap-4">
                {/* HomeOffice banner — distinct section for retrospective entry */}
                {hoWorkTypes.length > 0 && (
                  <div className="w-full">
                    <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 text-center">{t('HomeOffice', 'HomeOffice')}</p>
                    {hoWorkTypes.map((wt) => (
                      <button
                        key={wt.id}
                        onClick={() => {
                          setHoFormDate(localDateStr(0));
                          setHoFormStart('');
                          setHoFormEnd('');
                          setHoFormSummary('');
                          setHoFormError('');
                          setHoFormWorkTypeId(wt.id);
                          setHoFormWorkTypeName(wt.name);
                          setScreen('ho-form');
                        }}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-500/40 hover:border-emerald-400/70 text-white font-semibold text-base sm:text-lg transition-all duration-150 active:scale-[0.98]"
                      >
                        <span className="text-3xl shrink-0">🏠</span>
                        <div className="flex-1 text-left">
                          <div className="font-bold">{wt.name}</div>
                          <div className="text-emerald-300 text-sm font-normal">{t('Zpětné zadání docházky', 'Retrospective attendance entry')}</div>
                        </div>
                        <span className="text-emerald-400 text-xl">→</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Regular work types */}
                {visibleRegular.length > 0 && (
                  <>
                    {hoWorkTypes.length > 0 && (
                      <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{t('Přítomnost na pracovišti', 'On-site attendance')}</p>
                    )}
                    {/* Mobile list */}
                    <div className="flex flex-col gap-2 sm:hidden w-full">
                      {visibleRegular.map((wt, idx) => {
                        const colorClass = WORK_TYPE_COLORS[wt.name] ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                        const icon = WORK_TYPE_ICONS[wt.name] ?? '💼';
                        const isSelected = selectedWorkType?.id === wt.id;
                        return (
                          <button key={wt.id} onClick={() => setSelectedWorkType(wt)}
                            className={`${colorClass} flex items-center gap-3 px-4 py-3 rounded-xl w-full text-white font-semibold text-base transition-all duration-150 active:scale-[0.98] ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1e293b] brightness-110' : 'opacity-80'}`}
                          >
                            <span className="text-2xl shrink-0">{wt.icon ?? icon}</span>
                            <span className="flex-1 text-left">{wt.name}</span>
                            {isSelected && <span className="text-white/80 text-lg">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    {/* Desktop grid */}
                    <div className="hidden sm:grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                      {visibleRegular.map((wt, idx) => {
                        const colorClass = WORK_TYPE_COLORS[wt.name] ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                        const icon = WORK_TYPE_ICONS[wt.name] ?? '💼';
                        const isSelected = selectedWorkType?.id === wt.id;
                        return (
                          <button key={wt.id} onClick={() => setSelectedWorkType(wt)}
                            className={`${colorClass} flex flex-col items-center justify-center gap-3 p-6 rounded-2xl min-h-[120px] text-white font-semibold text-xl transition-all duration-150 active:scale-95 ${isSelected ? 'ring-4 ring-white ring-offset-2 ring-offset-[#1e293b] scale-105' : ''}`}
                          >
                            <span className="text-4xl">{wt.icon ?? icon}</span>
                            <span>{wt.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* "Více" button */}
                    {primaryWt && !showAllWorkTypes && (
                      <button
                        onClick={() => setShowAllWorkTypes(true)}
                        className="text-slate-400 hover:text-slate-200 text-sm font-medium underline underline-offset-2 transition-colors mt-1"
                      >
                        {t('Více možností', 'More options')}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          <div className="flex gap-3 w-full mt-1">
            <button
              onClick={() => { setScreen('pin'); setPin(''); }}
              className="flex-1 min-h-[48px] sm:min-h-[64px] bg-slate-700 hover:bg-slate-600 text-white text-base sm:text-xl font-semibold rounded-xl transition-all active:scale-95"
            >
              {t('Zpět', 'Back')}
            </button>
            <button
              onClick={handleCheckin}
              disabled={!selectedWorkType || loading}
              className="flex-[2] min-h-[48px] sm:min-h-[64px] bg-emerald-600 hover:bg-emerald-500 text-white text-base sm:text-xl font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {t('Zaznamenat příchod', 'Clock in')}
            </button>
          </div>
        </div>
      )}

      {/* Check-out Screen */}
      {screen === 'checkout' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-8">
          <h1 className="text-4xl font-bold text-slate-100 text-center">
            {t('Dobrý den', 'Hello')}, {employeeName}!
          </h1>

          {presence && (
            <div className="bg-slate-700 rounded-2xl p-6 w-full text-center space-y-2">
              <p className="text-slate-400 text-lg">{t('Přihlášen/a od', 'Logged in since')}</p>
              <p className="text-3xl font-bold text-white">
                {formatTime(presence.checkIn)}
              </p>
              {presence.workTypeName && (
                <p className="text-slate-300 text-xl">({presence.workTypeName})</p>
              )}
            </div>
          )}

          <div className="flex gap-4 w-full">
            <button
              onClick={() => { setScreen('pin'); setPin(''); }}
              className="flex-1 min-h-[64px] bg-slate-700 hover:bg-slate-600 text-white text-xl font-semibold rounded-xl transition-all active:scale-95"
            >
              {t('Zpět', 'Back')}
            </button>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="flex-[2] min-h-[64px] bg-amber-600 hover:bg-amber-500 text-white text-xl font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {t('Zaznamenat odchod', 'Clock out')}
            </button>
          </div>
        </div>
      )}

      {/* HomeOffice Retrospective Form */}
      {screen === 'ho-form' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-5">
          <div className="text-center">
            <div className="text-5xl mb-2">🏠</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">{t('HomeOffice — Zpětné zadání', 'HomeOffice — Retrospective entry')}</h1>
            <p className="text-slate-400 mt-1 text-base">{t('Zadejte kdy jste pracoval(a) z domova', 'Enter when you worked from home')}</p>
          </div>

          {/* Date picker with quick buttons */}
          <div className="w-full bg-slate-800 rounded-2xl p-4 flex flex-col gap-3">
            <label className="text-slate-400 text-sm font-medium uppercase tracking-wider">{t('Datum', 'Date')}</label>
            <div className="flex gap-2 flex-wrap">
              {[0, 1].map((back) => {
                const d = localDateStr(back);
                const label = back === 0 ? t('Dnes', 'Today') : t('Včera', 'Yesterday');
                return (
                  <button
                    key={back}
                    onClick={() => setHoFormDate(d)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${hoFormDate === d ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {label}
                  </button>
                );
              })}
              <input
                type="date"
                value={hoFormDate}
                max={localDateStr(0)}
                onChange={(e) => setHoFormDate(e.target.value)}
                className="flex-1 min-w-[140px] bg-slate-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Time range */}
          <div className="w-full bg-slate-800 rounded-2xl p-4 flex flex-col gap-3">
            <label className="text-slate-400 text-sm font-medium uppercase tracking-wider">{t('Pracovní doba', 'Working hours')}</label>
            <div className="flex gap-3 items-center">
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-slate-400 text-xs">{t('Od', 'From')}</span>
                <input
                  type="time"
                  value={hoFormStart}
                  onChange={(e) => setHoFormStart(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-xl px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
                />
              </div>
              <span className="text-slate-500 text-2xl mt-4">–</span>
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-slate-400 text-xs">{t('Do', 'To')}</span>
                <input
                  type="time"
                  value={hoFormEnd}
                  onChange={(e) => setHoFormEnd(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-xl px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
                />
              </div>
            </div>
            {hoFormStart && hoFormEnd && hoFormEnd > hoFormStart && (
              <p className="text-emerald-400 text-sm text-center">
                {(() => {
                  const [sh, sm] = hoFormStart.split(':').map(Number);
                  const [eh, em] = hoFormEnd.split(':').map(Number);
                  const totalMins = (eh * 60 + em) - (sh * 60 + sm);
                  const h = Math.floor(totalMins / 60);
                  const m = totalMins % 60;
                  return `${t('Celkem', 'Total')}: ${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`;
                })()}
              </p>
            )}
          </div>

          {/* Activity summary */}
          <div className="w-full bg-slate-800 rounded-2xl p-4 flex flex-col gap-3">
            <label className="text-slate-400 text-sm font-medium uppercase tracking-wider">{t('Popis činnosti (volitelné)', 'Activity summary (optional)')}</label>
            <textarea
              value={hoFormSummary}
              onChange={(e) => setHoFormSummary(e.target.value)}
              placeholder={t('Např. Zpracování faktur, videokonference, příprava prezentace...', 'E.g. Invoice processing, video call, preparing presentation...')}
              rows={3}
              className="w-full bg-slate-700 text-white rounded-xl p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-500"
            />
          </div>

          {/* Error */}
          {hoFormError && (
            <p className="text-red-400 text-sm text-center bg-red-900/30 rounded-xl px-4 py-2 w-full">{hoFormError}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setScreen('checkin')}
              className="flex-1 min-h-[56px] bg-slate-700 hover:bg-slate-600 text-white text-base font-semibold rounded-xl transition-all active:scale-95"
            >
              {t('Zpět', 'Back')}
            </button>
            <button
              onClick={handleHoRecord}
              disabled={!hoFormDate || !hoFormStart || !hoFormEnd || hoLoading}
              className="flex-[2] min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {hoLoading
                ? <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : null}
              {t('Uložit docházku', 'Save attendance')}
            </button>
          </div>
        </div>
      )}

      {/* HomeOffice Activity Dialog */}
      {screen === 'ho-activity' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="text-6xl mb-3">🏠</div>
            <h1 className="text-3xl font-bold text-slate-100">{t('Zpráva o činnosti', 'Activity report')}</h1>
            <p className="text-slate-400 mt-2 text-lg">{t('Co jste dnes na HomeOffice dělal(a)?', 'What did you work on from home today?')}</p>
          </div>
          <textarea
            value={hoNote}
            onChange={(e) => setHoNote(e.target.value)}
            placeholder={t('Např. Zpracování faktur, videokonference s klientem, příprava prezentace...', 'E.g. Invoice processing, client video call, preparing presentation...')}
            className="w-full bg-slate-700 text-white rounded-2xl p-5 text-base min-h-[150px] resize-none outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-500"
            rows={5}
            autoFocus
          />
          <div className="flex gap-3 w-full">
            <button
              onClick={() => handleHoNoteSubmit(true)}
              className="flex-1 min-h-[56px] bg-slate-700 hover:bg-slate-600 text-white text-base font-semibold rounded-xl transition-all active:scale-95"
            >
              {t('Přeskočit', 'Skip')}
            </button>
            <button
              onClick={() => handleHoNoteSubmit(false)}
              disabled={!hoNote.trim() || hoLoading}
              className="flex-[2] min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {hoLoading
                ? <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : null}
              {t('Odeslat zprávu', 'Submit report')}
            </button>
          </div>
        </div>
      )}

      {/* Success Check-in Screen */}
      {screen === 'success-checkin' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 bg-emerald-600 rounded-3xl p-12">
          <div className="text-8xl">✓</div>
          <p className="text-3xl font-bold text-white text-center">{successMessage}</p>
          <p className="text-emerald-200 text-lg">{t('Zavírám za 3 sekundy...', 'Closing in 3 seconds...')}</p>
        </div>
      )}

      {/* Success Check-out Screen */}
      {screen === 'success-checkout' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 bg-emerald-600 rounded-3xl p-12">
          <div className="text-8xl">✓</div>
          <p className="text-3xl font-bold text-white text-center">{successMessage}</p>
          <p className="text-emerald-200 text-lg">{t('Zavírám za 3 sekundy...', 'Closing in 3 seconds...')}</p>
        </div>
      )}

      {/* Error Screen */}
      {screen === 'error' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 bg-red-700 rounded-3xl p-12">
          <div className="text-8xl">✗</div>
          <p className="text-3xl font-bold text-white text-center">{errorMessage}</p>
          <p className="text-red-200 text-lg">{t('Zavírám za 3 sekundy...', 'Closing in 3 seconds...')}</p>
        </div>
      )}
    </div>
  );
}
