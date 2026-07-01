'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import IntegrationSettings from './IntegrationSettings';
import OrgLogoUpload from './OrgLogoUpload';
import ThemeSelector from './ThemeSelector';
import NotificationsPanel from './NotificationsPanel';
import { useT } from '@/lib/i18n';

// ─── ManagerTour ──────────────────────────────────────────────────────────────

interface MTourStep {
  target?: string;
  icon: string;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
  hintCs?: string;
  hintEn?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  switchTab?: 'employees' | 'work-types' | 'requests' | 'notifications' | 'settings';
}

const MANAGER_STEPS: MTourStep[] = [
  {
    icon: '🔐',
    titleCs: 'Vítejte v Manažerském panelu',
    titleEn: 'Welcome to the Manager panel',
    descCs: 'Toto je administrátorské rozhraní systému. Pojďme si projít jednotlivé sekce.',
    descEn: 'This is the system administration interface. Let\'s walk through each section.',
  },
  {
    target: 'mgr-tab-employees',
    icon: '👥',
    titleCs: 'Zaměstnanci',
    titleEn: 'Employees',
    descCs: 'Správa zaměstnanců — přidávání, úprava, nastavení PINu, přiřazení pracovního úvazku a štítků.',
    descEn: 'Manage employees — add, edit, set PINs, assign employment types and labels.',
    side: 'right',
    switchTab: 'employees',
  },
  {
    target: 'mgr-tab-work-types',
    icon: '🏷️',
    titleCs: 'Oddělení / Typy práce',
    titleEn: 'Departments / Work types',
    descCs: 'Definujte typy směn a oddělení — každý typ má název a barvu, která se zobrazí v kalendáři.',
    descEn: 'Define shift types and departments — each has a name and color shown in the calendar.',
    side: 'right',
    switchTab: 'work-types',
  },
  {
    target: 'mgr-tab-requests',
    icon: '📋',
    titleCs: 'Žádosti o dovolenou',
    titleEn: 'Leave requests',
    descCs: 'Přehled všech žádostí zaměstnanců o dovolenou. Jedním kliknutím schválíte nebo zamítnete.',
    descEn: 'Overview of all employee leave requests. Approve or reject with a single click.',
    side: 'right',
    switchTab: 'requests',
  },
  {
    target: 'mgr-tab-notifications',
    icon: '🔔',
    titleCs: 'Notifikace',
    titleEn: 'Notifications',
    descCs: 'Systémová upozornění — nové žádosti, změny v docházce, přihlášení do kiosku.',
    descEn: 'System notifications — new requests, attendance changes, kiosk logins.',
    side: 'right',
    switchTab: 'notifications',
  },
  {
    target: 'mgr-tab-settings',
    icon: '⚙️',
    titleCs: 'Nastavení',
    titleEn: 'Settings',
    descCs: 'Heslo manažera, provozní doby, bonusy, favicon, integrace a další konfigurace organizace.',
    descEn: 'Manager password, business hours, bonuses, favicon, integrations and org configuration.',
    side: 'right',
    switchTab: 'settings',
  },
  {
    icon: '✅',
    titleCs: 'To je vše!',
    titleEn: 'That\'s it!',
    descCs: 'Nyní znáte Manažerský panel. Pokud budete mít otázky, klikněte na ? kdykoli znovu.',
    descEn: 'You now know the Manager panel. If you have questions, click ? to reopen the tour anytime.',
  },
];

const PAD_MT = 8;
const CARD_W_MT = 300;

