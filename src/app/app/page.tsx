'use client'

import { useEffect, useState } from 'react'
import WorkPlanGrid from '@/components/WorkPlanGrid'
import GoogleSheetsGrid from '@/components/GoogleSheetsGrid'
import AttendanceKiosk from '@/components/AttendanceKiosk'
import PresenceDashboard from '@/components/PresenceDashboard'
import EmployeeHoursPortal from '@/components/EmployeeHoursPortal'
import ManagerLoginModal from '@/components/ManagerLoginModal'
import ManagerPanel from '@/components/ManagerPanel'
import { getManagerScope, type ManagerScope } from '@/lib/managerFetch'
import VacationPlanner from '@/components/VacationPlanner'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import ShiftAssistantPlanner from '@/components/ShiftAssistantPlanner'
import { getTheme, DEFAULT_THEME, type Theme } from '@/lib/themes'
import TabIcon from '@/components/TabIcons'
import { useLang, useT } from '@/lib/i18n'
import AppTour from '@/components/AppTour'
import TourSelectModal from '@/components/TourSelectModal'
import SubscriptionGate from '@/components/SubscriptionGate'
import LayoutEditor, { type LayoutConfig, type HideableElement, mergeLayout, DEFAULT_LAYOUT } from '@/components/LayoutEditor'
import { managerFetch } from '@/lib/managerFetch'

type Tab = 'schedule' | 'attendance' | 'overview' | 'my-hours' | 'vacation' | 'analytics' | 'management' | 'assistant'

const BASE_TABS: { id: Tab; labelCs: string; labelEn: string; icon: string }[] = [
  { id: 'attendance', labelCs: 'Příchod/Odchod', labelEn: 'Clock In/Out', icon: '⏰' },
  { id: 'overview', labelCs: 'Přehled', labelEn: 'Overview', icon: '📊' },
  { id: 'schedule', labelCs: 'Směny', labelEn: 'Shifts', icon: '📅' },
  { id: 'vacation', labelCs: 'Dovolená', labelEn: 'Vacation', icon: '🏖️' },
  { id: 'my-hours', labelCs: 'Zaměstnanec', labelEn: 'Employee', icon: '👤' },
]

const MANAGER_TABS: { id: Tab; labelCs: string; labelEn: string; icon: string }[] = [
  { id: 'analytics', labelCs: 'Analytika', labelEn: 'Analytics', icon: '📈' },
  { id: 'assistant', labelCs: 'Asistent', labelEn: 'Assistant', icon: '🤖' },
  { id: 'management', labelCs: 'Správa', labelEn: 'Management', icon: '⚙️' },
]

const MANAGER_SESSION_KEY = 'hris_manager_session'
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000 // 12 hours

// Decodes the payload of a signed v3 token ("base64(payload).signature").
// Unsigned legacy tokens are treated as expired — the server rejects them anyway.
function decodeTokenPayload(raw: string): string | null {
  const dotIdx = raw.lastIndexOf('.')
  if (dotIdx < 0) return null
  return atob(raw.slice(0, dotIdx))
}

function isManagerSessionValid(): boolean {
  try {
    const raw = localStorage.getItem(MANAGER_SESSION_KEY)
    if (!raw) return false
    const decoded = decodeTokenPayload(raw)
    if (!decoded || !decoded.includes('|')) return false
    // payload: orgId|employeeId|role|departments|permissions|timestamp
    const parts = decoded.split('|')
    if (parts.length < 6) return false
    const ts = parseInt(parts[5], 10)
    if (isNaN(ts)) return false
    return new Date().getTime() - ts < SESSION_DURATION_MS
  } catch {
    return false
  }
}

