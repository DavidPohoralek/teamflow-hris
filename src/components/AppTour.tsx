'use client';

import { useState, useEffect, useLayoutEffect, useCallback } from 'react';

const PRICING_URL = 'https://tmflw.com/#cenik';
const PAD = 10; // spotlight padding around element

// ─── Step definitions ─────────────────────────────────────────────────────────

interface TourStep {
  target?: string;
  icon: string;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  hintCs?: string;
  hintEn?: string;
  preferSide?: 'top' | 'bottom' | 'left' | 'right';
  switchTab?: string; // tab id to switch to before showing this step
}

const STEPS: TourStep[] = [
  {
    icon: '👋',
    titleCs: 'Vítejte v TeamFlow',
    titleEn: 'Welcome to TeamFlow',
    descCs: 'Provedeme vás klíčovými funkcemi aplikace. Průvodce trvá asi 1 minutu a kdykoli ho můžete přeskočit.',
    descEn: 'We\'ll walk you through the key features. The tour takes about 1 minute and you can skip it anytime.',
  },
  {
    target: 'tab-schedule',
    icon: '📅',
    titleCs: 'Plánování směn',
    titleEn: 'Shift planning',
    descCs: 'Záložka Směny zobrazuje plán celého týmu — každý den v měsíci jako buňka. Vidíte kdo a kdy pracuje.',
    descEn: 'The Shifts tab shows the full team plan — each day in the month as a cell. See who works when.',
    preferSide: 'bottom',
    switchTab: 'schedule',
  },
  {
    target: 'pin-input',
    icon: '🔑',
    titleCs: 'Přihlášení PIN kódem',
    titleEn: 'PIN login',
    descCs: 'Zadejte svůj osobní PIN a stiskněte OK. Od té chvíle vidíte vlastní jméno v záhlaví a máte přístup k vlastním směnám.',
    descEn: 'Enter your personal PIN and press OK. From then on you see your name in the header and can manage your own shifts.',
    hintCs: 'PIN dostanete od svého manažera. Po přihlášení stačí kliknout do políčka kdykoli znovu.',
    hintEn: 'You receive your PIN from your manager. After login, just click the field to re-enter anytime.',
    preferSide: 'bottom',
    switchTab: 'schedule',
  },
  {
    target: 'add-shift',
    icon: '➕',
    titleCs: 'Přidání směny',
    titleEn: 'Adding a shift',
    descCs: 'Kliknutím na "+ Přidat směnu" nebo přímo na libovolný den v kalendáři přidáte novou směnu zaměstnanci.',
    descEn: 'Click "+ Add shift" or directly on any day in the calendar to assign a new shift to an employee.',
    preferSide: 'bottom',
    switchTab: 'schedule',
  },
  {
    target: 'copy-shift',
    icon: '📋',
    titleCs: 'Kopírování směny',
    titleEn: 'Copy shift',
    descCs: 'Po přihlášení PINem se u vaší směny zobrazí ikonka kopírování. Klikněte na ni a pak klikejte na dny, kam chcete směnu zkopírovat.',
    descEn: 'After PIN login, a copy icon appears on your shift. Click it, then click the days you want to copy the shift to.',
    hintCs: 'Kopírování je rychlý způsob, jak naplánovat opakující se směny bez ručního zadávání.',
    hintEn: 'Copying is the fastest way to schedule recurring shifts without manual entry.',
    preferSide: 'bottom',
    switchTab: 'schedule',
  },
  {
    target: 'tab-overview',
    icon: '📊',
    titleCs: 'Přehled přítomnosti',
    titleEn: 'Attendance overview',
    descCs: 'Záložka Přehled ukazuje v reálném čase kdo je právě na směně, kdo přišel pozdě a celkový stav týmu.',
    descEn: 'The Overview tab shows in real time who is currently on shift, who came late, and the team status.',
    preferSide: 'bottom',
    switchTab: 'overview',
  },
  {
    target: 'tab-attendance',
    icon: '⏰',
    titleCs: 'Docházkový kiosek',
    titleEn: 'Attendance kiosk',
    descCs: 'Záložka Docházka slouží jako kiosek u vstupu. Zaměstnanec zadá PIN a zaznamená příchod nebo odchod.',
    descEn: 'The Attendance tab works as an entrance kiosk. Employees enter their PIN to clock in or out.',
    hintCs: 'Funguje skvěle na tabletu umístěném u dveří.',
    hintEn: 'Works great on a tablet placed by the entrance.',
    preferSide: 'bottom',
    switchTab: 'attendance',
  },
  {
    target: 'tab-my-hours',
    icon: '👤',
    titleCs: 'Portál zaměstnance',
    titleEn: 'Employee portal',
    descCs: 'Záložka Zaměstnanec — každý pracovník vidí své hodiny, plánované směny a žádosti o dovolenou.',
    descEn: 'The Employee tab — each worker sees their hours, planned shifts and leave requests.',
    preferSide: 'bottom',
    switchTab: 'my-hours',
  },
  {
    target: 'tab-vacation',
    icon: '🏖️',
    titleCs: 'Plánování dovolené',
    titleEn: 'Vacation planning',
    descCs: 'V záložce Dovolená zaměstnanci žádají o dovolenou přímo z aplikace. Manažer žádosti schvaluje jedním kliknutím.',
    descEn: 'In the Vacation tab employees request leave directly from the app. Managers approve with one click.',
    preferSide: 'bottom',
    switchTab: 'vacation',
  },
  {
    target: 'btn-manager',
    icon: '🔐',
    titleCs: 'Manažerský přístup',
    titleEn: 'Manager access',
    descCs: 'Toto tlačítko odemkne manažerský pohled: Analytiku, AI asistenta směn a kompletní správu zaměstnanců.',
    descEn: 'This button unlocks the manager view: Analytics, AI shift assistant and full employee management.',
    hintCs: 'Výchozí heslo je "manager123". Doporučujeme ho změnit v Nastavení.',
    hintEn: 'Default password is "manager123". We recommend changing it in Settings.',
    preferSide: 'bottom',
    switchTab: 'schedule',
  },
  {
    icon: '🎉',
    titleCs: 'Jste připraveni!',
    titleEn: 'You\'re all set!',
    descCs: 'Zvládli jste základy TeamFlow. Teď si vyberte předplatné a začněte naplno plánovat.',
    descEn: 'You\'ve mastered the basics. Now choose your plan and start scheduling.',
  },
];

