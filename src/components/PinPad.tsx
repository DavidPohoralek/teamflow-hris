'use client';

import { useEffect, useState } from 'react';

interface PinPadProps {
  title: string;
  subtitle?: string;
  onConfirm: (pin: string) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  /** If provided, renders a separate big button below pad instead of using the submit key */
  confirmLabel?: string;
  maxLength?: number;
  /** Live clock + date header (kiosk); off for embedded logins */
  showClock?: boolean;
  /** Muted helper line under the pad, e.g. "Zapomenutý PIN? …" */
  footer?: string;
  /** Silent status line under the clock, e.g. a green dot + "15 lidí ve směně" */
  status?: { dot: string; text: string } | null;
}

const CZ_DAYS = ['NEDĚLE', 'PONDĚLÍ', 'ÚTERÝ', 'STŘEDA', 'ČTVRTEK', 'PÁTEK', 'SOBOTA'];
const CZ_MONTHS_GEN = ['LEDNA', 'ÚNORA', 'BŘEZNA', 'DUBNA', 'KVĚTNA', 'ČERVNA', 'ČERVENCE', 'SRPNA', 'ZÁŘÍ', 'ŘÍJNA', 'LISTOPADU', 'PROSINCE'];

export default function PinPad({
  title,
  subtitle,
  onConfirm,
  loading = false,
  error = null,
  confirmLabel,
  maxLength = 8,
  showClock = true,
  footer,
  status = null,
}: PinPadProps) {
  const [pin, setPin] = useState('');
  const [now, setNow] = useState<Date | null>(null);

  // Live clock (spec 4a kiosk: date + big mono time)
  useEffect(() => {
    if (!showClock) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, [showClock]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key >= '0' && e.key <= '9') {
        setPin((p) => p.length < maxLength ? p + e.key : p);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        setPin((p) => p.slice(0, -1));
      } else if (e.key === 'Enter') {
        setPin((p) => {
          if (p.length >= 4) { onConfirm(p); return ''; }
          return p;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [loading, maxLength, onConfirm]);

  const handleDigit = (d: string) => {
    if (pin.length >= maxLength) return;
    setPin((p) => p + d);
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const handleConfirm = async () => {
    if (pin.length < 4 || loading) return;
    const current = pin;
    setPin('');
    await onConfirm(current);
  };

  // Layout: 1-9 on rows 1-3, then ⌫ / 0 / submit (→)
  const buttons: string[] = confirmLabel
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

  return (
    <div className="tf-sans flex-1 bg-[#f2f0ec] flex flex-col items-center justify-center p-6 select-none overflow-auto">
      {/* 29b: rounded card with an orange left rail instead of the clipped corner */}
      <div
        className="w-full max-w-[352px] bg-white border border-[#e5e3df] rounded-[14px] px-6 sm:px-[28px] pt-6 pb-[22px] flex flex-col items-center"
        style={{ borderLeft: '3px solid #E8963C', boxShadow: '0 1px 2px rgba(17,24,32,.04), 0 10px 28px rgba(17,24,32,.06)' }}
      >
        {/* Flat brand mark — badge + T + accent stripe, no corner fold (29b) */}
        <svg viewBox="0 0 96 96" className="w-[26px] h-[26px]" role="img" aria-label="TeamFlow">
          <path d="M10 8h60l16 16v48l-16 16H10z" fill="#23282E" />
          <path d="M24 30h48v13H55v37H41V43H24z" fill="#FFFFFF" />
          <path d="M38.5 43h2.5v37h-2.5z" fill="#E8963C" />
        </svg>

        {/* Clock — height reserved so the card doesn't jump when it mounts
            (now stays null on the server / first paint to avoid hydration drift) */}
        {showClock && (
          <div className="text-center h-[63px] mt-[14px] flex flex-col justify-end">
            {now && (
              <>
                <p className="tf-mono text-[9.5px] tracking-[.16em] uppercase" style={{ color: '#a2a8b0' }}>
                  {CZ_DAYS[now.getDay()]} {now.getDate()}. {CZ_MONTHS_GEN[now.getMonth()]}
                </p>
                <p className="tf-mono text-[44px] font-semibold leading-none mt-[5px]"
                  style={{ color: '#111820', letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums' }}>
                  {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
                </p>
              </>
            )}
          </div>
        )}

        {/* Presence status — slot always rendered so the async count can't resize the card */}
        <div className="flex items-center justify-center gap-[7px] h-[16px] mt-[9px]">
          {status && (
            <>
              <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: status.dot }} />
              <span className="text-[11.5px]" style={{ color: '#8a929c' }}>{status.text}</span>
            </>
          )}
        </div>

        {/* Full-width hairline divider (29b) */}
        <div className="w-full h-px bg-[#f0eeea] mt-[18px] mb-[14px]" />

        {/* Title */}
        <div className="text-center">
          <h1 className="text-[12.5px] font-normal" style={{ color: '#5c6672' }}>{title}</h1>
          {subtitle && <p className="text-[11.5px] mt-1" style={{ color: '#8a929c' }}>{subtitle}</p>}
        </div>

        {/* PIN dots */}
        <div className="flex gap-[11px] items-center justify-center h-3 mt-[11px] mb-4">
          {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-150"
              style={{ background: i < pin.length ? '#111820' : '#dedbd6' }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-[12.5px] font-medium animate-pulse text-center px-2 -mt-1 mb-2" style={{ color: '#9c4a3f' }}>
            {error}
          </p>
        )}

        {/* Keypad — 56px keys, dark #23282e confirm (29b) */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {buttons.map((btn, idx) => {
            if (btn === '') return <div key={idx} />;
            const isDelete = btn === 'del';
            const isConfirm = btn === 'ok';
            const disabled = loading || (isConfirm && pin.length < 4);

            return (
              <button
                key={idx}
                disabled={disabled}
                onClick={() => {
                  if (isDelete) handleDelete();
                  else if (isConfirm) handleConfirm();
                  else handleDigit(btn);
                }}
                className={[
                  'h-[56px] rounded-[10px] transition-all duration-100 active:scale-[.97] flex items-center justify-center',
                  isConfirm
                    ? 'bg-[#23282e] hover:bg-[#2f3a45] text-white text-[16px] disabled:opacity-30 disabled:cursor-not-allowed'
                    : isDelete
                      ? 'bg-white border border-[#e5e3df] hover:bg-[#f4f2ef] text-[16px] font-medium text-[#111820]'
                      : 'bg-white border border-[#e5e3df] hover:bg-[#f4f2ef] text-[20px] font-medium text-[#111820]',
                  'disabled:cursor-not-allowed',
                ].join(' ')}
              >
                {loading && isConfirm ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isDelete ? '\u232B' : isConfirm ? '\u2192' : btn}
              </button>
            );
          })}
        </div>

        {/* Optional confirm button below the pad */}
        {confirmLabel && (
          <button
            onClick={handleConfirm}
            disabled={pin.length < 4 || loading}
            className="w-full h-[52px] mt-2 bg-[#23282e] hover:bg-[#2f3a45] text-white text-[15px] font-medium rounded-[10px] transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : confirmLabel}
          </button>
        )}

        {/* Footer slot always rendered — keeps the keypad at the same height on
            Příchod/Odchod (with footer) and Zaměstnanec (without) */}
        <p className="text-[11px] text-center min-h-[14px] mt-4" style={{ color: '#a2a8b0' }}>{footer ?? ' '}</p>
      </div>
    </div>
  );
}
