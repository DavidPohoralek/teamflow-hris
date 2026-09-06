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
        className="relative w-full max-w-[380px] bg-white rounded-2xl"
        style={{ border: `1px solid ${LINE}`, boxShadow: '0 24px 56px -16px rgba(17,24,32,.45)' }}
      >
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-full text-xs transition-opacity hover:opacity-70"
            style={{ background: '#f4f2ee', color: FAINT }}
            aria-label="Zavřít"
          >
            ✕
          </button>
        )}

        <div className="px-6 pt-6 pb-5">
          {/* Header — mark and title on one line, not a stacked hero */}
          <div className="flex items-center gap-2.5">
            <TeamFlowMark className="w-[30px] h-[30px]" />
            <div className="leading-tight">
              <h2 className="text-[17px] font-semibold tracking-[-.015em] m-0" style={{ color: INK }}>
                Průvodce aplikací
              </h2>
              <p className="text-[12.5px] m-0" style={{ color: FAINT }}>App tour</p>
            </div>
          </div>

          <p className="text-[13.5px] mt-4 mb-0 leading-relaxed" style={{ color: MUTED }}>
            Za minutu vám ukážeme směny, docházku a Správu.
          </p>
          <p className="text-[12.5px] mt-1 mb-0 leading-relaxed" style={{ color: FAINT }}>
            A one-minute tour of shifts, attendance and the manager view.
          </p>

          <div className="grid grid-cols-2 gap-2.5 mt-5">
            <button
              onClick={() => onStart('cs')}
              className="py-2.5 px-3 rounded-[10px] text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: INK }}
            >
              Česky →
            </button>
            <button
              onClick={() => onStart('en')}
              className="py-2.5 px-3 rounded-[10px] text-[13.5px] font-semibold transition-colors hover:bg-[#faf9f7]"
              style={{ border: `1px solid #ddd8d0`, color: INK }}
            >
              English →
            </button>
          </div>
        </div>

        <div
          className="px-6 py-3.5 flex items-center justify-between gap-3 rounded-b-2xl"
          style={{ borderTop: `1px solid ${LINE}`, background: '#faf9f7' }}
        >
          <span className="text-[11.5px] leading-snug" style={{ color: FAINT }}>
            Později tlačítkem <strong style={{ color: ORANGE }}>?</strong> vpravo dole
          </span>
          <button
            onClick={handleSkip}
            className="text-[12.5px] font-medium whitespace-nowrap transition-opacity hover:opacity-70"
            style={{ color: MUTED }}
          >
            Přeskočit →
          </button>
        </div>
      </div>
    </div>
  );
}
