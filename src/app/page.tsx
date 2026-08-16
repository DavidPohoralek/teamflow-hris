import Link from 'next/link'
import { TeamFlowMark } from '@/components/TeamFlowLogo'

// The brand mark's folded corner, used as the page motif on the hero and CTA blocks.
const FOLD = 'clamp(44px, 7vw, 92px)'
const foldClip = (corner: 'br' | 'tr') =>
  corner === 'br'
    ? `polygon(0 0, 100% 0, 100% calc(100% - ${FOLD}), calc(100% - ${FOLD}) 100%, 0 100%)`
    : `polygon(0 0, calc(100% - ${FOLD}) 0, 100% ${FOLD}, 100% 100%, 0 100%)`

const FEATURES = [
  {
    title: 'Plánování směn',
    desc: 'Přehledný kalendář pro celý tým. Typy práce, schvalování a uzavřené dny na jednom místě.',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    title: 'Docházka PIN',
    desc: 'Kiosek pro příchod a odchod pomocí PIN kódu. Přesné záznamy bez papírování.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    title: 'Dovolené',
    desc: 'Zaměstnanci žádají online, manažer schvaluje jedním kliknutím.',
    icon: (
      <>
        <circle cx="12" cy="9" r="3.2" />
        <path d="M12 2.5v1.6M12 13.9v1.6M4.8 9H3.2M20.8 9h-1.6M6.9 3.9 5.8 2.8M18.2 2.8l-1.1 1.1M3 19.5c1.5 0 1.5 1.2 3 1.2s1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2" />
      </>
    ),
  },
  {
    title: 'Přehled v reálném čase',
    desc: 'Kdo je aktuálně v práci, kdo chybí — živý přehled pro celý tým.',
    icon: (
      <>
        <path d="M3 12h4l2.5-6 4 12L16 12h5" />
      </>
    ),
  },
  {
    title: 'Analytika a export',
    desc: 'Odpracované hodiny, přesčasy, sobotní příplatky a export do Excelu.',
    icon: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
  },
  {
    title: 'Portál zaměstnance',
    desc: 'Každý vidí své hodiny a žádosti bez sdílení hesla.',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
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
        <span aria-hidden className="absolute bottom-0 right-0"
          style={{ width: FOLD, height: FOLD, background: '#E8963C', clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />

        {/* Navbar */}
        <header className="relative border-b border-white/10">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-3">
            <TeamFlowMark variant="dark" className="w-[22px] h-[22px] shrink-0" />
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Team<span style={{ color: '#E8963C' }}>Flow</span>
            </span>
            <nav className="hidden sm:flex items-center gap-1 ml-6 text-[13px]">
              <a href="#funkce" className="px-3 py-2 rounded-[7px] text-[#aab3bd] hover:text-white hover:bg-white/5 transition">Funkce</a>
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
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-24 sm:pb-32">
          <p className="tf-mono text-[10px] sm:text-[11px] tracking-[.18em] uppercase text-[#8e9aa6] mb-6">
            Docházka a směny pro české firmy
          </p>
          <h1 className="text-[34px] sm:text-[52px] lg:text-[60px] font-semibold leading-[1.08] tracking-[-.02em] text-white max-w-[16ch]">
            Směny, docházka a dovolené <span style={{ color: '#E8963C' }}>bez chaosu</span>
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
          <p className="tf-mono text-[11px] text-[#7d8894] mt-5">Bez kreditní karty · Nastavení za 5 minut</p>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="funkce" className="max-w-6xl mx-auto px-5 sm:px-8 w-full pt-20 sm:pt-24 pb-16">
        <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-[-.015em] mb-3">
          Vše co potřebujete pro řízení týmu
        </h2>
        <p className="text-[14.5px] text-[#5c6672] mb-12 max-w-[56ch]">
          Jedna platforma místo tří aplikací a spousty tabulek.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title}
              className="bg-white border border-[#e9e7e3] rounded-[11px] p-6 transition-colors hover:border-[#d8d5d0]">
              <span style={{ color: '#C97C2A' }}><FeatureIcon>{f.icon}</FeatureIcon></span>
              <h3 className="text-[15px] font-medium mt-4 mb-1.5">{f.title}</h3>
              <p className="text-[13.5px] text-[#5c6672] leading-relaxed">{f.desc}</p>
            </div>
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
                      <path d="M4 12.5 9.5 18 20 6.5" />
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
                    <path d="M4 12.5 9.5 18 20 6.5" />
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

      {/* ── Closing CTA — mark shape again, folded corner top-right ── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 w-full pb-20">
        <div className="relative px-8 sm:px-12 py-16 sm:py-20 text-center"
          style={{ background: '#22272d', clipPath: foldClip('tr') }}>
          <span aria-hidden className="absolute top-0 right-0"
            style={{ width: FOLD, height: FOLD, background: '#E8963C', clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
          <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-[-.015em] text-white mb-3">
            Připraveni začít?
          </h2>
          <p className="text-[14.5px] text-[#aab3bd] mb-9 max-w-[42ch] mx-auto">
            Registrace trvá méně než minutu. Bez kreditní karty.
          </p>
          <Link href="/register"
            className="inline-block px-8 py-3.5 rounded-[9px] font-medium text-[15px] text-[#111820] transition hover:brightness-105"
            style={{ background: '#E8963C' }}>
            Registrovat firmu zdarma
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e9e7e3] mt-auto">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <TeamFlowMark variant="light" className="w-[18px] h-[18px]" />
            <span className="text-[12.5px] text-[#8a929c]">
              TeamFlow · SelbickyLabs · {new Date().getFullYear()}
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
