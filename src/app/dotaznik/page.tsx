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

const RED = '#e30613';

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
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e8' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1, color: '#111' }}>
              hel<span style={{ color: RED }}>V</span>eti
            </span>
            <span style={{ fontSize: 11, color: '#888', marginBottom: 4, marginLeft: 6, letterSpacing: 0.3 }}>Specialisté na hodinky</span>
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>
            Interní registrační formulář · Pouze pro zaměstnance
          </div>
        </div>
      </div>

      {/* Red accent line */}
      <div style={{ height: 3, background: RED }} />

      {/* Main */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 60px' }}>

        {done ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#e8f5e9', border: `2px solid #4caf50`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#4caf50" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 10 }}>Registrace dokončena</h2>
            <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              Vaše údaje byly úspěšně uloženy.<br />
              Nyní se můžete přihlásit do systému TeamFlow pomocí svého PIN kódu.
            </p>
            <a
              href="https://tmflw.com/app"
              style={{ display: 'inline-block', padding: '12px 28px', background: RED, color: '#fff', borderRadius: 4, fontWeight: 600, fontSize: 14, textDecoration: 'none', letterSpacing: 0.3 }}
            >
              Přejít do aplikace →
            </a>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 6 }}>Registrace zaměstnance</h1>
              <div style={{ width: 40, height: 3, background: RED, marginBottom: 12 }} />
              <p style={{ color: '#666', fontSize: 14 }}>Vyplňte formulář, aby vás manažer mohl přidat do systému plánování směn.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Základní údaje */}
              <Card title="Základní údaje">
                <div>
                  <Label>Jméno a první písmeno příjmení <Required /></Label>
                  <Input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="David P."
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <Label>PIN kód (4–8 číslic) <Required /></Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      value={form.pin}
                      onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="••••"
                      maxLength={8}
                      required
                      style={{ textAlign: 'center', letterSpacing: 6 }}
                    />
                    <Hint>Pod tímto kódem se budete přihlašovat</Hint>
                  </div>
                  <div>
                    <Label>E-mail na notifikace</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="vas@email.cz"
                    />
                    <Hint>Schválení dovolené, žádosti</Hint>
                  </div>
                </div>
              </Card>

              {/* Pracovní zařazení */}
              <Card title="Pracovní zařazení">
                <div>
                  <Label>Oddělení</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {DEPARTMENTS.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => set('department', form.department === d ? '' : d)}
                        style={{
                          padding: '7px 16px',
                          borderRadius: 4,
                          border: form.department === d ? `2px solid ${RED}` : '1px solid #ddd',
                          background: form.department === d ? RED : '#fff',
                          color: form.department === d ? '#fff' : '#444',
                          fontSize: 13,
                          fontWeight: form.department === d ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <Label>Pozice (nepovinné)</Label>
                    <Input
                      type="text"
                      value={form.position}
                      onChange={e => set('position', e.target.value)}
                      placeholder="Prodavač, Skladník…"
                    />
                  </div>
                  <div>
                    <Label>Pracovní poměr</Label>
                    <select
                      value={form.contract}
                      onChange={e => set('contract', e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, color: '#333', background: '#fff', outline: 'none' }}
                    >
                      {CONTRACTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
                  <div>
                    <Label>Měsíční fond hodin</Label>
                    <Input
                      type="number"
                      value={form.targetHours}
                      onChange={e => set('targetHours', parseInt(e.target.value) || 0)}
                      min={0}
                      max={300}
                    />
                  </div>
                  <div style={{ paddingBottom: 4 }}>
                    <Toggle
                      checked={form.labelProdejna}
                      onChange={() => set('labelProdejna', !form.labelProdejna)}
                      label="Štítek Prodejna"
                      hint="Chodím na prodejnu alespoň 1× měsíčně"
                    />
                  </div>
                </div>
              </Card>

              {/* Tier prodejny */}
              <Card title="Tier prodejny" subtitle="Jak často chodíte na prodejnu?">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {TIERS.map(tier => (
                    <button
                      key={tier.value}
                      type="button"
                      onClick={() => set('tier', tier.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 4,
                        border: form.tier === tier.value ? `2px solid ${RED}` : '1px solid #ddd',
                        background: form.tier === tier.value ? RED : '#fff',
                        color: form.tier === tier.value ? '#fff' : '#444',
                        fontSize: 13,
                        fontWeight: form.tier === tier.value ? 600 : 400,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>

                {showSaturdays && (
                  <div style={{ paddingTop: 16, borderTop: '1px solid #eee', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
                    <div>
                      <Label>Max sobot na prodejně / měsíc</Label>
                      <Input
                        type="number"
                        value={form.maxSaturdays}
                        onChange={e => set('maxSaturdays', parseInt(e.target.value) || 0)}
                        min={0}
                        max={5}
                      />
                    </div>
                    <div style={{ paddingBottom: 4 }}>
                      <Toggle
                        checked={form.canWorkSaturday}
                        onChange={() => set('canWorkSaturday', !form.canWorkSaturday)}
                        label="Soboty OK"
                        hint="Mohu pracovat v sobotu"
                      />
                    </div>
                  </div>
                )}
              </Card>

              {error && (
                <div style={{ background: '#fff3f3', border: `1px solid ${RED}`, borderRadius: 4, padding: '12px 16px' }}>
                  <p style={{ color: RED, fontSize: 14, margin: 0 }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '14px 0',
                  background: submitting ? '#999' : RED,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  letterSpacing: 0.5,
                  transition: 'background 0.15s',
                }}
              >
                {submitting ? 'Odesílám…' : 'Odeslat registraci →'}
              </button>

              <p style={{ textAlign: 'center', color: '#aaa', fontSize: 12 }}>
                Vaše údaje budou uloženy bezpečně a použity výhradně pro plánování směn v systému TeamFlow.
              </p>
            </form>
          </>
        )}
      </main>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e8e8e8', background: '#fff', padding: '16px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
          © helVeti · Specialisté na hodinky · <span style={{ color: RED }}>TeamFlow</span> interní systém
        </p>
      </div>
    </div>
  );
}

/* ── helpers ── */

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 3, height: 18, background: RED, borderRadius: 2, flexShrink: 0 }} />
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>{subtitle}</p>}
          </div>
        </div>
      </div>
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 12, color: '#555', fontWeight: 500, marginBottom: 5 }}>{children}</label>;
}

function Required() {
  return <span style={{ color: RED }}>*</span>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>{children}</p>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '9px 12px',
        border: '1px solid #ddd',
        borderRadius: 4,
        fontSize: 14,
        color: '#333',
        background: '#fff',
        outline: 'none',
        boxSizing: 'border-box',
        ...(props.style ?? {}),
      }}
      onFocus={e => { e.target.style.borderColor = RED; e.target.style.boxShadow = `0 0 0 2px ${RED}22`; }}
      onBlur={e => { e.target.style.borderColor = '#ddd'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: 'none',
          background: checked ? RED : '#ccc',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: checked ? 20 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
      <div>
        <p style={{ fontSize: 13, color: '#333', margin: 0, fontWeight: 500 }}>{label}</p>
        {hint && <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 0' }}>{hint}</p>}
      </div>
    </label>
  );
}
