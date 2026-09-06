'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 1 | 2 | 3 | 4 | 5;

interface WorkType {
  id: string;
  name: string;
  color: string;
}

// The Home office preset is special: until a work type named "Home office"
// exists, the "Pracuji z domu" button never shows up for employees. It is
// therefore highlighted in the wizard rather than hidden among the others.
const WORK_TYPE_PRESETS = [
  { name: 'Prodejna', color: '#3b82f6' },
  { name: 'Kancelář', color: '#10b981' },
  { name: 'Sklad', color: '#f59e0b' },
  { name: 'Výroba', color: '#8b5cf6' },
  { name: 'Backoffice', color: '#ef4444' },
  { name: 'Marketing', color: '#ec4899' },
];
const HOME_OFFICE = { name: 'Home office', color: '#06b6d4' };

const STEP_LABELS = ['Vítejte', 'Heslo', 'Oddělení', 'Zaměstnanci', 'Hotovo'];

const INK = '#111820';
const ORANGE = '#C97C2A';
const LINE = '#e6e2db';
const MUTED = '#6b7480';
const FAINT = '#9aa1aa';

const CARD = 'bg-white rounded-2xl p-7 sm:p-8';
const CARD_STYLE = { border: `1px solid ${LINE}`, boxShadow: '0 1px 2px rgba(17,24,32,.04)' };
const INPUT =
  'w-full px-3.5 py-2.5 rounded-[9px] text-sm bg-white outline-none transition-colors focus:border-[#111820]';
const INPUT_STYLE = { border: '1px solid #ddd8d0', color: INK };
const BTN_PRIMARY =
  'py-3 px-5 rounded-[10px] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50';
const BTN_SECONDARY =
  'py-3 px-5 rounded-[10px] text-sm font-semibold transition-colors hover:bg-[#faf9f7] disabled:opacity-50';
const LABEL = 'block text-[12.5px] font-semibold mb-1.5';
const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[.08em] mb-2.5';

