'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Přehled',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect
          x="3"
          y="3"
          width="7"
          height="7"
          rx="1"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="14"
          y="3"
          width="7"
          height="7"
          rx="1"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="3"
          y="14"
          width="7"
          height="7"
          rx="1"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="14"
          y="14"
          width="7"
          height="7"
          rx="1"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    href: '/shifts',
    label: 'Směny',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <rect
          x="3"
          y="4"
          width="18"
          height="18"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M16 2v4M8 2v4M3 10h18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/employees',
    label: 'Zaměstnanci',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path
          d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="9"
          cy="7"
          r="4"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/attendance',
    label: 'Docházka',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 7v5l3 3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/requests',
    label: 'Žádosti',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/setup',
    label: 'Setup / Admin',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 2L2 7l10 5 10-5-10-5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2 17l10 5 10-5M2 12l10 5 10-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Nastavení',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  },
];

interface SidebarProps {
  userEmail: string;
  displayName: string;
}

export default function Sidebar({ userEmail, displayName }: SidebarProps) {
  const { lang, setLang } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-700/50">
        <svg width="32" height="32" viewBox="0 0 250 260" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
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
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm leading-tight">TeamFlow</div>
          <div className="text-slate-400 text-xs">by SelbickyLabs</div>
        </div>
        <button
          onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}
          className="flex-shrink-0 px-2 py-1 rounded-md text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title={lang === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'}
        >
          {lang === 'cs' ? 'EN' : 'CS'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Hlavní menu
        </p>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'text-white bg-blue-600'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-semibold">
            {initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">
              {displayName}
            </div>
            <div className="text-slate-400 text-xs truncate">{userEmail}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Odhlásit se
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-800 text-white shadow-lg"
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
          <path
            d="M3 12h18M3 6h18M3 18h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#1e293b] transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-[#1e293b]">
        {sidebarContent}
      </aside>
    </>
  );
}
