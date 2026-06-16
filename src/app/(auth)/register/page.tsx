'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Hesla se neshodují.');
      return;
    }

    if (formData.password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků.');
      return;
    }

    setLoading(true);

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          company_name: formData.companyName,
        },
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      setError(authError.message || authError.code || JSON.stringify(authError) || 'Chyba při registraci.');
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError('Registrace se nezdařila. Zkuste to znovu.');
      setLoading(false);
      return;
    }

    // Use API route to create org + update profile (bypasses RLS correctly)
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: authData.user.id,
        userEmail: formData.email,
        companyName: formData.companyName,
        firstName: formData.firstName,
        lastName: formData.lastName,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setError(result.error || 'Nepodařilo se dokončit registraci.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Registrovat organizaci
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Vytvořte účet pro vaši společnost
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="companyName" className="form-label">
            Název společnosti
          </label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            required
            value={formData.companyName}
            onChange={handleChange}
            className="form-input"
            placeholder="Acme s.r.o."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="form-label">
              Jméno
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              value={formData.firstName}
              onChange={handleChange}
              className="form-input"
              placeholder="Jan"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="form-label">
              Příjmení
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              value={formData.lastName}
              onChange={handleChange}
              className="form-input"
              placeholder="Novák"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="form-label">
            E-mailová adresa
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="form-input"
            placeholder="jan@spolecnost.cz"
          />
        </div>

        <div>
          <label htmlFor="password" className="form-label">
            Heslo
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={formData.password}
            onChange={handleChange}
            className="form-input"
            placeholder="Min. 8 znaků"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="form-label">
            Potvrdit heslo
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
            className="form-input"
            placeholder="Zopakujte heslo"
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
              Registrace…
            </span>
          ) : (
            'Vytvořit účet'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Již máte účet?{' '}
        <Link
          href="/login"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Přihlásit se
        </Link>
      </p>
    </>
  );
}
