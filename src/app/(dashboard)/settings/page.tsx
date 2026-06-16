'use client';

import { useState } from 'react';

type TabKey = 'firma' | 'zamestnanci' | 'plan';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'firma', label: 'Firma' },
  { key: 'zamestnanci', label: 'Zaměstnanci' },
  { key: 'plan', label: 'Plán' },
];

function FirmaTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          Informace o společnosti
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Název společnosti</label>
            <input
              type="text"
              className="form-input"
              placeholder="Acme s.r.o."
              defaultValue=""
            />
          </div>
          <div>
            <label className="form-label">IČO</label>
            <input type="text" className="form-input" placeholder="12345678" />
          </div>
          <div>
            <label className="form-label">E-mail</label>
            <input
              type="email"
              className="form-input"
              placeholder="kontakt@spolecnost.cz"
            />
          </div>
          <div>
            <label className="form-label">Telefon</label>
            <input type="tel" className="form-input" placeholder="+420 123 456 789" />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Adresa</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ulice 1, 110 00 Praha"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          Lokalizace
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Časové pásmo</label>
            <select className="form-input">
              <option value="Europe/Prague">Europe/Prague (UTC+1/+2)</option>
              <option value="Europe/London">Europe/London (UTC+0/+1)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Jazyk rozhraní</label>
            <select className="form-input">
              <option value="cs">Čeština</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary">Uložit změny</button>
      </div>
    </div>
  );
}

function ZamestnanciTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          Výchozí nastavení zaměstnanců
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Cílový měsíční fond hodin</label>
            <input
              type="number"
              className="form-input"
              defaultValue={160}
              min={0}
            />
          </div>
          <div>
            <label className="form-label">Výchozí role nového zaměstnance</label>
            <select className="form-input">
              <option value="employee">Zaměstnanec</option>
              <option value="manager">Manažer</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          Oddělení
        </h3>
        <div className="space-y-2">
          {['HR', 'Provoz', 'IT', 'Obchod'].map((dept) => (
            <div
              key={dept}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-slate-50"
            >
              <span className="text-sm font-medium text-slate-700">{dept}</span>
              <button className="text-slate-400 hover:text-red-500 transition-colors">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
          <button className="btn-secondary w-full mt-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Přidat oddělení
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary">Uložit změny</button>
      </div>
    </div>
  );
}

function PlanTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          Nastavení plánování
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Začátek pracovního týdne</label>
            <select className="form-input">
              <option value="monday">Pondělí</option>
              <option value="sunday">Neděle</option>
            </select>
          </div>
          <div>
            <label className="form-label">Výchozí délka směny (hod)</label>
            <input
              type="number"
              className="form-input"
              defaultValue={8}
              min={1}
              max={24}
            />
          </div>
          <div>
            <label className="form-label">Minimální přestávka (min)</label>
            <input
              type="number"
              className="form-input"
              defaultValue={30}
              min={0}
            />
          </div>
          <div>
            <label className="form-label">Max. přesčas za měsíc (hod)</label>
            <input
              type="number"
              className="form-input"
              defaultValue={40}
              min={0}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">
          Typy směn
        </h3>
        <div className="space-y-2">
          {['Ranní (6:00–14:00)', 'Odpolední (14:00–22:00)', 'Noční (22:00–6:00)', 'Celodenní (8:00–16:00)'].map(
            (shift) => (
              <div
                key={shift}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-slate-50"
              >
                <span className="text-sm font-medium text-slate-700">
                  {shift}
                </span>
                <button className="text-slate-400 hover:text-blue-600 transition-colors">
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            )
          )}
          <button className="btn-secondary w-full mt-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Přidat typ směny
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary">Uložit změny</button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('firma');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Nastavení</h1>
        <p className="text-slate-500 text-sm mt-1">
          Konfigurace vaší organizace
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'firma' && <FirmaTab />}
          {activeTab === 'zamestnanci' && <ZamestnanciTab />}
          {activeTab === 'plan' && <PlanTab />}
        </div>
      </div>
    </div>
  );
}