function getRect(target: string) {
  const el = document.querySelector<HTMLElement>(`[data-mgr-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function calcPos(rect: { top: number; left: number; width: number; height: number } | null, side?: MTourStep['side']) {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (!rect) return { top: vh / 2 - 120, left: vw / 2 - CARD_W_MT / 2, side: 'center' as const };
  const cx = rect.left + rect.width / 2;
  const resolvedSide = side ?? 'bottom';
  let top = 0, left = 0;
  if (resolvedSide === 'right') { top = Math.max(12, rect.top); left = rect.left + rect.width + PAD_MT + 8; }
  else if (resolvedSide === 'left') { top = Math.max(12, rect.top); left = rect.left - CARD_W_MT - PAD_MT - 8; }
  else if (resolvedSide === 'top') { top = rect.top - 180 - PAD_MT; left = Math.max(12, cx - CARD_W_MT / 2); }
  else { top = rect.top + rect.height + PAD_MT + 8; left = Math.max(12, Math.min(cx - CARD_W_MT / 2, vw - CARD_W_MT - 12)); }
  return { top, left, side: resolvedSide };
}

function ManagerTour({ lang, onClose, onSwitchTab }: {
  lang: 'cs' | 'en';
  onClose: () => void;
  onSwitchTab: (tab: MTourStep['switchTab']) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; side: 'center' | 'top' | 'bottom' | 'left' | 'right' }>({ top: 0, left: 0, side: 'center' });
  const [visible, setVisible] = useState(false);

  const step = MANAGER_STEPS[idx];
  const total = MANAGER_STEPS.length;
  const isLast = idx === total - 1;
  const t = (cs: string, en: string) => lang === 'en' ? en : cs;

  const recalc = useCallback(() => {
    const r = step.target ? getRect(step.target) : null;
    setRect(r);
    setPos(calcPos(r, step.side));
  }, [step]);

  useLayoutEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => { recalc(); setVisible(true); });
    return () => cancelAnimationFrame(id);
  }, [recalc]);

  useEffect(() => { window.addEventListener('resize', recalc); return () => window.removeEventListener('resize', recalc); }, [recalc]);

  function next() {
    if (isLast) { onClose(); return; }
    const nextStep = MANAGER_STEPS[idx + 1];
    if (nextStep.switchTab) onSwitchTab(nextStep.switchTab);
    setIdx(i => i + 1);
  }
  function back() { if (idx > 0) { const prev = MANAGER_STEPS[idx - 1]; if (prev.switchTab) onSwitchTab(prev.switchTab); setIdx(i => i - 1); } }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  return (
    <>
      {/* Overlay */}
      {rect ? (
        <svg className="fixed inset-0 pointer-events-none" style={{ zIndex: 9998, width: '100%', height: '100%' }}>
          <defs>
            <mask id="mgr-mask">
              <rect x="0" y="0" width={vw} height={vh} fill="white"/>
              <rect x={rect.left - PAD_MT} y={rect.top - PAD_MT} width={rect.width + PAD_MT * 2} height={rect.height + PAD_MT * 2} rx="6" fill="black"/>
            </mask>
          </defs>
          <rect x="0" y="0" width={vw} height={vh} fill="rgba(0,0,0,0.55)" mask="url(#mgr-mask)"/>
          <rect x={rect.left - PAD_MT - 1} y={rect.top - PAD_MT - 1} width={rect.width + PAD_MT * 2 + 2} height={rect.height + PAD_MT * 2 + 2} rx="7" fill="none" stroke="rgba(99,102,241,0.85)" strokeWidth="2">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="1.8s" repeatCount="indefinite"/>
          </rect>
        </svg>
      ) : (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9998, background: 'rgba(0,0,0,0.55)' }}/>
      )}

      {/* Card */}
      <div className="fixed pointer-events-auto" style={{ zIndex: 9999, top: pos.top, left: pos.left, width: CARD_W_MT, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.97)', transition: 'opacity 0.2s ease, transform 0.2s ease' }}>
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="h-1 bg-slate-100">
            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${((idx + 1) / total) * 100}%` }}/>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1">
                {MANAGER_STEPS.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)} className={`rounded-full transition-all ${i === idx ? 'w-4 h-2 bg-indigo-500' : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'}`}/>
                ))}
              </div>
              <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="flex gap-3 mb-3">
              <span className="text-2xl flex-shrink-0">{step.icon}</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">{t(step.titleCs, step.titleEn)}</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{t(step.descCs, step.descEn)}</p>
              </div>
            </div>
            {(step.hintCs || step.hintEn) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                <p className="text-amber-700 text-xs">💡 {t(step.hintCs ?? '', step.hintEn ?? '')}</p>
              </div>
            )}
            <div className="flex gap-2">
              {idx > 0 && <button onClick={back} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50">← {t('Zpět', 'Back')}</button>}
              <button onClick={next} className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors">
                {isLast ? t('Hotovo ✓', 'Done ✓') : t('Další →', 'Next →')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

const DEFAULT_EMPLOYMENT_TYPES = ['HPP', 'DPP', 'DPČ', 'IČO'];

// Legacy value→label map for employees created before dynamic types
const LEGACY_LABELS: Record<string, string> = {
  hpp: 'HPP', dpp: 'DPP', dpc: 'DPČ', ico: 'IČO',
};

type EmploymentType = string;

function employmentLabel(value?: string | null) {
  if (!value) return '—';
  return LEGACY_LABELS[value] ?? value;
}

function useEmploymentTypes() {
  const [types, setTypes] = useState<string[]>(DEFAULT_EMPLOYMENT_TYPES);
  const [configs, setConfigs] = useState<Record<string, { paidVacation: boolean }>>({});
  const refresh = useCallback(async () => {
    try {
      const res = await managerFetch('/api/manager/employment-types');
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.types) && d.types.length > 0) setTypes(d.types);
        if (d.configs) setConfigs(d.configs);
      }
    } catch { /* keep defaults */ }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { types, configs, refresh };
}

interface Employee {
  id: string;
  name: string;
  pin?: string;
  pin_code?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  labels?: string[];
  target_hours?: number;
  vacation_days_per_year?: number;
  employment_type?: EmploymentType | null;
  can_saturday?: boolean;
  max_saturdays?: number;
  tier?: number;
  active: boolean;
}

interface WorkType {
  id: string;
  name: string;
  color: string;
  category: 'shift' | 'presence' | 'absence';
  sort_order?: number;
}

interface Request {
  id: string;
  employee_id: string;
  type: 'vacation' | 'sick' | 'correction' | 'other';
  date_from: string;
  date_to?: string;
  note?: string;
  hours?: number | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  employees?: { id: string; name: string; department?: string; position?: string };
}

interface ManagerPanelProps {
  orgId: string;
  onClose: () => void;
  lang?: 'cs' | 'en';
}

// ─── Constants ────────────────────────────────────────────────────────────────

// TYPE_LABELS and CATEGORY_LABELS are built inside components via useT() for i18n

const CATEGORY_COLORS: Record<string, string> = {
  shift: 'bg-blue-100 text-blue-800',
  presence: 'bg-green-100 text-green-800',
  absence: 'bg-red-100 text-red-800',
};

function formatRequestNote(raw: string | null | undefined): { short: string; full: string } {
  if (!raw) return { short: '—', full: '' };
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const parts: string[] = [];
    if (obj.timeIn && obj.timeIn !== '--:--') parts.push(`Příchod: ${obj.timeIn}`);
    if (obj.timeOut && obj.timeOut !== '--:--') parts.push(`Odchod: ${obj.timeOut}`);
    const userNote = typeof obj.userNote === 'string' ? obj.userNote.trim() : '';
    if (userNote) parts.push(userNote);
    const full = parts.join(' · ') || raw;
    return { short: full.length > 60 ? full.slice(0, 60) + '…' : full, full };
  } catch {
    return { short: raw.length > 60 ? raw.slice(0, 60) + '…' : raw, full: raw };
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManagerPanel({ onClose, initialTab, lang }: ManagerPanelProps & { initialTab?: 'notifications' }) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<'employees' | 'work-types' | 'requests' | 'settings' | 'notifications'>(initialTab ?? 'employees');
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [tourLang, setTourLang] = useState<'cs' | 'en' | null>(null);

  useEffect(() => {
    managerFetch('/api/requests?status=pending')
      .then((r) => r.json())
      .then((d) => setPendingCount((d.requests ?? []).length))
      .catch(() => {});
    managerFetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => setUnreadCount((d.notifications ?? []).filter((n: { read: boolean }) => !n.read).length))
      .catch(() => {});
  }, []);

  const tabs = [
    { id: 'employees' as const, label: t('Zaměstnanci', 'Employees'), icon: '👥' },
    { id: 'work-types' as const, label: t('Oddělení', 'Departments'), icon: '🏷️' },
    { id: 'requests' as const, label: t('Žádosti', 'Requests'), icon: '📋' },
    { id: 'notifications' as const, label: t('Notifikace', 'Notifications'), icon: '🔔' },
    { id: 'settings' as const, label: t('Nastavení', 'Settings'), icon: '⚙️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex bg-white">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-gray-900 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-700">
          <h1 className="text-white font-semibold text-base leading-tight">{t('Správa systému', 'System Management')}</h1>
          <p className="text-gray-400 text-xs mt-0.5">Manager Panel</p>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-mgr-tour={`mgr-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.id === 'requests' && pendingCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
                  {pendingCount}
                </span>
              )}
              {tab.id === 'notifications' && unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="px-2 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <span className="text-base">✕</span>
            {t('Zavřít panel', 'Close panel')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            {tabs.find((t) => t.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowTour(true); setTourLang(null); }}
              className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title={t('Průvodce panelem', 'Panel tour')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={t('Zavřít', 'Close')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'employees' && <EmployeesTab />}
          {activeTab === 'work-types' && <WorkTypesTab />}
          {activeTab === 'requests' && <RequestsTab onCountChange={(n) => setPendingCount(n)} />}
          {activeTab === 'notifications' && <NotificationsTab onRead={() => setUnreadCount(0)} />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </div>

      {showTour && tourLang === null && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-72">
            <p className="text-base font-semibold text-slate-900 mb-1 text-center">🌐 Jazyk průvodce</p>
            <p className="text-xs text-slate-400 text-center mb-5">Tour language</p>
            <div className="flex gap-3">
              <button
                onClick={() => setTourLang('cs')}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-sm font-semibold text-slate-700 transition-all"
              >
                🇨🇿 Čeština
              </button>
              <button
                onClick={() => setTourLang('en')}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-sm font-semibold text-slate-700 transition-all"
              >
                🇬🇧 English
              </button>
            </div>
            <button onClick={() => setShowTour(false)} className="mt-4 w-full text-xs text-slate-400 hover:text-slate-600 transition-colors">
              Zrušit / Cancel
            </button>
          </div>
        </div>
      )}

      {showTour && tourLang !== null && (
        <ManagerTour
          lang={tourLang}
          onClose={() => setShowTour(false)}
          onSwitchTab={(tab) => { if (tab) setActiveTab(tab); }}
        />
      )}
    </div>
  );
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

function EmployeesTab() {
  const t = useT();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [vacBalances, setVacBalances] = useState<Record<string, { remainingDays: number; usedDays: number; pendingDays: number; totalDays: number; hasPaidVacation: boolean }>>({});

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await managerFetch('/api/employees');
      if (!res.ok) throw new Error('Nepodařilo se načíst zaměstnance.');
      const data = await res.json();
      setEmployees(data.employees ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    managerFetch('/api/manager/vacation-balances').then(r => r.json()).then(d => {
      const map: typeof vacBalances = {};
      for (const b of (d.balances ?? [])) map[b.employeeId] = b;
      setVacBalances(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleDelete = async (id: string) => {
    try {
      const res = await managerFetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Nepodařilo se smazat zaměstnance.');
      setDeleteConfirm(null);
      fetchEmployees();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Chyba při mazání');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{employees.length} zaměstnanců</p>
        <button
          onClick={() => { setEditingEmployee(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {t('+ Přidat zaměstnance', '+ Add employee')}
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={fetchEmployees} />}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[t('Jméno', 'Name'), 'PIN', t('Poměr', 'Contract'), t('Oddělení', 'Department'), t('Pozice', 'Position'), t('Štítky', 'Tags'), t('Cíl. hodiny', 'Target hours'), t('Dovolená', 'Vacation'), 'Tier', t('Aktivní', 'Active'), t('Akce', 'Actions')].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('Žádní zaměstnanci', 'No employees')}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{emp.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{emp.pin_code ?? emp.pin ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {employmentLabel(emp.employment_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.department ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.position ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {emp.tier ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          T{emp.tier}{emp.max_saturdays ? ` · ${emp.max_saturdays}So` : ''}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {(emp.labels ?? []).map((l) => (
                          <span key={l} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{l}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.target_hours ?? 160}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {(() => {
                        const b = vacBalances[emp.id];
                        if (!b) return <span className="text-gray-300">—</span>;
                        if (!b.hasPaidVacation) return <span className="text-xs text-gray-400">{t('Bez nároku', 'No entitlement')}</span>;
                        const pct = b.totalDays > 0 ? Math.min(100, (b.usedDays / b.totalDays) * 100) : 0;
                        const pendingPct = b.totalDays > 0 ? Math.min(100 - pct, (b.pendingDays / b.totalDays) * 100) : 0;
                        const remaining = b.totalDays - b.usedDays;
                        const barColor = remaining / b.totalDays > 0.5 ? 'bg-emerald-500' : remaining / b.totalDays > 0.1 ? 'bg-amber-500' : 'bg-red-500';
                        return (
                          <div className="min-w-[90px]">
                            <span className={`text-xs font-semibold ${remaining <= 0 ? 'text-red-600' : remaining <= 3 ? 'text-amber-600' : 'text-gray-700'}`}>
                              {b.usedDays}/{b.totalDays} {t('dní', 'd')}
                            </span>
                            <div className="mt-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                              <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                              {pendingPct > 0 && <div className="h-full bg-amber-300 transition-all" style={{ width: `${pendingPct}%` }} />}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {emp.active ? t('Ano', 'Yes') : t('Ne', 'No')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => { setEditingEmployee(emp); setShowForm(true); }}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                      >
                        {t('Upravit', 'Edit')}
                      </button>
                      {deleteConfirm === emp.id ? (
                        <span className="text-sm">
                          <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 mr-1">{t('Smazat?', 'Delete?')}</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600">{t('Zrušit', 'Cancel')}</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(emp.id)} className="text-red-500 hover:text-red-700 text-sm">
                          {t('Smazat', 'Delete')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          existingPins={employees.filter((e) => e.id !== editingEmployee?.id).map((e) => e.pin_code ?? e.pin ?? '')}
          allLabels={Array.from(new Set(employees.flatMap((e) => e.labels ?? [])))}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchEmployees(); }}
        />
      )}
    </div>
  );
}

// ─── Employee Form ────────────────────────────────────────────────────────────

interface EmployeeFormProps {
  employee: Employee | null;
  existingPins: string[];
  allLabels: string[];
  onClose: () => void;
  onSaved: () => void;
}

function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => onChange(value.filter((v) => v !== tag));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0 && input.length > 0) {
        addTag(filtered[0]);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
            {tag}
            <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(tag); }} className="hover:text-blue-900 leading-none">✕</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex-1 min-w-[80px] outline-none text-sm bg-transparent"
          placeholder={value.length === 0 ? 'Prodejna…' : ''}
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {filtered.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useWorkTypes() {
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  useEffect(() => {
    managerFetch('/api/work-types').then((r) => r.json()).then((d) => setWorkTypes(d.workTypes ?? [])).catch(() => {});
  }, []);
  return workTypes;
}

function EmployeeForm({ employee, existingPins, allLabels, onClose, onSaved }: EmployeeFormProps) {
  const t = useT();
  const { types: empTypes } = useEmploymentTypes();
  const deptOptions = useWorkTypes().filter((wt) => wt.category === 'shift');
  const [form, setForm] = useState({
    name: employee?.name ?? '',
    pin: employee?.pin_code ?? employee?.pin ?? '',
    email: employee?.email ?? '',
    phone: employee?.phone ?? '',
    department: employee?.department ?? '',
    position: employee?.position ?? '',
    labels: employee?.labels ?? [],
    target_hours: employee?.target_hours ?? 160,
    vacation_days_per_year: employee?.vacation_days_per_year ?? 20,
    employment_type: (employee?.employment_type ? (LEGACY_LABELS[employee.employment_type] ?? employee.employment_type) : empTypes[0] ?? 'HPP') as EmploymentType,
    tier: employee?.tier ?? 0,
    can_saturday: employee?.can_saturday ?? false,
    max_saturdays: employee?.max_saturdays ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('Jméno je povinné', 'Name is required');
    if (!form.pin) {
      e.pin = t('PIN je povinný', 'PIN is required');
    } else if (!/^\d{4,8}$/.test(form.pin)) {
      e.pin = t('PIN musí mít 4–8 číslic', 'PIN must be 4–8 digits');
    } else if (existingPins.includes(form.pin)) {
      e.pin = t('Tento PIN je již obsazen', 'This PIN is already taken');
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        labels: form.labels,
        tier: form.tier,
        can_saturday: form.can_saturday,
        max_saturdays: form.max_saturdays,
      };

      const url = employee ? `/api/employees/${employee.id}` : '/api/employees';
      const method = employee ? 'PUT' : 'POST';
      const res = await managerFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Chyba při ukládání');
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{employee ? t('Upravit zaměstnance', 'Edit employee') : t('Přidat zaměstnance', 'Add employee')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label={`${t('Jméno', 'Name')} *`} error={errors.name}>
            <input className={inputCls(errors.name)} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jan Novák" />
          </FormField>
          <FormField label={`PIN * (4–8 ${t('číslic', 'digits')})`} error={errors.pin}>
            <input className={inputCls(errors.pin)} value={form.pin} onChange={(e) => set('pin', e.target.value)} placeholder="1234" maxLength={8} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email">
              <input className={inputCls()} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jan@firma.cz" type="email" />
            </FormField>
            <FormField label={t('Telefon', 'Phone')}>
              <input className={inputCls()} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+420..." />
            </FormField>
          </div>
          <FormField label={t('Pracovní poměr', 'Employment type')}>
            <select
              className={inputCls()}
              value={form.employment_type}
              onChange={(e) => set('employment_type', e.target.value)}
            >
              {empTypes.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
              {/* show legacy value if not in current list */}
              {form.employment_type && !empTypes.includes(form.employment_type) && (
                <option value={form.employment_type}>{form.employment_type}</option>
              )}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('Oddělení', 'Department')}>
              {deptOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {deptOptions.map((wt) => (
                    <button
                      key={wt.id}
                      type="button"
                      onClick={() => set('department', form.department === wt.name ? '' : wt.name)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${form.department === wt.name ? 'border-current shadow-sm' : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      style={form.department === wt.name ? { borderColor: wt.color, backgroundColor: `${wt.color}22`, color: wt.color } : {}}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: wt.color }} />
                      {wt.name}
                    </button>
                  ))}
                </div>
              ) : (
                <input className={inputCls()} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Prodejna" />
              )}
            </FormField>
            <FormField label={t('Pozice', 'Position')}>
              <input className={inputCls()} value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="Prodavač" />
            </FormField>
          </div>
          <FormField label={t('Štítky', 'Tags')}>
            <TagInput value={form.labels as string[]} onChange={(v) => set('labels', v)} suggestions={allLabels} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('Cílové hodiny / měsíc', 'Target hours / month')}>
              <input className={inputCls()} type="number" min={0} value={form.target_hours} onChange={(e) => set('target_hours', Number(e.target.value))} />
            </FormField>
            <FormField label={t('Dovolená / rok (dní)', 'Vacation / year (days)')}>
              <input className={inputCls()} type="number" min={0} max={365} value={form.vacation_days_per_year} onChange={(e) => set('vacation_days_per_year', Number(e.target.value))} />
            </FormField>
          </div>
          {/* Tier + Soboty */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('Asistent směn (DLC)', 'Shift assistant (DLC)')}</p>
            <FormField label={t('Tier zaměstnance', 'Employee tier')}>
              <div className="flex gap-2">
                {([0, 1, 2, 3] as const).map((t_) => {
                  const labels = [t('Bez tieru', 'No tier'), 'Tier 1', 'Tier 2', 'Tier 3'];
                  const descs = [
                    t('Neřazeno', 'Unranked'),
                    t('Full-time prodejna', 'Full-time store'),
                    t('~4× / měsíc', '~4× / month'),
                    t('Výpomoc ~1×', 'Occasional ~1×'),
                  ];
                  const active = form.tier === t_;
                  return (
                    <button
                      key={t_}
                      type="button"
                      onClick={() => set('tier', t_)}
                      title={descs[t_]}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                    >
                      {labels[t_]}
                    </button>
                  );
                })}
              </div>
              {form.tier > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  {[
                    '',
                    t('Full-time prodejna — priorita každá sobota', 'Full-time store — priority every Saturday'),
                    t('Částečný úvazek — cca 4 soboty měsíčně', 'Part-time — approx. 4 Saturdays/month'),
                    t('Výpomoc — cca 1 sobota měsíčně', 'Occasional — approx. 1 Saturday/month'),
                  ][form.tier]}
                </p>
              )}
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('Max sobot / měsíc', 'Max Saturdays / month')}>
                <input
                  className={inputCls()}
                  type="number"
                  min={0}
                  max={5}
                  value={form.max_saturdays}
                  onChange={(e) => set('max_saturdays', Number(e.target.value))}
                  placeholder="0"
                />
              </FormField>
              <FormField label={t('Může pracovat v sobotu', 'Can work Saturday')}>
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.can_saturday}
                    onChange={(e) => set('can_saturday', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">{form.can_saturday ? t('Ano', 'Yes') : t('Ne', 'No')}</span>
                </label>
              </FormField>
            </div>
          </div>

          <div className="flex gap-3 pt-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">{t('Zrušit', 'Cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? t('Ukládám…', 'Saving…') : employee ? t('Uložit', 'Save') : t('Přidat', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Work Types Tab ───────────────────────────────────────────────────────────

function WorkTypesTab() {
  const t = useT();
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingWT, setEditingWT] = useState<WorkType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await managerFetch('/api/work-types');
      if (!res.ok) throw new Error('Nepodařilo se načíst typy práce.');
      const data = await res.json();
      setWorkTypes(data.workTypes ?? data.work_types ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleDelete = async (id: string) => {
    try {
      const res = await managerFetch(`/api/work-types/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Nepodařilo se smazat typ práce.');
      setDeleteConfirm(null);
      fetch_();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Chyba');
    }
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const idx = workTypes.findIndex((w) => w.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= workTypes.length) return;
    const updated = [...workTypes];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    // Assign sort_order by position
    const patches = updated.map((wt, i) => managerFetch(`/api/work-types/${wt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sort_order: i }),
    }));
    setWorkTypes(updated); // optimistic
    await Promise.all(patches);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{workTypes.length} typů</p>
        <button
          onClick={() => { setEditingWT(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
        >
          {t('+ Přidat oddělení', '+ Add department')}
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={fetch_} />}

      {!loading && !error && (
        <div className="space-y-2">
          {workTypes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('Žádná oddělení', 'No departments')}</p>
          ) : (
            workTypes.map((wt) => (
              <div key={wt.id} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                <div className="w-7 h-7 rounded-full flex-shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: wt.color }} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 text-sm">{wt.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[wt.category]}`}>
                  {wt.category === 'shift' ? t('Směna', 'Shift') : wt.category === 'presence' ? t('Docházka', 'Attendance') : t('Absence', 'Absence')}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Reorder buttons */}
                  <button
                    onClick={() => handleReorder(wt.id, 'up')}
                    disabled={workTypes.indexOf(wt) === 0}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                    title={t('Posunout výš', 'Move up')}
                  >▲</button>
                  <button
                    onClick={() => handleReorder(wt.id, 'down')}
                    disabled={workTypes.indexOf(wt) === workTypes.length - 1}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed"
                    title={t('Posunout níž', 'Move down')}
                  >▼</button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
                  <button onClick={() => { setEditingWT(wt); setShowForm(true); }} className="text-blue-600 hover:text-blue-800 text-sm">{t('Upravit', 'Edit')}</button>
                  {deleteConfirm === wt.id ? (
                    <>
                      <button onClick={() => handleDelete(wt.id)} className="text-red-600 hover:text-red-800 text-sm">{t('Smazat?', 'Delete?')}</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600 text-sm">{t('Zrušit', 'Cancel')}</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirm(wt.id)} className="text-red-500 hover:text-red-700 text-sm">{t('Smazat', 'Delete')}</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showForm && (
        <WorkTypeForm
          workType={editingWT}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetch_(); }}
        />
      )}
    </div>
  );
}

