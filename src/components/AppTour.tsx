'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';

const PRICING_URL = 'https://tmflw.com/#cenik';
const PAD = 10; // spotlight padding around element

// ─── Icons ───────────────────────────────────────────────────────────────────

type IconName =
  | 'sparkle' | 'calendar' | 'table' | 'key' | 'plus' | 'copy'
  | 'chart' | 'clock' | 'user' | 'sun' | 'lock' | 'flag';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M15 9v11" /></>,
  key: <><circle cx="8" cy="12" r="4" /><path d="M12 12h9M17 12v3M20 12v2" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
};

function StepIcon({ name }: { name: IconName }) {
  return (
    <span className="w-9 h-9 rounded-[10px] grid place-content-center flex-none"
      style={{ background: '#fbf8f3', border: '1px solid #e6e2db', color: '#C97C2A' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[name]}
      </svg>
    </span>
  );
}

// ─── Step definitions ─────────────────────────────────────────────────────────

interface TourStep {
  target?: string;
  icon: IconName;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  hintCs?: string;
  hintEn?: string;
  preferSide?: 'top' | 'bottom' | 'left' | 'right';
  switchTab?: string; // tab id to switch to before showing this step
}

export type ShiftView = 'teamflow' | 'googlesheets';

// Shifts come in two styles and the company runs ONE of them (a manager picks it
// in Správa → Nastavení). The steps that talk about entering a shift therefore
// differ per style — the table view has no "+ Přidat směnu" button and no copy
// icon, you work in the cells. Building the list per style keeps every step
// pointing at something the user can actually see.
function buildSteps(view: ShiftView): TourStep[] {
  const table = view === 'googlesheets';

  const shiftEntry: TourStep = table
    ? {
        target: 'shift-grid',
        icon: 'plus',
        titleCs: 'Zadání směny',
        titleEn: 'Entering a shift',
        descCs: 'Klikněte na buňku v průsečíku zaměstnance a dne a zadejte časy. Pravým tlačítkem otevřete nabídku — smazat, označit volno nebo zkopírovat na další dny.',
        descEn: 'Click the cell where an employee meets a day and type the times. Right-click opens a menu — delete, mark a day off, or copy to other days.',
        preferSide: 'top',
        switchTab: 'schedule',
      }
    : {
        target: 'add-shift',
        icon: 'plus',
        titleCs: 'Přidání směny',
        titleEn: 'Adding a shift',
        descCs: 'Kliknutím na „+ Přidat směnu“ nebo přímo na libovolný den v kalendáři přidáte zaměstnanci novou směnu.',
        descEn: 'Click "+ Add shift" or directly on any day in the calendar to assign a new shift to an employee.',
        preferSide: 'bottom',
        switchTab: 'schedule',
      };

  const shiftRepeat: TourStep = table
    ? {
        target: 'shift-grid',
        icon: 'copy',
        titleCs: 'Opakující se směny',
        titleEn: 'Recurring shifts',
        descCs: 'Řádek je jeden člověk, sloupec jeden den — celý měsíc týmu vidíte najednou. Hotový rozpis stáhnete do kalendáře tlačítkem s ikonou kalendáře v liště.',
        descEn: 'A row is one person, a column one day — you see the whole team month at once. Export the finished plan to your calendar with the calendar button in the toolbar.',
        preferSide: 'top',
        switchTab: 'schedule',
      }
    : {
        target: 'copy-shift',
        icon: 'copy',
        titleCs: 'Kopírování směny',
        titleEn: 'Copy shift',
        descCs: 'Po přihlášení PINem se u vaší směny objeví ikonka kopírování. Klikněte na ni a pak na dny, kam chcete směnu zkopírovat.',
        descEn: 'After PIN login, a copy icon appears on your shift. Click it, then click the days you want to copy the shift to.',
        hintCs: 'Nejrychlejší způsob, jak naplánovat opakující se směny bez ručního zadávání.',
        hintEn: 'The fastest way to schedule recurring shifts without manual entry.',
        preferSide: 'bottom',
        switchTab: 'schedule',
      };

  return [
    {
      icon: 'sparkle',
      titleCs: 'Vítejte v TeamFlow',
      titleEn: 'Welcome to TeamFlow',
      descCs: 'Provedeme vás klíčovými funkcemi aplikace. Průvodce trvá asi minutu a kdykoli ho můžete přeskočit.',
      descEn: 'We\'ll walk you through the key features. The tour takes about a minute and you can skip it anytime.',
    },
    {
      target: 'tab-schedule',
      icon: table ? 'table' : 'calendar',
      titleCs: table ? 'Směny — tabulkový styl' : 'Směny — kalendářový styl',
      titleEn: table ? 'Shifts — table style' : 'Shifts — calendar style',
      descCs: table
        ? 'Vaše firma má zapnutý tabulkový styl: řádky jsou zaměstnanci, sloupce dny v měsíci. Hodí se, když chcete vidět celý tým na jedné obrazovce.'
        : 'Vaše firma má zapnutý kalendářový styl: každý den v měsíci je jedna buňka se směnami. Hodí se, když plánujete spíš po dnech než po lidech.',
      descEn: table
        ? 'Your company uses the table style: rows are employees, columns are days of the month. Good when you want the whole team on one screen.'
        : 'Your company uses the calendar style: each day of the month is one cell with its shifts. Good when you plan by day rather than by person.',
      hintCs: table
        ? 'Druhý styl se jmenuje TeamFlow-Směny a vypadá jako klasický kalendář. Přepnete ho ve Správě → Nastavení, platí pro celou firmu.'
        : 'Druhý styl se jmenuje GoogleSheets-Směny — velká tabulka, řádek na člověka. Přepnete ho ve Správě → Nastavení, platí pro celou firmu.',
      hintEn: table
        ? 'The other style, TeamFlow-Shifts, looks like a classic calendar. Switch it in Správa → Nastavení; it applies company-wide.'
        : 'The other style, GoogleSheets-Shifts, is one big table with a row per person. Switch it in Správa → Nastavení; it applies company-wide.',
      preferSide: 'bottom',
      switchTab: 'schedule',
    },
    {
      target: 'pin-input',
      icon: 'key',
      titleCs: 'Přihlášení PIN kódem',
      titleEn: 'PIN login',
      descCs: 'Zadejte svůj osobní PIN a stiskněte OK. Od té chvíle vidíte v záhlaví své jméno a spravujete vlastní směny.',
      descEn: 'Enter your personal PIN and press OK. From then on you see your name in the header and manage your own shifts.',
      hintCs: 'PIN dostanete od svého manažera. Kdykoli se můžete přihlásit znovu kliknutím do políčka.',
      hintEn: 'You receive your PIN from your manager. Click the field to log in again anytime.',
      preferSide: 'bottom',
      switchTab: 'schedule',
    },
    shiftEntry,
    shiftRepeat,
    {
      target: 'tab-overview',
      icon: 'chart',
      titleCs: 'Přehled přítomnosti',
      titleEn: 'Attendance overview',
      descCs: 'Přehled ukazuje v reálném čase, kdo je právě na směně, kdo přišel pozdě a jak na tom tým celkově je.',
      descEn: 'The Overview shows in real time who is currently on shift, who came late, and how the team is doing.',
      preferSide: 'bottom',
      switchTab: 'overview',
    },
    {
      target: 'tab-attendance',
      icon: 'clock',
      titleCs: 'Docházkový kiosek',
      titleEn: 'Attendance kiosk',
      descCs: 'Záložka Příchod/Odchod slouží jako kiosek u vstupu. Zaměstnanec zadá PIN a zaznamená příchod nebo odchod.',
      descEn: 'The Clock in/out tab works as an entrance kiosk. Employees enter their PIN to clock in or out.',
      hintCs: 'Funguje skvěle na tabletu postaveném u dveří.',
      hintEn: 'Works great on a tablet placed by the entrance.',
      preferSide: 'bottom',
      switchTab: 'attendance',
    },
    {
      target: 'tab-my-hours',
      icon: 'user',
      titleCs: 'Portál zaměstnance',
      titleEn: 'Employee portal',
      descCs: 'Záložka Zaměstnanec — každý pracovník tu vidí své odpracované hodiny, plánované směny a žádosti o dovolenou.',
      descEn: 'The Employee tab — each worker sees their hours worked, planned shifts and leave requests.',
      preferSide: 'bottom',
      switchTab: 'my-hours',
    },
    {
      target: 'tab-vacation',
      icon: 'sun',
      titleCs: 'Plánování dovolené',
      titleEn: 'Vacation planning',
      descCs: 'V záložce Dovolená žádají zaměstnanci o volno přímo z aplikace. Manažer žádost schválí jedním kliknutím.',
      descEn: 'In the Vacation tab employees request time off directly from the app. A manager approves with one click.',
      preferSide: 'bottom',
      switchTab: 'vacation',
    },
    {
      target: 'btn-manager',
      icon: 'lock',
      titleCs: 'Manažerský přístup',
      titleEn: 'Manager access',
      descCs: 'Toto tlačítko odemkne manažerský pohled: analytiku, exporty, AI asistenta směn a kompletní správu zaměstnanců.',
      descEn: 'This button unlocks the manager view: analytics, exports, the AI shift assistant and full employee management.',
      hintCs: 'Přihlásíte se heslem, které jste si zvolili při zakládání firmy. Změníte ho ve Správě → Nastavení.',
      hintEn: 'Sign in with the password you chose when setting up the company. Change it in Správa → Nastavení.',
      preferSide: 'bottom',
      switchTab: 'schedule',
    },
    {
      icon: 'flag',
      titleCs: 'Jste připraveni',
      titleEn: 'You\'re all set',
      descCs: 'Zvládli jste základy TeamFlow. Teď si vyberte předplatné a začněte naplno plánovat.',
      descEn: 'You\'ve mastered the basics. Now choose your plan and start scheduling.',
    },
  ];
}

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

// `clamped` = the card had to be moved to stay on screen, so it no longer sits
// flush against the spotlight and the arrow would point at nothing.
interface CardPos { top: number; left: number; side: 'top' | 'bottom' | 'left' | 'right' | 'center'; clamped?: boolean }

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

  // preferSide is a PREFERENCE, not a command: a tall target (the whole shift
  // grid) leaves no room above it, and honouring 'top' regardless pushed the
  // card off the top of the window.
  const fits = (s: 'top' | 'bottom' | 'left' | 'right') =>
    s === 'bottom' ? roomBelow >= CARD_H_EST + ARROW
    : s === 'top' ? roomAbove >= CARD_H_EST + ARROW
    : s === 'right' ? roomRight >= CARD_W + ARROW
    : roomLeft >= CARD_W + ARROW;

  const auto: 'top' | 'bottom' | 'left' | 'right' =
    fits('bottom') ? 'bottom' : fits('top') ? 'top' : fits('right') ? 'right' : 'left';
  const side = prefer && fits(prefer) ? prefer : auto;

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

  // Last resort: whatever the geometry said, keep the card on screen.
  const clampedTop = Math.max(12, Math.min(top, vh - CARD_H_EST - 12));
  const clampedLeft = Math.max(12, Math.min(left, vw - CARD_W - 12));
  const clamped = clampedTop !== top;

  return { top: clampedTop, left: clampedLeft, side, clamped };
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
  shiftView?: ShiftView;
}

