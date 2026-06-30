'use client';

import { useEffect, useState } from 'react';

interface PinPadProps {
  title: string;
  subtitle?: string;
  onConfirm: (pin: string) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  /** If provided, renders a separate big button below pad instead of using ✓ key */
  confirmLabel?: string;
  maxLength?: number;
}

export default function PinPad({
  title,
  subtitle,
  onConfirm,
  loading = false,
  error = null,
  confirmLabel,
  maxLength = 8,
}: PinPadProps) {
  const [pin, setPin] = useState('');

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

  // Layout: 1-9 on rows 1-3, then ⌫ / 0 / ✓
  const buttons: string[] = confirmLabel
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

  return (
    <div className="flex-1 bg-[#1e293b] flex flex-col items-center justify-center p-6 select-none">
      <div className="w-full max-w-xs flex flex-col items-center gap-7">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
        </div>

        {/* PIN dots */}
        <div className="flex gap-4 items-center justify-center h-10">
          {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                i < pin.length ? 'bg-white scale-110' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm font-medium animate-pulse -mt-3 text-center px-2">
            {error}
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {buttons.map((btn, idx) => {
            if (btn === '') return <div key={idx} />;
            const isDelete = btn === '⌫';
            const isConfirm = btn === '✓';
            const disabled = loading || (isConfirm && pin.length < 4) || ((isConfirm || isDelete) && loading);

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
                  'min-h-[68px] text-2xl font-bold rounded-2xl transition-all duration-100 active:scale-95',
                  isConfirm
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed'
                    : isDelete
                    ? 'bg-slate-600 hover:bg-slate-500 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white',
                  'disabled:cursor-not-allowed',
                ].join(' ')}
              >
                {loading && isConfirm ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
            className="w-full min-h-[56px] bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : confirmLabel}
          </button>
        )}
      </div>
    </div>
  );
}