interface WorkTypeFormProps {
  workType: WorkType | null;
  onClose: () => void;
  onSaved: () => void;
}

function WorkTypeForm({ workType, onClose, onSaved }: WorkTypeFormProps) {
  const t = useT();
  const [form, setForm] = useState({
    name: workType?.name ?? '',
    color: workType?.color ?? '#3B82F6',
    category: workType?.category ?? 'shift' as const,
    sort_order: workType?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const set = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setNameError('Název je povinný'); return; }
    setSaving(true);
    try {
      const url = workType ? `/api/work-types/${workType.id}` : '/api/work-types';
      const method = workType ? 'PUT' : 'POST';
      const res = await managerFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Chyba při ukládání');
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{workType ? t('Upravit oddělení', 'Edit department') : t('Přidat oddělení', 'Add department')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label={`${t('Název', 'Name')} *`} error={nameError}>
            <input className={inputCls(nameError)} value={form.name} onChange={(e) => { setNameError(''); set('name', e.target.value); }} placeholder="Ranní směna" />
          </FormField>
          <FormField label={t('Barva', 'Color')}>
            <div className="flex items-center gap-3">
              <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="h-9 w-16 rounded border border-gray-300 cursor-pointer p-0.5" />
              <span className="text-sm text-gray-500 font-mono">{form.color}</span>
            </div>
          </FormField>
          <FormField label={t('Kategorie', 'Category')}>
            <select className={inputCls()} value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="shift">{t('Směna', 'Shift')}</option>
              <option value="presence">{t('Docházka', 'Attendance')}</option>
              <option value="absence">{t('Absence', 'Absence')}</option>
            </select>
          </FormField>
          <FormField label={t('Pořadí', 'Order')}>
            <input className={inputCls()} type="number" min={0} value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
          </FormField>
          <div className="flex gap-3 pt-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">{t('Zrušit', 'Cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? t('Ukládám…', 'Saving…') : workType ? t('Uložit', 'Save') : t('Přidat', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Vacation Overview Panel ──────────────────────────────────────────────────

function VacationOverviewPanel() {
  const t = useT();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [requests, setRequests] = useState<Request[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      managerFetch('/api/requests?status=approved').then((r) => r.json()),
      managerFetch('/api/requests?status=pending').then((r) => r.json()),
      managerFetch('/api/employees').then((r) => r.json()),
    ]).then(([approved, pending, emps]) => {
      setRequests([...(approved.requests ?? []), ...(pending.requests ?? [])].filter((r: Request) => r.type === 'vacation'));
      setEmployees(emps.employees ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const [year, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mo, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const DAY_NAMES = [t('Po','Mon'),t('Út','Tue'),t('St','Wed'),t('Čt','Thu'),t('Pá','Fri'),t('So','Sat'),t('Ne','Sun')];

  function mondayWD(d: string) { return (new Date(d + 'T00:00:00').getDay() + 6) % 7; }
  function dateInRange(day: string, from: string, to: string | null) {
    return day >= from && (to ? day <= to : day === from);
  }

  const departments = ['all', ...Array.from(new Set(employees.map(e => e.department ?? '').filter(Boolean))).sort()];
  const filteredEmployees = deptFilter === 'all' ? employees : employees.filter(e => (e.department ?? '') === deptFilter);

  const empDays = new Map<string, Map<string, string>>();
  for (const req of requests) {
    for (const day of days) {
      if (dateInRange(day, req.date_from, req.date_to ?? null)) {
        if (!empDays.has(req.employee_id)) empDays.set(req.employee_id, new Map());
        empDays.get(req.employee_id)!.set(day, req.status);
      }
    }
  }

  const CZ_MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
  const firstOffset = days.length > 0 ? mondayWD(days[0]) : 0;

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t('Přehled dovolených — kdo kdy chybí', 'Vacation overview — who is absent when')}</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => { const [y,m] = month.split('-').map(Number); const d = new Date(y, m-2, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 text-sm">‹</button>
            <span className="text-sm font-medium text-slate-700 px-2">{CZ_MONTHS[mo-1]} {year}</span>
            <button onClick={() => { const [y,m] = month.split('-').map(Number); const d = new Date(y, m, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 text-sm">›</button>
          </div>
        </div>
        {departments.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => setDeptFilter(dept)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${deptFilter === dept ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'}`}
              >
                {dept === 'all' ? t('Všechna oddělení', 'All departments') : dept}
              </button>
            ))}
          </div>
        )}
      </div>
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">{t('Načítám…', 'Loading…')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-slate-300">
                <th className="sticky left-0 bg-slate-800 px-3 py-2 text-left font-medium w-28 whitespace-nowrap">{t('Zaměstnanec', 'Employee')}</th>
                {Array.from({ length: firstOffset }).map((_, i) => <th key={`e${i}`} />)}
                {days.map((d) => {
                  const wd = mondayWD(d);
                  const dayN = new Date(d + 'T00:00:00').getDate();
                  return (
                    <th key={d} className={`px-0.5 py-2 text-center font-medium min-w-[28px] ${wd >= 5 ? 'text-blue-300' : ''}`}>
                      <div>{dayN}</div>
                      <div className="text-slate-500 text-[9px]">{DAY_NAMES[wd]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => {
                const dayMap = empDays.get(emp.id);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap">{emp.name}</td>
                    {Array.from({ length: firstOffset }).map((_, i) => <td key={`e${i}`} />)}
                    {days.map((d) => {
                      const wd = mondayWD(d);
                      const st = dayMap?.get(d);
                      return (
                        <td key={d} className={`px-0.5 py-1 text-center ${wd >= 5 ? 'bg-blue-50/40' : ''}`}>
                          {st === 'approved' && <span className="block w-5 h-5 rounded bg-emerald-400 mx-auto" title={t('Schválena', 'Approved')} />}
                          {st === 'pending' && <span className="block w-5 h-5 rounded bg-amber-300 mx-auto" title={t('Čeká', 'Pending')} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-4 px-4 py-2 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400" />{t('Schválena', 'Approved')}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-300" />{t('Čeká na schválení', 'Pending approval')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Requests Tab ─────────────────────────────────────────────────────────────

function RequestsTab({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const t = useT();
  const [subTab, setSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVacationOverview, setShowVacationOverview] = useState(false);

  const fetchRequests = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await managerFetch(`/api/requests?status=${status}`);
      if (!res.ok) throw new Error('Nepodařilo se načíst žádosti.');
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(subTab); }, [subTab, fetchRequests]);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await managerFetch(`/api/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Nepodařilo se zpracovat žádost.');
      fetchRequests(subTab);
      // Refresh badge count
      managerFetch('/api/requests?status=pending').then((r) => r.json()).then((d) => onCountChange?.((d.requests ?? []).length)).catch(() => {});
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Chyba');
    }
  };

  const TYPE_LABELS: Record<string, string> = {
    vacation: t('Dovolená', 'Vacation'),
    sick: t('Nemoc', 'Sick leave'),
    correction: t('Oprava docházky', 'Attendance correction'),
    other: t('Ostatní', 'Other'),
  };

  const subTabs: { id: 'pending' | 'approved' | 'rejected'; label: string }[] = [
    { id: 'pending', label: t('Čekající', 'Pending') },
    { id: 'approved', label: t('Schválené', 'Approved') },
    { id: 'rejected', label: t('Zamítnuté', 'Rejected') },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {subTabs.map((st) => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subTab === st.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {st.label}
          </button>
        ))}
        </div>
        <button
          onClick={() => setShowVacationOverview((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${showVacationOverview ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'}`}
        >
          🏖️ {showVacationOverview ? t('Skrýt přehled dovolených', 'Hide vacation overview') : t('Přehled dovolených', 'Vacation overview')}
        </button>
      </div>

      {showVacationOverview && <VacationOverviewPanel />}

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={() => fetchRequests(subTab)} />}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[t('Zaměstnanec', 'Employee'), t('Typ', 'Type'), t('Od', 'From'), t('Do', 'To'), t('Hodiny', 'Hours'), t('Poznámka', 'Note'), t('Datum podání', 'Submitted'), ...(subTab === 'pending' ? [t('Akce', 'Actions')] : [])].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={subTab === 'pending' ? 8 : 7} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('Žádné žádosti', 'No requests')}
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {req.employees?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {TYPE_LABELS[req.type] ?? req.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{req.date_from}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{req.date_to ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{req.hours ? `${req.hours}h` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                      {(() => { const { short, full } = formatRequestNote(req.note); return <span title={full || undefined}>{short}</span>; })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString('cs-CZ')}
                    </td>
                    {subTab === 'pending' && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleAction(req.id, 'approved')}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 hover:bg-green-200 mr-2 text-base"
                          title={t('Schválit', 'Approve')}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleAction(req.id, 'rejected')}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 hover:bg-red-200 text-base"
                          title={t('Zamítnout', 'Reject')}
                        >
                          ✗
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const t = useT();
  const [passwords, setPasswords] = useState({ current: '', newPwd: '', confirm: '' });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [kioskEnabled, setKioskEnabled] = useState(false);
  const { types: empTypes, configs: empConfigs, refresh: refreshEmpTypes } = useEmploymentTypes();
  const [newEmpType, setNewEmpType] = useState('');
  const [savingEmpTypes, setSavingEmpTypes] = useState(false);

  const saveEmpTypes = async (updated: string[]) => {
    setSavingEmpTypes(true);
    try {
      await managerFetch('/api/manager/employment-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: updated }),
      });
      await refreshEmpTypes();
    } finally {
      setSavingEmpTypes(false);
    }
  };

  const togglePaidVacation = async (typeName: string, value: boolean) => {
    const updated = { ...empConfigs, [typeName]: { paidVacation: value } };
    await managerFetch('/api/manager/employment-types', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs: updated }),
    });
    await refreshEmpTypes();
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!passwords.current) { setPwdMsg({ type: 'error', text: 'Zadejte aktuální heslo.' }); return; }
    if (!passwords.newPwd) { setPwdMsg({ type: 'error', text: 'Zadejte nové heslo.' }); return; }
    if (passwords.newPwd !== passwords.confirm) { setPwdMsg({ type: 'error', text: 'Hesla se neshodují.' }); return; }

    setSavingPwd(true);
    try {
      const res = await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: passwords.current, new_password: passwords.newPwd }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Nepodařilo se změnit heslo.');
      }
      setPwdMsg({ type: 'success', text: t('Heslo bylo úspěšně změněno.', 'Password changed successfully.') });
      setPasswords({ current: '', newPwd: '', confirm: '' });
    } catch (err) {
      setPwdMsg({ type: 'error', text: err instanceof Error ? err.message : 'Chyba' });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      {/* Manager Password */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('Manažerské heslo', 'Manager password')}</h3>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <FormField label={t('Aktuální heslo', 'Current password')}>
            <input
              type="password"
              className={inputCls()}
              value={passwords.current}
              onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
              autoComplete="current-password"
            />
          </FormField>
          <FormField label={t('Nové heslo', 'New password')}>
            <input
              type="password"
              className={inputCls()}
              value={passwords.newPwd}
              onChange={(e) => setPasswords((p) => ({ ...p, newPwd: e.target.value }))}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label={t('Potvrdit nové heslo', 'Confirm new password')}>
            <input
              type="password"
              className={inputCls()}
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
            />
          </FormField>
          {pwdMsg && (
            <p className={`text-sm ${pwdMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {pwdMsg.text}
            </p>
          )}
          <div className="pt-1">
            <button type="submit" disabled={savingPwd} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {savingPwd ? t('Ukládám…', 'Saving…') : t('Uložit heslo', 'Save password')}
            </button>
          </div>
        </form>
      </section>

      {/* Company Info */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('Informace o firmě', 'Company info')}</h3>
        <FormField label={t('Název firmy', 'Company name')}>
          <input className={inputCls() + ' bg-gray-50'} disabled value="" placeholder={t('(načítá se…)', '(loading…)')} />
        </FormField>
        <p className="text-xs text-gray-400 mt-2">{t('Název firmy je nyní jen pro čtení.', 'Company name is read-only.')}</p>
      </section>

      {/* Employment types */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Pracovní poměry', 'Employment types')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Typy pracovního poměru, které budou dostupné při přidávání zaměstnance.', 'Employment types available when adding an employee.')}</p>
        <div className="space-y-2 mb-4">
          {empTypes.map((et) => {
            const paid = empConfigs[et]?.paidVacation ?? true;
            return (
              <div key={et} className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                <span className="font-medium text-blue-900 text-sm">{et}</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={paid}
                      onClick={() => togglePaidVacation(et, !paid)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${paid ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${paid ? 'translate-x-4' : ''}`} />
                    </button>
                    {paid ? t('Placená dovolená', 'Paid vacation') : t('Bez placené dovolené', 'No paid vacation')}
                  </label>
                  {empTypes.length > 1 && (
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-500 transition-colors text-xs"
                      onClick={() => saveEmpTypes(empTypes.filter((x) => x !== et))}
                      disabled={savingEmpTypes}
                    >✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('Přidat typ (např. DPP)', 'Add type (e.g. DPP)')}
            value={newEmpType}
            onChange={(e) => setNewEmpType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const v = newEmpType.trim();
                if (v && !empTypes.includes(v)) { saveEmpTypes([...empTypes, v]); setNewEmpType(''); }
              }
            }}
          />
          <button
            type="button"
            disabled={savingEmpTypes || !newEmpType.trim() || empTypes.includes(newEmpType.trim())}
            onClick={() => {
              const v = newEmpType.trim();
              if (v && !empTypes.includes(v)) { saveEmpTypes([...empTypes, v]); setNewEmpType(''); }
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {savingEmpTypes ? '…' : t('Přidat', 'Add')}
          </button>
        </div>
      </section>

      {/* Attendance */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('Docházka', 'Attendance')}</h3>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={kioskEnabled}
            onClick={() => setKioskEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${kioskEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${kioskEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-gray-700">{t('Kiosk povolen', 'Kiosk enabled')}</span>
        </label>
      </section>

      {/* Planning features */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Plánování směn', 'Shift planning')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Volitelné funkce pro firmy s víkendovým provozem', 'Optional features for businesses with weekend operations')}</p>
        <ToggleSetting
          label={t('Logika sobot', 'Saturday logic')}
          description={t('Sledovat, zda zaměstnanci mohou pracovat v sobotu a kolik sobot za měsíc. Vhodné pro maloobchod a provoz o víkendech.', 'Track whether employees can work on Saturdays and how many Saturdays per month. Suitable for retail and weekend operations.')}
          settingKey="saturday_logic_enabled"
        />
        <div className="mt-4">
          <ToggleSetting
            label={t('Víkendový provoz', 'Weekend operation')}
            description={t('Firma má otevřeno i o víkendech. Víkendové buňky v gridu budou zvýrazněny jako pracovní dny. Směny lze přidávat o víkendech vždy bez ohledu na toto nastavení.', 'The business is open on weekends. Weekend cells in the grid will be highlighted as working days. Shifts can always be added on weekends regardless of this setting.')}
            settingKey="weekend_open"
          />
        </div>
      </section>

      {/* Bonus settings */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Bonusy — nastavení', 'Bonus settings')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Příplatky pro výpočet bonusových hodin v exportu CSV', 'Bonuses for calculating bonus hours in CSV export')}</p>
        <div className="space-y-4">
          <NumberSetting label={t('Příplatek za sobotu (%)', 'Saturday bonus (%)')} description={t('% navíc za hodiny v sobotu. Např. 10 = za 8h soboty → 0,8h bonus.', '% extra for Saturday hours. E.g. 10 = for 8h Saturday → 0.8h bonus.')} settingKey="bonus_saturday_pct" defaultValue={10} />
          <NumberSetting label={t('Přesčas — práh (h/měsíc)', 'Overtime threshold (h/month)')} description={t('Od kolika hodin měsíčně se počítá přesčas. 0 = přesčas se nepočítá.', 'Monthly hours threshold for overtime. 0 = overtime not counted.')} settingKey="bonus_overtime_threshold" defaultValue={0} />
          <NumberSetting label={t('Příplatek za přesčas (%)', 'Overtime bonus (%)')} description={t('% navíc za přesčasové hodiny.', '% extra for overtime hours.')} settingKey="bonus_overtime_pct" defaultValue={25} />
        </div>
      </section>

      {/* Provozní doba */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Provozní doba', 'Business hours')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Nastavte otevírací hodiny pro každý den v týdnu', 'Set opening hours for each day of the week')}</p>
        <OperatingHoursSetting />
      </section>

      {/* Zavřené dny */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Státní svátky / Zavřené dny', 'Holidays / Closed days')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Konkrétní dny, kdy je firma zavřená (formát: RRRR-MM-DD)', 'Specific days when the business is closed (format: YYYY-MM-DD)')}</p>
        <ClosedDatesSetting />
      </section>

      {/* Večerní směna */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Večerní směna', 'Evening shift')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Konfigurace odpolední/večerní směny — asistent navrhne naplánované zaměstnance se štítkem jako kandidáty.', 'Configure the evening shift — the assistant will suggest already-scheduled employees with the matching label as candidates.')}</p>
        <EveningShiftSetting />
      </section>

      {/* Počítání dovolené */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Počítání dovolené', 'Vacation counting')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Jak se počítají dny dovolené — pouze pracovní dny, nebo všechny dny týdne.', 'How vacation days are counted — workdays only or all days of the week.')}</p>
        <VacationCountingModeSetting />
      </section>

      {/* Výchozí dovolená */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Výchozí dovolená', 'Default vacation')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Kolik dní dovolené dostane nový zaměstnanec, pokud není zadáno jinak.', 'How many vacation days a new employee gets if not specified otherwise.')}</p>
        <DefaultVacationDaysSetting />
      </section>

      {/* Počet lidí na prodejně */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Počet lidí na prodejně', 'Required staff per day')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Kolik zaměstnanců musí být na prodejně v daný den v týdnu. Asistent směn toto použije jako výchozí hodnotu.', 'How many employees must be at the store on each weekday. The shift assistant uses this as the default.')}</p>
        <StaffingPerDaySetting />
      </section>

      {/* Absence a benefity */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Absence a benefity', 'Absences and benefits')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Konfigurace nemocenské a benefitů', 'Sick leave and benefits configuration')}</p>
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{t('Nemocenská', 'Sick leave')}</p>
            <NumberSetting label={t('% z denního fondu hodin', '% of daily hour fund')} description={t('Např. 60 = nemocenská = 60 % z 8h = 4,8h', 'E.g. 60 = sick leave = 60% of 8h = 4.8h')} settingKey="sick_leave_pct" defaultValue={60} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">{t('Benefity — konfigurace', 'Benefits — configuration')}</p>
            <BenefitsSetting />
          </div>
        </div>
      </section>

      {/* Logo */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <OrgLogoUpload />
      </section>

      {/* Theme */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <ThemeSelector onThemeChange={key => window.dispatchEvent(new CustomEvent('tf:theme-change', { detail: key }))} />
      </section>

      {/* Favicon */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <FaviconSetting />
      </section>

      {/* Integrations */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <IntegrationSettings />
      </section>
    </div>
  );
}

function FaviconSetting() {
  const t = useT();
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, string>) => { if (d.favicon_url) setUrl(d.favicon_url); })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favicon_url: url.trim() || null }),
      });
      // Apply immediately in the current tab
      const faviconHref = url.trim() || '/favicon.svg';
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = faviconHref;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h3 className="font-semibold text-gray-900 mb-1">{t('Favicon', 'Favicon')}</h3>
      <p className="text-xs text-gray-400 mb-4">
        {t(
          'URL obrázku, který se zobrazí jako ikona záložky v prohlížeči. Ponechte prázdné pro výchozí logo TeamFlow.',
          'URL of the image shown as the browser tab icon. Leave empty to use the default TeamFlow logo.',
        )}
      </p>
      <div className="flex gap-2 items-center">
        {url && (
          <img src={url} alt="favicon preview" className="w-6 h-6 rounded object-contain border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/icon.png"
          className={inputCls('flex-1')}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}
        >
          {saved ? `✓ ${t('Uloženo', 'Saved')}` : saving ? '…' : t('Uložit', 'Save')}
        </button>
      </div>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  settingKey: string;
}

function ToggleSetting({ label, description, settingKey }: ToggleSettingProps) {
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    managerFetch(`/api/manager/settings`)
      .then((r) => r.json())
      .then((d) => { if (settingKey in d) setEnabled(d[settingKey]); })
      .catch(() => {});
  }, [settingKey]);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: next }),
      });
    } catch { setEnabled(!next); }
    finally { setSaving(false); }
  };

  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={enabled} onClick={toggle} disabled={saving}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'} disabled:opacity-60`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </label>
  );
}

function NumberSetting({ label, description, settingKey, defaultValue }: { label: string; description: string; settingKey: string; defaultValue: number }) {
  const [value, setValue] = useState<string>(String(defaultValue));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d) => { if (settingKey in d) setValue(String(d[settingKey])); })
      .catch(() => {});
  }, [settingKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: parseFloat(value) || 0 }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
          min={0}
          step={1}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}
        >
          {saved ? '✓' : saving ? '…' : 'Uložit'}
        </button>
      </div>
    </div>
  );
}

