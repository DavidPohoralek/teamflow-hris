'use client'

// Interactive product demo for the marketing page. Entirely client-side and
// fed by invented people — it never touches the API or a real org.
// Desktop: the app's graphite sidebar. Mobile: the same nav laid on its side
// above the content, so the demo stays clickable on a phone.

import { useCallback, useEffect, useRef, useState } from 'react'
import TabIcon from '@/components/TabIcons'
import { TeamFlowMark } from '@/components/TeamFlowLogo'
import { catColors } from '@/lib/categoryColors'

type TabId = 'attendance' | 'overview' | 'schedule' | 'vacation' | 'my-hours'

const TABS: { id: TabId; label: string; short: string }[] = [
  { id: 'attendance', label: 'Příchod/Odchod', short: 'Příchod' },
  { id: 'overview', label: 'Přehled', short: 'Přehled' },
  { id: 'schedule', label: 'Směny', short: 'Směny' },
  { id: 'vacation', label: 'Dovolená', short: 'Dovolená' },
  { id: 'my-hours', label: 'Zaměstnanec', short: 'Zaměstnanec' },
]

// Invented staff. The PINs are printed on the page on purpose — without them
// nobody would know what to type.
type Person = {
  pin: string; name: string; short: string; initials: string
  dep: 'Prodejna' | 'Expedice' | 'Backoffice'
}
const PEOPLE: Person[] = [
  { pin: '1234', name: 'Tereza Nováková', short: 'Nováková T.', initials: 'NT', dep: 'Prodejna' },
  { pin: '2345', name: 'Martin Dvořák', short: 'Dvořák M.', initials: 'DM', dep: 'Prodejna' },
  { pin: '3456', name: 'Klára Svobodová', short: 'Svobodová K.', initials: 'SK', dep: 'Expedice' },
  { pin: '4567', name: 'Jakub Kučera', short: 'Kučera J.', initials: 'KJ', dep: 'Backoffice' },
]

// The demo runs through the app's real category-colour engine, so chips,
// tints and rails are pixel-identical to production.
const DEP = {
  Prodejna: catColors('#ec4899'),
  Expedice: catColors('#22c55e'),
  Backoffice: catColors('#eab308'),
} as const

// Shift plan for the demo week — index 0..4 is Mon..Fri, null means a day off.
const PLAN: Record<string, (string | null)[]> = {
  '1234': ['9–16', '9–16', null, '12–20', '9–16'],
  '2345': ['12–20', null, '9–16', '9–16', null],
  '3456': [null, '7–15', '7–15', null, '7–15'],
  '4567': ['10–18', '10–18', null, '10–18', '10–18'],
}

const DAYS_CZ = ['NEDĚLE', 'PONDĚLÍ', 'ÚTERÝ', 'STŘEDA', 'ČTVRTEK', 'PÁTEK', 'SOBOTA']
const MONTHS_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince']
const pad = (n: number) => String(n).padStart(2, '0')

// Numbers count up when a screen opens — the same tabular feel as the app.
function Num({ v, dec = 0, fixed = false, className, style }: {
  v: number; dec?: number; fixed?: boolean; className?: string; style?: React.CSSProperties
}) {
  const [d, setD] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setD(v); return }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 600)
      setD(v * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [v])
  return (
    <span className={className} style={style}>
      {fixed
        ? d.toFixed(dec) // the portal prints raw toFixed with a dot
        : d.toLocaleString('cs-CZ', { minimumFractionDigits: dec, maximumFractionDigits: dec })}
    </span>
  )
}