// ─── Spotlight geometry ───────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ─── Tooltip positioning ──────────────────────────────────────────────────────

const CARD_W = 320;
const CARD_H_EST = 200; // rough estimate for off-screen avoidance
const ARROW = 12;

interface CardPos { top: number; left: number; side: 'top' | 'bottom' | 'left' | 'right' | 'center' }

function calcCardPos(rect: Rect | null, prefer?: 'top' | 'bottom' | 'left' | 'right'): CardPos {
  if (!rect) return { top: window.innerHeight / 2 - CARD_H_EST / 2, left: window.innerWidth / 2 - CARD_W / 2, side: 'center' };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spottedTop = rect.top - PAD;
  const spottedBot = rect.top + rect.height + PAD;
  const spottedLeft = rect.left - PAD;
  const spottedRight = rect.left + rect.width + PAD;

  const roomBelow = vh - spottedBot;
  const roomAbove = spottedTop;
  const roomRight = vw - spottedRight;
  const roomLeft = spottedLeft;

  const side = prefer ?? (roomBelow >= CARD_H_EST + ARROW ? 'bottom' : roomAbove >= CARD_H_EST + ARROW ? 'top' : roomRight >= CARD_W + ARROW ? 'right' : 'left');

  let top: number, left: number;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  if (side === 'bottom') {
    top = spottedBot + ARROW;
    left = Math.max(12, Math.min(cx - CARD_W / 2, vw - CARD_W - 12));
  } else if (side === 'top') {
    top = spottedTop - CARD_H_EST - ARROW;
    left = Math.max(12, Math.min(cx - CARD_W / 2, vw - CARD_W - 12));
  } else if (side === 'right') {
    top = Math.max(12, cy - CARD_H_EST / 2);
    left = spottedRight + ARROW;
  } else {
    top = Math.max(12, cy - CARD_H_EST / 2);
    left = roomLeft - CARD_W - ARROW;
  }

  return { top, left, side };
}

