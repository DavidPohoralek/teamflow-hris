'use client';

import { TeamFlowMark } from '@/components/TeamFlowLogo';

const PRICING_URL = 'https://tmflw.com/#cenik';

const INK = '#111820';
const MUTED = '#6b7480';
const FAINT = '#9aa1aa';
const LINE = '#e6e2db';
const ORANGE = '#C97C2A';

interface Props {
  onStart: (lang: 'cs' | 'en') => void;
  onSkip: () => void;
  canClose?: boolean;
  onClose?: () => void;
}

export default function TourSelectModal({ onStart, onSkip, canClose, onClose }: Props) {
  async function handleSkip() {
    localStorage.setItem('tf_tour_seen', '1');
    try {
      await fetch('/api/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });
    } catch { /* ignore */ }
    onSkip();
    window.location.replace(PRICING_URL);
  }

  return (
    <div className="tf-sans fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: 'rgba(17,24,32,.55)', backdropFilter: 'blur(3px)' }} />
      <div
        className="relative w-full max-w-[420px] bg-white rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${LINE}`, boxShadow: '0 24px 56px -16px rgba(17,24,32,.45)' }}
      >
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full text-xs transition-opacity hover:opacity-70"
            style={{ background: '#f4f2ee', color: FAINT }}
            aria-label="Zavřít"
          >
            ✕
          </button>
        )}

        <div className="px-8 pt-8 pb-6 text-center">
          <div className="flex justify-center mb-4">
            <TeamFlowMark className="w-[38px] h-[38px]" />
          </div>
          <h2 className="text-[20px] font-semibold tracking-[-.015em] m-0" style={{ color: INK }}>
            Průvodce aplikací
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>
            Ukážeme vám, kde se plánují směny, jak se lidé hlásí do docházky a co všechno najdete ve Správě.
            Trvá to asi minutu.
          </p>
          <p className="text-[13px] mt-1.5" style={{ color: FAINT }}>
            A quick tour of shifts, attendance and the manager view.
          </p>
        </div>

        <div className="px-8 pb-7">
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <button
              onClick={() => onStart('cs')}
              className="flex flex-col items-center gap-0.5 py-3.5 px-4 rounded-xl transition-colors hover:bg-[#faf9f7]"
              style={{ border: `1.5px solid ${LINE}` }}
            >
              <span className="text-sm font-semibold" style={{ color: INK }}>Česky</span>
              <span className="text-xs" style={{ color: FAINT }}>Spustit průvodce</span>
            </button>
            <button
              onClick={() => onStart('en')}
              className="flex flex-col items-center gap-0.5 py-3.5 px-4 rounded-xl transition-colors hover:bg-[#faf9f7]"
              style={{ border: `1.5px solid ${LINE}` }}
            >
              <span className="text-sm font-semibold" style={{ color: INK }}>English</span>
              <span className="text-xs" style={{ color: FAINT }}>Start tour</span>
            </button>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full" style={{ borderTop: `1px solid ${LINE}` }} /></div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs" style={{ color: FAINT }}>nebo / or</span>
            </div>
          </div>

          <button
            onClick={handleSkip}
            className="w-full py-2.5 px-4 text-sm font-medium rounded-[10px] transition-colors hover:bg-[#faf9f7]"
            style={{ border: `1px solid #ddd8d0`, color: MUTED }}
          >
            Přeskočit a vybrat předplatné → / Skip to pricing →
          </button>

          <p className="text-xs text-center mt-3 leading-snug" style={{ color: FAINT }}>
            Průvodce spustíte kdykoli později tlačítkem{' '}
            <strong style={{ color: ORANGE }}>?</strong> vpravo dole.
          </p>
        </div>
      </div>
    </div>
  );
}
