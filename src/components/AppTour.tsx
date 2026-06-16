'use client';

import { useState, useEffect } from 'react';

const PRICING_URL = 'https://selbickylabs.com/#teamflow';

interface Step {
  icon: string;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  hintCs?: string;
  hintEn?: string;
  target?: 'schedule' | 'attendance' | 'overview' | 'my-hours' | 'manager' | 'management' | 'done';
}

const STEPS: Step[] = [
  {
    icon: '👋',
    titleCs: 'Vítejte v TeamFlow!',
    titleEn: 'Welcome to TeamFlow!',
    descCs: 'Provedeme vás základy systému. Průvodce trvá přibližně 2 minuty a ukáže vám vše potřebné.',
    descEn: 'We\'ll guide you through the basics. This walkthrough takes about 2 minutes.',
  },
  {
    icon: '📅',
    titleCs: 'Plánování směn',
    titleEn: 'Shift planning',
    descCs: 'Záložka Směny zobrazuje plán celého týmu. Každý sloupec = den, každý řádek = zaměstnanec.',
    descEn: 'The Shifts tab shows the full team plan. Each column = day, each row = employee.',
    hintCs: 'Klikněte na záložku "Směny" v horní liště a prohlédněte si tabulku.',
    hintEn: 'Click the "Shifts" tab in the top bar and explore the grid.',
    target: 'schedule',
  },
  {
    icon: '✏️',
    titleCs: 'Přiřazení zaměstnance',
    titleEn: 'Assigning employees',
    descCs: 'Klikněte na libovolnou buňku v tabulce směn pro přiřazení zaměstnance na daný den. Buňky lze také kopírovat přetažením.',
    descEn: 'Click any cell in the shift grid to assign an employee to that day. Cells can also be copied by dragging.',
    hintCs: 'Zkuste kliknout na prázdnou buňku v tabulce.',
    hintEn: 'Try clicking an empty cell in the grid.',
    target: 'schedule',
  },
  {
    icon: '📊',
    titleCs: 'Přehled přítomnosti',
    titleEn: 'Attendance overview',
    descCs: 'Záložka Přehled ukazuje kdo je aktuálně přihlášen na směně a stav docházky v reálném čase.',
    descEn: 'The Overview tab shows who is currently clocked in and live attendance status.',
    hintCs: 'Přejděte na záložku "Přehled".',
    hintEn: 'Switch to the "Overview" tab.',
    target: 'overview',
  },
  {
    icon: '👤',
    titleCs: 'Portál zaměstnance',
    titleEn: 'Employee portal',
    descCs: 'Záložka Zaměstnanec umožňuje každému vidět své hodiny, naplánované směny a žádat o dovolenou — bez sdílení hesel.',
    descEn: 'The Employee tab lets each person see their hours, planned shifts and request leave — without sharing passwords.',
    hintCs: 'Přejděte na záložku "Zaměstnanec".',
    hintEn: 'Switch to the "Employee" tab.',
    target: 'my-hours',
  },
  {
    icon: '⏰',
    titleCs: 'Docházkový kiosek',
    titleEn: 'Attendance kiosk',
    descCs: 'Záložka Docházka slouží jako kiosek — zaměstnanec se přihlásí PIN kódem a označí příchod/odchod.',
    descEn: 'The Attendance tab works as a kiosk — employees clock in/out using their PIN code.',
    hintCs: 'Záložka "Docházka" funguje i na tabletu umístěném u vchodu.',
    hintEn: 'The "Attendance" tab works great on a tablet placed at the entrance.',
    target: 'attendance',
  },
  {
    icon: '🔐',
    titleCs: 'Manažerský přístup',
    titleEn: 'Manager access',
    descCs: 'Klikněte na tlačítko "Manažer" vpravo nahoře a zadejte manažerské heslo. Odemknete tím záložky Analytika, Asistent a Správa.',
    descEn: 'Click the "Manager" button top-right and enter the manager password to unlock Analytics, Assistant and Management tabs.',
    hintCs: 'Tlačítko "Manažer" je v pravém horním rohu navigace.',
    hintEn: 'The "Manager" button is in the top-right of the navigation bar.',
    target: 'manager',
  },
  {
    icon: '⚙️',
    titleCs: 'Správa systému',
    titleEn: 'System management',
    descCs: 'V záložce Správa nastavíte zaměstnance, typy práce, notifikace, šablony směn a vše ostatní. Je dostupná jen pro manažera.',
    descEn: 'The Management tab lets you configure employees, work types, notifications, shift templates and everything else. Manager-only.',
    hintCs: 'Po přihlášení jako manažer se záložka "Správa" zobrazí v navigaci.',
    hintEn: 'After logging in as manager, the "Management" tab appears in the navigation.',
    target: 'management',
  },
  {
    icon: '🎉',
    titleCs: 'Jste připraveni!',
    titleEn: 'You\'re all set!',
    descCs: 'Zvládli jste základy TeamFlow. Teď si vyberte předplatné, které vám nejvíce vyhovuje, a začněte plánovat.',
    descEn: 'You\'ve mastered the basics of TeamFlow. Now choose the subscription that fits you best and start planning.',
    hintCs: 'Základní plán nebo plán s AI asistentem pro pokročilé plánování.',
    hintEn: 'Standard plan or plan with AI Assistant for advanced scheduling.',
    target: 'done',
  },
];

