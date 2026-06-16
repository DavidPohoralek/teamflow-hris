'use client'

import { useEffect, useState } from 'react'
import WorkPlanGrid from '@/components/WorkPlanGrid'
import AttendanceKiosk from '@/components/AttendanceKiosk'
import AttendanceManager from '@/components/AttendanceManager'
import PresenceDashboard from '@/components/PresenceDashboard'
import EmployeeHoursPortal from '@/components/EmployeeHoursPortal'
import ManagerLoginModal from '@/components/ManagerLoginModal'
import ManagerPanel from '@/components/ManagerPanel'
import VacationPlanner from '@/components/VacationPlanner'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import ShiftAssistant from '@/components/ShiftAssistant'
import { getTheme, DEFAULT_THEME, type Theme } from '@/lib/themes'

type Tab = 'schedule' | 'attendance' | 'overview' | 'my-hours' | 'vacation' | 'analytics' | 'management' | 'assistant'

const BASE_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'schedule', label: 'Směny', icon: '📅' },
  { id: 'attendance', label: 'Docházka', icon: '⏰' },
  { id: 'overview', label: 'Přehled', icon: '📊' },
  { id: 'my-hours', label: 'Zaměstnanec', icon: '👤' },
  { id: 'vacation', label: 'Dovolená', icon: '🏖️' },
]

const MANAGER_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'analytics', label: 'Analytika', icon: '📈' },
  { id: 'assistant', label: 'Asistent', icon: '🤖' },
  { id: 'management', label: 'Správa', icon: '⚙️' },
]

const MANAGER_SESSION_KEY = 'hris_manager_session'
const ORG_ID_KEY = 'hris_org_id'
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

function isManagerSessionValid(): boolean {
  try {
    const raw = localStorage.getItem(MANAGER_SESSION_KEY)
    if (!raw) return false
    // Token format: base64(orgId:timestamp)
    const decoded = atob(raw)
    const parts = decoded.split(':')
    if (parts.length < 2) return false
    const ts = parseInt(parts[parts.length - 1], 10)
    if (isNaN(ts)) return false
    return new Date().getTime() - ts < SESSION_DURATION_MS
  } catch {
    return false
  }
}

