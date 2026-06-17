import Link from 'next/link'

const FEATURES = [
  { icon: '📅', title: 'Plánování směn', desc: 'Přehledný kalendář pro celý tým. Typy práce, schvalování a uzavřené dny na jednom místě.' },
  { icon: '⏰', title: 'Docházka PIN', desc: 'Kiosek pro příchod a odchod pomocí PIN kódu. Přesné záznamy bez papírování.' },
  { icon: '🏖️', title: 'Dovolené', desc: 'Zaměstnanci žádají online, manažer schvaluje jedním kliknutím.' },
  { icon: '📊', title: 'Přehled v reálném čase', desc: 'Kdo je aktuálně v práci, kdo chybí — živý přehled pro celý tým.' },
  { icon: '📈', title: 'Analytika & export', desc: 'Odpracované hodiny, přesčasy, sobotní příplatky a export do Excelu.' },
  { icon: '👤', title: 'Portál zaměstnance', desc: 'Každý vidí své hodiny a žádosti bez sdílení hesla.' },
]

const TESTIMONIALS = [
  { quote: 'Konečně vím, kdo je v práci, bez papírování a telefonátů.', author: 'Petra S.', role: 'vedoucí prodejny' },
  { quote: 'Zavedení trvalo odpoledne, ne měsíc.', author: 'Martin H.', role: 'majitel kavárny' },
  { quote: '', author: '', role: '' },
]