export default function HomePage() {
  const { lang, setLang } = useLang()
  const t = useT()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string>('')
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<Tab>('schedule')
  const [isManagerMode, setIsManagerMode] = useState(false)
  const [managerScope, setManagerScope] = useState<ManagerScope | null>(null)
  const [showManagerLogin, setShowManagerLogin] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [showManagerPanel, setShowManagerPanel] = useState(false)
  const [managerPanelTab, setManagerPanelTab] = useState<'notifications' | undefined>(undefined)
  const [showTourSelect, setShowTourSelect] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [tourLang, setTourLang] = useState<'cs' | 'en'>('cs')
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [shiftViewMode, setShiftViewMode] = useState<'teamflow' | 'googlesheets'>('teamflow')
  const [layout, setLayout] = useState<LayoutConfig>(DEFAULT_LAYOUT)
  const [showLayoutEditor, setShowLayoutEditor] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('tf_sidebar_collapsed') === '1' } catch { return false }
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const toggleSidebar = () => setSidebarCollapsed(v => {
    const next = !v
    try { localStorage.setItem('tf_sidebar_collapsed', next ? '1' : '0') } catch { /* ignore */ }
    return next
  })
  // Shifts context published by GoogleSheetsGrid — PIN session + category legend
  // with people counts, shown in the dark sidebar rail.
  const [shiftsCtx, setShiftsCtx] = useState<{
    session: { name: string; department: string | null; workedMonth: number; hoursMonth: number } | null
    categories: { name: string; count: number; color: string }[]
  }>({ session: null, categories: [] })
  // Vacation dashboard published by VacationPlanner — used/planned/remaining hours
  const [vacationCtx, setVacationCtx] = useState<{ scope: 'org' | 'me'; hasPaidVacation?: boolean; usedHours: number; plannedHours: number; remainingHours: number } | null>(null)

  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })

  // Live theme change from settings panel
  useEffect(() => {
    const handler = (e: Event) => setTheme(getTheme((e as CustomEvent).detail))
    window.addEventListener('tf:theme-change', handler)
    return () => window.removeEventListener('tf:theme-change', handler)
  }, [])

  // Live shift view mode change from settings panel
  useEffect(() => {
    const handler = (e: Event) => setShiftViewMode((e as CustomEvent).detail as 'teamflow' | 'googlesheets')
    window.addEventListener('tf:shift-view-change', handler)
    return () => window.removeEventListener('tf:shift-view-change', handler)
  }, [])

  // Shifts context (PIN session + category legend) from the shifts grid
  useEffect(() => {
    const handler = (e: Event) => setShiftsCtx((e as CustomEvent).detail)
    window.addEventListener('tf:shifts-context', handler)
    return () => window.removeEventListener('tf:shifts-context', handler)
  }, [])

  // Vacation dashboard context from VacationPlanner
  useEffect(() => {
    const handler = (e: Event) => setVacationCtx((e as CustomEvent).detail)
    window.addEventListener('tf:vacation-context', handler)
    return () => window.removeEventListener('tf:vacation-context', handler)
  }, [])

  // Manager token expired mid-session (fired by managerFetch on 401) →
  // drop manager mode and reopen the login so actions stop silently failing.
  useEffect(() => {
    const handler = () => {
      setIsManagerMode(false)
      setManagerScope(null)
      setSessionExpired(true)
      setShowManagerLogin(true)
    }
    window.addEventListener('tf:manager-session-expired', handler)
    return () => window.removeEventListener('tf:manager-session-expired', handler)
  }, [])

  // Check subscription status — drives tour gate and paywall
  useEffect(() => {
    function checkSubscription() {
      setSubscriptionStatus(null) // reset to trigger loading block
      fetch('/api/subscription')
        .then(r => r.json())
        .then((d: { status: string }) => {
          setSubscriptionStatus(d.status)
          if (d.status === 'trial') {
            setShowTourSelect(true)
          }
        })
        .catch(() => setSubscriptionStatus('active'))
    }

    checkSubscription()

    // bfcache restore (browser back button) — re-check without trusting cached state
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) checkSubscription()
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  // Load org + manager session on mount
  useEffect(() => {
    fetchOrg(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchOrg(showLoadingSpinner: boolean) {
    if (showLoadingSpinner) setLoading(true)
    try {
      // Try authenticated endpoint first; fall back to public (unauthenticated kiosk devices)
      let res = await fetch('/api/me/org')
      if (!res.ok) {
        // Try ?org= URL param, then localStorage (set when manager logged in)
        const slug =
          new URLSearchParams(window.location.search).get('org') ??
          (() => { try { return localStorage.getItem('hris_org_slug') } catch { return null } })()
        if (!slug) {
          // Device was never set up by a manager → send to login
          window.location.href = '/login'
          return
        }
        res = await fetch(`/api/public/org?slug=${encodeURIComponent(slug)}`)
      }
      if (!res.ok) {
        setError('Systém není nastaven. Kontaktujte správce.')
        return
      }
      const data = (await res.json()) as { id: string; name: string; slug?: string }
      // Remember which org this device belongs to (set by manager login)
      if (data.slug) {
        try { localStorage.setItem('hris_org_slug', data.slug) } catch { /* ignore */ }
      }
      setOrgId(data.id)
      setOrgName(data.name)

      // Validate manager session belongs to this org, clear if not
      const managerValid = isManagerSessionValid()
      if (managerValid) {
        try {
          const raw = localStorage.getItem(MANAGER_SESSION_KEY)
          const decoded = decodeTokenPayload(raw!) ?? ''
          const tokenOrgId = decoded.split('|')[0]
          if (tokenOrgId !== data.id) {
            localStorage.removeItem(MANAGER_SESSION_KEY)
            setIsManagerMode(false)
            setManagerScope(null)
          } else {
            setIsManagerMode(true)
            setManagerScope(getManagerScope())
          }
        } catch {
          localStorage.removeItem(MANAGER_SESSION_KEY)
          setIsManagerMode(false)
          setManagerScope(null)
        }
      } else {
        setIsManagerMode(false)
        setManagerScope(null)
      }
      // Load org logo
      fetch(`/api/public/org-logo?orgId=${data.id}`)
        .then(r => r.json())
        .then((d: { logoUrl: string | null }) => setOrgLogoUrl(d.logoUrl ?? null))
        .catch(() => {})
      // Load theme + shift view mode + layout
      fetch(`/api/public/company-settings?orgId=${data.id}`)
        .then(r => r.json())
        .then((d: Record<string, unknown>) => {
          if (d.ui_theme) setTheme(getTheme(d.ui_theme as string))
          if (d.shift_view_mode === 'googlesheets' || d.shift_view_mode === 'teamflow') {
            setShiftViewMode(d.shift_view_mode as 'teamflow' | 'googlesheets')
          }
          if (d.ui_layout) {
            try {
              const parsed = typeof d.ui_layout === 'string' ? JSON.parse(d.ui_layout) : d.ui_layout
              setLayout(mergeLayout(parsed))
            } catch { /* ignore bad JSON */ }
          }
          // Apply custom favicon if set, otherwise fall back to default TeamFlow favicon
          const faviconUrl = (d.favicon_url as string) || '/favicon.svg'
          let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
          if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            document.head.appendChild(link)
          }
          link.href = faviconUrl
        })
        .catch(() => {})
    } catch {
      if (showLoadingSpinner) {
        setError('Nepodařilo se načíst konfiguraci systému.')
      }
    } finally {
      if (showLoadingSpinner) setLoading(false)
    }
  }

  function handleManagerSuccess() {
    setIsManagerMode(true)
    setManagerScope(getManagerScope())
    setShowManagerLogin(false)
    // Re-login after an expiry: stay where the user was working, don't jump to Management
    if (sessionExpired) {
      setSessionExpired(false)
      // Let components (e.g. the shift grid) auto-retry the action that was blocked
      window.dispatchEvent(new CustomEvent('tf:manager-relogged-in'))
    } else {
      setActiveTab('management')
    }
  }

  async function handleSaveLayout(newLayout: LayoutConfig) {
    setLayout(newLayout)
    setShowLayoutEditor(false)
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        body: JSON.stringify({ ui_layout: JSON.stringify(newLayout) }),
      })
    } catch { /* layout already applied locally, server error is non-critical */ }
  }

  function handleManagerLogout() {
    localStorage.removeItem(MANAGER_SESSION_KEY)
    setIsManagerMode(false)
    setManagerScope(null)
    if (activeTab === 'management' || activeTab === 'analytics' || activeTab === 'assistant') {
      setActiveTab('schedule')
    }
  }

  // Block ALL render until subscription status is confirmed — prevents back-button bypass
  if (subscriptionStatus === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Paywall — pending or expired subscription
  if (subscriptionStatus === 'pending' || subscriptionStatus === 'expired') {
    return <SubscriptionGate status={subscriptionStatus} orgName={orgName} />
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">{t('Načítání systému...', 'Loading...')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !orgId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-gray-700 font-medium">
            {error ?? t('Systém není nastaven. Kontaktujte správce.', 'System not configured. Contact your administrator.')}
          </p>
        </div>
      </div>
    )
  }

  const visibleTabs = layout.tabs
    .filter(lt => lt.visible)
    .map(lt => [...BASE_TABS, ...MANAGER_TABS].find(t => t.id === lt.id))
    .filter((t): t is typeof BASE_TABS[0] => t !== undefined)
    .filter(t => !MANAGER_TABS.some(mt => mt.id === t.id) || isManagerMode)

  // Sidebar palette — dark for ink/graphite, light for the paper theme
  const darkSide = theme.key !== 'paper'
  const sideBg = theme.key === 'graphite' ? 'bg-[#262b31]' : theme.key === 'paper' ? 'bg-white' : 'bg-[#111820]'
  const sideBorder = darkSide ? 'border-black/30' : 'border-[#e2e0dc]'
  const sideFootBorder = darkSide ? 'border-[#1e2833]' : 'border-[#eceae6]'
  const itemActiveCls = darkSide ? 'bg-[#2c3b4a] text-white' : 'bg-[#f1efe9] text-[#111820]'
  const itemInactiveCls = darkSide ? 'text-[#c6cfd8] hover:text-white hover:bg-white/[0.06]' : 'text-[#5c6672] hover:text-[#111820] hover:bg-black/[0.04]'
  const logoSquareCls = darkSide ? 'bg-white' : 'bg-[#111820]'
  const chromeBorderCls = darkSide ? 'border-[#2b3742]' : 'border-[#e2e0dc]'
  const activeRuleColor = darkSide ? '#ffffff' : '#111820'
  const sideTextCls = darkSide ? 'text-white' : 'text-[#111820]'

  const renderNavItems = (collapsed: boolean, onNavigate?: () => void) => (
    <div className={collapsed ? 'flex flex-col items-center gap-1' : 'flex flex-col gap-0.5 px-2'}>
      {visibleTabs.map((tab) => {
        const active = activeTab === tab.id
        const label = lang === 'en' ? tab.labelEn : tab.labelCs
        return (
          <button
            key={tab.id}
            data-tour={`tab-${tab.id}`}
            onClick={() => { setActiveTab(tab.id); onNavigate?.() }}
            title={collapsed ? label : undefined}
            style={active ? { boxShadow: `inset 2px 0 0 ${activeRuleColor}` } : undefined}
            className={collapsed
              ? `w-[38px] h-[38px] rounded-[9px] flex items-center justify-center transition-colors ${active ? itemActiveCls : itemInactiveCls}`
              : `flex items-center gap-3 px-3 py-[11px] rounded-[8px] text-[14.5px] transition-colors ${active ? `font-medium ${itemActiveCls}` : `font-normal ${itemInactiveCls}`}`}
          >
            <TabIcon id={tab.id} className={collapsed ? 'w-[20px] h-[20px]' : 'w-[20px] h-[20px]'} />
            {!collapsed && <span className="truncate">{label}</span>}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="tf-sans h-dvh flex overflow-hidden bg-[#fbfaf8]">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col shrink-0 border-r ${sideBorder} ${sideBg} ${theme.navText} transition-[width] duration-200 ${sidebarCollapsed ? 'w-[60px]' : 'w-[240px]'}`}>
        {sidebarCollapsed ? (
          <>
            <div className={`w-[22px] h-[22px] rounded-[6px] ${logoSquareCls} mx-auto mt-3.5 mb-1.5`} />
            <button onClick={toggleSidebar} title={t('Rozbalit', 'Expand')} className={`w-[38px] h-[26px] mx-auto mb-3 flex items-center justify-center rounded-[7px] border ${chromeBorderCls} ${darkSide ? 'text-[#c6cfd8] hover:text-white' : 'text-[#5c6672] hover:text-[#111820]'} text-xs`}>»</button>
          </>
        ) : (
          <div className="flex items-center gap-2.5 pl-4 pr-3 pt-3.5 pb-4">
            <span className={`w-[20px] h-[20px] rounded-[6px] shrink-0 ${logoSquareCls}`} />
            <span className="text-[15px] font-semibold tracking-tight">TeamFlow</span>
            <button onClick={toggleSidebar} title={t('Sbalit', 'Collapse')} className={`ml-auto w-6 h-6 flex items-center justify-center rounded-[6px] border ${chromeBorderCls} ${darkSide ? 'text-[#c6cfd8] hover:text-white' : 'text-[#5c6672] hover:text-[#111820]'} text-xs`}>«</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-none py-0.5">
          {renderNavItems(sidebarCollapsed)}
        </div>

        {/* Shifts context — PIN session + category legend (Směny tab, expanded) */}
        {!sidebarCollapsed && activeTab === 'schedule' && (shiftsCtx.session || shiftsCtx.categories.length > 0) && (
          <div className={`px-3 pb-1 pt-1 border-t ${sideFootBorder}`}>
            {shiftsCtx.session && (
              <div className={`relative rounded-[10px] px-3 py-3 mt-2.5 ${darkSide ? 'bg-white/[0.05]' : 'bg-black/[0.03]'}`}>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('tf:shifts-pin-logout'))}
                  title={t('Odhlásit ze směn', 'Log out of shifts')}
                  className={`absolute top-2 right-2 text-xs ${darkSide ? 'text-[#8e9aa6] hover:text-white' : 'text-[#8a929c] hover:text-[#111820]'}`}
                >✕</button>
                <div className="flex items-center gap-2.5">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${darkSide ? 'bg-[#26313d] text-[#dfe5ea]' : 'bg-[#e9e7e3] text-[#5c6672]'}`}>
                    {shiftsCtx.session.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-[13px] font-medium leading-tight truncate ${sideTextCls}`}>{shiftsCtx.session.name}</div>
                    {shiftsCtx.session.department && (
                      <div className={`text-[11.5px] leading-tight truncate ${darkSide ? 'text-[#8e9aa6]' : 'text-[#5c6672]'}`}>{shiftsCtx.session.department}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-5 mt-3">
                  <div>
                    <div className={`tf-mono text-[19px] font-semibold leading-none ${sideTextCls}`}>{shiftsCtx.session.workedMonth} <span className="text-[12px] font-normal">h</span></div>
                    <div className={`text-[10.5px] mt-1 ${darkSide ? 'text-[#8e9aa6]' : 'text-[#5c6672]'}`}>{t('odpracováno', 'worked')}</div>
                  </div>
                  <div>
                    <div className={`tf-mono text-[19px] font-semibold leading-none ${sideTextCls}`}>{shiftsCtx.session.hoursMonth} <span className="text-[12px] font-normal">h</span></div>
                    <div className={`text-[10.5px] mt-1 ${darkSide ? 'text-[#8e9aa6]' : 'text-[#5c6672]'}`}>{t('naplánováno', 'planned')}</div>
                  </div>
                </div>
              </div>
            )}

            {shiftsCtx.categories.length > 0 && (
              <div className="mt-3">
                <div className={`text-[10px] font-normal uppercase tracking-[.12em] mb-1.5 ${darkSide ? 'text-[#7e8b98]' : 'text-[#8a929c]'}`}>{t('Kategorie', 'Categories')}</div>
                <div className="flex flex-col gap-1">
                  {shiftsCtx.categories.map((c) => (
                    <div key={c.name} className="flex items-center gap-2.5 py-0.5">
                      <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: c.color }} />
                      <span className={`text-[12.5px] truncate ${sideTextCls}`}>{c.name}</span>
                      <span className={`ml-auto tf-mono text-[12px] ${darkSide ? 'text-[#8e9aa6]' : 'text-[#8a929c]'}`}>{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vacation dashboard — used / planned / remaining (Dovolená tab, expanded) */}
        {!sidebarCollapsed && activeTab === 'vacation' && vacationCtx && (
          <div className={`px-3 pb-1 pt-1 border-t ${sideFootBorder}`}>
            <div className={`text-[10px] font-normal uppercase tracking-[.12em] mt-2.5 mb-2 ${darkSide ? 'text-[#7e8b98]' : 'text-[#8a929c]'}`}>
              {vacationCtx.scope === 'me' ? t('Moje dovolená', 'My vacation') : t('Dovolená týmu', 'Team vacation')}
            </div>
            {(() => {
              const showRemaining = vacationCtx.scope === 'org' || vacationCtx.hasPaidVacation !== false
              const total = Math.max(1, vacationCtx.usedHours + vacationCtx.plannedHours + (showRemaining ? vacationCtx.remainingHours : 0))
              const seg = (h: number) => `${(h / total) * 100}%`
              const rows: { label: string; hours: number; dot: string }[] = [
                { label: t('Vyčerpáno', 'Used'), hours: vacationCtx.usedHours, dot: '#c25b52' },
                { label: t('Naplánováno', 'Planned'), hours: vacationCtx.plannedHours, dot: '#c99a3a' },
                ...(showRemaining ? [{ label: t('Zbývá', 'Remaining'), hours: vacationCtx.remainingHours, dot: '#3f9e6a' }] : []),
              ]
              return (
                <>
                  <div className="flex h-2 rounded-full overflow-hidden mb-3" style={{ background: darkSide ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                    <div style={{ width: seg(vacationCtx.usedHours), background: '#c25b52' }} />
                    <div style={{ width: seg(vacationCtx.plannedHours), background: '#c99a3a' }} />
                    {showRemaining && <div style={{ width: seg(vacationCtx.remainingHours), background: '#3f9e6a' }} />}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {rows.map((r) => (
                      <div key={r.label} className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: r.dot }} />
                        <span className={`text-[12.5px] ${sideTextCls}`}>{r.label}</span>
                        <span className={`ml-auto tf-mono text-[12.5px] font-medium ${sideTextCls}`}>{r.hours} h</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* Footer — manager status + language */}
        <div className={`mt-auto border-t ${sideFootBorder} ${sidebarCollapsed ? 'pt-3 flex flex-col items-center gap-2.5 pb-1' : 'px-4 pt-3.5 pb-1'}`}>
          {sidebarCollapsed ? (
            <>
              {isManagerMode ? (
                <button onClick={handleManagerLogout} title={t('Odhlásit', 'Log out')} className="w-[26px] h-[26px] rounded-full bg-[#26313d] text-[#dfe5ea] flex items-center justify-center text-[10.5px]">
                  {managerScope?.role === 'admin' ? 'AD' : 'MG'}
                </button>
              ) : (
                <button onClick={() => setShowManagerLogin(true)} title={t('Manažer', 'Manager')} className={`w-[38px] h-[34px] rounded-[9px] flex items-center justify-center ${itemInactiveCls}`}>
                  <TabIcon id="management" className="w-[18px] h-[18px]" />
                </button>
              )}
              <button onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')} className={`text-[10px] ${darkSide ? 'text-[#c6cfd8] hover:text-white' : 'text-[#5c6672] hover:text-[#111820]'}`}>
                {lang === 'cs' ? 'CZ' : 'EN'}
              </button>
            </>
          ) : (
            <>
              {isManagerMode ? (
                <div className="flex items-center gap-2.5">
                  <span className="w-[26px] h-[26px] rounded-full bg-[#26313d] text-[#dfe5ea] flex items-center justify-center text-[10.5px] shrink-0">
                    {managerScope?.role === 'admin' ? 'AD' : 'MG'}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-[11.5px] font-medium leading-tight truncate ${sideTextCls}`}>{managerScope?.role === 'admin' ? t('Administrátor', 'Administrator') : t('Manažer', 'Manager')}</div>
                    <div className="flex items-center gap-1 leading-tight">
                      <span className={`w-1.5 h-1.5 rounded-full ${darkSide ? 'bg-emerald-400' : 'bg-emerald-600'}`} />
                      <span className={`text-[10.5px] ${darkSide ? 'text-[#c6cfd8]' : 'text-[#5c6672]'}`}>{t('Manažer', 'Manager')}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button data-tour="btn-manager" onClick={() => setShowManagerLogin(true)} className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-[7px] text-[12.5px] ${itemInactiveCls}`}>
                  <TabIcon id="management" className="w-[17px] h-[17px]" />
                  {t('Přihlásit jako manažer', 'Manager login')}
                </button>
              )}

              {isManagerMode && (
                <div className="flex items-center gap-2 mt-2.5">
                  {managerScope?.isAdmin !== false && (
                    <button onClick={() => setShowLayoutEditor(true)} title={t('Upravit rozhraní', 'Edit layout')} className={`flex-1 px-2 py-1 rounded-[5px] text-[11.5px] border text-center whitespace-nowrap ${chromeBorderCls} ${darkSide ? 'text-[#c6cfd8] hover:text-white' : 'text-[#5c6672] hover:text-[#111820]'}`}>
                      {t('Upravit', 'Edit')}
                    </button>
                  )}
                  <button onClick={handleManagerLogout} className={`flex-1 px-2 py-1 rounded-[5px] text-[11.5px] border text-center whitespace-nowrap ${chromeBorderCls} ${darkSide ? 'text-[#c6cfd8] hover:text-white' : 'text-[#5c6672] hover:text-[#111820]'}`}>
                    {t('Odhlásit', 'Log out')}
                  </button>
                </div>
              )}
              <div className="flex items-center mt-2.5 mb-1.5">
                <div className={`flex items-center rounded-[6px] overflow-hidden border ${chromeBorderCls} text-[10.5px]`}>
                  <button onClick={() => setLang('cs')} className={`px-2.5 py-[3px] ${lang === 'cs' ? (darkSide ? 'bg-[#26313d] text-white' : 'bg-[#111820] text-white') : (darkSide ? 'text-[#c6cfd8]' : 'text-[#5c6672]')}`}>CZ</button>
                  <button onClick={() => setLang('en')} className={`px-2.5 py-[3px] ${lang === 'en' ? (darkSide ? 'bg-[#26313d] text-white' : 'bg-[#111820] text-white') : (darkSide ? 'text-[#c6cfd8]' : 'text-[#5c6672]')}`}>EN</button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <aside className={`relative w-[240px] max-w-[82%] flex flex-col border-r ${sideBorder} ${sideBg} ${theme.navText}`}>
            <div className="flex items-center gap-2.5 pl-4 pr-3 pt-3.5 pb-4">
              <span className={`w-[20px] h-[20px] rounded-[6px] shrink-0 ${logoSquareCls}`} />
              <span className="text-[15px] font-semibold tracking-tight">TeamFlow</span>
              <button onClick={() => setMobileNavOpen(false)} className={`ml-auto w-6 h-6 flex items-center justify-center rounded-[6px] border ${chromeBorderCls} ${darkSide ? 'text-[#c6cfd8]' : 'text-[#5c6672]'} text-xs`}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-none py-0.5">
              {renderNavItems(false, () => setMobileNavOpen(false))}
            </div>
            <div className={`mt-auto border-t ${sideFootBorder} px-4 pt-3.5 pb-3 flex items-center gap-2`}>
              {isManagerMode ? (
                <button onClick={() => { handleManagerLogout(); setMobileNavOpen(false) }} className={`px-2 py-1 rounded-[5px] text-[11.5px] border ${chromeBorderCls} ${darkSide ? 'text-[#c6cfd8]' : 'text-[#5c6672]'}`}>{t('Odhlásit', 'Log out')}</button>
              ) : (
                <button onClick={() => { setShowManagerLogin(true); setMobileNavOpen(false) }} className={`px-2 py-1 rounded-[5px] text-[11.5px] border ${chromeBorderCls} ${darkSide ? 'text-[#c6cfd8]' : 'text-[#5c6672]'}`}>{t('Manažer', 'Manager')}</button>
              )}
              <div className={`ml-auto flex items-center rounded-[6px] overflow-hidden border ${chromeBorderCls} text-[10.5px]`}>
                <button onClick={() => setLang('cs')} className={`px-2 py-[3px] ${lang === 'cs' ? (darkSide ? 'bg-[#26313d] text-white' : 'bg-[#111820] text-white') : (darkSide ? 'text-[#c6cfd8]' : 'text-[#5c6672]')}`}>CZ</button>
                <button onClick={() => setLang('en')} className={`px-2 py-[3px] ${lang === 'en' ? (darkSide ? 'bg-[#26313d] text-white' : 'bg-[#111820] text-white') : (darkSide ? 'text-[#c6cfd8]' : 'text-[#5c6672]')}`}>EN</button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className={`md:hidden flex items-center gap-3 px-4 h-12 border-b ${sideBorder} ${sideBg} ${theme.navText} shrink-0`}>
          <button onClick={() => setMobileNavOpen(true)} className={`w-8 h-8 -ml-1 flex items-center justify-center rounded-[7px] ${itemInactiveCls}`} aria-label={t('Menu', 'Menu')}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-[18px] h-[18px] rounded-[5px] shrink-0 ${logoSquareCls}`} />
            <span className="text-[15px] font-semibold tracking-tight truncate">TeamFlow</span>
          </div>
        </div>

        {/* Content — kiosk tabs fill height, others scroll */}
        <main className="flex-1 overflow-hidden bg-[#fbfaf8] flex flex-col">
        {/* Kiosk tabs: fill remaining height, no outer scroll */}
        {activeTab === 'attendance' && (
          <AttendanceKiosk orgId={orgId} />
        )}

        {activeTab === 'my-hours' && (
          <EmployeeHoursPortal
            orgId={orgId}
            onClose={() => setActiveTab('schedule')}
          />
        )}

        {/* Scrollable tabs */}
        {activeTab === 'schedule' && (
          <div className="flex-1 overflow-auto">
            {shiftViewMode === 'googlesheets' ? (
              <GoogleSheetsGrid
                orgId={orgId}
                month={currentMonth}
                isManagerMode={isManagerMode}
                onMonthChange={(m: string) => setCurrentMonth(m)}
                hiddenElements={layout.hiddenElements}
              />
            ) : (
              <WorkPlanGrid
                orgId={orgId}
                month={currentMonth}
                isManagerMode={isManagerMode}
                onMonthChange={(month: string) => setCurrentMonth(month)}
              />
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="flex-1 overflow-auto">
            <PresenceDashboard orgId={orgId} isManagerMode={isManagerMode} />
          </div>
        )}

        {activeTab === 'vacation' && (
          <div className="flex-1 overflow-auto">
            <VacationPlanner orgId={orgId} isManagerMode={isManagerMode} />
          </div>
        )}

        {activeTab === 'analytics' && isManagerMode && (
          <div className="flex-1 overflow-auto">
            <AnalyticsDashboard orgId={orgId} isAdmin={managerScope?.isAdmin !== false} />
          </div>
        )}

        {activeTab === 'assistant' && isManagerMode && (
          <div className="flex-1 overflow-auto">
            {managerScope && !managerScope.isAdmin && !managerScope.permissions.includes('shift_assistant') ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                <div className="text-5xl">🔒</div>
                <h3 className="text-xl font-semibold text-slate-700">{t('Přístup zamítnut', 'Access denied')}</h3>
                <p className="text-slate-400 max-w-xs text-sm">
                  {t('Pro přístup k Asistentovi směn potřebujete oprávnění shift_assistant. Kontaktujte administrátora.', 'You need the shift_assistant permission to access this feature. Contact your administrator.')}
                </p>
              </div>
            ) : (
              <ShiftAssistantPlanner
                orgId={orgId}
                month={currentMonth}
                onMonthChange={(m) => setCurrentMonth(m)}
                onOpenNotifications={() => {
                  setManagerPanelTab('notifications');
                  setShowManagerPanel(true);
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'management' && isManagerMode && (
          <ManagerPanel orgId={orgId} onClose={() => setActiveTab('schedule')} initialTab={managerPanelTab} scope={managerScope} />
        )}
        </main>
      </div>

      {/* Manager Login Modal */}
      {showManagerLogin && orgId && (
        <ManagerLoginModal
          orgId={orgId}
          onSuccess={handleManagerSuccess}
          onClose={() => { setShowManagerLogin(false); setSessionExpired(false); }}
          expired={sessionExpired}
        />
      )}

      {/* Tour select modal — shown on first visit */}
      {showTourSelect && (
        <TourSelectModal
          onStart={(l) => { setTourLang(l); setShowTourSelect(false); setShowTour(true); }}
          onSkip={() => setShowTourSelect(false)}
          canClose={subscriptionStatus === 'active'}
          onClose={() => setShowTourSelect(false)}
        />
      )}

      {/* App tour overlay */}
      {showTour && (
        <AppTour
          lang={tourLang}
          onClose={() => setShowTour(false)}
          canClose={subscriptionStatus === 'active'}
          paid={subscriptionStatus !== 'pending' && subscriptionStatus !== 'expired'}
          onSwitchTab={(tab) => setActiveTab(tab as Tab)}
        />
      )}

      {/* Layout editor drawer */}
      {showLayoutEditor && (
        <LayoutEditor
          layout={layout}
          onSave={handleSaveLayout}
          onClose={() => setShowLayoutEditor(false)}
        />
      )}

      {/* ? help button — fixed bottom right */}
      {!showTour && !showTourSelect && (
        <div className="fixed bottom-6 right-6 z-50 group">
          <button
            onClick={() => setShowTourSelect(true)}
            className="w-11 h-11 rounded-full bg-white border-2 border-slate-200 shadow-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:shadow-blue-100 transition-all duration-200 font-bold text-lg"
            aria-label="Spustit průvodce"
          >
            ?
          </button>
          {/* Tooltip on hover */}
          <div className="absolute bottom-14 right-0 bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
            {t('Spustit průvodce', 'Start tour')}
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800" />
          </div>
        </div>
      )}
    </div>
  )
}
