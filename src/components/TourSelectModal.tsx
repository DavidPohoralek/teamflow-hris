'use client';

const PRICING_URL = 'https://tmflw.com/#cenik';

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            aria-label="Zavřít"
          >
            ✕
          </button>
        )}
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-8 py-8 text-white text-center">
          <div className="text-4xl mb-3">🎓</div>
          <h2 className="text-xl font-bold">Průvodce aplikací</h2>
          <p className="text-blue-100 text-sm mt-1">App tutorial</p>
        </div>

        <div className="px-8 py-6">
          <p className="text-slate-700 text-sm text-center mb-6">
            Chcete si projít průvodce aplikací?<br/>
            <span className="text-slate-400">Would you like a quick app tour?</span>
          </p>

          {/* Language choice + start */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => onStart('cs')}
              className="flex flex-col items-center gap-2 py-4 px-4 bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-400 rounded-xl transition-all group"
            >
              <span className="text-2xl">🇨🇿</span>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">Česky</span>
              <span className="text-xs text-slate-400">Spustit průvodce</span>
            </button>
            <button
              onClick={() => onStart('en')}
              className="flex flex-col items-center gap-2 py-4 px-4 bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-400 rounded-xl transition-all group"
            >
              <span className="text-2xl">🇬🇧</span>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">English</span>
              <span className="text-xs text-slate-400">Start tour</span>
            </button>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">nebo / or</span></div>
          </div>

          <button
            onClick={handleSkip}
            className="w-full py-2.5 px-4 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200"
          >
            Přeskočit a vybrat předplatné → / Skip to pricing →
          </button>

          <p className="text-xs text-slate-400 text-center mt-3">
            Průvodce lze spustit kdykoliv přes tlačítko <strong>?</strong> v aplikaci
          </p>
        </div>
      </div>
    </div>
  );
}