const TF_LOGO = (
  <svg width="44" height="44" viewBox="0 0 250 260" xmlns="http://www.w3.org/2000/svg">
    <polygon points="125,130 225,72 225,187 125,244" fill="#C87C1A"/>
    <polygon points="25,72 125,130 125,244 25,187" fill="#E09828"/>
    <polygon points="125,15 225,72 213,72 125,22" fill="#EDB84A"/>
    <polygon points="25,72 125,15 125,22 37,72" fill="#E09828"/>
    <polygon points="225,72 125,130 125,122 213,72" fill="#96560A"/>
    <polygon points="125,130 25,72 37,72 125,122" fill="#AE6A10"/>
    <polygon points="37,72 125,22 125,122" fill="#2A4878"/>
    <polygon points="213,72 125,22 125,122" fill="#05080F"/>
    <line x1="125" y1="22" x2="125" y2="122" stroke="#1A2E58" strokeWidth="1.5"/>
    <polyline points="125,22 213,72 125,122 37,72 125,22" fill="none" stroke="#182840" strokeWidth="1.8"/>
    <polygon points="35,98 115,145 115,163 35,117" fill="#7A4808"/>
    <polygon points="61,139 89,155 89,210 61,194" fill="#7A4808"/>
    <polygon points="135,145 215,98 215,117 135,163" fill="#6A3806"/>
    <polygon points="135,170 153,159 153,211 135,221" fill="#6A3806"/>
    <polygon points="157,171 200,146 200,163 157,188" fill="#6A3806"/>
    <polyline points="25,72 125,15 225,72" fill="none" stroke="#C07010" strokeWidth="2.5" strokeLinejoin="round"/>
    <line x1="25" y1="72" x2="25" y2="187" stroke="#C07010" strokeWidth="2"/>
    <line x1="225" y1="72" x2="225" y2="187" stroke="#8A4A08" strokeWidth="2"/>
    <line x1="25" y1="187" x2="125" y2="244" stroke="#B07010" strokeWidth="2"/>
    <line x1="225" y1="187" x2="125" y2="244" stroke="#8A4A08" strokeWidth="2"/>
    <line x1="125" y1="130" x2="125" y2="244" stroke="#9A5C10" strokeWidth="2.5"/>
  </svg>
)

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col overflow-x-hidden">

      {/* ── Animated background grid ── */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(200,124,26,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(200,124,26,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, #C87C1A 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(ellipse, #2A4878 0%, transparent 70%)' }} />
      </div>

      {/* ── Navbar ── */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-[#080c14]/80 sticky top-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {TF_LOGO}
            <span className="font-bold text-lg tracking-tight">TeamFlow</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1 text-sm text-slate-400">
            <a href="#funkce" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">Funkce</a>
            <a href="#cenik" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">Ceník</a>
            <a href="#reference" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">Reference</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition">Přihlásit se</Link>
            <Link href="/register" className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-xl transition text-sm">
              Vyzkoušet zdarma
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-32 text-center w-full">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold uppercase tracking-widest mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          HR systém pro malé a střední firmy
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold leading-[1.05] mb-6 tracking-tight">
          Směny, docházka a<br />
          <span className="relative inline-block">
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #EDB84A 0%, #C87C1A 50%, #E09828 100%)' }}>
              dovolené
            </span>
          </span>
          {' '}bez chaosu
        </h1>

        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          TeamFlow nahradí excelovské tabulky a WhatsApp skupiny. Plánujte směny, sledujte docházku a spravujte dovolené z jednoho místa.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
          <Link href="/register"
            className="px-8 py-4 rounded-xl font-bold text-slate-900 text-base transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #EDB84A, #C87C1A)' }}>
            Registrovat firmu zdarma →
          </Link>
          <a href="#funkce"
            className="px-8 py-4 rounded-xl font-medium text-slate-300 text-base bg-white/5 hover:bg-white/10 border border-white/10 transition">
            Jak to funguje
          </a>
        </div>
        <p className="text-xs text-slate-600">Bez kreditní karty · Nastavení za 5 minut</p>

        {/* Floating stat chips */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          {[
            { label: 'Plánování směn', icon: '📅' },
            { label: 'PIN docházka', icon: '⏰' },
            { label: 'AI asistent', icon: '✦' },
            { label: 'Export pro účetní', icon: '📊' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 text-sm text-slate-300">
              <span>{s.icon}</span> {s.label}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="funkce" className="relative z-10 max-w-6xl mx-auto px-6 pb-28 w-full">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Vše co potřebujete pro řízení týmu</h2>
          <p className="text-slate-500 text-sm">Jedna platforma místo tří aplikací a spousty spreadsheetů.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.title}
              className="group relative bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-amber-500/30 hover:bg-white/[0.06] transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(circle at top left, rgba(200,124,26,0.08) 0%, transparent 60%)' }} />
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/0 to-transparent group-hover:via-amber-500/30 transition-all duration-500" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="cenik" className="relative z-10 max-w-6xl mx-auto px-6 pb-28 w-full">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Transparentní ceník</h2>
          <p className="text-slate-500 text-sm">Pevná cena pro celou firmu. Žádné skryté poplatky za zaměstnance.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
          {/* Standard */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-7 flex flex-col">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Standard</p>
            <p className="text-4xl font-extrabold text-white mb-1">1 190 Kč<span className="text-base font-normal text-slate-500"> / měs.</span></p>
            <p className="text-xs text-slate-600 mb-7">nebo <span className="text-slate-300 font-medium">11 900 Kč / rok</span> <span className="text-emerald-400">(2 měs. zdarma)</span></p>
            <ul className="space-y-3 text-sm text-slate-300 flex-1 mb-7">
              {['Pokročilý kalendář směn', 'Docházkový PIN terminál', 'Žádosti a schvalování dovolených', 'Přehledy hodin & export', 'Portál zaměstnance', 'Analytika'].map(f => (
                <li key={f} className="flex items-center gap-2.5"><span className="text-emerald-400 font-bold">✓</span> {f}</li>
              ))}
            </ul>
            <Link href="/register" className="block w-full py-3 text-center bg-white/8 hover:bg-white/14 text-white font-semibold rounded-xl transition border border-white/10 text-sm">
              Vyzkoušet zdarma
            </Link>
          </div>

          {/* StoreForce */}
          <div className="relative rounded-2xl p-7 flex flex-col overflow-hidden border border-amber-500/30"
            style={{ background: 'linear-gradient(160deg, #0f1729 0%, #0c1020 100%)' }}>
            <div className="absolute top-0 left-0 right-0 h-[1px]"
              style={{ background: 'linear-gradient(90deg, transparent, #C87C1A, transparent)' }} />
            <div className="absolute top-4 right-4 text-[11px] font-bold px-3 py-1 rounded-full text-slate-900"
              style={{ background: 'linear-gradient(135deg, #EDB84A, #C87C1A)' }}>
              Doporučeno
            </div>
            <p className="text-xs font-semibold text-amber-500/70 uppercase tracking-wider mb-3">StoreForce ✦</p>
            <p className="text-4xl font-extrabold text-white mb-1">1 680 Kč<span className="text-base font-normal text-amber-600/60"> / měs.</span></p>
            <p className="text-xs text-amber-900/70 mb-7">nebo <span className="text-amber-300/70 font-medium">15 900 Kč / rok</span> <span className="text-emerald-400">(2 měs. zdarma)</span></p>
            <ul className="space-y-3 text-sm text-slate-200 flex-1 mb-7">
              <li className="flex items-center gap-2.5"><span className="text-emerald-400 font-bold">✓</span> Vše ze Standard</li>
              {['AI asistent — autonomní doplňování směn', 'Notifikace přes Slack & e-mail', 'Potvrzení jedním kliknutím bez přihlášení', 'Ideální pro kamenné prodejny a retail'].map(f => (
                <li key={f} className="flex items-center gap-2.5"><span className="text-amber-400 font-bold">✦</span> {f}</li>
              ))}
            </ul>
            <Link href="/register"
              className="block w-full py-3 text-center font-bold rounded-xl transition text-sm text-slate-900 hover:opacity-90 shadow-lg shadow-amber-900/30"
              style={{ background: 'linear-gradient(135deg, #EDB84A, #C87C1A)' }}>
              Vyzkoušet zdarma
            </Link>
          </div>
        </div>

        {/* Download PDFs */}
        <div className="flex items-center justify-center gap-3">
          <span className="text-xs text-slate-600">Stáhnout ceník:</span>
          <a href="/teamflow-cenik-cs.pdf" download className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-400 transition">🇨🇿 CS PDF</a>
          <a href="/teamflow-pricing-en.pdf" download className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-400 transition">🇬🇧 EN PDF</a>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="reference" className="relative z-10 max-w-6xl mx-auto px-6 pb-28 w-full">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Co říkají zákazníci</h2>
          <p className="text-slate-500 text-sm">Skutečné firmy, skutečné výsledky.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className={`rounded-2xl p-6 flex flex-col gap-4 border transition-all ${
              t.author
                ? 'bg-white/[0.03] border-white/8 hover:border-amber-500/20'
                : 'border-dashed border-white/8 opacity-30'
            }`}>
              {t.author ? (
                <>
                  <div className="text-amber-400/60 text-4xl leading-none font-serif">"</div>
                  <p className="text-slate-300 text-sm leading-relaxed flex-1 -mt-4">{t.quote}"</p>
                  <div className="border-t border-white/8 pt-4">
                    <p className="text-white font-semibold text-sm">{t.author}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{t.role}</p>
                  </div>
                </>
              ) : (
                <p className="text-slate-700 text-sm text-center m-auto py-8">Vaše reference zde</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24 w-full">
        <div className="relative rounded-3xl overflow-hidden border border-amber-500/20 text-center py-20 px-8"
          style={{ background: 'linear-gradient(135deg, #0f1220 0%, #131a2e 50%, #0f1220 100%)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(ellipse at center, rgba(200,124,26,0.12) 0%, transparent 70%)' }} />
          <div className="absolute top-0 left-0 right-0 h-[1px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(200,124,26,0.5), transparent)' }} />
          <h2 className="relative text-3xl font-bold mb-4">Připraveni začít?</h2>
          <p className="relative text-slate-400 mb-8 max-w-md mx-auto">Registrace trvá méně než minutu. Bez kreditní karty.</p>
          <Link href="/register"
            className="relative inline-block px-10 py-4 rounded-xl font-bold text-slate-900 text-base transition-all hover:scale-[1.02] shadow-xl shadow-amber-900/30"
            style={{ background: 'linear-gradient(135deg, #EDB84A, #C87C1A)' }}>
            Registrovat firmu zdarma →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            {TF_LOGO}
            <span>TeamFlow · SelbickyLabs · {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-5">
            <a href="#funkce" className="hover:text-slate-400 transition">Funkce</a>
            <a href="#cenik" className="hover:text-slate-400 transition">Ceník</a>
            <Link href="/login" className="hover:text-slate-400 transition">Přihlásit se</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