// ─── Components ───────────────────────────────────────────────────────────────

function SpotlightOverlay({ rect }: { rect: Rect | null }) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  if (!rect) {
    // No spotlight — simple dark overlay
    return (
      <div className="fixed inset-0 bg-slate-900/60 pointer-events-none" style={{ zIndex: 9998 }} />
    );
  }

  const sx = rect.left - PAD;
  const sy = rect.top - PAD;
  const sw = rect.width + PAD * 2;
  const sh = rect.height + PAD * 2;

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998, width: '100%', height: '100%' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id="tf-tour-mask">
          <rect x="0" y="0" width={vw} height={vh} fill="white" />
          <rect x={sx} y={sy} width={sw} height={sh} rx="8" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width={vw} height={vh} fill="rgba(15,23,42,0.65)" mask="url(#tf-tour-mask)" />
      {/* Pulsing border ring */}
      <rect
        x={sx - 2} y={sy - 2} width={sw + 4} height={sh + 4}
        rx="10" fill="none"
        stroke="rgba(99,102,241,0.8)" strokeWidth="2"
        style={{ animation: 'tf-pulse 1.8s ease-in-out infinite' }}
      />
      <style>{`
        @keyframes tf-pulse {
          0%, 100% { opacity: 0.4; stroke-width: 2; }
          50% { opacity: 1; stroke-width: 3; }
        }
      `}</style>
    </svg>
  );
}

function Arrow({ side, cardPos, rect }: { side: CardPos['side']; cardPos: CardPos; rect: Rect | null }) {
  if (!rect || side === 'center') return null;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const size = 10;

  let style: React.CSSProperties = {};
  if (side === 'bottom') {
    style = { top: cardPos.top - size, left: Math.min(cx - cardPos.left - size, CARD_W - 24) };
  } else if (side === 'top') {
    style = { top: cardPos.top + CARD_H_EST - 4, left: Math.min(cx - cardPos.left - size, CARD_W - 24) };
  } else if (side === 'right') {
    style = { top: cy - cardPos.top - size, left: cardPos.left - size * 2 };
  } else {
    style = { top: cy - cardPos.top - size, left: cardPos.left + CARD_W };
  }

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        zIndex: 10001,
        width: size * 2,
        height: size * 2,
        background: 'white',
        transform: 'rotate(45deg)',
        borderRadius: 2,
        ...style,
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lang: 'cs' | 'en';
  onClose: () => void;
  canClose?: boolean;
  paid?: boolean;
  onSwitchTab?: (tab: string) => void;
}