export default function HomePage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string>('')
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<Tab>('schedule')
  const [isManagerMode, setIsManagerMode] = useState(false)
  const [showManagerLogin, setShowManagerLogin] = useState(false)
  const [showManagerPanel, setShowManagerPanel] = useState(false)


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

  // Load org + manager session on mount
  useEffect(() => {
    // Check manager session
    setIsManagerMode(isManagerSessionValid())

    // Try cached org id first
    const cachedOrgId = localStorage.getItem(ORG_ID_KEY)
    if (cachedOrgId) {
      setOrgId(cachedOrgId)
      setLoading(false)
      // Refresh in background to keep name up to date
      fetchOrg(false)
    } else {
      fetchOrg(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchOrg(showLoadingSpinner: boolean) {
    if (showLoadingSpinner) setLoading(true)
    try {
      const res = await fetch('/api/public/org')
      if (!res.ok) {
        setError('Systém není nastaven. Kontaktujte správce.')
        return
      }
      const data = (await res.json()) as { id: string; name: string }
      setOrgId(data.id)
      setOrgName(data.name)
      localStorage.setItem(ORG_ID_KEY, data.id)
      // Load org logo (public, no auth needed)
      fetch(`/api/public/org-logo?orgId=${data.id}`)
        .then(r => r.json())
        .then((d: { logoUrl: string | null }) => setOrgLogoUrl(d.logoUrl ?? null))
        .catch(() => {})
      // Load theme from public settings
      fetch(`/api/public/company-settings?orgId=${data.id}`)
        .then(r => r.json())
        .then((d: Record<string, string>) => {
          if (d.ui_theme) setTheme(getTheme(d.ui_theme))
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
    setShowManagerLogin(false)
    setActiveTab('management')
  }

  function handleManagerLogout() {
    localStorage.removeItem(MANAGER_SESSION_KEY)
    setIsManagerMode(false)
    if (activeTab === 'management') {
      setActiveTab('schedule')
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Načítání systému...</p>
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
            {error ?? 'Systém není nastaven. Kontaktujte správce.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className={`${theme.navBg} ${theme.navText} shadow-xl border-b ${theme.navBorder} z-10`}>
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <svg width="36" height="36" viewBox="0 0 250 260" xmlns="http://www.w3.org/2000/svg">
              {/* Outer faces */}
              <polygon points="125,130 225,72 225,187 125,244" fill="#C87C1A"/>
              <polygon points="25,72 125,130 125,244 25,187" fill="#E09828"/>
              {/* Rim strips */}
              <polygon points="125,15 225,72 213,72 125,22" fill="#EDB84A"/>
              <polygon points="25,72 125,15 125,22 37,72" fill="#E09828"/>
              <polygon points="225,72 125,130 125,122 213,72" fill="#96560A"/>
              <polygon points="125,130 25,72 37,72 125,122" fill="#AE6A10"/>
              {/* Interior diagonal split IT→IB */}
              <polygon points="37,72 125,22 125,122" fill="#2A4878"/>
              <polygon points="213,72 125,22 125,122" fill="#05080F"/>
              <line x1="125" y1="22" x2="125" y2="122" stroke="#1A2E58" strokeWidth="1.5"/>
              <polyline points="125,22 213,72 125,122 37,72 125,22" fill="none" stroke="#182840" strokeWidth="1.8"/>
              {/* T — crossbar */}
              <polygon points="35,98 115,145 115,163 35,117" fill="#7A4808"/>
              {/* T — stem (gap above) */}
              <polygon points="61,139 89,155 89,210 61,194" fill="#7A4808"/>
              {/* F — top bar */}
              <polygon points="135,145 215,98 215,117 135,163" fill="#6A3806"/>
              {/* F — stem (gap above) */}
              <polygon points="135,170 153,159 153,211 135,221" fill="#6A3806"/>
              {/* F — middle bar (gap from stem) */}
              <polygon points="157,171 200,146 200,163 157,188" fill="#6A3806"/>
              {/* Outer edges */}
              <polyline points="25,72 125,15 225,72" fill="none" stroke="#C07010" strokeWidth="2.5" strokeLinejoin="round"/>
              <line x1="25" y1="72" x2="25" y2="187" stroke="#C07010" strokeWidth="2"/>
              <line x1="225" y1="72" x2="225" y2="187" stroke="#8A4A08" strokeWidth="2"/>
              <line x1="25" y1="187" x2="125" y2="244" stroke="#B07010" strokeWidth="2"/>
              <line x1="225" y1="187" x2="125" y2="244" stroke="#8A4A08" strokeWidth="2"/>
              <line x1="125" y1="130" x2="125" y2="244" stroke="#9A5C10" strokeWidth="2.5"/>
            </svg>
            </div>

          {/* Divider + org logo */}
          <div className={`h-6 w-px ${theme.divider}`} />
          {orgLogoUrl
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={orgLogoUrl} alt={orgName} className="h-8 w-auto max-w-[140px] object-contain" />
            : <span className="text-slate-400 text-sm font-medium">{orgName}</span>
          }

          {/* Tabs — center */}
          <div className="flex-1 flex justify-center">
            <div className={`flex items-center rounded-xl p-1 gap-0.5 ${theme.tabsBg}`}>
              {[...BASE_TABS, ...(isManagerMode ? MANAGER_TABS : [])].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : theme.tabInactive
                    }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Manager button */}
          <div className="shrink-0">
            {isManagerMode ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-emerald-400 text-sm font-medium">Manažer</span>
                </div>
                <button
                  onClick={handleManagerLogout}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${theme.logoutBtnClass}`}
                >
                  Odhlásit
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowManagerLogin(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${theme.managerBtnClass}`}
              >
                <span>🔐</span>
                <span>Manažer</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-slate-50">
        {activeTab === 'schedule' && (
          <WorkPlanGrid
            orgId={orgId}
            month={currentMonth}
            isManagerMode={isManagerMode}
            onMonthChange={(month: string) => setCurrentMonth(month)}
          />
        )}

        {activeTab === 'attendance' && (
          isManagerMode
            ? <AttendanceManager orgId={orgId} />
            : <AttendanceKiosk orgId={orgId} />
        )}

        {activeTab === 'overview' && (
          <PresenceDashboard orgId={orgId} isManagerMode={isManagerMode} />
        )}

        {activeTab === 'my-hours' && (
          <EmployeeHoursPortal
            orgId={orgId}
            onClose={() => setActiveTab('schedule')}
          />
        )}

        {activeTab === 'vacation' && (
          <VacationPlanner orgId={orgId} isManagerMode={isManagerMode} />
        )}

        {activeTab === 'analytics' && isManagerMode && (
          <AnalyticsDashboard orgId={orgId} />
        )}

        {activeTab === 'assistant' && isManagerMode && (
          <ShiftAssistant orgId={orgId} month={currentMonth} />
        )}

        {activeTab === 'management' && isManagerMode && (
          <ManagerPanel orgId={orgId} onClose={() => setActiveTab('schedule')} />
        )}
      </main>

      {/* Manager Login Modal */}
      {showManagerLogin && orgId && (
        <ManagerLoginModal
          orgId={orgId}
          onSuccess={handleManagerSuccess}
          onClose={() => setShowManagerLogin(false)}
        />
      )}
    </div>
  )
}