export default function AppTour({ lang, onClose, canClose, paid, onSwitchTab, shiftView = 'teamflow' }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<CardPos>({ top: 0, left: 0, side: 'center' });
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const t = useCallback((cs: string, en: string) => lang === 'en' ? en : cs, [lang]);

  // Paid users skip the pricing/Done step (the last entry)
  const allSteps = useMemo(() => buildSteps(shiftView), [shiftView]);
  const steps = useMemo(() => (paid ? allSteps.slice(0, -1) : allSteps), [paid, allSteps]);
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

  // CARD_H_EST is only a guess; a step carrying a hint is noticeably taller and
  // would hang off the bottom of the window. Re-clamp against what actually
  // rendered.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    setCardPos((prev) => {
      const top = Math.max(12, Math.min(prev.top, window.innerHeight - h - 12));
      return top === prev.top ? prev : { ...prev, top, clamped: true };
    });
  });

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
      {visible && !cardPos.clamped && <Arrow side={cardPos.side} cardPos={cardPos} rect={rect} />}

      {/* Tooltip card */}
      <div
        ref={cardRef}
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
        <div className="tf-sans bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #e6e2db', boxShadow: '0 18px 40px -12px rgba(17,24,32,.35)' }}>
          {/* Progress bar */}
          <div className="h-1" style={{ background: '#eae6df' }}>
            <div
              className="h-full transition-all duration-400"
              style={{ width: `${((stepIndex + 1) / total) * 100}%`, background: '#C97C2A' }}
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
                    className={`rounded-full transition-all duration-200 ${i === stepIndex ? 'w-4 h-2' : 'w-2 h-2'}`}
                    style={{ background: i === stepIndex ? '#C97C2A' : '#e0dbd3' }}
                  />
                ))}
              </div>
              {!isLast && (
                <button
                  onClick={markAndRedirect}
                  className="text-xs transition-colors hover:opacity-70"
                  style={{ color: '#9aa1aa' }}
                >
                  {t('Přeskočit →', 'Skip →')}
                </button>
              )}
              {canClose && (
                <button
                  onClick={onClose}
                  className="w-6 h-6 flex items-center justify-center rounded-full text-xs transition-colors hover:opacity-70"
                  style={{ background: '#f4f2ee', color: '#8a929c' }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Icon + title */}
            <div className="flex items-start gap-3 mb-3">
              <StepIcon name={step.icon} />
              <div className="min-w-0">
                <h3 className="font-semibold text-base leading-snug tracking-[-.01em]" style={{ color: '#111820' }}>
                  {t(step.titleCs, step.titleEn)}
                </h3>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: '#6b7480' }}>
                  {t(step.descCs, step.descEn)}
                </p>
              </div>
            </div>

            {/* Hint */}
            {(step.hintCs || step.hintEn) && (
              <div className="rounded-xl px-3 py-2 mb-3" style={{ background: '#fbf8f3', border: '1px solid #e6e2db' }}>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7480' }}>
                  {t(step.hintCs ?? '', step.hintEn ?? '')}
                </p>
              </div>
            )}

            {/* Done step pricing */}
            {isLast && (
              <div className="rounded-xl p-4 text-white mb-3" style={{ background: '#22272d' }}>
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
                    <span className="absolute -top-2 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: '#E8963C', color: '#111820' }}>
                      {t('Doporučeno', 'Recommended')}
                    </span>
                    <p className="font-bold text-sm">StoreForce</p>
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
                  className="px-4 py-2 rounded-[10px] text-sm font-medium transition-colors hover:bg-[#faf9f7]"
                  style={{ border: '1px solid #ddd8d0', color: '#111820' }}
                >
                  ← {t('Zpět', 'Back')}
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 py-2 px-4 rounded-[10px] text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: isLast ? '#C97C2A' : '#111820' }}
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
