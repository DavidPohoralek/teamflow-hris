'use client';

import { useState, useEffect, useRef } from 'react';

const PRICING_URL = 'https://selbickylabs.com/#teamflow';

// ─── CS video steps ────────────────────────────────────────────────────────────
// 5 videos → 7 total steps (welcome + 5 videos + done)

interface VideoStep {
  type: 'video';
  icon: string;
  title: string;
  desc: string;
  videoSrc: string;
}

interface TextStep {
  type: 'text';
  icon: string;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  hintCs?: string;
  hintEn?: string;
  targetLabel?: string;
}

interface WelcomeStep { type: 'welcome' }
interface DoneStep { type: 'done' }

type Step = WelcomeStep | VideoStep | TextStep | DoneStep;

const CS_STEPS: Step[] = [
  { type: 'welcome' },
  {
    type: 'video',
    icon: '📅',
    title: 'Plánování směn',
    desc: 'Jak vypadá tabulka směn a jak plánovat rozvrh celého týmu.',
    videoSrc: '/videos/tour/tour-plánovani.mp4',
  },
  {
    type: 'video',
    icon: '📊',
    title: 'Přehled přítomnosti',
    desc: 'Záložka Přehled — kdo je aktuálně na směně a stav týmu v reálném čase.',
    videoSrc: '/videos/tour/tour-prehled.mp4',
  },
  {
    type: 'video',
    icon: '⏰',
    title: 'Přihlašování na směnu',
    desc: 'Jak se zaměstnanec přihlásí na směnu pomocí PIN kódu v docházkovém kiosku.',
    videoSrc: '/videos/tour/tour-prihlasovani.mp4',
  },
  {
    type: 'video',
    icon: '👤',
    title: 'Portál zaměstnance',
    desc: 'Co vidí zaměstnanec po přihlášení — vlastní hodiny, směny a žádosti.',
    videoSrc: '/videos/tour/tour-zamestnanec.mp4',
  },
  {
    type: 'video',
    icon: '🏖️',
    title: 'Plánování dovolené',
    desc: 'Jak zaměstnanci žádají o dovolenou a jak manažer žádosti schvaluje.',
    videoSrc: '/videos/tour/tour-dovolena.mp4',
  },
  { type: 'done' },
];

