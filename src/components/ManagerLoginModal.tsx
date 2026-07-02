'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';

interface ManagerLoginModalProps {
  orgId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const MANAGER_SESSION_KEY = 'hris_manager_session';

// ── Admin (password) tab ──────────────────────────────────────────────────────

function AdminTab({ orgId, onSuccess }: { orgId: string; onSuccess: () => void }) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/public/verify-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem(MANAGER_SESSION_KEY, data.token);
        onSuccess();
      } else {
        setError(t('Nesprávné heslo', 'Incorrect password'));
      }
    } catch {
      setError(t('Chyba připojení. Zkuste to znovu.', 'Connection error. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="manager-password" className="block text-sm font-medium text-gray-700 mb-1">
          {t('Heslo', 'Password')}
        </label>
        <input
          id="manager-password"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder="••••••••"
          autoFocus
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password}
        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {t('Přihlašuji…', 'Logging in…')}
          </span>
        ) : t('Přihlásit se', 'Log in')}
      </button>
    </form>
  );
}

// ── Manager (PIN numpad) tab ──────────────────────────────────────────────────

function ManagerPinTab({ orgId, onSuccess }: { orgId: string; onSuccess: () => void }) {
  const t = useT();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDigit = (d: string) => {
    if (loading) return;
    setError('');
    setPin((p) => p.length < 8 ? p + d : p);
  };

  const handleBackspace = () => { setError(''); setPin((p) => p.slice(0, -1)); };
  const handleClear = () => { setError(''); setPin(''); };

  const handleSubmit = async () => {
    if (!pin || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/manager-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, pin }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem(MANAGER_SESSION_KEY, data.token);
        onSuccess();
      } else {
        const d = await res.json();
        setError(d.error ?? t('Neplatný PIN', 'Invalid PIN'));
        setPin('');
      }
    } catch {
      setError(t('Chyba připojení', 'Connection error'));
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const dots = Array.from({ length: Math.max(pin.length, 4) }, (_, i) => i < pin.length);

  return (
    <div className="space-y-4">
      {/* PIN display */}
      <div className="flex justify-center gap-2 py-2">
        {dots.map((filled, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-all ${filled ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
          />
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            disabled={loading}
            className="h-12 rounded-xl text-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition active:scale-95 disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <button type="button" onClick={handleClear} disabled={loading}
          className="h-12 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-500 transition active:scale-95 disabled:opacity-50">
          {t('Smaž', 'Clear')}
        </button>
        <button
          type="button"
          onClick={() => handleDigit('0')}
          disabled={loading}
          className="h-12 rounded-xl text-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition active:scale-95 disabled:opacity-50"
        >
          0
        </button>
        <button type="button" onClick={handleBackspace} disabled={loading}
          className="h-12 rounded-xl text-lg font-medium bg-slate-100 hover:bg-slate-200 text-slate-500 transition active:scale-95 disabled:opacity-50">
          ⌫
        </button>
      </div>

      {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || pin.length < 4}
        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {t('Přihlašuji…', 'Logging in…')}
          </span>
        ) : t('Přihlásit se', 'Log in')}
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ManagerLoginModal({ orgId, onSuccess, onClose }: ManagerLoginModalProps) {
  const t = useT();
  const [tab, setTab] = useState<'admin' | 'manager'>('admin');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-xl font-semibold text-gray-900">{t('Přihlášení', 'Login')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-6 mb-4 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setTab('admin')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'admin' ? 'bg-white shadow text-gray-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            🔐 {t('Admin', 'Admin')}
          </button>
          <button
            onClick={() => setTab('manager')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'manager' ? 'bg-white shadow text-gray-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            👤 {t('Manažer', 'Manager')}
          </button>
        </div>

        {/* Tab description */}
        <p className="text-xs text-slate-400 text-center px-6 mb-4">
          {tab === 'admin'
            ? t('Plný přístup — heslo ze Nastavení', 'Full access — password from Settings')
            : t('Přihlášení PINem — omezený přístup dle nastavení', 'PIN login — access scoped per settings')}
        </p>

        {/* Content */}
        <div className="px-6 pb-6">
          {tab === 'admin'
            ? <AdminTab orgId={orgId} onSuccess={onSuccess} />
            : <ManagerPinTab orgId={orgId} onSuccess={onSuccess} />}
        </div>

        {/* Cancel */}
        <div className="px-6 pb-6 -mt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            {t('Zrušit', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
