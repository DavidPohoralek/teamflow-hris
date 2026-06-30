'use client';

import { useState, useEffect, useCallback } from 'react';
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
  | 'error';

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
  const [presence, setPresence] = useState<PresenceRecord | null>(null);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [selectedWorkType, setSelectedWorkType] = useState<WorkType | null>(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load work types
  useEffect(() => {
    fetch(`/api/public/work-types?orgId=${orgId}`)
      .then((r) => r.json())
      .then((json: { workTypes?: WorkType[] } | WorkType[]) => {
        const list = Array.isArray(json) ? json : (json.workTypes ?? []);
        setWorkTypes(list.filter((wt) => wt.category === 'shift' || wt.category === 'presence'));
      })
      .catch(() => {});
  }, [orgId]);

  const resetKiosk = useCallback(() => {
    setTimeout(() => {
      setScreen('pin');
      setPin('');
      setEmployeeName('');
      setEmployeeId('');
      setPresence(null);
      setSelectedWorkType(null);
      setSuccessMessage('');
      setErrorMessage('');
      setPinError(false);
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
      if (!res.ok) throw new Error();
      const now = new Date().toLocaleTimeString('cs-CZ', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setSuccessMessage(`${t('Příchod zaznamenán v', 'Clocked in at')} ${now}`);
      setScreen('success-checkin');
      resetKiosk();
    } catch {
      setErrorMessage(t('Chyba při záznamu příchodu. Zkuste to prosím znovu.', 'Error recording clock-in. Please try again.'));
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
        body: JSON.stringify({
          action: 'checkout',
          orgId,
          employeeId,
          pin,
        }),
      });
      if (!res.ok) throw new Error();
      const duration = presence ? formatDuration(presence.checkIn) : '';
      setSuccessMessage(`${t('Odchod zaznamenán. Odpracováno:', 'Clocked out. Time worked:')} ${duration}`);
      setScreen('success-checkout');
      resetKiosk();
    } catch {
      setErrorMessage(t('Chyba při záznamu odchodu. Zkuste to prosím znovu.', 'Error recording clock-out. Please try again.'));
      setScreen('error');
      resetKiosk();
    } finally {
      setLoading(false);
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
        <div className="w-full max-w-2xl flex flex-col items-center gap-8">
          <h1 className="text-4xl font-bold text-slate-100 text-center">
            {t('Dobrý den', 'Hello')}, {employeeName}!
          </h1>
          <p className="text-slate-400 text-xl">{t('Vyberte typ pracovního místa:', 'Select work location:')}</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
            {workTypes.map((wt, idx) => {
              const colorClass =
                WORK_TYPE_COLORS[wt.name] ??
                DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              const icon = WORK_TYPE_ICONS[wt.name] ?? '💼';
              const isSelected = selectedWorkType?.id === wt.id;

              return (
                <button
                  key={wt.id}
                  onClick={() => setSelectedWorkType(wt)}
                  className={`
                    ${colorClass}
                    flex flex-col items-center justify-center gap-3 p-6 rounded-2xl
                    min-h-[120px] text-white font-semibold text-xl
                    transition-all duration-150 active:scale-95
                    ${isSelected ? 'ring-4 ring-white ring-offset-2 ring-offset-[#1e293b] scale-105' : ''}
                  `}
                >
                  <span className="text-4xl">{wt.icon ?? icon}</span>
                  <span>{wt.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-4 w-full mt-2">
            <button
              onClick={() => { setScreen('pin'); setPin(''); }}
              className="flex-1 min-h-[64px] bg-slate-700 hover:bg-slate-600 text-white text-xl font-semibold rounded-xl transition-all active:scale-95"
            >
              {t('Zpět', 'Back')}
            </button>
            <button
              onClick={handleCheckin}
              disabled={!selectedWorkType || loading}
              className="flex-[2] min-h-[64px] bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
