import type { Metadata } from 'next'
import Link from 'next/link'
import { TeamFlowMark } from '@/components/TeamFlowLogo'

const OG_TITLE = 'TeamFlow — směny, docházka a dovolené bez chaosu'
const OG_DESC = 'Plánování směn, PIN docházka a schvalování dovolených pro české firmy. Nahradí excelové tabulky a WhatsApp skupiny.'

export const metadata: Metadata = {
  title: OG_TITLE,
  description: OG_DESC,
  openGraph: {
    title: OG_TITLE,
    description: OG_DESC,
    url: 'https://www.tmflw.com',
    siteName: 'TeamFlow',
    locale: 'cs_CZ',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'TeamFlow' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: OG_DESC,
    images: ['/og.png'],
  },
}
import LandingDemo from '@/components/LandingDemo'
import Reveal from '@/components/Reveal'
import ScrollPath from '@/components/ScrollPath'

// The brand mark's folded corner, used as the page motif on the hero and CTA blocks.
const FOLD = 'clamp(44px, 7vw, 92px)'
const foldClip = (corner: 'br' | 'tr') =>
  corner === 'br'
    ? `polygon(0 0, 100% 0, 100% calc(100% - ${FOLD}), calc(100% - ${FOLD}) 100%, 0 100%)`
    : `polygon(0 0, calc(100% - ${FOLD}) 0, 100% ${FOLD}, 100% 100%, 0 100%)`

