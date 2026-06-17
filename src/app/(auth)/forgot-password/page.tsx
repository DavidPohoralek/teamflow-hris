'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se odeslat e-mail.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Zapomenuté heslo</h1>
        <p className="text-slate-500 text-sm text-center mb-8">
          Zadejte svůj e-mail a pošleme vám odkaz pro reset hesla.
        </p>

        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
            <div className="text-3xl mb-3">📧</div>
            <p className="text-emerald-800 font-semibold mb-1">E-mail odeslán</p>
            <p className="text-emerald-700 text-sm">
              Zkontrolujte svou schránku a klikněte na odkaz pro reset hesla.
            </p>
            <Link href="/login" className="block mt-4 text-sm text-emerald-700 hover:underline">
              ← Zpět na přihlášení
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vas@email.cz"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              {loading ? 'Odesílám...' : 'Odeslat odkaz'}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
                ← Zpět na přihlášení
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