const EN_STEPS: Step[] = [
  { type: 'welcome' },
  {
    type: 'text',
    icon: '📅',
    titleCs: 'Plánování směn',
    titleEn: 'Shift planning',
    descCs: 'Záložka Směny zobrazuje plán celého týmu. Každý sloupec = den, každý řádek = zaměstnanec.',
    descEn: 'The Shifts tab shows the full team plan. Each column = day, each row = employee.',
    hintEn: 'Click the "Shifts" tab in the top bar and explore the grid.',
    targetLabel: 'Tab: Shifts',
  },
  {
    type: 'text',
    icon: '✏️',
    titleCs: 'Přiřazení zaměstnance',
    titleEn: 'Assigning employees',
    descCs: 'Klikněte na libovolnou buňku pro přiřazení zaměstnance. Buňky lze kopírovat přetažením.',
    descEn: 'Click any cell to assign an employee. Cells can be copied by dragging.',
    hintEn: 'Try clicking an empty cell in the shift grid.',
    targetLabel: 'Tab: Shifts',
  },
  {
    type: 'text',
    icon: '📊',
    titleCs: 'Přehled přítomnosti',
    titleEn: 'Attendance overview',
    descCs: 'Záložka Přehled ukazuje kdo je aktuálně přihlášen na směně.',
    descEn: 'The Overview tab shows who is currently clocked in and live attendance status.',
    hintEn: 'Switch to the "Overview" tab.',
    targetLabel: 'Tab: Overview',
  },
  {
    type: 'text',
    icon: '👤',
    titleCs: 'Portál zaměstnance',
    titleEn: 'Employee portal',
    descCs: 'Záložka Zaměstnanec — osobní přehled hodin, směn a žádostí o dovolenou.',
    descEn: 'The Employee tab shows personal hours, shifts and leave requests without sharing passwords.',
    hintEn: 'Switch to the "Employee" tab.',
    targetLabel: 'Tab: Employee',
  },
  {
    type: 'text',
    icon: '⏰',
    titleCs: 'Docházkový kiosek',
    titleEn: 'Attendance kiosk',
    descCs: 'Záložka Docházka — zaměstnanec se přihlásí PIN kódem a označí příchod/odchod.',
    descEn: 'The Attendance tab works as a kiosk — employees clock in/out using their PIN code.',
    hintEn: 'Works great on a tablet placed at the entrance.',
    targetLabel: 'Tab: Attendance',
  },
  {
    type: 'text',
    icon: '🔐',
    titleCs: 'Manažerský přístup',
    titleEn: 'Manager access',
    descCs: 'Klikněte na "Manažer" vpravo nahoře, zadejte heslo. Odemknete Analytiku, Asistenta a Správu.',
    descEn: 'Click "Manager" top-right, enter your password to unlock Analytics, Assistant and Management.',
    hintEn: 'The "Manager" button is in the top-right of the navigation bar.',
    targetLabel: 'Button: Manager (top right)',
  },
  { type: 'done' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      className="w-full rounded-xl bg-slate-900 max-h-56 object-contain"
      controls
      playsInline
      muted
      autoPlay
    />
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  lang: 'cs' | 'en';
  onClose: () => void;
}

export default function AppTour({ lang, onClose }: Props) {
  const steps = lang === 'cs' ? CS_STEPS : EN_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const total = steps.length;
  const current = steps[stepIndex];
  const isLast = stepIndex === total - 1;

  const t = (cs: string, en: string) => lang === 'en' ? en : cs;

  function handleNext() {
    if (isLast) {
      localStorage.setItem('tf_tour_seen', '1');
      onClose();
      window.location.href = PRICING_URL;
    } else {
      setStepIndex(i => i + 1);
    }
  }

  function handleSkip() {
    localStorage.setItem('tf_tour_seen', '1');
    onClose();
    window.location.href = PRICING_URL;
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pb-6 px-4 pointer-events-none">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] pointer-events-auto" />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl pointer-events-auto border border-slate-200 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
          />
        </div>

        <div className="p-5">
          {/* Counter + skip */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {stepIndex + 1} / {total}
            </span>
            {!isLast && current.type !== 'welcome' && (
              <button onClick={handleSkip} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                {t('Přeskočit průvodce →', 'Skip tour →')}
              </button>
            )}
          </div>

          {/* ── Welcome step ── */}
          {current.type === 'welcome' && (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">🎓</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {t('Průvodce aplikací', 'App tour')}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {t(
                  'Provedeme vás základy TeamFlow pomocí krátkých videí. Celý průvodce trvá přibližně 2 minuty.',
                  'We\'ll walk you through TeamFlow basics step by step. The tour takes about 2 minutes.'
                )}
              </p>
            </div>
          )}

          {/* ── Video step (CS only) ── */}
          {current.type === 'video' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{current.icon}</span>
                <h3 className="text-base font-bold text-slate-900">{current.title}</h3>
              </div>
              <VideoPlayer src={current.videoSrc} />
              <p className="text-slate-500 text-xs mt-2 leading-relaxed">{current.desc}</p>
            </div>
          )}

          {/* ── Text step (EN) ── */}
          {current.type === 'text' && (
            <div>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl flex-shrink-0 mt-0.5">{current.icon}</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {t(current.titleCs, current.titleEn)}
                  </h3>
                  <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                    {t(current.descCs, current.descEn)}
                  </p>
                </div>
              </div>
              {current.targetLabel && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-2">
                  <span className="text-blue-500 text-sm">👆</span>
                  <span className="text-blue-700 text-xs font-semibold">{current.targetLabel}</span>
                </div>
              )}
              {(current.hintCs || current.hintEn) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <p className="text-amber-700 text-xs leading-relaxed">
                    💡 {t(current.hintCs ?? '', current.hintEn ?? '')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Done step ── */}
          {current.type === 'done' && (
            <div className="text-center py-2">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {t('Jste připraveni!', 'You\'re all set!')}
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                {t(
                  'Zvládli jste základy TeamFlow. Teď si vyberte předplatné.',
                  'You\'ve mastered the basics. Now choose your plan.'
                )}
              </p>
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-4 text-white text-left">
                <p className="font-semibold text-sm mb-3">{t('Vyberte si předplatné', 'Choose your plan')}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/15 rounded-lg p-3">
                    <p className="font-bold text-sm">Standard</p>
                    <p className="opacity-80 mt-1 leading-relaxed">
                      {t('Plánování, docházka, analytika', 'Scheduling, attendance, analytics')}
                    </p>
                  </div>
                  <div className="bg-white/15 rounded-lg p-3 border border-white/40 relative">
                    <span className="absolute -top-2 -right-1 bg-amber-400 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {t('Doporučeno', 'Recommended')}
                    </span>
                    <p className="font-bold text-sm flex items-center gap-1">Pro + AI <span className="text-amber-300">✦</span></p>
                    <p className="opacity-80 mt-1 leading-relaxed">
                      {t('Vše + AI asistent směn', 'Everything + AI shift assistant')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-4">
            {stepIndex > 0 && (
              <button onClick={() => setStepIndex(i => i - 1)}
                className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                ← {t('Zpět', 'Back')}
              </button>
            )}
            <button onClick={handleNext}
              className={`py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                isLast
                  ? 'flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-lg shadow-blue-500/25'
                  : 'flex-1 bg-blue-600 hover:bg-blue-700 text-white'
              }`}>
              {isLast
                ? t('Vybrat předplatné →', 'Choose plan →')
                : current.type === 'welcome'
                  ? t('Začít průvodce →', 'Start tour →')
                  : t('Další →', 'Next →')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