const FEATURES = [
  {
    title: 'Plánování směn',
    tag: 'týden · měsíc · typy prací',
    desc: 'Přehledný kalendář pro celý tým. Typy práce, schvalování a uzavřené dny na jednom místě.',
    icon: (
      <>
        <rect pathLength={100} x="3" y="5" width="18" height="16" rx="2" />
        <path pathLength={100} d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    title: 'Docházka PIN',
    tag: 'příchod za dvě vteřiny',
    desc: 'Kiosek pro příchod a odchod pomocí PIN kódu. Přesné záznamy bez papírování.',
    icon: (
      <>
        <circle pathLength={100} cx="12" cy="12" r="9" />
        <path pathLength={100} d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    title: 'Dovolené',
    tag: 'žádost → schválení → kalendář',
    desc: 'Zaměstnanci žádají online, manažer schvaluje jedním kliknutím.',
    icon: (
      <>
        <circle pathLength={100} cx="12" cy="9" r="3.2" />
        <path pathLength={100} d="M12 2.5v1.6M12 13.9v1.6M4.8 9H3.2M20.8 9h-1.6M6.9 3.9 5.8 2.8M18.2 2.8l-1.1 1.1M3 19.5c1.5 0 1.5 1.2 3 1.2s1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2" />
      </>
    ),
  },
  {
    title: 'Přehled v reálném čase',
    tag: 'kdo je v práci právě teď',
    desc: 'Kdo je aktuálně v práci, kdo chybí — živý přehled pro celý tým.',
    icon: (
      <>
        <path pathLength={100} d="M3 12h4l2.5-6 4 12L16 12h5" />
      </>
    ),
  },
  {
    title: 'Analytika a export',
    tag: 'XLSX pro účetní jedním klikem',
    desc: 'Odpracované hodiny, přesčasy, sobotní příplatky a export do Excelu.',
    icon: (
      <>
        <path pathLength={100} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
  },
  {
    title: 'Portál zaměstnance',
    tag: 'hodiny · přesčasy · dovolená',
    desc: 'Každý vidí své hodiny a žádosti bez sdílení hesla.',
    icon: (
      <>
        <circle pathLength={100} cx="12" cy="8" r="3.5" />
        <path pathLength={100} d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
      </>
    ),
  },
]

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

const STANDARD_FEATURES = [
  'Pokročilý kalendář směn',
  'Docházkový PIN terminál',
  'Žádosti a schvalování dovolených',
  'Přehledy hodin a export',
  'Portál zaměstnance',
  'Analytika',
]

const STOREFORCE_FEATURES = [
  'AI asistent — autonomní doplňování směn',
  'Notifikace přes Slack a e-mail',
  'Potvrzení jedním kliknutím bez přihlášení',
  'Ideální pro kamenné prodejny a retail',
]

export default function LandingPage() {
  return (
    <div className="tf-sans min-h-screen bg-[#fbfaf8] text-[#111820] flex flex-col overflow-x-hidden">

      {/* ── Hero block — graphite with the brand mark's folded corner ── */}
      <section className="relative" style={{ background: '#22272d', clipPath: foldClip('br') }}>
        <span aria-hidden className="tf-fold absolute bottom-0 right-0"
          style={{ width: FOLD, height: FOLD, background: '#E8963C', clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', transformOrigin: '100% 100%' }} />

        {/* The brand mark, drawing itself large behind the headline.
            Hairline strokes (non-scaling) and no doubled edges: the fold keeps
            only its two inner legs, the accent is a single orange line. */}
        <svg aria-hidden viewBox="0 0 96 96" fill="none" strokeLinejoin="round" strokeLinecap="square"
          className="tf-draw is-visible hidden lg:block absolute right-[3%] top-1/2 -translate-y-1/2 w-[540px] h-[540px] pointer-events-none">
          <path pathLength={100} vectorEffect="non-scaling-stroke" d="M10 8h60l16 16v48l-16 16H10z" stroke="rgba(255,255,255,.10)" strokeWidth="1.3" />
          <path pathLength={100} vectorEffect="non-scaling-stroke" d="M24 30h48v13H55v37H41V43H24z" stroke="rgba(255,255,255,.15)" strokeWidth="1.3" />
          <path pathLength={100} vectorEffect="non-scaling-stroke" d="M39.75 44.5V78.5" stroke="rgba(232,150,60,.45)" strokeWidth="1.3" />
          <path pathLength={100} vectorEffect="non-scaling-stroke" d="M86 24H70V8" stroke="rgba(232,150,60,.6)" strokeWidth="1.3" />
        </svg>

        {/* Navbar */}
        <header className="relative border-b border-white/10">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-3">
            <TeamFlowMark variant="dark" className="w-[30px] h-[30px] shrink-0" />
            <span className="text-[19px] font-semibold tracking-tight text-white">
              Team<span style={{ color: '#E8963C' }}>Flow</span>
            </span>
            <nav className="hidden sm:flex items-center gap-1 ml-6 text-[13px]">
              <a href="#funkce" className="px-3 py-2 rounded-[7px] text-[#aab3bd] hover:text-white hover:bg-white/5 transition">Funkce</a>
              <a href="#ukazka" className="px-3 py-2 rounded-[7px] text-[#aab3bd] hover:text-white hover:bg-white/5 transition">Ukázka</a>
              <a href="#cenik" className="px-3 py-2 rounded-[7px] text-[#aab3bd] hover:text-white hover:bg-white/5 transition">Ceník</a>
            </nav>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <Link href="/login"
                className="px-2.5 sm:px-3 py-2 text-[13px] whitespace-nowrap text-[#aab3bd] hover:text-white transition">
                Přihlásit se
              </Link>
              <Link href="/register"
                className="px-3 sm:px-4 py-2 text-[13px] font-medium rounded-[8px] whitespace-nowrap text-[#111820] transition hover:brightness-105"
                style={{ background: '#E8963C' }}>
                <span className="sm:hidden">Vyzkoušet</span>
                <span className="hidden sm:inline">Vyzkoušet zdarma</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero copy */}
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-16 sm:pb-24">
          <p className="tf-mono text-[10px] sm:text-[11px] tracking-[.18em] uppercase text-[#8e9aa6] mb-6">
            Docházka a směny pro české firmy
          </p>
          <h1 className="text-[34px] sm:text-[52px] lg:text-[60px] font-semibold leading-[1.08] tracking-[-.02em] text-white max-w-[16ch]">
            {['Směny,', 'docházka', 'a', 'dovolené'].map((w, i) => (
              <span key={w} className="tf-rise inline-block" style={{ animationDelay: `${i * 0.07}s` }}>{w}&nbsp;</span>
            ))}
            <span className="relative inline-block" style={{ color: '#E8963C' }}>
              <span className="tf-rise inline-block" style={{ animationDelay: '.28s' }}>bez&nbsp;</span>
              <span className="tf-rise inline-block" style={{ animationDelay: '.35s' }}>chaosu</span>
              {/* the underline sweeps in once the words have landed */}
              <span aria-hidden className="tf-underline absolute left-0 right-1 -bottom-[5px] sm:-bottom-[7px] h-[3px] bg-[#E8963C]" />
            </span>
          </h1>
          <p className="text-[15px] sm:text-[16.5px] text-[#aab3bd] leading-relaxed max-w-[52ch] mt-6">
            TeamFlow nahradí excelové tabulky a WhatsApp skupiny. Plánujte směny,
            sledujte docházku a spravujte dovolené z jednoho místa.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-9">
            <Link href="/register"
              className="px-7 py-3.5 rounded-[9px] font-medium text-[15px] text-[#111820] text-center transition hover:brightness-105"
              style={{ background: '#E8963C' }}>
              Registrovat firmu zdarma
            </Link>
            <a href="#funkce"
              className="px-7 py-3.5 rounded-[9px] text-[15px] text-white text-center border border-white/20 hover:bg-white/5 transition">
              Jak to funguje
            </a>
          </div>

          {/* Quiet mono facts */}
          <div className="tf-rise flex max-w-[430px] mt-12 border-t border-white/[.12]" style={{ animationDelay: '.55s' }}>
            {[
              { v: '5 min', l: 'nastavení' },
              { v: '0 Kč', l: 'za zaměstnance' },
              { v: 'CZ', l: 'česky, pro české mzdy' },
            ].map((s, i) => (
              <div key={s.v} className={`flex-1 pt-3.5 ${i > 0 ? 'pl-5 border-l border-white/[.12]' : 'pr-5'}`}>
                <p className="tf-mono text-[16px] text-white leading-none">{s.v}</p>
                <p className="text-[11.5px] text-[#8e9aa6] mt-1.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ticker — system events gliding along the hero's bottom edge, vanishing into the fold */}
        <div aria-hidden className="relative border-t border-white/10 overflow-hidden">
          <div className="tf-ticker flex w-max">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0">
                {[
                  '● 08:02 Nováková — příchod',
                  '● 08:11 Dvořák — příchod',
                  '✓ dovolená schválena — Svobodová',
                  '+ směna přidána — Kučera ČT 10–18',
                  '● 07:05 Svobodová — příchod',
                  '✓ export odeslán účetní — červenec',
                ].map((e, i) => (
                  <span key={i} className="tf-mono text-[11px] text-[#8e9aa6] px-6 py-2.5 whitespace-nowrap border-l border-[#E8963C]/40">
                    {e.startsWith('●')
                      ? <><span style={{ color: '#3fa96b' }}>●</span>{e.slice(1)}</>
                      : e}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Light body — carries the scroll spine ── */}
      <div className="relative">
      <ScrollPath />

      {/* ── Features ── */}
      <section id="funkce" className="max-w-6xl mx-auto px-5 sm:px-8 w-full pt-20 sm:pt-24 pb-16">
        <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-[-.015em] mb-3">
          Vše co potřebujete pro řízení týmu
        </h2>
        <p className="text-[14.5px] text-[#5c6672] mb-12 max-w-[56ch]">
          Jedna platforma místo tří aplikací a spousty tabulek.
        </p>
        {/* One panel in the app's table language: strong ink rule on top,
            hairline grid between cells (gap-px trick), mono footnotes. */}
        <div className="rounded-[10px] overflow-hidden border border-[#e2e0dc] bg-[#eceae6]"
          style={{ borderTop: '2px solid #111820' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.07} className="bg-white">
                <div className="group h-full p-6 lg:p-7 transition-colors hover:bg-[#fbfaf8]">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#f3e3cd]"
                      style={{ background: '#f8efe3', color: '#C97C2A' }}>
                      <FeatureIcon>{f.icon}</FeatureIcon>
                    </span>
                    <h3 className="text-[15px] font-medium">{f.title}</h3>
                  </div>
                  <p className="text-[13.5px] text-[#5c6672] leading-relaxed mt-3.5">{f.desc}</p>
                  <p className="tf-mono text-[10.5px] tracking-[.04em] mt-4 text-[#8a929c]">
                    <span style={{ color: '#C97C2A' }}>—</span> {f.tag}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive demo ── */}
      <section id="ukazka" className="max-w-6xl mx-auto px-5 sm:px-8 w-full pt-12 pb-20">
        <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-[-.015em] mb-3">
          Vyzkoušejte si to hned tady
        </h2>
        <p className="text-[14.5px] text-[#5c6672] mb-8 max-w-[56ch]">
          Bez registrace. Přepínejte sekce a v Příchodu/Odchodu zkuste zadat PIN —
          je to skutečné rozhraní, jen se smyšlenými lidmi.
        </p>
        <LandingDemo />
        <div className="flex flex-wrap items-center gap-2.5 mt-4">
          <span className="text-[12.5px] text-[#8a929c]">Zkuste některý PIN:</span>
          {['1234', '2345', '3456', '4567'].map((p) => (
            <span key={p} className="tf-mono text-[12.5px] text-[#5c6672] bg-white border border-[#e2e0dc] rounded-[6px] px-2.5 py-1">
              {p}
            </span>
          ))}
          <span className="text-[12px] text-[#8a929c]">Druhé zadání zapíše odchod.</span>
        </div>
      </section>

      {/* ── Three steps ── */}
      <section id="zavedeni" className="max-w-6xl mx-auto px-5 sm:px-8 w-full pt-12 pb-20">
        <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-[-.015em] mb-3">
          Zavedete to za odpoledne
        </h2>
        <p className="text-[14.5px] text-[#5c6672] mb-10 max-w-[56ch]">
          Bez IT oddělení a bez školení.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {[
            { t: 'Založíte firmu', d: 'Registrace zabere minutu. Vyplníte název firmy a oddělení.' },
            { t: 'Nahrajete lidi', d: 'Jména, úvazky a PIN kódy. Klidně hromadně z tabulky.' },
            { t: 'Tým píchá na PIN', d: 'Tablet u vchodu a hodiny se počítají samy. Od prvního dne.' },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 0.09} className="h-full">
              <div className={`h-full py-4 sm:py-2 border-b sm:border-b-0 border-[#e2e0dc] last:border-b-0 ${i > 0 ? 'sm:border-l sm:border-[#e2e0dc] sm:pl-8' : ''} ${i < 2 ? 'sm:pr-8' : ''}`}>
                <p className="tf-mono text-[12px] tracking-[.08em]" style={{ color: '#C97C2A' }}>0{i + 1}</p>
                <h3 className="text-[16px] font-medium mt-2.5">{s.t}</h3>
                <p className="text-[13.5px] text-[#5c6672] leading-relaxed mt-1.5">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="cenik" className="max-w-6xl mx-auto px-5 sm:px-8 w-full pt-12 pb-24">
        <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-[-.015em] mb-3">Transparentní ceník</h2>
        <p className="text-[14.5px] text-[#5c6672] mb-12 max-w-[56ch]">
          Pevná cena pro celou firmu. Žádné skryté poplatky za zaměstnance.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
          {/* Standard */}
          <div className="bg-white border border-[#e9e7e3] rounded-[13px] p-7 flex flex-col">
            <p className="tf-mono text-[10.5px] tracking-[.14em] uppercase text-[#8a929c] mb-4">Standard</p>
            <p className="tf-mono text-[34px] font-medium tracking-tight leading-none">
              1 190 Kč<span className="tf-sans text-[15px] font-normal text-[#8a929c]"> / měs.</span>
            </p>
            <p className="text-[12.5px] text-[#8a929c] mt-2.5 mb-7">
              nebo <span className="text-[#111820]">11 900 Kč / rok</span>{' '}
              <span style={{ color: '#2f7d46' }}>(2 měs. zdarma)</span>
            </p>
            <ul className="flex flex-col gap-3 text-[13.5px] text-[#5c6672] flex-1 mb-7">
              {STANDARD_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0" style={{ color: '#2f7d46' }}>
                    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path pathLength={100} d="M4 12.5 9.5 18 20 6.5" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/register"
              className="block w-full py-3 text-center rounded-[9px] text-[14px] font-medium border border-[#d8d5d0] hover:bg-[#f4f2ef] transition">
              Vyzkoušet zdarma
            </Link>
          </div>

          {/* StoreForce — recommended */}
          <div className="relative rounded-[13px] p-7 flex flex-col text-white" style={{ background: '#22272d' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="tf-mono text-[10.5px] tracking-[.14em] uppercase" style={{ color: '#E8963C' }}>StoreForce</p>
              <span className="text-[10.5px] font-medium px-2.5 py-1 rounded-[6px] text-[#111820]" style={{ background: '#E8963C' }}>
                Doporučeno
              </span>
            </div>
            <p className="tf-mono text-[34px] font-medium tracking-tight leading-none">
              1 680 Kč<span className="tf-sans text-[15px] font-normal text-[#8e9aa6]"> / měs.</span>
            </p>
            <p className="text-[12.5px] text-[#8e9aa6] mt-2.5 mb-7">
              nebo <span className="text-white">15 900 Kč / rok</span>{' '}
              <span style={{ color: '#7fc79a' }}>(2 měs. zdarma)</span>
            </p>
            <ul className="flex flex-col gap-3 text-[13.5px] text-[#c6cfd8] flex-1 mb-7">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0" style={{ color: '#7fc79a' }}>
                  <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path pathLength={100} d="M4 12.5 9.5 18 20 6.5" />
                  </svg>
                </span>
                Vše ze Standard
              </li>
              {STOREFORCE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[13px] leading-none" style={{ color: '#E8963C' }}>✦</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/register"
              className="block w-full py-3 text-center rounded-[9px] text-[14px] font-medium text-[#111820] transition hover:brightness-105"
              style={{ background: '#E8963C' }}>
              Vyzkoušet zdarma
            </Link>
          </div>
        </div>

        {/* Price list PDFs */}
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <span className="text-[12.5px] text-[#8a929c]">Stáhnout ceník:</span>
          <a href="/teamflow-cenik-cs.pdf" download
            className="px-3 py-1.5 rounded-[7px] border border-[#e2e0dc] bg-white text-[12.5px] text-[#5c6672] hover:border-[#d8d5d0] transition">
            Česky (PDF)
          </a>
          <a href="/teamflow-pricing-en.pdf" download
            className="px-3 py-1.5 rounded-[7px] border border-[#e2e0dc] bg-white text-[12.5px] text-[#5c6672] hover:border-[#d8d5d0] transition">
            English (PDF)
          </a>
        </div>
      </section>

      {/* ── FAQ — native details/summary, no JS ── */}
      <section id="faq" className="max-w-6xl mx-auto px-5 sm:px-8 w-full pb-24">
        <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-[-.015em] mb-3">
          Časté dotazy
        </h2>
        <p className="text-[14.5px] text-[#5c6672] mb-8 max-w-[56ch]">
          Rychlé odpovědi, než se rozhodnete.
        </p>
        <div className="max-w-3xl border-t border-[#e2e0dc]">
          {[
            {
              q: 'Musí mít každý zaměstnanec telefon nebo e-mail?',
              a: 'Ne. Příchody a odchody se zadávají PIN kódem na společném tabletu nebo počítači. Portál zaměstnance je volitelný — kdo chce, podívá se na své hodiny odkudkoliv.',
            },
            {
              q: 'Sedí to na české příplatky a podklady pro mzdy?',
              a: 'Ano. TeamFlow počítá odpracované hodiny, přesčasy i víkendové příplatky podle vašeho nastavení a export do Excelu předáte účetní beze změn.',
            },
            {
              q: 'Jak dlouho trvá zavedení?',
              a: 'Většině firem stačí odpoledne: založíte firmu, nahrajete jména a PIN kódy a tým může začít píchat ještě tentýž den.',
            },
            {
              q: 'Co když budeme chtít skončit?',
              a: 'Data jsou vaše — kompletní historii docházky i směn si kdykoliv stáhnete do Excelu.',
            },
          ].map((f) => (
            <details key={f.q} className="group border-b border-[#e2e0dc]">
              <summary className="flex items-center gap-4 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="flex-1 text-[15px] font-medium group-hover:text-[#5c6672] transition-colors">{f.q}</span>
                <span aria-hidden className="shrink-0 text-[19px] leading-none text-[#8a929c] transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <p className="pb-5 pr-10 text-[13.5px] text-[#5c6672] leading-relaxed max-w-[70ch]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Closing CTA — mark shape again, folded corner top-right ── */}
      <section id="cta" className="max-w-6xl mx-auto px-5 sm:px-8 w-full pb-20">
        <div className="relative px-8 sm:px-12 py-16 sm:py-20 text-center"
          style={{ background: '#22272d', clipPath: foldClip('tr') }}>
          <span aria-hidden className="absolute top-0 right-0"
            style={{ width: FOLD, height: FOLD, background: '#E8963C', clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
          <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-[-.015em] text-white mb-3">
            Připraveni začít?
          </h2>
          <p className="text-[14.5px] text-[#aab3bd] mb-9 max-w-[42ch] mx-auto">
            Registrace trvá méně než minutu.
          </p>
          <Link href="/register"
            className="inline-block px-8 py-3.5 rounded-[9px] font-medium text-[15px] text-[#111820] transition hover:brightness-105"
            style={{ background: '#E8963C' }}>
            Registrovat firmu zdarma
          </Link>
        </div>
      </section>

      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e9e7e3] mt-auto">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <TeamFlowMark variant="light" className="w-[18px] h-[18px]" />
            <span className="text-[12.5px] text-[#8a929c]">
              TeamFlow · Shelbitsky · {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex gap-5 text-[12.5px] text-[#5c6672]">
            <a href="#funkce" className="hover:text-[#111820] transition">Funkce</a>
            <a href="#cenik" className="hover:text-[#111820] transition">Ceník</a>
            <Link href="/login" className="hover:text-[#111820] transition">Přihlásit se</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
