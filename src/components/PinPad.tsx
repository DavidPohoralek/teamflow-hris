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
      <div className="w-full max-w-[400px] bg-white border border-[#e5e3df] rounded-[16px] px-[26px] sm:px-[34px] pt-7 pb-6 flex flex-col items-center gap-5"
        style={{ boxShadow: '0 1px 2px rgba(17,24,32,.04), 0 12px 32px rgba(17,24,32,.07)' }}>
        {/* Clock header */}
        {showClock && now && (
          <div className="text-center">
            <p className="tf-mono text-[10.5px] tracking-[.14em]" style={{ color: '#a2a8b0' }}>
              {CZ_DAYS[now.getDay()]} {now.getDate()}. {CZ_MONTHS_GEN[now.getMonth()]}
            </p>
            <p className="tf-mono text-[52px] font-semibold leading-none tracking-tight mt-2" style={{ color: '#111820', fontVariantNumeric: 'tabular-nums' }}>
              {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
            </p>
          </div>
        )}

        {/* Silent status — e.g. "15 lidí ve směně" */}
        {status && (
          <div className="flex items-center gap-2 -mt-2">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: status.dot }} />
            <span className="text-[12px]" style={{ color: '#8a929c' }}>{status.text}</span>
          </div>
        )}

        {/* Divider */}
        <span className="w-8 h-px bg-[#e5e3df] my-1" />

        {/* Title */}
        <div className="text-center -mt-1">
          <h1 className="text-[13.5px] font-normal" style={{ color: '#5c6672' }}>{title}</h1>
          {subtitle && <p className="text-[12.5px] mt-1" style={{ color: '#8a929c' }}>{subtitle}</p>}
        </div>

        {/* PIN dots */}
        <div className="flex gap-3.5 items-center justify-center h-4">
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
          <p className="text-[13px] font-medium animate-pulse -mt-2 text-center px-2" style={{ color: '#9c4a3f' }}>
            {error}
          </p>
        )}

        {/* Keypad — white key cards, dark submit (spec 4a) */}
        <div className="grid grid-cols-3 gap-[9px] w-full">
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
                  'min-h-[64px] rounded-[9px] transition-all duration-100 active:scale-[.97] flex items-center justify-center',
                  isConfirm
                    ? 'bg-[#111820] hover:bg-[#2a333e] text-white disabled:opacity-30 disabled:cursor-not-allowed'
                    : 'bg-white border border-[#e2e0dc] hover:bg-[#f4f2ef] text-[22px] font-medium text-[#111820]',
                  'disabled:cursor-not-allowed',
                ].join(' ')}
              >
                {loading && isConfirm ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isDelete ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 6H8l-5 6 5 6h13a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1Z" />
                    <path d="m12 9 6 6M18 9l-6 6" />
                  </svg>
                ) : isConfirm ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                ) : btn}
              </button>
            );
          })}
        </div>

        {/* Optional confirm button below pad */}
        {confirmLabel && (
          <button
            onClick={handleConfirm}
            disabled={pin.length < 4 || loading}
            className="w-full min-h-[52px] bg-[#111820] hover:bg-[#2a333e] text-white text-[15px] font-medium rounded-[9px] transition-all active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : confirmLabel}
          </button>
        )}

        {/* Always render the footer slot so the keypad sits at the same height
            whether or not a footer is supplied (Příchod/Odchod vs Zaměstnanec). */}
        <p className="text-[12.5px] text-center min-h-[16px]" style={{ color: '#8a929c' }}>{footer ?? ' '}</p>
      </div>
    </div>
  );
}
