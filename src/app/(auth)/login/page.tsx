'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n';

// Odstraní případné poškozené / zbytkové Supabase přihlašovací cookies (všechny
// chunky "sb-...-auth-token"). Řeší zaseknuté profily po dřívějším výpadku
// obnovování session v middleware, kdy stará cookie tiše bránila novému
// přihlášení "chytnout". Bezpečné volat vždy před loginem – čerstvé přihlášení
// si potřebné cookies stejně vytvoří znovu.
function clearStaleSupabaseAuthCookies() {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim();
    if (!name.startsWith('sb-')) continue;
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${host}`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${host}`;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const t = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Samohojení: než se přihlásíme, pročisti případnou starou/poškozenou
    // přihlašovací session, aby se čerstvé přihlášení vždy uchytilo (jinak
    // zaseknutý profil "nic neudělá" a spadne zpátky na login).
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    clearStaleSupabaseAuthCookies();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? t('Nesprávný e-mail nebo heslo.', 'Incorrect email or password.')
          : authError.message
      );
      setLoading(false);
      return;
    }

    // Clear any leftover manager session from a previous org/user
    localStorage.removeItem('hris_manager_session');

    router.push('/app');
    router.refresh();
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">{t('Přihlásit se', 'Sign in')}</h2>
        <p className="text-sm text-slate-500 mt-1">
          {t('Zadejte své přihlašovací údaje', 'Enter your login credentials')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="form-label">
            {t('E-mailová adresa', 'Email address')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            placeholder={t('vas@email.cz', 'your@email.com')}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="form-label mb-0">
              {t('Heslo', 'Password')}
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('Zapomenuté heslo?', 'Forgot password?')}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 mt-2"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {t('Přihlašování…', 'Signing in…')}
            </span>
          ) : (
            t('Přihlásit se', 'Sign in')
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        {t('Nemáte účet?', "Don't have an account?")}{' '}
        <Link
          href="/register"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          {t('Registrovat organizaci', 'Register organization')}
        </Link>
      </p>
    </>
  );
}
