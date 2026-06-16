'use client';

import { useEffect, useState } from 'react';

interface StatusData {
  employeeCount: number;
  workTypeCount: number;
  kioskEnabled: boolean;
  managerPasswordSet: boolean;
  loading: boolean;
  error: string | null;
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
        ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
      }`}
    >
      {ok ? '✓' : '✗'}
    </span>
  );
}

function StatusRow({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <StatusBadge ok={ok} />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            ok ? 'text-slate-800' : 'text-slate-600'
          }`}
        >
          {label}
        </p>
        {hint && (
          <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
        )}
      </div>
    </div>
  );
}

export default function SetupPage() {
  const [status, setStatus] = useState<StatusData>({
    employeeCount: 0,
    workTypeCount: 0,
    kioskEnabled: false,
    managerPasswordSet: false,
    loading: true,
    error: null,
  });
  const [copied, setCopied] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [empRes, wtRes, settingsRes] = await Promise.all([
          fetch('/api/employees'),
          fetch('/api/work-types'),
          fetch('/api/manager/settings'),
        ]);

        const [empData, wtData, settingsData] = await Promise.all([
          empRes.ok ? empRes.json() : null,
          wtRes.ok ? wtRes.json() : null,
          settingsRes.ok ? settingsRes.json() : null,
        ]);

        setStatus({
          employeeCount: Array.isArray(empData) ? empData.length : 0,
          workTypeCount: Array.isArray(wtData) ? wtData.length : 0,
          kioskEnabled: settingsData?.kioskEnabled ?? false,
          managerPasswordSet: settingsData?.managerPasswordSet ?? false,
          loading: false,
          error: null,
        });
      } catch {
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: 'Nepodařilo se načíst data.',
        }));
      }
    }

    fetchAll();
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — select the input
    }
  }

  const orgCreated = true; // User is authenticated, so org exists
  const passwordOk = status.managerPasswordSet;
  const employeesAdded = status.employeeCount > 0;
  const workTypesSet = status.workTypeCount > 0;

  const completedSteps = [orgCreated, passwordOk, employeesAdded, workTypesSet].filter(Boolean).length;
  const totalSteps = 4;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🛠</span>
          <h1 className="text-2xl font-bold text-slate-900">Nastavení systému</h1>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          Průvodce konfigurací — dokončete kroky níže pro plné spuštění systému.
        </p>
      </div>

      {/* Section 1 — Status přehled */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Status přehled
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {completedSteps}/{totalSteps} dokončeno
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${status.loading ? 0 : progressPct}%` }}
            />
          </div>
        </div>

        <div className="px-6 py-2">
          {status.loading ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              Načítám data&hellip;
            </div>
          ) : status.error ? (
            <div className="py-4 text-center text-red-500 text-sm">
              {status.error}
            </div>
          ) : (
            <>
              <StatusRow
                ok={orgCreated}
                label="Organizace vytvořena"
                hint="Váš účet je registrován a organizace existuje."
              />
              <StatusRow
                ok={passwordOk}
                label="Manažerské heslo nastaveno"
                hint={
                  passwordOk
                    ? 'Heslo je nastaveno. Ujistěte se, že není výchozí (manager123).'
                    : 'Přejděte do Nastavení a nastavte heslo pro manažerský kiosek.'
                }
              />
              <StatusRow
                ok={employeesAdded}
                label={`Zaměstnanci přidáni${status.employeeCount > 0 ? ` (${status.employeeCount})` : ''}`}
                hint={
                  employeesAdded
                    ? `${status.employeeCount} zaměstnanec/ů v systému.`
                    : 'Přidejte alespoň jednoho zaměstnance v sekci Zaměstnanci.'
                }
              />
              <StatusRow
                ok={workTypesSet}
                label={`Typy práce nastaveny${status.workTypeCount > 0 ? ` (${status.workTypeCount})` : ''}`}
                hint={
                  workTypesSet
                    ? `${status.workTypeCount} typ(y) práce definováno.`
                    : 'Definujte typy práce v sekci Nastavení → Plán.'
                }
              />
            </>
          )}
        </div>
      </div>

      {/* Section 2 — Rychlý start */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Rychlý start</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Sdílejte tuto URL se zaměstnanci, aby se mohli přihlásit.
          </p>
        </div>

        <div className="px-6 py-5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Sdílejte tuto URL se zaměstnanci:
          </label>

          {/* URL box */}
          <div className="flex items-stretch gap-2">
            <div className="flex-1 flex items-center px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm text-slate-700 select-all overflow-x-auto whitespace-nowrap">
              {appUrl || 'http://localhost:3000'}
            </div>
            <button
              onClick={handleCopy}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 flex-shrink-0 ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Zkopírováno
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Kopírovat
                </>
              )}
            </button>
          </div>

          {/* QR placeholder */}
          <div className="mt-4 flex items-center gap-4 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
            <div className="w-16 h-16 flex-shrink-0 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" className="text-slate-400">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 14h2v2h-2zM18 14h3v2h-3zM14 18h3v3h-3zM19 19h2v2h-2z" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">QR kód</p>
              <p className="text-xs text-slate-400 mt-0.5">
                QR kód pro snadné sdílení — připravujeme.
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono break-all">
                {appUrl || 'http://localhost:3000'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 — Odkaz na správu */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Správa systému</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Otevřete rozhraní pro manažery a administrátory.
          </p>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-800">Manažerský panel</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Přihlaste se jako manažer pomocí manažerského hesla.
              </p>
            </div>
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0 ml-4"
            >
              Otevřít správu systému
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

          <p className="text-xs text-slate-400 mt-3 text-center">
            Hlavní stránka &rarr; tlačítko &ldquo;Přihlásit se jako manažer&rdquo; &rarr; zadejte manažerské heslo
          </p>
        </div>
      </div>
    </div>
  );
}
