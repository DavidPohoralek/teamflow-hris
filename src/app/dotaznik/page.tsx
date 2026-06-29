'use client';

import { useState, useRef, useCallback } from 'react';

const DEPARTMENTS = ['Prodejna', 'Expedice', 'Backoffice', 'Homeoffice', 'Jiné'];
const CONTRACTS = ['HPP', 'DPP', 'DPČ', 'IČO'];
const TIERS = [
  { value: 'none', label: 'Nechodím na prodejnu' },
  { value: 'Tier 1', label: 'Tier 1 — Prodejce' },
  { value: 'Tier 2', label: 'Tier 2 — cca 4× měsíčně' },
  { value: 'Tier 3', label: 'Tier 3 — 1× měsíčně dopomoc' },
];

const RED = '#e30613';

// Helveti SVG logo (from brand assets)
function HelvetiLogo({ width = 140 }: { width?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" fillRule="evenodd" strokeLinejoin="round" strokeMiterlimit={2} clipRule="evenodd" viewBox="0 0 3662 1860" width={width} height={width * (1860/3662)}>
      <path fill="#314A5E" fillRule="nonzero" d="m54.748 16.505 8.4 17.198 2.705.016L80.666 3.41l-2.781-1.4-13.36 27.415L57.477 15l-2.798 1.366.068.14m11.492 43.109V54.63H63.31v5.295h2.929v-.31m-14.176-3.013 2.49-4.321-2.539-1.461-2.644 4.587 2.538 1.463.155-.268m-11.887-9.916 4.345-2.443-1.435-2.553-4.616 2.595 1.435 2.552.27-.151m39.898 8.428-2.5-4.314-2.533 1.469 2.654 4.581 2.534-1.468-.155-.268M66.343 0H63.57v5.295h2.927V0h-.154M51.746 2.338 49.36 3.417l2.18 4.825 2.669-1.207-2.182-4.825-.28.128M89.882 44.1l-4.343-2.45L84.1 44.2l4.612 2.602 1.438-2.55-.268-.152" transform="scale(4.16667) translate(-.67) scale(7.44911)"/>
      <path fill="#D53A41" fillRule="nonzero" d="M4.898 15.39c.826-.693 2.55-1.585 4.853-1.585 4.532 0 6.836 2.49 6.836 7.209v12.484h-3.122v-12.15c0-3.27-1.56-4.83-4.383-4.83-2.783 0-5.871 2.611-5.871 6.317v10.663H.09V7.49h3.12l-.001 9.526s.39-.734 1.69-1.626m32.907 15.985c-2.416 1.932-3.976 2.638-7.023 2.638-5.722 0-9.363-3.79-9.363-10.106 0-5.945 3.567-10.107 9.289-10.107 4.16 0 8.62 2.23 8.433 10.367H24.615c.074 4.719 2.49 7.208 6.243 7.208 2.043 0 3.603-.557 5.312-2.118l1.636 2.118Zm-1.784-9.623c-.149-3.493-2.266-5.462-5.388-5.462-3.009 0-5.238 1.598-5.87 5.462h11.258ZM44.01 7.49h3.084v21.92c0 1.227.557 1.822 2.155 1.673v2.75c-3.493.26-5.239-.855-5.239-3.79V7.49m50.965 23.885c-2.415 1.932-3.975 2.638-7.022 2.638-5.722 0-9.363-3.79-9.363-10.106 0-5.945 3.567-10.107 9.289-10.107 4.161 0 8.62 2.23 8.434 10.367H81.785c.075 4.719 2.49 7.208 6.242 7.208 2.044 0 3.605-.557 5.314-2.118l1.634 2.118Zm-1.783-9.623c-.148-3.493-2.266-5.462-5.387-5.462-3.01 0-5.24 1.598-5.87 5.462h11.257Zm11.896 7.435c0 1.375.853 2.044 2.19 2.044.968 0 1.822-.186 2.528-.595l.594 2.639a9.846 9.846 0 0 1-3.715.743c-2.676 0-4.72-1.227-4.72-4.162V16.815H99.03v-2.49h2.936V9.57h3.122v4.755h5.126v2.49h-5.126v12.372m9.742-18.66h3.232V7.63h-3.232v2.897Zm.075 22.962h3.093V14.317h-3.093v19.172Z" transform="scale(4.16667) translate(-.67) scale(7.44911)"/>
    </svg>
  );
}

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

  // Running button state
  const [btnPos, setBtnPos] = useState<{ x: number; y: number } | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleRewardEscape = useCallback(() => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      setShowReward(true);
      return;
    }
    // Move button to random position within viewport
    const maxX = Math.max(window.innerWidth - 220, 50);
    const maxY = Math.max(window.innerHeight - 80, 50);
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    setBtnPos({ x, y });
  }, [clickCount]);

  const handleRewardHover = useCallback(() => {
    if (showReward) return;
    const maxX = Math.max(window.innerWidth - 220, 50);
    const maxY = Math.max(window.innerHeight - 80, 50);
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    setBtnPos({ x, y });
  }, [showReward]);

  return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e8' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <HelvetiLogo width={130} />
          <div style={{ fontSize: 12, color: '#999' }}>
            Interní registrační formulář · Pouze pro zaměstnance
          </div>
        </div>
      </div>
      <div style={{ height: 3, background: RED }} />

      {/* Main */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 60px' }}>

        {done ? (
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '50px 40px', textAlign: 'center' }}>
            {/* Success checkmark */}
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#e8f5e9', border: '2px solid #4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#4caf50" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 10 }}>Registrace dokončena</h2>
            <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
              Vaše údaje byly úspěšně uloženy.<br />
              Nyní se můžete přihlásit do systému TeamFlow pomocí svého PIN kódu.
            </p>

            {/* Go to app button */}
            <a
              href="https://tmflw.com/app"
              style={{ display: 'inline-block', padding: '12px 28px', background: RED, color: '#fff', borderRadius: 4, fontWeight: 600, fontSize: 14, textDecoration: 'none', letterSpacing: 0.3, marginBottom: 24 }}
            >
              Přejít do aplikace →
            </a>

            {/* Reward divider */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 28, marginTop: 8 }}>
              <p style={{ fontSize: 13, color: '#aaa', marginBottom: 16 }}>🎁 Jako poděkování za registraci pro vás máme malé překvapení…</p>

              {showReward ? (
                /* Reward revealed */
                <div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 12 }}>Vaše odměna 🏆</p>
                  <img
                    src="/odmena.jpg"
                    alt="Vaše odměna"
                    style={{ maxWidth: 320, width: '100%', borderRadius: 8, border: '3px solid #eee', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
                  />
                  <p style={{ fontSize: 13, color: '#999', marginTop: 12 }}>Gratulujeme! Právě jste vyhráli pohled na svého šéfa 😄</p>
                </div>
              ) : (
                /* Running button */
                <div style={{ position: 'relative', minHeight: 60 }}>
                  <button
                    onClick={handleRewardEscape}
                    onMouseEnter={handleRewardHover}
                    style={{
                      position: btnPos ? 'fixed' : 'relative',
                      left: btnPos ? btnPos.x : undefined,
                      top: btnPos ? btnPos.y : undefined,
                      zIndex: 9999,
                      padding: '12px 24px',
                      background: '#111',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'left 0.1s, top 0.1s',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    🎁 Vyzvedněte si odměnu
                  </button>
                  {clickCount > 0 && (
                    <p style={{ fontSize: 11, color: '#ccc', marginTop: 8 }}>
                      {5 - clickCount}× a je vaše…
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 6 }}>Registrace zaměstnance</h1>
              <div style={{ width: 40, height: 3, background: RED, marginBottom: 12 }} />
              <p style={{ color: '#666', fontSize: 14 }}>Vyplňte formulář, aby vás manažer mohl přidat do systému plánování směn.</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              <Card title="Základní údaje">
                <div>
                  <Label>Jméno a první písmeno příjmení <Required /></Label>
                  <Input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="David P." required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <Label>PIN kód (4–8 číslic) <Required /></Label>
                    <Input
                      type="password" inputMode="numeric"
                      value={form.pin} onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="••••" maxLength={8} required style={{ textAlign: 'center', letterSpacing: 6 }}
                    />
                    <Hint>Pod tímto kódem se budete přihlašovat</Hint>
                  </div>
                  <div>
                    <Label>E-mail na notifikace</Label>
                    <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="vas@email.cz" />
                    <Hint>Schválení dovolené, žádosti</Hint>
                  </div>
                </div>
              </Card>

              <Card title="Pracovní zařazení">
                <div>
                  <Label>Oddělení</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {DEPARTMENTS.map(d => (
                      <button key={d} type="button" onClick={() => set('department', form.department === d ? '' : d)}
                        style={{ padding: '7px 16px', borderRadius: 4, border: form.department === d ? `2px solid ${RED}` : '1px solid #ddd', background: form.department === d ? RED : '#fff', color: form.department === d ? '#fff' : '#444', fontSize: 13, fontWeight: form.department === d ? 600 : 400, cursor: 'pointer' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <Label>Pozice (nepovinné)</Label>
                    <Input type="text" value={form.position} onChange={e => set('position', e.target.value)} placeholder="Prodavač, Skladník…" />
                  </div>
                  <div>
                    <Label>Pracovní poměr</Label>
                    <select value={form.contract} onChange={e => set('contract', e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, color: '#333', background: '#fff', outline: 'none' }}>
                      {CONTRACTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
                  <div>
                    <Label>Měsíční fond hodin</Label>
                    <Input type="number" value={form.targetHours} onChange={e => set('targetHours', parseInt(e.target.value) || 0)} min={0} max={300} />
                  </div>
                  <div style={{ paddingBottom: 4 }}>
                    <Toggle checked={form.labelProdejna} onChange={() => set('labelProdejna', !form.labelProdejna)} label="Štítek Prodejna" hint="Chodím na prodejnu alespoň 1× měsíčně" />
                  </div>
                </div>
              </Card>

              <Card title="Tier prodejny" subtitle="Jak často chodíte na prodejnu?">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {TIERS.map(tier => (
                    <button key={tier.value} type="button" onClick={() => set('tier', tier.value)}
                      style={{ padding: '10px 14px', borderRadius: 4, border: form.tier === tier.value ? `2px solid ${RED}` : '1px solid #ddd', background: form.tier === tier.value ? RED : '#fff', color: form.tier === tier.value ? '#fff' : '#444', fontSize: 13, fontWeight: form.tier === tier.value ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}>
                      {tier.label}
                    </button>
                  ))}
                </div>
                {showSaturdays && (
                  <div style={{ paddingTop: 16, borderTop: '1px solid #eee', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
                    <div>
                      <Label>Max sobot na prodejně / měsíc</Label>
                      <Input type="number" value={form.maxSaturdays} onChange={e => set('maxSaturdays', parseInt(e.target.value) || 0)} min={0} max={5} />
                    </div>
                    <div style={{ paddingBottom: 4 }}>
                      <Toggle checked={form.canWorkSaturday} onChange={() => set('canWorkSaturday', !form.canWorkSaturday)} label="Soboty OK" hint="Mohu pracovat v sobotu" />
                    </div>
                  </div>
                )}
              </Card>

              {error && (
                <div style={{ background: '#fff3f3', border: `1px solid ${RED}`, borderRadius: 4, padding: '12px 16px' }}>
                  <p style={{ color: RED, fontSize: 14, margin: 0 }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={submitting}
                style={{ padding: '14px 0', background: submitting ? '#999' : RED, color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: 0.5 }}>
                {submitting ? 'Odesílám…' : 'Odeslat registraci →'}
              </button>

              <p style={{ textAlign: 'center', color: '#aaa', fontSize: 12 }}>
                Vaše údaje budou uloženy bezpečně a použity výhradně pro plánování směn v systému TeamFlow.
              </p>
            </form>
          </>
        )}
      </main>

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
      style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, color: '#333', background: '#fff', outline: 'none', boxSizing: 'border-box', ...(props.style ?? {}) }}
      onFocus={e => { e.target.style.borderColor = RED; e.target.style.boxShadow = `0 0 0 2px ${RED}22`; }}
      onBlur={e => { e.target.style.borderColor = '#ddd'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <button type="button" role="switch" aria-checked={checked} onClick={onChange}
        style={{ width: 40, height: 22, borderRadius: 11, border: 'none', background: checked ? RED : '#ccc', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
        <span style={{ position: 'absolute', top: 3, left: checked ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
      <div>
        <p style={{ fontSize: 13, color: '#333', margin: 0, fontWeight: 500 }}>{label}</p>
        {hint && <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 0' }}>{hint}</p>}
      </div>
    </label>
  );
}