const TARGET_LABELS: Record<string, { cs: string; en: string }> = {
  schedule: { cs: 'Záložka: Směny', en: 'Tab: Shifts' },
  attendance: { cs: 'Záložka: Docházka', en: 'Tab: Attendance' },
  overview: { cs: 'Záložka: Přehled', en: 'Tab: Overview' },
  'my-hours': { cs: 'Záložka: Zaměstnanec', en: 'Tab: Employee' },
  manager: { cs: 'Tlačítko: Manažer (vpravo nahoře)', en: 'Button: Manager (top right)' },
  management: { cs: 'Záložka: Správa', en: 'Tab: Management' },
  done: { cs: 'Konec průvodce', en: 'End of tour' },
};

interface Props {
  lang: 'cs' | 'en';
  onClose: () => void;
}

export default function AppTour({ lang, onClose }: Props) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const t = (cs: string, en: string) => lang === 'en' ? en : cs;

  function handleNext() {
    if (isLast) {
      localStorage.setItem('tf_tour_seen', '1');
      onClose();
      window.location.href = PRICING_URL;
    } else {
      setStep(s => s + 1);
    }
  }

  function handleSkip() {
    localStorage.setItem('tf_tour_seen', '1');
    onClose();
    window.location.href = PRICING_URL;
  }

  // Prevent body scroll while tour is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const targetLabel = current.target ? TARGET_LABELS[current.target] : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pb-8 px-4 pointer-events-none">
      {/* Backdrop — only bottom portion, keep app visible above */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] pointer-events-auto" onClick={() => {}} />

      {/* Tour card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl pointer-events-auto border border-slate-200 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Step counter + skip */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {step + 1} / {total}
            </span>
            {!isLast && (
              <button onClick={handleSkip} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                {t('Přeskočit průvodce →', 'Skip tour →')}
              </button>
            )}
          </div>

          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-4">
            <div className="text-4xl flex-shrink-0 mt-0.5">{current.icon}</div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                {t(current.titleCs, current.titleEn)}
              </h3>
              <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                {t(current.descCs, current.descEn)}
              </p>
            </div>
          </div>

          {/* Target indicator */}
          {targetLabel && current.target !== 'done' && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-4">
              <span className="text-blue-500 text-sm">👆</span>
              <span className="text-blue-700 text-xs font-semibold">{t(targetLabel.cs, targetLabel.en)}</span>
            </div>
          )}

          {/* Hint */}
          {(current.hintCs || current.hintEn) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4">
              <p className="text-amber-700 text-xs leading-relaxed">
                💡 {t(current.hintCs ?? '', current.hintEn ?? '')}
              </p>
            </div>
          )}

          {/* Pricing CTA on last step */}
          {isLast && (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-4 mb-4 text-white">
              <p className="font-semibold text-sm mb-2">{t('Vyberte si předplatné', 'Choose your plan')}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/15 rounded-lg p-2.5">
                  <p className="font-bold">Standard</p>
                  <p className="opacity-80 mt-0.5">{t('Plánování, docházka, analytika', 'Scheduling, attendance, analytics')}</p>
                </div>
                <div className="bg-white/15 rounded-lg p-2.5 border border-white/30">
                  <p className="font-bold flex items-center gap-1">Pro + AI <span className="text-amber-300">✦</span></p>
                  <p className="opacity-80 mt-0.5">{t('Vše + AI asistent směn', 'Everything + AI shift assistant')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                ← {t('Zpět', 'Back')}
              </button>
            )}
            <button onClick={handleNext}
              className={`py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors ${
                isLast
                  ? 'flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25'
                  : step === 0 ? 'flex-1 bg-blue-600 hover:bg-blue-700 text-white' : 'flex-1 bg-blue-600 hover:bg-blue-700 text-white'
              }`}>
              {isLast
                ? t('Vybrat předplatné →', 'Choose plan →')
                : t('Další →', 'Next →')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