// ─── OperatingHoursSetting ────────────────────────────────────────────────────

const WEEKDAY_KEYS_BASE: { key: string; czLabel: string; enLabel: string }[] = [
  { key: 'hours_mon', czLabel: 'Po', enLabel: 'Mon' },
  { key: 'hours_tue', czLabel: 'Út', enLabel: 'Tue' },
  { key: 'hours_wed', czLabel: 'St', enLabel: 'Wed' },
  { key: 'hours_thu', czLabel: 'Čt', enLabel: 'Thu' },
  { key: 'hours_fri', czLabel: 'Pá', enLabel: 'Fri' },
  { key: 'hours_sat', czLabel: 'So', enLabel: 'Sat' },
  { key: 'hours_sun', czLabel: 'Ne', enLabel: 'Sun' },
];

function OperatingHoursSetting() {
  const t = useT();
  const WEEKDAY_KEYS = WEEKDAY_KEYS_BASE.map(({ key, czLabel, enLabel }) => ({ key, label: t(czLabel, enLabel) }));
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const v: Record<string, string> = {};
        for (const { key } of WEEKDAY_KEYS_BASE) {
          v[key] = typeof d[key] === 'string' ? (d[key] as string) : '';
        }
        setValues(v);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const setOpen = (key: string, open: boolean) => {
    setValues((v) => ({ ...v, [key]: open ? '09:00-18:00' : '' }));
  };

  const setTime = (key: string, part: 'from' | 'to', time: string) => {
    setValues((v) => {
      const cur = v[key] ?? '09:00-18:00';
      const [f, t] = cur.split('-');
      return { ...v, [key]: part === 'from' ? `${time}-${t ?? '18:00'}` : `${f ?? '09:00'}-${time}` };
    });
  };

  return (
    <div className="space-y-2">
      {WEEKDAY_KEYS.map(({ key, label }) => {
        const val = values[key] ?? '';
        const isOpen = val !== '';
        const [fromTime, toTime] = isOpen ? val.split('-') : ['09:00', '18:00'];
        return (
          <div key={key} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
            <span className="w-7 text-sm font-medium text-gray-600">{label}</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={isOpen} onChange={(e) => setOpen(key, e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-gray-600">{t('Otevřeno', 'Open')}</span>
            </label>
            {isOpen && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-gray-400">{t('Od', 'From')}</span>
                <input type="time" value={fromTime ?? '09:00'} onChange={(e) => setTime(key, 'from', e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <span className="text-xs text-gray-400">{t('Do', 'To')}</span>
                <input type="time" value={toTime ?? '18:00'} onChange={(e) => setTime(key, 'to', e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            )}
          </div>
        );
      })}
      <div className="pt-2">
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}>
          {saved ? `✓ ${t('Uloženo', 'Saved')}` : saving ? '…' : t('Uložit provozní dobu', 'Save business hours')}
        </button>
      </div>
    </div>
  );
}

// ─── ClosedDatesSetting ───────────────────────────────────────────────────────

function ClosedDatesSetting() {
  const t = useT();
  const [dates, setDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const raw = typeof d['closed_dates'] === 'string' ? (d['closed_dates'] as string) : '';
        setDates(raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []);
      })
      .catch(() => {});
  }, []);

  const saveDates = async (newDates: string[]) => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_dates: newDates.join(',') }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const addDate = () => {
    if (!newDate || dates.includes(newDate)) { setNewDate(''); return; }
    const next = [...dates, newDate].sort();
    setDates(next);
    setNewDate('');
    saveDates(next);
  };

  const removeDate = (d: string) => {
    const next = dates.filter((x) => x !== d);
    setDates(next);
    saveDates(next);
  };

  return (
    <div className="space-y-3">
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <span key={d} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-2.5 py-1 rounded-full">
              {d}
              <button onClick={() => removeDate(d)} className="text-slate-400 hover:text-red-500 ml-1 leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <button onClick={addDate} disabled={!newDate || saving}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {t('+ Přidat datum', '+ Add date')}
        </button>
        {saved && <span className="text-emerald-600 text-sm">✓ {t('Uloženo', 'Saved')}</span>}
      </div>
    </div>
  );
}

