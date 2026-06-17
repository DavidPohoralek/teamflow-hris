'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Heslo musí mít alespoň 6 znaků.');
      return;
    }
    if (password !== confirm) {
      setError('Hesla se neshodují.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se změnit heslo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Nové heslo</h1>
        <p className="text-slate-500 text-sm text-center mb-8">Zadejte nové heslo pro váš účet.</p>

        {done ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-emerald-800 font-semibold">Heslo bylo změněno</p>
            <p className="text-emerald-700 text-sm mt-1">Přesměrování na přihlášení...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nové heslo</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="min. 6 znaků"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Potvrdit heslo</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Zopakujte heslo"
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
              {loading ? 'Ukládám...' : 'Nastavit heslo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
