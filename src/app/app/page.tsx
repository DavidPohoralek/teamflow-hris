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

  return (
    <div className="tf-sans h-dvh flex flex-col bg-[#fbfaf8] overflow-hidden">
      {/* Navbar — full-width bar, colour driven by theme */}
      <nav className={`${theme.navBg} ${theme.navText} border-b ${theme.navBorder} z-10 shrink-0`}>
        {/* Desktop row — 56px */}
        <div className="hidden md:flex px-4 h-[56px] items-center gap-3">
          {/* TeamFlow logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className={`w-[24px] h-[24px] rounded-[7px] inline-block ${theme.key === 'paper' ? 'bg-[#111820]' : 'bg-white'}`} />
            <span className="text-[15px] font-semibold tracking-tight">TeamFlow</span>
          </div>
          <div className={`h-5 w-px ${theme.divider}`} />
          {orgLogoUrl
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={orgLogoUrl} alt={orgName} className="h-7 w-auto max-w-[130px] object-contain" />
            : <span className="text-[12.5px] font-medium opacity-70">{orgName}</span>
          }
          <div className="flex-1 flex items-center gap-0.5 min-w-0 overflow-x-auto scrollbar-none">
              {layout.tabs
                .filter(lt => lt.visible)
                .map(lt => [...BASE_TABS, ...MANAGER_TABS].find(t => t.id === lt.id))
                .filter((t): t is typeof BASE_TABS[0] => t !== undefined)
                .filter(t => !MANAGER_TABS.some(mt => mt.id === t.id) || isManagerMode)
                .map((tab) => (
                <button
                  key={tab.id}
                  data-tour={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-2 rounded-lg text-[13px] transition-colors duration-150 whitespace-nowrap flex items-center gap-1.5
                    ${activeTab === tab.id
                      ? `font-medium ${theme.tabActive ?? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'}`
                      : `font-normal ${theme.tabInactive}`
                    }`}
                >
                  <TabIcon id={tab.id} className="w-4 h-4" />
                  {lang === 'en' ? tab.labelEn : tab.labelCs}
                </button>
              ))}
          </div>
          <div className="shrink-0">
            {isManagerMode ? (
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1.5 px-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${theme.managerLiveText === 'text-emerald-600' ? 'bg-emerald-600' : 'bg-emerald-400'}`} />
                  <span className={`${theme.managerLiveText ?? 'text-emerald-400'} text-[12.5px] font-medium`}>{t('Manažer', 'Manager')}</span>
                </div>
                {managerScope?.isAdmin !== false && (
                  <button
                    onClick={() => setShowLayoutEditor(true)}
                    className={`px-2 py-[7px] rounded-md text-[12.5px] transition-colors ${theme.logoutBtnClass}`}
                    title={t('Upravit rozhraní', 'Edit layout')}
                  >
                    {t('Upravit', 'Edit')}
                  </button>
                )}
                <button onClick={handleManagerLogout} className={`px-2 py-[7px] rounded-md text-[12.5px] transition-colors ${theme.logoutBtnClass}`}>
                  {t('Odhlásit', 'Log out')}
                </button>
              </div>
            ) : (
              <button data-tour="btn-manager" onClick={() => setShowManagerLogin(true)} className={`px-3 py-[7px] rounded-md text-[12.5px] transition-colors duration-150 ${theme.managerBtnClass}`}>
                {t('Manažer', 'Manager')}
              </button>
            )}
          </div>
          {/* Language switch — CZ | EN segmented pair */}
          <div className={`shrink-0 flex items-center rounded-md overflow-hidden border ${theme.chromeBorder ?? 'border-white/15'} p-0.5 gap-0.5`}>
            <button
              onClick={() => setLang('cs')}
              className={`px-2.5 py-[5px] rounded-[4px] text-[11.5px] font-medium transition-colors ${lang === 'cs' ? (theme.tabActive ?? 'bg-white text-[#111820]') : theme.tabInactive}`}
            >CZ</button>
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-[5px] rounded-[4px] text-[11.5px] font-medium transition-colors ${lang === 'en' ? (theme.tabActive ?? 'bg-white text-[#111820]') : theme.tabInactive}`}
            >EN</button>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden">
          {/* Top strip: org logo + manager button */}
          <div className="flex items-center justify-between px-4 h-12">
            <div className="flex items-center min-w-0">
              {orgLogoUrl
                ? /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={orgLogoUrl} alt={orgName} className="h-7 w-auto max-w-[120px] object-contain" />
                : <span className="text-sm font-semibold truncate">{orgName}</span>
              }
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isManagerMode ? (
                <>
                  <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-emerald-400 text-xs font-medium">{t('Manažer', 'Manager')}</span>
                  </div>
                  {managerScope?.isAdmin !== false && (
                    <button
                      onClick={() => setShowLayoutEditor(true)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${theme.logoutBtnClass}`}
                      title="Upravit rozhraní"
                    >
                      {t('Upravit', 'Edit')}
                    </button>
                  )}
                  <button onClick={handleManagerLogout} className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${theme.logoutBtnClass}`}>
                    {t('Odhlásit', 'Log out')}
                  </button>
                </>
              ) : (
                <button data-tour="btn-manager" onClick={() => setShowManagerLogin(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${theme.managerBtnClass}`}>
                  <span>{t('Manažer', 'Manager')}</span>
                </button>
              )}
            </div>
          </div>
          {/* Scrollable tabs row */}
          <div className={`overflow-x-auto scrollbar-none border-t ${theme.navBorder}`}>
            <div className="flex items-center gap-0.5 px-2 py-1.5 min-w-max">
              {layout.tabs
                .filter(lt => lt.visible)
                .map(lt => [...BASE_TABS, ...MANAGER_TABS].find(t => t.id === lt.id))
                .filter((t): t is typeof BASE_TABS[0] => t !== undefined)
                .filter(t => !MANAGER_TABS.some(mt => mt.id === t.id) || isManagerMode)
                .map((tab) => (
                <button
                  key={tab.id}
                  data-tour={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap
                    ${activeTab === tab.id
                      ? (theme.tabActive ?? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20')
                      : theme.tabInactive
                    }`}
                >
                  <TabIcon id={tab.id} className="w-4 h-4" />
                  <span>{lang === 'en' ? tab.labelEn : tab.labelCs}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

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