export default function AppTour({ lang, onClose, canClose, paid, onSwitchTab }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<CardPos>({ top: 0, left: 0, side: 'center' });
  const [visible, setVisible] = useState(false);

  const t = useCallback((cs: string, en: string) => lang === 'en' ? en : cs, [lang]);

  // Paid users skip the pricing/Done step (last STEPS entry)
  const steps = paid ? STEPS.slice(0, -1) : STEPS;
  const total = steps.length;
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  // Recalculate spotlight whenever step changes
  const recalc = useCallback(() => {
    const r = step.target ? getTargetRect(step.target) : null;
    setRect(r);
    setCardPos(calcCardPos(r, step.preferSide));
  }, [step]);

  useLayoutEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => {
      recalc();
      setVisible(true);
    });
    return () => cancelAnimationFrame(id);
  }, [recalc]);

  useEffect(() => {
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [recalc]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Scroll target into view when it exists
  useEffect(() => {
    if (step.target) {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [step.target]);

  async function markAndRedirect() {
    localStorage.setItem('tf_tour_seen', '1');
    try {
      await fetch('/api/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });
    } catch { /* ignore */ }
    onClose();
    window.location.replace(PRICING_URL);
  }

  function goToStep(i: number) {
    const target = steps[i];
    if (target?.switchTab) onSwitchTab?.(target.switchTab);
    setStepIndex(i);
  }

  function handleNext() {
    if (isLast) {
      if (paid) { onClose(); return; }
      markAndRedirect();
      return;
    }
    goToStep(stepIndex + 1);
  }

  function handleBack() {
    if (stepIndex > 0) goToStep(stepIndex - 1);
  }

  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      <SpotlightOverlay rect={rect} />

      {/* Tooltip arrow */}
      {visible && <Arrow side={cardPos.side} cardPos={cardPos} rect={rect} />}

      {/* Tooltip card */}
      <div
        className="fixed pointer-events-auto"
        style={{
          zIndex: 10000,
          top: cardPos.top,
          left: cardPos.left,
          width: CARD_W,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/30 overflow-hidden border border-slate-200">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-indigo-500 transition-all duration-400"
              style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
            />
          </div>

          <div className="p-5">
            {/* Top row: dots + skip */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToStep(i)}
                    className={`rounded-full transition-all duration-200 ${
                      i === stepIndex ? 'w-4 h-2 bg-indigo-500' : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>
              {!isLast && (
                <button
                  onClick={markAndRedirect}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {t('Přeskočit →', 'Skip →')}
                </button>
              )}
              {canClose && (
                <button
                  onClick={onClose}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 text-xs transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Icon + title */}
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl flex-shrink-0 leading-none mt-0.5">{step.icon}</span>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-base leading-snug">
                  {t(step.titleCs, step.titleEn)}
                </h3>
                <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                  {t(step.descCs, step.descEn)}
                </p>
              </div>
            </div>

            {/* Hint */}
            {(step.hintCs || step.hintEn) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                <p className="text-amber-700 text-xs leading-relaxed">
                  💡 {t(step.hintCs ?? '', step.hintEn ?? '')}
                </p>
              </div>
            )}

            {/* Done step pricing */}
            {isLast && (
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-4 text-white mb-3">
                <p className="font-semibold text-sm mb-3">{t('Vyberte si plán', 'Choose your plan')}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/15 rounded-lg p-3">
                    <p className="font-bold text-sm">Standard</p>
                    <p className="opacity-80 mt-0.5">1 190 Kč / {t('měs.', 'mo.')}</p>
                    <p className="opacity-60 mt-0.5 text-[11px] leading-snug">
                      {t('Plánování, docházka, analytika', 'Scheduling, attendance, analytics')}
                    </p>
                  </div>
                  <div className="bg-white/15 rounded-lg p-3 border border-white/40 relative">
                    <span className="absolute -top-2 -right-1 bg-amber-400 text-slate-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {t('Doporučeno', 'Recommended')}
                    </span>
                    <p className="font-bold text-sm flex items-center gap-1">StoreForce <span className="text-amber-300">✦</span></p>
                    <p className="opacity-80 mt-0.5">1 680 Kč / {t('měs.', 'mo.')}</p>
                    <p className="opacity-60 mt-0.5 text-[11px] leading-snug">
                      {t('Vše + AI asistent směn', 'Everything + AI shift assistant')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ← {t('Zpět', 'Back')}
                </button>
              )}
              <button
                onClick={handleNext}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
                  isLast
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/25'
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                }`}
              >
                {isLast
                  ? t('Vybrat předplatné →', 'Choose plan →')
                  : isFirst
                    ? t('Začít →', 'Get started →')
                    : t('Další →', 'Next →')
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
