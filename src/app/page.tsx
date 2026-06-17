import Link from 'next/link'

const FEATURES = [
  {
    icon: '📅',
    title: 'Plánování směn',
    desc: 'Přehledný kalendář směn pro celý tým. Zavřené dny, typy práce a schvalování na jednom místě.',
  },
  {
    icon: '⏰',
    title: 'Docházka',
    desc: 'Kiosek pro příchod a odchod pomocí PIN kódu. Přesné záznamy bez papírování.',
  },
  {
    icon: '🏖️',
    title: 'Dovolené a absence',
    desc: 'Zaměstnanci žádají online, manažer schvaluje jedním kliknutím. Celý přehled kdo je kdy pryč.',
  },
  {
    icon: '📈',
    title: 'Analytika',
    desc: 'Odpracované hodiny, přesčasy, sobotní příplatky a export do Excelu pro mzdové účetnictví.',
  },
  {
    icon: '⚙️',
    title: 'Nastavení firmy',
    desc: 'Provozní doba, státní svátky, nemocenské procento, benefity — vše si nastavíte sami.',
  },
  {
    icon: '👤',
    title: 'Portál zaměstnance',
    desc: 'Každý zaměstnanec vidí své hodiny, žádosti a zůstatek dovolené bez nutnosti sdílet heslo.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* Navbar */}
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="36" height="36" viewBox="0 0 250 260" xmlns="http://www.w3.org/2000/svg">
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
            <span className="font-bold text-lg tracking-tight">TeamFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#cenik"
              className="text-sm font-medium text-slate-400 hover:text-white transition px-3 py-2 hidden sm:block"
            >
              Ceník
            </a>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition px-4 py-2"
            >
              Přihlásit se
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-lg transition"
            >
              Vyzkoušet zdarma
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-sm text-amber-400 font-medium mb-8">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
          HR systém pro malé a střední firmy
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-tight max-w-3xl mb-6">
          Směny, docházka a{' '}
          <span className="text-amber-400">dovolené</span>{' '}
          bez chaosu
        </h1>

        <p className="text-lg text-slate-400 max-w-xl mb-10 leading-relaxed">
          TeamFlow nahradí excelovské tabulky a WhatsApp skupiny. Plánujte směny,
          sledujte docházku a spravujte dovolené z jednoho místa.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/register"
            className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-xl transition text-base"
          >
            Registrovat firmu zdarma
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium rounded-xl transition text-base"
          >
            Přihlásit se
          </Link>
        </div>

        <p className="text-xs text-slate-600 mt-6">Bez kreditní karty · Nastavení za 5 minut</p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <h2 className="text-center text-2xl font-semibold text-slate-200 mb-12">
          Vše co potřebujete pro řízení týmu
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-600 transition"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="cenik" className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-slate-200 mb-3">Transparentní ceník</h2>
          <p className="text-slate-400 text-sm">Pevná cena pro celou firmu. Žádné skryté poplatky.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">

          {/* Standard */}
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-7 flex flex-col">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Standard</p>
            <p className="text-3xl font-bold text-white mb-0.5">1 190 Kč<span className="text-base font-normal text-slate-400"> / měs.</span></p>
            <p className="text-xs text-slate-500 mb-6">nebo <span className="text-white font-medium">11 900 Kč / rok</span> <span className="text-emerald-400">(2 měsíce zdarma)</span></p>
            <ul className="space-y-2.5 text-sm text-slate-300 flex-1 mb-6">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Pokročilý kalendář směn</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Docházkový PIN terminál</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Žádosti a schvalování dovolených</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Přehledy hodin & export</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Portál zaměstnance</li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Analytika</li>
            </ul>
            <Link
              href="/register"
              className="block w-full py-2.5 text-center bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition text-sm"
            >
              Vyzkoušet zdarma
            </Link>
          </div>

          {/* StoreForce */}
          <div className="bg-gradient-to-b from-blue-950 to-indigo-950 border border-blue-700/50 rounded-2xl p-7 flex flex-col relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-amber-400 text-slate-900 text-[11px] font-bold px-2.5 py-1 rounded-full">
              Doporučeno
            </div>
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">StoreForce ✦</p>
            <p className="text-3xl font-bold text-white mb-0.5">1 680 Kč<span className="text-base font-normal text-blue-300"> / měs.</span></p>
            <p className="text-xs text-blue-500/80 mb-6">nebo <span className="text-white font-medium">15 900 Kč / rok</span> <span className="text-emerald-400">(2 měsíce zdarma)</span></p>
            <ul className="space-y-2.5 text-sm text-slate-200 flex-1 mb-6">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Vše ze Standard</li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">✦</span> AI asistent — autonomní doplňování směn</li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">✦</span> Notifikace přes Slack & e-mail</li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">✦</span> Potvrzení jedním kliknutím bez přihlášení</li>
              <li className="flex items-start gap-2"><span className="text-amber-400 mt-0.5">✦</span> Pro kamenné prodejny a retail</li>
            </ul>
            <Link
              href="/register"
              className="block w-full py-2.5 text-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition text-sm shadow-lg shadow-blue-900/50"
            >
              Vyzkoušet zdarma
            </Link>
          </div>
        </div>

        {/* Download PDFs */}
        <div className="flex items-center justify-center gap-3">
          <span className="text-xs text-slate-600">Stáhnout ceník:</span>
          <a href="/teamflow-cenik-cs.pdf" download className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-400 transition">
            🇨🇿 CS PDF
          </a>
          <a href="/teamflow-pricing-en.pdf" download className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-400 transition">
            🇬🇧 EN PDF
          </a>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <h2 className="text-center text-2xl font-semibold text-slate-200 mb-12">Co říkají zákazníci</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { quote: 'Konečně vím, kdo je v práci, bez papírování a telefonátů.', author: 'Petra S.', role: 'vedoucí prodejny' },
            { quote: 'Zavedení trvalo odpoledne, ne měsíc.', author: 'Martin H.', role: 'majitel kavárny' },
            { quote: '—', author: '', role: '' },
          ].map((t, i) => (
            <div key={i} className={`bg-slate-900 border rounded-2xl p-6 flex flex-col gap-4 ${t.author ? 'border-slate-800' : 'border-dashed border-slate-800 opacity-40'}`}>
              {t.author ? (
                <>
                  <p className="text-slate-300 text-sm leading-relaxed flex-1">„{t.quote}"</p>
                  <div className="border-t border-slate-800 pt-4">
                    <p className="text-white font-semibold text-sm">{t.author}</p>
                    <p className="text-slate-500 text-xs">{t.role}</p>
                  </div>
                </>
              ) : (
                <p className="text-slate-600 text-sm text-center m-auto">Vaše reference zde</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="border-t border-slate-800 py-16 px-6 text-center">
        <h2 className="text-2xl font-semibold mb-4">Připraveni začít?</h2>
        <p className="text-slate-400 mb-8">Registrace trvá méně než minutu.</p>
        <Link
          href="/register"
          className="inline-block px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-xl transition"
        >
          Registrovat firmu zdarma
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} TeamFlow · SelbickyLabs
      </footer>
    </div>
  )
}
