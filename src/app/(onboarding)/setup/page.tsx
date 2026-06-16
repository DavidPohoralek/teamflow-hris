'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface WorkType {
  id: string;
  name: string;
  color: string;
}

const WORK_TYPE_PRESETS = [
  { name: 'Prodejna', color: '#3b82f6' },
  { name: 'Kancelář', color: '#10b981' },
  { name: 'Sklad', color: '#f59e0b' },
  { name: 'Výroba', color: '#8b5cf6' },
  { name: 'Provoz', color: '#ef4444' },
  { name: 'Home office', color: '#06b6d4' },
];

const THEMES = [
  { key: 'slate', label: 'Noční modrá', colors: ['#0f172a', '#1e293b'] },
  { key: 'indigo', label: 'Indigo', colors: ['#3730a3', '#4338ca'] },
  { key: 'emerald', label: 'Tmavá zelená', colors: ['#064e3b', '#065f46'] },
  { key: 'rose', label: 'Burgundy', colors: ['#881337', '#9f1239'] },
  { key: 'zinc', label: 'Světlá', colors: ['#e4e4e7', '#f4f4f5'] },
];

const STEP_LABELS = ['Vítejte', 'Heslo', 'Logo & vzhled', 'Typy práce', 'Zaměstnanci', 'Hotovo'];

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-0 mb-10 overflow-x-auto pb-1">
      {STEP_LABELS.map((label, i) => {
        const num = (i + 1) as Step;
        const done = step > num;
        const active = step === num;
        return (
          <div key={num} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : num}
              </div>
              <span className={`text-xs mt-1.5 font-medium whitespace-nowrap ${active ? 'text-blue-600' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-0.5 w-10 mx-1 mb-5 transition-colors ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [orgName, setOrgName] = useState('');
  const [appUrl, setAppUrl] = useState('');

  // Step 2
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Step 3 — logo & theme
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('slate');
  const [themeLoading, setThemeLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4 — work types
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [wtName, setWtName] = useState('');
  const [wtColor, setWtColor] = useState('#3b82f6');
  const [wtLoading, setWtLoading] = useState(false);
  const [wtError, setWtError] = useState('');

  // Step 5 — employees
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState('');

  // Step 6
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') setAppUrl(window.location.origin + '/app');
    fetch('/api/me/org')
      .then(r => r.json())
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

  // ── Step 3: logo & theme ──────────────────────────────────────────────────

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoError('');
  }

  async function handleLogoUpload() {
    if (!logoFile) return;
    setLogoLoading(true);
    setLogoError('');
    try {
      const form = new FormData();
      form.append('logo', logoFile);
      const res = await fetch('/api/org/logo', { method: 'POST', body: form });
      if (!res.ok) {
        const d = await res.json();
        setLogoError(d.error ?? 'Chyba při nahrávání.');
      }
    } finally {
      setLogoLoading(false);
    }
  }

  async function handleThemeSelect(key: string) {
    setSelectedTheme(key);
    setThemeLoading(true);
    try {
      await fetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_theme: key }),
      });
    } finally {
      setThemeLoading(false);
    }
  }

  async function handleStep3Continue() {
    if (logoFile) await handleLogoUpload();
    setStep(4);
  }

  // ── Step 4: work types ────────────────────────────────────────────────────

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
      setWorkTypes(prev => [...prev, d.workType as WorkType]);
    } finally {
      setWtLoading(false);
    }
  }

  async function addCustomWorkType(e: React.FormEvent) {
    e.preventDefault();
    if (!wtName.trim()) return;
    await addPreset(wtName.trim(), wtColor);
    setWtName('');
  }

  // ── Step 5: employees ─────────────────────────────────────────────────────

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setEmpError('');
    if (!empName.trim()) return;
    setEmpLoading(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: empName.trim(), email: empEmail.trim() || undefined }),
      });
      if (!res.ok) { const d = await res.json(); setEmpError(d.error ?? 'Chyba při přidávání zaměstnance.'); return; }
      const d = await res.json();
      setEmployees(prev => [...prev, { id: d.employee?.id ?? Math.random().toString(), name: empName.trim() }]);
      setEmpName('');
      setEmpEmail('');
    } finally {
      setEmpLoading(false);
    }
  }

  async function handleCopy() {
    try { await navigator.clipboard.writeText(appUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <StepIndicator step={step} />

      {/* ── Step 1: Welcome ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Vítejte{orgName ? ` v ${orgName}` : ''}!</h1>
          <p className="text-slate-500 mb-2">Vaše firma byla úspěšně vytvořena. Za pár minut nastavíme vše potřebné:</p>
          <ul className="text-sm text-slate-500 mb-8 text-left inline-block mt-4 space-y-2">
            <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">1.</span> Heslo pro manažerský panel</li>
            <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">2.</span> Logo firmy a barevné téma aplikace</li>
            <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">3.</span> Typy práce / směn</li>
            <li className="flex items-center gap-2"><span className="text-blue-500 font-bold">4.</span> První zaměstnanci</li>
          </ul>
          <button onClick={() => setStep(2)} className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
            Začít nastavení →
          </button>
        </div>
      )}

      {/* ── Step 2: Manager password ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Nastavte heslo manažera</h2>
            <p className="text-slate-500 text-sm mt-1">Toto heslo použijete pro přihlášení do manažerského panelu v aplikaci.</p>
          </div>
          <form onSubmit={handleSetPassword} className="space-y-4">
            {passwordError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{passwordError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nové heslo</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Minimálně 4 znaky" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Potvrdit heslo</label>
              <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Zopakujte heslo" required />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                ← Zpět
              </button>
              <button type="submit" disabled={passwordLoading}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                {passwordLoading ? 'Ukládám…' : 'Uložit a pokračovat →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Step 3: Logo & Theme ── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Logo a vzhled aplikace</h2>
            <p className="text-slate-500 text-sm mt-1">Tento krok je volitelný — vše lze změnit kdykoli v nastavení.</p>
          </div>

          {/* Logo upload */}
          <div className="mb-8">
            <p className="text-sm font-semibold text-slate-700 mb-3">Logo firmy</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            >
              {logoPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoPreview} alt="Logo preview" className="h-14 w-auto max-w-[140px] object-contain rounded-lg" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" className="text-slate-400">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-700">{logoPreview ? 'Klikněte pro změnu' : 'Nahrát logo'}</p>
                <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, SVG nebo WEBP · max. 2 MB</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoSelect} className="hidden" />
            {logoError && <p className="text-xs text-red-500 mt-2">{logoError}</p>}
          </div>

          {/* Theme picker */}
          <div className="mb-8">
            <p className="text-sm font-semibold text-slate-700 mb-1">Barevné téma aplikace</p>
            <p className="text-xs text-slate-400 mb-3">Vyberte barvu navigační lišty v hlavní aplikaci.</p>
            <div className="flex flex-wrap gap-3">
              {THEMES.map(theme => (
                <button
                  key={theme.key}
                  onClick={() => handleThemeSelect(theme.key)}
                  disabled={themeLoading}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 transition-all ${
                    selectedTheme === theme.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex rounded-md overflow-hidden w-8 h-5 flex-shrink-0">
                    <div className="flex-1" style={{ backgroundColor: theme.colors[0] }} />
                    <div className="flex-1" style={{ backgroundColor: theme.colors[1] }} />
                  </div>
                  <span className="text-xs font-medium text-slate-700">{theme.label}</span>
                  {selectedTheme === theme.key && (
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" className="text-blue-500 ml-auto">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3 bg-slate-50 rounded-lg px-3 py-2">
              💡 Téma &quot;Světlá&quot; odpovídá světlému režimu. Ostatní jsou tmavé varianty. Vždy to lze změnit v <strong>Správa → Nastavení</strong>.
            </p>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setStep(2)}
              className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              ← Zpět
            </button>
            <button onClick={handleStep3Continue} disabled={logoLoading}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
              {logoLoading ? 'Nahrávám…' : 'Pokračovat →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Work types ── */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Typy práce</h2>
            <p className="text-slate-500 text-sm mt-1">Definujte typy směn nebo pozic ve vaší firmě.</p>
          </div>

          {workTypes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {workTypes.map(wt => (
                <span key={wt.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white" style={{ backgroundColor: wt.color }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {wt.name}
                </span>
              ))}
            </div>
          )}

          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Rychlé přidání</p>
            <div className="flex flex-wrap gap-2">
              {WORK_TYPE_PRESETS.filter(p => !workTypes.some(wt => wt.name === p.name)).map(preset => (
                <button key={preset.name} onClick={() => addPreset(preset.name, preset.color)} disabled={wtLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: preset.color, color: preset.color }}>
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={addCustomWorkType} className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Vlastní typ</p>
            <div className="flex gap-2">
              <input type="color" value={wtColor} onChange={e => setWtColor(e.target.value)} className="w-11 h-11 rounded-lg border border-slate-200 cursor-pointer p-1" />
              <input type="text" value={wtName} onChange={e => setWtName(e.target.value)} placeholder="Název typu práce"
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              <button type="submit" disabled={wtLoading || !wtName.trim()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                Přidat
              </button>
            </div>
          </form>

          {wtError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{wtError}</div>}

          <div className="flex gap-3 pt-2 border-t border-slate-100 mt-4">
            <button onClick={() => setStep(3)} className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              ← Zpět
            </button>
            <button onClick={() => setStep(5)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors ${workTypes.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
              {workTypes.length > 0 ? 'Pokračovat →' : 'Přeskočit →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Employees ── */}
      {step === 5 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Přidejte zaměstnance</h2>
            <p className="text-slate-500 text-sm mt-1">Přidejte členy týmu. Zaměstnance lze přidávat i později v sekci Zaměstnanci.</p>
          </div>

          {employees.length > 0 && (
            <div className="mb-5 space-y-1.5">
              {employees.map(emp => (
                <div key={emp.id} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-800">{emp.name}</span>
                  <svg className="ml-auto text-emerald-500" width="14" height="14" fill="none" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addEmployee} className="space-y-3 mb-4">
            {empError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{empError}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jméno a příjmení *</label>
              <input type="text" value={empName} onChange={e => setEmpName(e.target.value)} placeholder="Jana Nováková"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail (volitelné)</label>
              <input type="email" value={empEmail} onChange={e => setEmpEmail(e.target.value)} placeholder="jana@firma.cz"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <button type="submit" disabled={empLoading || !empName.trim()}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {empLoading ? 'Přidávám…' : '+ Přidat zaměstnance'}
            </button>
          </form>

          <div className="flex gap-3 pt-2 border-t border-slate-100 mt-4">
            <button onClick={() => setStep(4)} className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              ← Zpět
            </button>
            <button onClick={() => setStep(6)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors ${employees.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
              {employees.length > 0 ? 'Dokončit →' : 'Přeskočit →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 6: Done ── */}
      {step === 6 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Vše je připraveno!</h2>
          <p className="text-slate-500 mb-6 text-sm">Systém je nakonfigurován. Sdílejte odkaz se zaměstnanci nebo přejděte do aplikace.</p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-900">✓</p>
              <p className="text-xs text-slate-500 mt-1">Heslo nastaveno</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-900">{workTypes.length}</p>
              <p className="text-xs text-slate-500 mt-1">Typy práce</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
              <p className="text-xs text-slate-500 mt-1">Zaměstnanci</p>
            </div>
          </div>

          <div className="mb-6 text-left">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Odkaz pro zaměstnance:</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm text-slate-700 overflow-x-auto whitespace-nowrap">
                {appUrl}
              </div>
              <button onClick={handleCopy}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${copied ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {copied ? '✓ Zkopírováno' : 'Kopírovat'}
              </button>
            </div>
          </div>

          <button onClick={() => router.push('/app')}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-base">
            Přejít do aplikace →
          </button>

          <p className="text-xs text-slate-400 mt-4">
            Heslo, logo i téma lze kdykoli změnit v <strong>Správa → Nastavení</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