export default function LandingDemo() {
  const [tab, setTab] = useState<TabId>('schedule')
  const [now, setNow] = useState<Date | null>(null)
  // Who is currently clocked in — the PIN pad mutates this and Přehled reads it.
  const [shift, setShift] = useState<Record<string, string | null>>({
    '1234': null, '2345': '08:11', '3456': '07:05', '4567': null,
  })
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<{ person: Person; arriving: boolean; time: string } | null>(null)
  // Replays the shift chips whenever Směny is opened.
  const [gridRun, setGridRun] = useState(0)
  // Toolbar state, mirroring the real shift grid (view switch + PIN login).
  const [view, setView] = useState<'dnes' | 'tyden' | 'mesic'>('tyden')
  const [tbPin, setTbPin] = useState('')
  // The demo introduces itself once, then hands over. Without this most
  // visitors never realise the thing is clickable at all.
  const [intro, setIntro] = useState<'idle' | 'playing' | 'done'>('idle')
  const introRef = useRef<'idle' | 'playing' | 'done'>('idle')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  // Mirrors of the state the scripted intro drives, so its callbacks read
  // current values instead of the ones captured when it started.
  const pinRef = useRef('')
  const shiftRef = useRef(shift)
  const receiptRef = useRef<typeof receipt>(null)
  useEffect(() => { shiftRef.current = shift }, [shift])
  useEffect(() => { receiptRef.current = receipt }, [receipt])

  const stopIntro = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (introRef.current !== 'done') { introRef.current = 'done'; setIntro('done') }
  }, [])

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 20000)
    return () => clearInterval(id)
  }, [])

  // Clear the confirmation after a moment, like a kiosk with a queue behind you.
  useEffect(() => {
    if (!receipt) return
    const id = setTimeout(() => {
      receiptRef.current = null; setReceipt(null)
      pinRef.current = ''; setPin('')
    }, 3800)
    return () => clearTimeout(id)
  }, [receipt])

  const presentCount = Object.values(shift).filter(Boolean).length

  function submit(value: string) {
    if (receiptRef.current) return
    if (value.length < 4) { setError('Zadejte 4 číslice.'); return }
    const person = PEOPLE.find((p) => p.pin === value)
    if (!person) { setError('Neznámý PIN. Zkuste 1234.'); pinRef.current = ''; setPin(''); return }
    const d = new Date()
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    const arriving = !shiftRef.current[person.pin]
    const next = { ...shiftRef.current, [person.pin]: arriving ? time : null }
    shiftRef.current = next
    setShift(next)
    setError('')
    receiptRef.current = { person, arriving, time }
    setReceipt(receiptRef.current)
  }

  // Plays itself the first time the section is scrolled into view.
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { introRef.current = 'done'; setIntro('done'); return }

    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || introRef.current !== 'idle') return
      io.disconnect()
      introRef.current = 'playing'
      setIntro('playing')
      const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)) }
      at(300, () => setTab('attendance'))
      ;['1', '2', '3', '4'].forEach((d, i) => at(1200 + i * 340, () => press(d)))
      at(4400, () => setTab('overview'))
      at(7000, () => { introRef.current = 'done'; setIntro('done') })
    }, { threshold: 0.35 })

    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // User-facing handlers — any interaction cancels the intro.
  function pickTab(id: TabId) {
    stopIntro()
    setTab(id)
    if (id === 'schedule') setGridRun((n) => n + 1)
  }
  function pressKey(key: string) { stopIntro(); press(key) }

  // PIN typed straight into the Směny toolbar — jumps to the kiosk and clocks in.
  function submitToolbarPin() {
    if (tbPin.length !== 4) return
    stopIntro()
    const value = tbPin
    setTbPin('')
    setTab('attendance')
    timers.current.push(setTimeout(() => submit(value), 350))
  }

  function press(key: string) {
    if (receiptRef.current) return
    if (key === 'del') {
      pinRef.current = pinRef.current.slice(0, -1); setPin(pinRef.current); setError(''); return
    }
    if (key === 'ok') { submit(pinRef.current); return }
    setError('')
    if (pinRef.current.length >= 4) return
    pinRef.current += key
    setPin(pinRef.current)
    // Auto-confirm on the fourth digit, exactly like the real kiosk.
    if (pinRef.current.length === 4) {
      const value = pinRef.current
      timers.current.push(setTimeout(() => submit(value), 140))
    }
  }

  const navItem = (t: typeof TABS[number], active: boolean) => (
    <button
      key={t.id}
      onClick={() => pickTab(t.id)}
      aria-current={active ? 'true' : undefined}
      className={`relative flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-[7px] text-[13px] transition-colors ${
        active ? 'bg-[#2c3b4a] text-white' : 'text-[#c6cfd8] hover:bg-white/5'
      }`}
    >
      {active && <span className="absolute -left-[9px] top-1.5 bottom-1.5 w-[2px] rounded bg-white" />}
      <TabIcon id={t.id} className="w-[17px] h-[17px] shrink-0" />
      {t.label}
    </button>
  )

  return (
    <div ref={rootRef} className="relative bg-white border border-[#e2e0dc] rounded-[12px] overflow-hidden"
      style={{ boxShadow: '0 6px 24px rgba(17,24,32,.09)' }}>

      {/* Once the scripted intro finishes, say the quiet part out loud. */}
      {intro === 'done' && (
        <div className="absolute top-2.5 right-2.5 z-10 tf-reveal is-visible pointer-events-none">
          <span className="text-[11px] font-medium text-[#111820] px-2.5 py-1 rounded-full shadow-sm"
            style={{ background: '#E8963C' }}>
            Teď vy — klikejte
          </span>
        </div>
      )}

      {/* Mobile nav — the sidebar laid on its side */}
      <div className="sm:hidden bg-[#262b31]">
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5">
          <TeamFlowMark variant="dark" className="w-[19px] h-[19px]" />
          <span className="text-[13.5px] font-semibold tracking-tight text-white">
            Team<span style={{ color: '#E8963C' }}>Flow</span>
          </span>
        </div>
        <div className="flex gap-1 px-3 pb-2.5 overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => pickTab(t.id)}
              aria-current={tab === t.id ? 'true' : undefined}
              className={`shrink-0 px-3 py-1.5 rounded-[7px] text-[12.5px] whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-[#2c3b4a] text-white' : 'text-[#aab3bd]'
              }`}>
              {t.short}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-[420px] sm:min-h-[400px]">
        {/* Desktop sidebar */}
        <aside className="hidden sm:flex w-[196px] shrink-0 bg-[#262b31] flex-col px-2.5 py-3 pl-4">
          <div className="flex items-center gap-2.5 px-1 pb-4">
            <TeamFlowMark variant="dark" className="w-[20px] h-[20px]" />
            <span className="text-[14px] font-semibold tracking-tight text-white">
              Team<span style={{ color: '#E8963C' }}>Flow</span>
            </span>
          </div>
          {TABS.map((t) => navItem(t, tab === t.id))}

          {tab === 'schedule' && (
            <div className="mt-5 px-1">
              <p className="tf-mono text-[9px] tracking-[.14em] uppercase text-[#8e9aa6] mb-2">Kategorie</p>
              {(['Prodejna', 'Expedice', 'Backoffice'] as const).map((d) => (
                <div key={d} className="flex items-center gap-2 py-1 text-[11.5px] text-[#c6cfd8]">
                  <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: DEP[d].solid }} />
                  {d}
                  <span className="tf-mono ml-auto text-[11px] text-[#8e9aa6]">
                    {PEOPLE.filter((p) => p.dep === d).length}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto pt-4 px-1">
            <p className="text-[10.5px] text-[#6d7883] mb-3">Ukázka se smyšlenými lidmi</p>
            <div className="flex items-center gap-2 text-[11.5px] text-[#c6cfd8]">
              <svg viewBox="0 0 24 24" className="w-[14px] h-[14px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14.5 4a5.5 5.5 0 1 0 3 10.1L21 17.6V21h-3.4l-1.5-1.5.1-1.6-1.7-.2-.2-1.7-1.6.1" />
                <circle cx="16.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              Přihlásit jako manažer
            </div>
            <div className="inline-flex mt-3 border border-white/15 rounded-[6px] overflow-hidden">
              <span className="tf-mono text-[10px] px-2 py-0.5 bg-[#c6cfd8] text-[#111820]">CZ</span>
              <span className="tf-mono text-[10px] px-2 py-0.5 text-[#8e9aa6]">EN</span>
            </div>
          </div>
        </aside>

        {/* Content — remounts per tab so each screen slides in like the app */}
        <div className="flex-1 min-w-0">
        <div key={tab} className="tf-tabfade">

          {tab === 'schedule' && (
            <div>
              <div className="flex items-center gap-x-2.5 gap-y-1.5 px-3 sm:px-4 py-2.5 border-b border-[#e9e7e3] flex-wrap">
                <span className="text-[13.5px] font-semibold">Směny</span>
                <span className="hidden sm:inline text-[#e2e0dc]">|</span>
                <span className="tf-mono text-[11.5px] text-[#5c6672]">srpen 2026</span>
                <span className="hidden sm:flex items-center gap-1 text-[#8a929c]">
                  <button className="px-1 hover:text-[#111820]" aria-label="Předchozí">‹</button>
                  <button className="px-1 hover:text-[#111820]" aria-label="Další">›</button>
                </span>
                <span className="hidden md:inline text-[#e2e0dc]">|</span>
                <span className="hidden md:flex items-center gap-2.5 text-[11.5px]">
                  {([['dnes', 'Dnes'], ['tyden', 'Týden'], ['mesic', 'Měsíc']] as const).map(([k, l]) => (
                    <button key={k} onClick={() => { stopIntro(); setView(k) }}
                      className={view === k
                        ? 'text-[#111820] border-b-[1.5px] border-[#111820] pb-px'
                        : 'text-[#8a929c] hover:text-[#111820]'}>
                      {l}
                    </button>
                  ))}
                </span>
                <span className="hidden lg:inline text-[#e2e0dc]">|</span>
                <span className="hidden lg:inline text-[11.5px] text-[#5c6672]">Typ práce ⌄</span>
                <span className="hidden lg:inline text-[11.5px] text-[#5c6672]">Aktivity</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="hidden lg:flex items-center gap-1 text-[11.5px] text-[#8a929c]">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
                    </svg>
                    Hledat…
                  </span>
                  <input
                    value={tbPin}
                    onChange={(e) => { stopIntro(); setTbPin(e.target.value.replace(/\D/g, '').slice(0, 4)) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitToolbarPin() }}
                    placeholder="Váš PIN" inputMode="numeric" type="password"
                    className="tf-mono w-[72px] px-2 py-1 text-[11px] border border-[#e2e0dc] rounded-[6px] placeholder:text-[#a2a8b0] focus:outline-none focus:border-[#8a929c]"
                  />
                  <button onClick={submitToolbarPin} disabled={tbPin.length !== 4}
                    className={`tf-mono text-[11px] px-2.5 py-1 rounded-[6px] transition-colors ${
                      tbPin.length === 4 ? 'bg-[#111820] text-white' : 'bg-[#b3b7bb] text-white cursor-not-allowed'
                    }`}>
                    OK
                  </button>
                </span>
              </div>
              <div className="p-3 sm:p-4">
                <div className="overflow-x-auto">
                  <div key={gridRun} className="min-w-[560px] border border-[#e9e7e3] rounded-[7px] overflow-hidden bg-white">
                    {/* Header row — month label + day columns, strong ink rule underneath */}
                    <div className="flex" style={{ borderBottom: '2px solid #111820' }}>
                      <div className="w-[140px] shrink-0 px-3 py-1.5 bg-[#fbfaf8] border-r border-[#e9e7e3]">
                        <div className="text-[8.5px] uppercase tracking-[.1em]" style={{ color: '#8a929c' }}>srpen</div>
                        <div className="tf-mono text-[10.5px] font-medium" style={{ color: '#111820' }}>3. 8. – 9. 8.</div>
                      </div>
                      {['PO 3', 'ÚT 4', 'ST 5', 'ČT 6', 'PÁ 7'].map((d) => (
                        <div key={d} className="tf-mono flex-1 flex items-center justify-center py-1.5 text-[10px] font-medium uppercase tracking-[.04em] bg-[#fbfaf8] border-r border-[#e9e7e3]"
                          style={{ color: '#111820' }}>{d}</div>
                      ))}
                      {['SO 8', 'NE 9'].map((d, i) => (
                        <div key={d} className={`tf-mono flex-1 flex items-center justify-center py-1.5 text-[10px] font-medium uppercase tracking-[.04em] bg-[#f3f1ed] ${i === 0 ? 'border-r border-[#e9e7e3]' : ''}`}
                          style={{ color: '#8a929c' }}>{d}</div>
                      ))}
                    </div>
                    {/* Employee rows — white, only the name cell carries the department tint */}
                    {PEOPLE.map((p, idx) => {
                      const c = DEP[p.dep]
                      return (
                        <div key={p.pin}
                          className={`group flex bg-white ${idx < PEOPLE.length - 1 ? 'border-b border-[#f4f2ef]' : ''}`}>
                          <div className="w-[140px] shrink-0 pl-2.5 pr-2 py-[3px] min-h-[31px] flex items-center gap-1.5 border-r border-[#ececea]"
                            style={{ backgroundColor: c.tint, borderLeft: `3px solid ${c.solid}` }}>
                            <span className="text-[11.5px] leading-tight truncate" style={{ color: '#111820' }}>{p.short}</span>
                            <span className="hidden md:inline shrink-0 text-[8px] uppercase tracking-[.05em] leading-none px-1 py-[2px] rounded-[3px] whitespace-nowrap"
                              style={{ background: c.fill, color: c.text }}>{p.dep}</span>
                          </div>
                          {PLAN[p.pin].map((slot, i) => (
                            <div key={i} className="flex-1 px-[4px] py-[3px] min-h-[31px] border-r border-[#f4f2ef] flex items-center justify-center transition-colors duration-75 group-hover:bg-[#f5f3ef]">
                              {slot ? (
                                <span className="tf-chip-in tf-mono w-full text-[10px] font-medium py-[3px] px-1 leading-tight text-center"
                                  style={{ background: c.fill, color: c.text, boxShadow: `inset 3px 0 0 ${c.solid}`, borderRadius: '4px', animationDelay: `${(idx * 5 + i) * 0.055}s` }}>{slot}</span>
                              ) : (
                                <span className="select-none text-[13px] leading-none" style={{ color: '#dad7d1' }}>·</span>
                              )}
                            </div>
                          ))}
                          <div className="flex-1 min-h-[31px] bg-[#faf9f7] border-r border-[#f4f2ef] flex items-center justify-center">
                            <span className="select-none text-[13px] leading-none" style={{ color: '#dad7d1' }}>·</span>
                          </div>
                          <div className="flex-1 min-h-[31px] bg-[#faf9f7] flex items-center justify-center">
                            <span className="select-none text-[13px] leading-none" style={{ color: '#dad7d1' }}>·</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="flex gap-4 mt-3">
                  {(['Prodejna', 'Expedice', 'Backoffice'] as const).map((d) => (
                    <span key={d} className="flex items-center gap-1.5 text-[11px] text-[#5c6672]">
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: DEP[d].solid }} />{d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'attendance' && (
            <div className="bg-[#f2f0ec] flex items-center justify-center p-5 min-h-[420px] sm:min-h-[400px]">
              <div className="relative bg-white w-full max-w-[290px] px-6 pt-5 pb-5 text-center"
                style={{
                  clipPath: 'polygon(0 0, calc(100% - 34px) 0, 100% 34px, 100% 100%, 0 100%)',
                  boxShadow: '0 4px 16px rgba(17,24,32,.09)',
                }}>
                <span aria-hidden className="absolute top-0 right-0"
                  style={{ width: 34, height: 34, background: '#E8963C', clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />

                {receipt ? (
                  <div className="py-6">
                    <div className="w-[46px] h-[46px] rounded-full bg-[#e4f2e8] flex items-center justify-center mx-auto">
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#2f7d46" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 12.5 9.5 18 20 6.5" />
                      </svg>
                    </div>
                    <p className="text-[16px] font-medium mt-3.5">{receipt.person.name}</p>
                    <p className="text-[12.5px] text-[#5c6672] mt-1">
                      {receipt.arriving ? 'Příchod zaznamenán' : 'Odchod zaznamenán'} · {receipt.person.dep}
                    </p>
                    <p className="tf-mono text-[30px] font-medium mt-3">{receipt.time}</p>
                    <p className="text-[11.5px] text-[#8a929c] mt-3">
                      {receipt.arriving ? 'Hezký den. Hodiny se počítají samy.' : 'Dnes odpracováno 8,0 h. Na shledanou.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <TeamFlowMark variant="light" className="w-[24px] h-[24px] mx-auto" />
                    <p className="tf-mono text-[9.5px] tracking-[.13em] text-[#a2a8b0] mt-1.5">
                      {now ? `${DAYS_CZ[now.getDay()]} ${now.getDate()}. ${MONTHS_GEN[now.getMonth()].toUpperCase()}` : ' '}
                    </p>
                    <p className="tf-mono text-[38px] font-medium leading-none mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : '--:--'}
                    </p>
                    <p className="text-[11.5px] text-[#8a929c] mt-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2f7d46] align-middle mr-1.5" />
                      {presentCount} {presentCount === 1 ? 'člověk' : presentCount < 5 ? 'lidé' : 'lidí'} ve směně
                    </p>
                    <span className="block w-8 h-px bg-[#e5e3df] mx-auto my-3" />
                    <p className="text-[12.5px] text-[#5c6672]">Zadejte svůj PIN</p>
                    <div className="flex gap-2.5 justify-center h-4 items-center my-2.5">
                      {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
                        <span key={i} className="w-[9px] h-[9px] rounded-full"
                          style={{ background: i < pin.length ? '#111820' : '#dedbd6' }} />
                      ))}
                    </div>
                    <p className="text-[11.5px] min-h-[16px] mb-1" style={{ color: '#9c4a3f' }}>{error}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => (
                        <button key={k} onClick={() => pressKey(k)}
                          aria-label={k === 'del' ? 'Smazat' : k === 'ok' ? 'Potvrdit' : k}
                          className={`h-[40px] rounded-[8px] flex items-center justify-center transition-colors ${
                            k === 'ok'
                              ? 'bg-[#111820] hover:bg-[#2a333e] text-white'
                              : 'bg-white border border-[#e2e0dc] hover:bg-[#f4f2ef] tf-mono text-[17px] text-[#111820]'
                          }`}>
                          {k === 'del' ? (
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M21 6H8l-5 6 5 6h13a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1Z" /><path d="m12 9 6 6M18 9l-6 6" />
                            </svg>
                          ) : k === 'ok' ? (
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M5 12h14M13 6l6 6-6 6" />
                            </svg>
                          ) : k}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'overview' && (
            <div className="p-3 sm:p-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#e9e7e3]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2f7d46] animate-pulse" />
                <span className="text-[13.5px] font-semibold">Přítomnost</span>
                <span className="tf-mono text-[11.5px] text-[#2f7d46] bg-[#e4f2e8] px-2 py-0.5 rounded-full">{presentCount}</span>
                <button className="ml-auto text-[11.5px] text-[#8a929c] hover:text-[#111820] transition-colors">Obnovit</button>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mt-3.5">
                {(['Prodejna', 'Expedice', 'Backoffice'] as const).map((d) => {
                  const c = DEP[d]
                  const n = PEOPLE.filter((p) => p.dep === d && shift[p.pin]).length
                  return (
                    <div key={d} className="rounded-[9px] p-3.5 text-center border"
                      style={{ background: c.fill, borderColor: c.solid + '55' }}>
                      <Num v={n} className="tf-mono text-[22px] block" style={{ color: c.text }} />
                      <div className="text-[11px] mt-0.5" style={{ color: c.text }}>{d}</div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4">
                {PEOPLE.map((p, i) => {
                  const since = shift[p.pin]
                  const c = DEP[p.dep]
                  return (
                    <div key={p.pin} className="tf-chip-in flex items-center gap-2.5 py-2 border-b border-[#f4f2ef] last:border-0"
                      style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: since ? '#2f7d46' : '#d8d5d0' }} />
                      <span className="text-[12.5px] text-[#111820] flex-1 truncate">{p.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[3px] hidden sm:inline"
                        style={{ background: c.fill, color: c.text }}>{p.dep}</span>
                      <span className="tf-mono text-[11.5px] text-[#8a929c] w-[62px] text-right">
                        {since ? `od ${since}` : 'mimo'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-[#8a929c] mt-3">
                Naťukejte PIN v Příchodu/Odchodu a čísla se tu změní.
              </p>
            </div>
          )}

          {tab === 'vacation' && (
            <div className="p-3 sm:p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-[13.5px] font-semibold">Srpen 2026</span>
              </div>
              <div className="border border-[#e9e7e3] rounded-[7px] overflow-hidden">
                <div className="grid grid-cols-7 bg-[#faf9f7] border-b border-[#e9e7e3]">
                  {['PO', 'ÚT', 'ST', 'ČT', 'PÁ', 'SO', 'NE'].map((d) => (
                    <div key={d} className="tf-mono text-center py-1.5 text-[9.5px] text-[#8a929c]">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: 14 }).map((_, i) => {
                    const day = i + 3
                    const weekend = i % 7 >= 5
                    const vac: Record<number, { n: number; pending?: boolean }> = {
                      3: { n: 2 }, 4: { n: 1 }, 6: { n: 1, pending: true }, 12: { n: 1 },
                    }
                    const v = vac[day]
                    return (
                      <div key={i}
                        className="min-h-[52px] p-1.5 border-r border-b border-[#f4f2ef] last:border-r-0"
                        style={{ background: weekend ? '#faf9f7' : '#fff' }}>
                        <div className="flex justify-between items-start">
                          <span className="tf-mono text-[10.5px]" style={{ color: weekend ? '#8a929c' : '#111820' }}>{day}</span>
                          {v && <span className="tf-mono text-[9px] text-[#8a929c]">{v.n}×</span>}
                        </div>
                        {v && (
                          <div className="flex gap-[3px] mt-1">
                            {Array.from({ length: v.n }).map((_, k) => (
                              <span key={k} className="w-[6px] h-[6px] rounded-full"
                                style={{ background: v.pending ? '#e0b64a' : '#3f9e63' }} />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-[11px] text-[#5c6672]">
                  <span className="w-[9px] h-[9px] rounded-[2px] bg-[#cfe9d8]" />Schválena
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#5c6672]">
                  <span className="w-[9px] h-[9px] rounded-[2px] bg-[#f4e6bd]" />Čeká na schválení
                </span>
              </div>
            </div>
          )}

          {tab === 'my-hours' && (
            /* Mirrors EmployeeHoursPortal: name header, Tento/Minulý měsíc cards,
               the emerald vacation dashboard with the segmented bar. */
            <div className="p-3 sm:p-4">
              <div className="flex items-start justify-between pb-3 border-b border-[#e9e7e3]">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold truncate" style={{ color: '#111820' }}>Tereza Nováková</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8a929c' }}>Přehled odpracovaných hodin</p>
                </div>
                <span className="text-slate-400 p-1" aria-hidden>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                <div className="bg-[#f1efe9] rounded-xl p-3 border border-[#e9e7e3]">
                  <p className="text-[9px] font-medium uppercase tracking-[.1em] mb-1.5" style={{ color: '#8a929c' }}>Tento měsíc</p>
                  <p className="tf-mono text-[22px] font-semibold leading-none" style={{ color: '#111820' }}>
                    <Num v={126.5} dec={2} fixed /><span className="text-[13px] ml-1 font-normal">h</span>
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: '#5c6672' }}>16 dní</p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: '#8a929c' }}>srpen</p>
                </div>
                <div className="bg-[#fbfaf8] rounded-xl p-3 border border-[#e9e7e3]">
                  <p className="text-[9px] font-medium uppercase tracking-[.1em] mb-1.5" style={{ color: '#8a929c' }}>Minulý měsíc</p>
                  <p className="tf-mono text-[22px] font-semibold leading-none" style={{ color: '#111820' }}>
                    <Num v={168} dec={2} fixed /><span className="text-[13px] ml-1 font-normal">h</span>
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: '#5c6672' }}>21 dní</p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: '#8a929c' }}>červenec</p>
                </div>
              </div>

              <div className="mt-2.5 bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200 rounded-xl px-3 py-3">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">🏖️ Dovolená 2026</p>
                  <p className="text-[12px] font-bold text-emerald-700">88 <span className="font-medium text-emerald-600">/ 160 h zbývá</span></p>
                </div>
                <div className="h-2 w-full bg-white rounded-full overflow-hidden flex border border-emerald-100">
                  <div className="h-full bg-emerald-500" style={{ width: '32.5%' }} />
                  <div className="h-full bg-sky-400" style={{ width: '7.5%' }} />
                  <div className="h-full bg-amber-300" style={{ width: '5%' }} />
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                  {[
                    { v: 52, l: 'Vyčerpáno', num: 'text-emerald-700', dot: 'bg-emerald-500' },
                    { v: 12, l: 'Naplánováno', num: 'text-sky-600', dot: 'bg-sky-400' },
                    { v: 88, l: 'Zbývá', num: 'text-slate-700', dot: 'bg-slate-300' },
                  ].map((s, i) => (
                    <div key={s.l} className="tf-chip-in bg-white/70 rounded-lg px-2 py-1.5 text-center" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
                      <p className={`text-[14px] font-bold leading-none ${s.num}`}>
                        <Num v={s.v} /><span className="text-[9.5px] font-semibold ml-0.5">h</span>
                      </p>
                      <p className="text-[8.5px] font-semibold text-slate-500 uppercase tracking-wide mt-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${s.dot}`} />{s.l}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[9px] font-medium uppercase tracking-[.1em] mb-1" style={{ color: '#8a929c' }}>Poslední směny</p>
                {[
                  { d: '3. 8.', t: '08:02 – 16:04', h: '8.03 h' },
                  { d: '4. 8.', t: '08:58 – 16:12', h: '7.23 h' },
                  { d: '6. 8.', t: '12:01 – 20:06', h: '8.08 h' },
                ].map((r) => (
                  <div key={r.d} className="flex items-center py-1.5 border-b border-[#f4f2ef] last:border-0">
                    <span className="tf-mono text-[10.5px] w-[44px]" style={{ color: '#8a929c' }}>{r.d}</span>
                    <span className="tf-mono text-[11.5px] flex-1" style={{ color: '#111820' }}>{r.t}</span>
                    <span className="tf-mono text-[11px]" style={{ color: '#5c6672' }}>{r.h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
        </div>
      </div>
    </div>
  )
}
