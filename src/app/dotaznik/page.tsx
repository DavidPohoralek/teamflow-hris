'use client';

import { useState } from 'react';

const DEPARTMENTS = ['Prodejna', 'Expedice', 'Backoffice', 'Homeoffice', 'Jiné'];
const CONTRACTS = ['HPP', 'DPP', 'DPČ', 'IČO'];
const TIERS = [
  { value: 'none', label: 'Nechodím na prodejnu' },
  { value: 'Tier 1', label: 'Tier 1 — Prodejce' },
  { value: 'Tier 2', label: 'Tier 2 — cca 4× měsíčně' },
  { value: 'Tier 3', label: 'Tier 3 — 1× měsíčně dopomoc' },
];

export default function DotaznikPage() {
  const [form, setForm] = useState({
    name: '',
    pin: '',
    email: '',
    department: '',
    position: '',
    labelProdejna: false,
    targetHours: 160,
    contract: 'HPP',
    tier: 'none',
    maxSaturdays: 1,
    canWorkSaturday: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const showSaturdays = form.tier !== 'none';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError('Zadejte prosím jméno.'); return; }
    if (!/^\d{4,8}$/.test(form.pin)) { setError('PIN musí mít 4–8 číslic.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/dotaznik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Chyba. Zkuste to znovu.'); return; }
      setDone(true);
    } catch {
      setError('Nepodařilo se odeslat formulář.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* Background pattern — elegant dark watches feel */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 20% 50%, rgba(180,30,30,0.08) 0%, transparent 50%),
                          radial-gradient(circle at 80% 20%, rgba(180,30,30,0.05) 0%, transparent 40%),
                          radial-gradient(circle at 60% 80%, rgba(255,255,255,0.02) 0%, transparent 30%)`,
      }} />

      {/* Header */}
      <header className="relative z-10 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">helVeti</p>
              <p className="text-white/40 text-xs">Specialisté na hodinky</p>
            </div>
          </div>
          <p className="text-white/30 text-xs hidden sm:block">Interní registrační formulář · Pouze pro zaměstnance</p>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {done ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-white text-2xl font-bold mb-3">Registrace dokončena</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Vaše údaje byly úspěšně uloženy.<br/>
              Nyní se můžete přihlásit do systému TeamFlow pomocí svého PIN kódu.
            </p>
            <a
              href="https://tmflw.com/app"
              className="inline-block mt-8 px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Přejít do aplikace →
            </a>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <h1 className="text-white text-3xl font-bold mb-3">Registrace zaměstnance</h1>
              <p className="text-white/40 text-sm">Vyplňte formulář, aby vás manažer mohl přidat do systému plánování směn.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Card: Základní údaje */}
              <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 space-y-4">
                <h2 className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-4">Základní údaje</h2>

                <div>
                  <label className="block text-white/60 text-xs mb-1.5">Jméno a první písmeno příjmení <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="David P."
                    required
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-red-500/60 focus:bg-white/8 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">PIN kód (4–8 číslic) <span className="text-red-400">*</span></label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={form.pin}
                      onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="••••"
                      maxLength={8}
                      required
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-red-500/60 transition-colors text-center tracking-widest"
                    />
                    <p className="text-white/25 text-xs mt-1">Pod tímto kódem se budete přihlašovat</p>
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">E-mail na notifikace</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="vas@email.cz"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-red-500/60 transition-colors"
                    />
                    <p className="text-white/25 text-xs mt-1">Schválení dovolené, žádosti</p>
                  </div>
                </div>
              </section>

              {/* Card: Pracovní zařazení */}
              <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 space-y-4">
                <h2 className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-4">Pracovní zařazení</h2>

                <div>
                  <label className="block text-white/60 text-xs mb-2">Oddělení</label>
                  <div className="flex flex-wrap gap-2">
                    {DEPARTMENTS.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => set('department', form.department === d ? '' : d)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                          form.department === d
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-white/5 border-white/15 text-white/60 hover:border-white/30 hover:text-white/80'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Pozice (nepovinné)</label>
                    <input
                      type="text"
                      value={form.position}
                      onChange={e => set('position', e.target.value)}
                      placeholder="Prodavač, Skladník…"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-red-500/60 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Pracovní poměr</label>
                    <select
                      value={form.contract}
                      onChange={e => set('contract', e.target.value)}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/60 transition-colors"
                      style={{ colorScheme: 'dark' }}
                    >
                      {CONTRACTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Měsíční fond hodin</label>
                    <input
                      type="number"
                      value={form.targetHours}
                      onChange={e => set('targetHours', parseInt(e.target.value) || 0)}
                      min={0}
                      max={300}
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/60 transition-colors"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.labelProdejna}
                        onClick={() => set('labelProdejna', !form.labelProdejna)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.labelProdejna ? 'bg-red-600' : 'bg-white/20'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.labelProdejna ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <div>
                        <p className="text-white/70 text-sm">Štítek Prodejna</p>
                        <p className="text-white/30 text-xs">Chodím na prodejnu alespoň 1× měsíčně</p>
                      </div>
                    </label>
                  </div>
                </div>
              </section>

              {/* Card: Tier prodejny */}
              <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 space-y-4">
                <div>
                  <h2 className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-1">Tier prodejny</h2>
                  <p className="text-white/30 text-xs mb-4">Jak často chodíte na prodejnu?</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TIERS.map(tier => (
                      <button
                        key={tier.value}
                        type="button"
                        onClick={() => set('tier', tier.value)}
                        className={`px-3 py-3 rounded-xl text-xs font-medium border transition-all text-center leading-snug ${
                          form.tier === tier.value
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-white/5 border-white/15 text-white/50 hover:border-white/30 hover:text-white/70'
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>

                {showSaturdays && (
                  <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white/60 text-xs mb-1.5">Max sobot na prodejně / měsíc</label>
                      <input
                        type="number"
                        value={form.maxSaturdays}
                        onChange={e => set('maxSaturdays', parseInt(e.target.value) || 0)}
                        min={0}
                        max={5}
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/60 transition-colors"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={form.canWorkSaturday}
                          onClick={() => set('canWorkSaturday', !form.canWorkSaturday)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.canWorkSaturday ? 'bg-red-600' : 'bg-white/20'}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.canWorkSaturday ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <div>
                          <p className="text-white/70 text-sm">Soboty OK</p>
                          <p className="text-white/30 text-xs">Mohu pracovat v sobotu</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </section>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-sm tracking-wide"
              >
                {submitting ? 'Odesílám…' : 'Odeslat registraci →'}
              </button>

              <p className="text-center text-white/20 text-xs">
                Vaše údaje budou uloženy bezpečně a použity výhradně pro plánování směn v systému TeamFlow.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