function Check({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-center mb-6">
      {STEP_LABELS.map((label, i) => {
        const num = (i + 1) as Step;
        const done = step > num;
        const active = step === num;
        return (
          <div key={num} className="contents">
            <div className="flex flex-col items-center gap-1.5 w-[68px] sm:w-[78px] flex-none">
              <span
                className="w-[27px] h-[27px] rounded-full grid place-content-center text-xs font-semibold"
                style={{
                  background: done ? ORANGE : active ? INK : '#eae6df',
                  color: done || active ? '#fff' : FAINT,
                }}
              >
                {done ? <Check /> : num}
              </span>
              <span
                className="text-[11px] font-medium whitespace-nowrap"
                style={{ color: active ? INK : FAINT, fontWeight: active ? 600 : 500 }}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <span
                className="h-0.5 flex-1 rounded-sm -mx-2 mb-[19px]"
                style={{ background: done ? ORANGE : '#eae6df' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg px-4 py-3 text-sm mb-4"
      style={{ background: '#fdf2f2', border: '1px solid #f5d3d3', color: '#a33a3a' }}>
      {children}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [orgName, setOrgName] = useState('');
  const [appUrl, setAppUrl] = useState('');

  // Step 2 — manager password
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Step 3 — work types / departments
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [wtName, setWtName] = useState('');
  const [wtLoading, setWtLoading] = useState(false);
  const [wtError, setWtError] = useState('');

  // Step 4 — employees
  const [employees, setEmployees] = useState<{ id: string; name: string; pin: string }[]>([]);
  const [empName, setEmpName] = useState('');
  const [empPin, setEmpPin] = useState('');
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState('');

  // Step 5
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') setAppUrl(window.location.origin + '/app');
    fetch('/api/me/org')
      .then((r) => r.json())
      .then((d: { name?: string }) => { if (d.name) setOrgName(d.name); })
      .catch(() => {});
  }, []);

  // ── Step 2: password ──────────────────────────────────────────────────────

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    if (password.length < 4) { setPasswordError('Heslo musí mít alespoň 4 znaky.'); return; }
    if (password !== passwordConfirm) { setPasswordError('Hesla se neshodují.'); return; }
    setPasswordLoading(true);
    try {
      const res = await fetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      });
      if (!res.ok) {
        const d = await res.json();
        setPasswordError(d.error ?? 'Nepodařilo se uložit heslo.');
        return;
      }
      setStep(3);
    } finally {
      setPasswordLoading(false);
    }
  }

  // ── Step 3: work types ────────────────────────────────────────────────────

  async function addPreset(name: string, color: string) {
    setWtError('');
    setWtLoading(true);
    try {
      const res = await fetch('/api/work-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, category: 'shift' }),
      });
      if (!res.ok) { const d = await res.json(); setWtError(d.error ?? 'Chyba při přidávání.'); return; }
      const d = await res.json();
      setWorkTypes((prev) => [...prev, d.workType as WorkType]);
    } finally {
      setWtLoading(false);
    }
  }

  async function addCustomWorkType(e: React.FormEvent) {
    e.preventDefault();
    if (!wtName.trim()) return;
    await addPreset(wtName.trim(), '#64748b');
    setWtName('');
  }

  const hasHomeOffice = workTypes.some((wt) => wt.name === HOME_OFFICE.name);

  // ── Step 4: employees ─────────────────────────────────────────────────────

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setEmpError('');
    if (!empName.trim()) return;
    const pin = empPin.trim();
    if (pin && !/^\d{4,6}$/.test(pin)) {
      setEmpError('PIN musí být 4–6 číslic.');
      return;
    }
    setEmpLoading(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: empName.trim(), pin: pin || undefined }),
      });
      if (!res.ok) { const d = await res.json(); setEmpError(d.error ?? 'Chyba při přidávání zaměstnance.'); return; }
      const d = await res.json();
      setEmployees((prev) => [
        ...prev,
        { id: d.employee?.id ?? Math.random().toString(), name: empName.trim(), pin },
      ]);
      setEmpName('');
      setEmpPin('');
    } finally {
      setEmpLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <div className="tf-sans max-w-[660px] mx-auto" style={{ color: INK }}>
      <StepIndicator step={step} />

      {/* ── Step 1: Welcome ── */}
      {step === 1 && (
        <div className={CARD} style={CARD_STYLE}>
          <h1 className="text-[21px] font-bold tracking-[-.015em] m-0">
            Vítejte{orgName ? ` v ${orgName}` : ''}
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>
            Firma je založená. Za dvě minuty ji máte připravenou k provozu — projdeme spolu tři věci:
          </p>

          <ul className="list-none p-0 mt-5 mb-0 flex flex-col gap-2.5">
            {[
              ['Heslo manažera', 'kterým se dostanete do Správy'],
              ['Oddělení', 'kde u vás lidé pracují a podle čeho plánujete směny'],
              ['Zaměstnanci', 'jméno a PIN do docházky'],
            ].map(([title, desc], i) => (
              <li key={title} className="flex gap-2.5 text-sm" style={{ color: MUTED }}>
                <span
                  className="w-5 h-5 rounded-full grid place-content-center text-[11px] font-bold flex-none mt-px"
                  style={{ background: '#fbf8f3', border: `1px solid ${LINE}`, color: ORANGE }}
                >
                  {i + 1}
                </span>
                <span><b className="font-semibold" style={{ color: INK }}>{title}</b> — {desc}</span>
              </li>
            ))}
          </ul>

          <p className="text-[12.5px] mt-5 mb-0 leading-snug" style={{ color: FAINT }}>
            Všechno jde kdykoli změnit ve <b style={{ color: MUTED }}>Správě → Nastavení</b>.
          </p>

          <div className="flex gap-2.5 mt-6">
            <button onClick={() => setStep(2)} className={`${BTN_PRIMARY} flex-1`} style={{ background: INK }}>
              Začít nastavení →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Manager password ── */}
      {step === 2 && (
        <div className={CARD} style={CARD_STYLE}>
          <h2 className="text-[21px] font-bold tracking-[-.015em] m-0">Nastavte heslo manažera</h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>
            Tímto heslem se budete přihlašovat do Správy. Zaměstnanci ho nepotřebují — ti se do docházky
            hlásí svým PINem.
          </p>

          <form onSubmit={handleSetPassword} className="mt-6">
            {passwordError && <ErrorBox>{passwordError}</ErrorBox>}
            <div className="mb-4">
              <label className={LABEL} htmlFor="tf-pwd">Nové heslo</label>
              <input id="tf-pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className={INPUT} style={INPUT_STYLE} placeholder="Minimálně 4 znaky" required autoFocus />
            </div>
            <div>
              <label className={LABEL} htmlFor="tf-pwd2">Potvrdit heslo</label>
              <input id="tf-pwd2" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                className={INPUT} style={INPUT_STYLE} placeholder="Zopakujte heslo" required />
            </div>
            <div className="flex gap-2.5 mt-6">
              <button type="button" onClick={() => setStep(1)} className={BTN_SECONDARY}
                style={{ border: '1px solid #ddd8d0', color: INK }}>
                ← Zpět
              </button>
              <button type="submit" disabled={passwordLoading} className={`${BTN_PRIMARY} flex-1`} style={{ background: INK }}>
                {passwordLoading ? 'Ukládám…' : 'Uložit a pokračovat →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Step 3: Departments / work types ── */}
      {step === 3 && (
        <div className={CARD} style={CARD_STYLE}>
          <h2 className="text-[21px] font-bold tracking-[-.015em] m-0">Kde u vás lidi pracují?</h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>
            Vyberte oddělení nebo typy směn. Podle nich plánujete směny a lidé při příchodu vybírají, kde
            zrovna pracují.
          </p>

          <div className="mt-6">
            {workTypes.length > 0 && (
              <>
                <p className={EYEBROW} style={{ color: FAINT }}>Přidáno</p>
                <div className="flex flex-wrap gap-[7px] mb-4">
                  {workTypes.map((wt) => (
                    <span key={wt.id}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium"
                      style={{ background: '#fbf8f3', border: `1px solid ${LINE}` }}>
                      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: wt.color }} />
                      {wt.name}
                    </span>
                  ))}
                </div>
              </>
            )}

            <p className={EYEBROW} style={{ color: FAINT }}>Rychlé přidání</p>
            <div className="flex flex-wrap gap-2">
              {WORK_TYPE_PRESETS.filter((p) => !workTypes.some((wt) => wt.name === p.name)).map((preset) => (
                <button key={preset.name} onClick={() => addPreset(preset.name, preset.color)} disabled={wtLoading}
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-medium bg-white transition-colors hover:bg-[#faf9f7] disabled:opacity-50"
                  style={{ border: '1.5px solid #ddd8d0', color: MUTED }}>
                  + {preset.name}
                </button>
              ))}
              {!hasHomeOffice && (
                <button onClick={() => addPreset(HOME_OFFICE.name, HOME_OFFICE.color)} disabled={wtLoading}
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ border: `1.5px solid ${ORANGE}`, color: ORANGE, background: '#fdf5ec' }}>
                  + {HOME_OFFICE.name}
                </button>
              )}
            </div>

            {!hasHomeOffice && (
              <p className="text-[12.5px] mt-2.5 mb-0 leading-snug" style={{ color: FAINT }}>
                <b style={{ color: ORANGE }}>Home office</b> přidejte, pokud u vás lidé pracují z domu — teprve
                pak se jim v docházce objeví tlačítko „Pracuji z domu“.
              </p>
            )}

            <div className="h-4" />
            <p className={EYEBROW} style={{ color: FAINT }}>Vlastní</p>
            <form onSubmit={addCustomWorkType} className="flex gap-2.5">
              <input type="text" value={wtName} onChange={(e) => setWtName(e.target.value)}
                placeholder="Název oddělení" className={INPUT} style={INPUT_STYLE} />
              <button type="submit" disabled={wtLoading || !wtName.trim()} className={`${BTN_SECONDARY} flex-none`}
                style={{ border: '1px solid #ddd8d0', color: INK }}>
                Přidat
              </button>
            </form>

            {wtError && <div className="mt-4"><ErrorBox>{wtError}</ErrorBox></div>}

            <div className="flex gap-2.5 mt-6">
              <button onClick={() => setStep(2)} className={BTN_SECONDARY}
                style={{ border: '1px solid #ddd8d0', color: INK }}>
                ← Zpět
              </button>
              <button onClick={() => setStep(4)} className={`${BTN_PRIMARY} flex-1`}
                style={workTypes.length > 0
                  ? { background: INK }
                  : { background: '#eae6df', color: MUTED }}>
                {workTypes.length > 0 ? 'Pokračovat →' : 'Přeskočit →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Employees ── */}
      {step === 4 && (
        <div className={CARD} style={CARD_STYLE}>
          <h2 className="text-[21px] font-bold tracking-[-.015em] m-0">Přidejte zaměstnance</h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>
            Stačí jméno a PIN — tím se budou hlásit do docházky. Zbytek (oddělení, úvazek, mzda) doplníte
            kdykoli později ve Správě.
          </p>

          <div className="mt-6">
            {employees.length > 0 && (
              <>
                <p className={EYEBROW} style={{ color: FAINT }}>Přidáno</p>
                <div className="flex flex-wrap gap-[7px] mb-4">
                  {employees.map((emp) => (
                    <span key={emp.id}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium"
                      style={{ background: '#fbf8f3', border: `1px solid ${LINE}` }}>
                      {emp.name}{emp.pin ? ` · PIN ${emp.pin}` : ''}
                    </span>
                  ))}
                </div>
              </>
            )}

            {empError && <ErrorBox>{empError}</ErrorBox>}

            <form onSubmit={addEmployee} className="flex flex-col sm:flex-row gap-2.5">
              <input type="text" value={empName} onChange={(e) => setEmpName(e.target.value)}
                placeholder="Jméno a příjmení" className={INPUT} style={INPUT_STYLE} />
              <input type="text" inputMode="numeric" value={empPin}
                onChange={(e) => setEmpPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="PIN" className={`${INPUT} sm:max-w-[120px]`} style={INPUT_STYLE} />
              <button type="submit" disabled={empLoading || !empName.trim()} className={`${BTN_SECONDARY} flex-none`}
                style={{ border: '1px solid #ddd8d0', color: INK }}>
                {empLoading ? 'Přidávám…' : 'Přidat'}
              </button>
            </form>

            <p className="text-[12.5px] mt-2.5 mb-0 leading-snug" style={{ color: FAINT }}>
              PIN je 4–6 číslic a musí být v rámci firmy jedinečný. Necháte-li ho prázdný, doplníte ho později.
            </p>

            <div className="flex gap-2.5 mt-6">
              <button onClick={() => setStep(3)} className={BTN_SECONDARY}
                style={{ border: '1px solid #ddd8d0', color: INK }}>
                ← Zpět
              </button>
              <button onClick={() => setStep(5)} className={`${BTN_PRIMARY} flex-1`}
                style={employees.length > 0
                  ? { background: INK }
                  : { background: '#eae6df', color: MUTED }}>
                {employees.length > 0 ? 'Dokončit →' : 'Přidám je později →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Done ── */}
      {step === 5 && (
        <div className={CARD} style={CARD_STYLE}>
          <h2 className="text-[21px] font-bold tracking-[-.015em] m-0">Hotovo, můžete začít</h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>
            {orgName ? `Firma ${orgName} je nastavená.` : 'Firma je nastavená.'} Tady je, co teď máte:
          </p>

          <ul className="list-none p-0 mt-5 mb-0 flex flex-col gap-2.5">
            {[
              <><b className="font-semibold" style={{ color: INK }}>Heslo manažera</b> nastavené</>,
              <>
                <b className="font-semibold" style={{ color: INK }}>{workTypes.length} oddělení</b>
                {workTypes.length > 0 ? ` — ${workTypes.map((w) => w.name).join(', ')}` : ' — doplníte ve Správě'}
              </>,
              <>
                <b className="font-semibold" style={{ color: INK }}>
                  {employees.length} {employees.length === 1 ? 'zaměstnanec' : employees.length >= 2 && employees.length <= 4 ? 'zaměstnanci' : 'zaměstnanců'}
                </b>
                {employees.length > 0 ? ' s PINy do docházky' : ' — přidáte ve Správě'}
              </>,
              <>
                <b className="font-semibold" style={{ color: INK }}>Pracovní poměry</b> HPP, DPP, DPČ, IČO —
                u IČO se dovolená neproplácí. Změníte v Nastavení.
              </>,
            ].map((content, i) => (
              <li key={i} className="flex gap-2.5 text-sm" style={{ color: MUTED }}>
                <span className="w-5 h-5 rounded-full grid place-content-center flex-none mt-px"
                  style={{ background: '#fbf8f3', border: `1px solid ${LINE}`, color: ORANGE }}>
                  <Check size={11} />
                </span>
                <span>{content}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <p className={EYEBROW} style={{ color: FAINT }}>Odkaz pro zaměstnance</p>
            <div className="flex gap-2.5">
              <div className="flex-1 flex items-center px-3.5 py-2.5 rounded-[9px] tf-mono text-[13px] overflow-x-auto whitespace-nowrap"
                style={{ background: '#faf9f7', border: `1px solid ${LINE}`, color: MUTED }}>
                {appUrl}
              </div>
              <button onClick={handleCopy} className={`${BTN_SECONDARY} flex-none`}
                style={{ border: '1px solid #ddd8d0', color: copied ? ORANGE : INK }}>
                {copied ? '✓ Zkopírováno' : 'Kopírovat'}
              </button>
            </div>
            <p className="text-[12.5px] mt-2.5 mb-0 leading-snug" style={{ color: FAINT }}>
              Naplánujte první směny ve <b style={{ color: MUTED }}>Směnách</b>, nebo rovnou spusťte docházku
              v <b style={{ color: MUTED }}>Příchod/Odchod</b>. Kiosek můžete otevřít na tabletu u vchodu.
            </p>
          </div>

          <div className="flex gap-2.5 mt-6">
            <button onClick={() => router.push('/app')} className={`${BTN_PRIMARY} flex-1`} style={{ background: INK }}>
              Otevřít TeamFlow →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