// ─── StaffingPerDaySetting ───────────────────────────────────────────────────

const DOW_KEYS = ['required_mon', 'required_tue', 'required_wed', 'required_thu', 'required_fri', 'required_sat', 'required_sun'] as const;
const DOW_CZ   = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const DOW_EN   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DOW_DEFAULT = [3, 3, 3, 3, 3, 2, 0];

function StaffingPerDaySetting() {
  const t = useT();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const v: Record<string, string> = {};
        DOW_KEYS.forEach((key, i) => {
          v[key] = typeof d[key] === 'number' ? String(d[key]) : String(DOW_DEFAULT[i]);
        });
        setValues(v);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, number> = {};
    DOW_KEYS.forEach((key) => { payload[key] = Math.max(0, parseInt(values[key] ?? '0') || 0); });
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 mb-3">
        {DOW_KEYS.map((key, i) => (
          <div key={key} className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500">{t(DOW_CZ[i].slice(0, 2), DOW_EN[i].slice(0, 2))}</span>
            <input
              type="number"
              min={0}
              max={99}
              value={values[key] ?? String(DOW_DEFAULT[i])}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className={`w-full text-center border rounded-lg px-1 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                parseInt(values[key] ?? '0') === 0 ? 'border-gray-100 bg-gray-50 text-gray-300' : 'border-gray-200 text-gray-800'
              }`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? t('Ukládám…', 'Saving…') : t('Uložit', 'Save')}
        </button>
        {saved && <span className="text-emerald-600 text-sm font-medium">✓ {t('Uloženo', 'Saved')}</span>}
        <span className="text-xs text-gray-400 ml-auto">{t('0 = zavřeno / nepracovní den', '0 = closed / non-working day')}</span>
      </div>
    </div>
  );
}

// ─── BenefitsSetting ─────────────────────────────────────────────────────────

interface BenefitRow {
  label: string;
  hoursKey: string;
  maxKey: string;
  defaultHours: number;
  defaultMax: number;
}

const BENEFIT_ROWS_BASE = [
  { czLabel: 'Darování krve', enLabel: 'Blood donation', hoursKey: 'benefit_blood_hours', maxKey: 'benefit_blood_max', defaultHours: 8, defaultMax: 1 },
  { czLabel: 'Angličtina', enLabel: 'English lessons', hoursKey: 'benefit_english_hours', maxKey: 'benefit_english_max', defaultHours: -1, defaultMax: 4 },
  { czLabel: 'Cvičení', enLabel: 'Gym', hoursKey: 'benefit_gym_hours', maxKey: 'benefit_gym_max', defaultHours: -1, defaultMax: 4 },
];

function BenefitsSetting() {
  const t = useT();
  const BENEFIT_ROWS = BENEFIT_ROWS_BASE.map(({ czLabel, enLabel, ...rest }) => ({ label: t(czLabel, enLabel), ...rest }));
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const v: Record<string, string> = {};
        for (const row of BENEFIT_ROWS_BASE) {
          v[row.hoursKey] = typeof d[row.hoursKey] === 'number' ? String(d[row.hoursKey]) : String(row.defaultHours);
          v[row.maxKey] = typeof d[row.maxKey] === 'number' ? String(d[row.maxKey]) : String(row.defaultMax);
        }
        setValues(v);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, number> = {};
    for (const key of Object.keys(values)) {
      payload[key] = parseFloat(values[key]) || 0;
    }
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider pb-1 border-b border-gray-100">
        <span>{t('Benefit', 'Benefit')}</span>
        <span>{t('Efekt hodin', 'Hours effect')}</span>
        <span>{t('Max. za měsíc', 'Max per month')}</span>
      </div>
      {BENEFIT_ROWS.map((row) => (
        <div key={row.hoursKey} className="grid grid-cols-3 gap-2 items-center">
          <span className="text-sm text-gray-700">{row.label}</span>
          <input
            type="number"
            step={0.5}
            value={values[row.hoursKey] ?? String(row.defaultHours)}
            onChange={(e) => setValues((v) => ({ ...v, [row.hoursKey]: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="number"
            step={1}
            min={0}
            value={values[row.maxKey] ?? String(row.defaultMax)}
            onChange={(e) => setValues((v) => ({ ...v, [row.maxKey]: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      ))}
      <div className="pt-2">
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}>
          {saved ? `✓ ${t('Uloženo', 'Saved')}` : saving ? '…' : t('Uložit benefity', 'Save benefits')}
        </button>
      </div>
    </div>
  );
}

// ─── EveningShiftSetting ──────────────────────────────────────────────────────

function EveningShiftSetting() {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('19:00');
  const [minStaff, setMinStaff] = useState('2');
  const [label, setLabel] = useState('Prodejna');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (typeof d.evening_shift_enabled === 'boolean') setEnabled(d.evening_shift_enabled);
        else if (d.evening_shift_enabled === 'true') setEnabled(true);
        if (typeof d.evening_shift_start === 'string' && d.evening_shift_start) setStartTime(d.evening_shift_start);
        if (typeof d.evening_shift_end === 'string' && d.evening_shift_end) setEndTime(d.evening_shift_end);
        if (d.evening_shift_min_staff != null) setMinStaff(String(d.evening_shift_min_staff));
        if (typeof d.evening_shift_label === 'string' && d.evening_shift_label) setLabel(d.evening_shift_label);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evening_shift_enabled: enabled,
          evening_shift_start: startTime,
          evening_shift_end: endTime,
          evening_shift_min_staff: parseInt(minStaff) || 2,
          evening_shift_label: label,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm font-medium text-gray-700">{t('Večerní směna aktivní', 'Evening shift active')}</span>
      </label>

      {enabled && (
        <div className="space-y-3 pl-2 border-l-2 border-blue-100">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('Od', 'From')}</p>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('Do', 'To')}</p>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('Min. lidí', 'Min. staff')}</p>
              <input type="number" min={1} max={20} value={minStaff} onChange={(e) => setMinStaff(e.target.value)}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('Štítek zaměstnanců pro večerní směnu', 'Employee label for evening shift')}</p>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Prodejna"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="text-xs text-gray-400 mt-1">{t('Zaměstnanci s tímto štítkem budou navrhováni pro večerní směnu.', 'Employees with this label will be suggested for the evening shift.')}</p>
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}>
        {saved ? `✓ ${t('Uloženo', 'Saved')}` : saving ? '…' : t('Uložit', 'Save')}
      </button>
    </div>
  );
}

// ─── VacationCountingModeSetting ──────────────────────────────────────────────

function VacationCountingModeSetting() {
  const t = useT();
  const [mode, setMode] = useState<'workdays' | 'all'>('workdays');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (d.vacation_counting_mode === 'all') setMode('all');
        else setMode('workdays');
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacation_counting_mode: mode }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input type="radio" name="vacation_counting_mode" value="workdays" checked={mode === 'workdays'}
            onChange={() => setMode('workdays')} className="accent-blue-600" />
          <span className="text-sm text-gray-700">{t('Pracovní dny (Po–Pá)', 'Workdays (Mon–Fri)')}</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input type="radio" name="vacation_counting_mode" value="all" checked={mode === 'all'}
            onChange={() => setMode('all')} className="accent-blue-600" />
          <span className="text-sm text-gray-700">{t('Celý týden (Po–Ne)', 'All days (Mon–Sun)')}</span>
        </label>
      </div>
      <button onClick={handleSave} disabled={saving}
        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}>
        {saved ? `✓ ${t('Uloženo', 'Saved')}` : saving ? '…' : t('Uložit', 'Save')}
      </button>
    </div>
  );
}

// ─── DefaultVacationDaysSetting ───────────────────────────────────────────────

function DefaultVacationDaysSetting() {
  const t = useT();
  const [days, setDays] = useState(20);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        if (typeof d.default_vacation_days === 'number') setDays(d.default_vacation_days);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_vacation_days: days }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="flex items-end gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Výchozí počet dní', 'Default days')}</label>
        <input
          type="number" min={0} max={365} value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <button onClick={handleSave} disabled={saving}
        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}>
        {saved ? `✓ ${t('Uloženo', 'Saved')}` : saving ? '…' : t('Uložit', 'Save')}
      </button>
    </div>
  );
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function FormField({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <p className="text-sm text-red-600 mb-3">{message}</p>
      <button onClick={onRetry} className="text-sm text-blue-600 hover:text-blue-800 underline">Zkusit znovu</button>
    </div>
  );
}

function inputCls(error?: string) {
  return `block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
    error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
  }`;
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab({ onRead }: { onRead: () => void }) {
  return <NotificationsPanel onUnreadChange={(count) => { if (count === 0) onRead(); }} />;
}
