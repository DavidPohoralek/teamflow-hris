export interface Theme {
  key: string;
  label: string;
  navBg: string;
  navBorder: string;
  navText: string;
  divider: string;
  tabsBg: string;
  /** Active tab pill — themes without it fall back to the legacy blue pill */
  tabActive?: string;
  tabInactive: string;
  tabHover: string;
  managerBtnClass: string;
  logoutBtnClass: string;
  /** Border on nav chrome (CZ/EN switch) — falls back to a translucent white hairline */
  chromeBorder?: string;
  /** Colour of the live "Manažer" indicator text — falls back to emerald-400 (for dark bars) */
  managerLiveText?: string;
  preview: [string, string];
}

export const THEMES: Theme[] = [
  {
    key: 'paper',
    label: 'Světlá (papír)',
    navBg: 'bg-white shadow-[0_1px_3px_rgba(17,24,32,0.05)]',
    navBorder: 'border-[#e2e0dc]',
    navText: 'text-[#111820]',
    divider: 'bg-[#e9e7e3]',
    tabsBg: '',
    tabActive: 'bg-[#111820] text-white',
    tabInactive: 'text-[#5c6672] hover:text-[#111820]',
    tabHover: '',
    managerBtnClass: 'text-[#5c6672] hover:text-[#111820]',
    logoutBtnClass: 'text-[#5c6672] hover:text-[#111820]',
    chromeBorder: 'border-[#e2e0dc]',
    managerLiveText: 'text-emerald-600',
    preview: ['#ffffff', '#f5f3ef'],
  },
  {
    key: 'graphite',
    label: 'Teplý grafit',
    navBg: 'bg-[#262b31]',
    navBorder: 'border-black/30',
    navText: 'text-white',
    divider: 'bg-white/15',
    tabsBg: '',
    tabActive: 'bg-white text-[#111820]',
    tabInactive: 'text-[#9aa4ae] hover:text-white',
    tabHover: '',
    managerBtnClass: 'text-[#9aa4ae] hover:text-white',
    logoutBtnClass: 'text-[#9aa4ae] hover:text-white',
    chromeBorder: 'border-white/15',
    managerLiveText: 'text-emerald-400',
    preview: ['#262b31', '#363c44'],
  },
  {
    key: 'ink',
    label: 'Ink (černá)',
    navBg: 'bg-[#111820]',
    navBorder: 'border-black/40',
    navText: 'text-white',
    divider: 'bg-white/15',
    tabsBg: '',
    tabActive: 'bg-white text-[#111820]',
    tabInactive: 'text-[#8e9aa6] hover:text-white',
    tabHover: '',
    managerBtnClass: 'text-[#8e9aa6] hover:text-white',
    logoutBtnClass: 'text-[#8e9aa6] hover:text-white',
    chromeBorder: 'border-white/15',
    managerLiveText: 'text-emerald-400',
    preview: ['#111820', '#2A2E36'],
  },
  {
    key: 'slate',
    label: 'Noční modrá',
    navBg: 'bg-gradient-to-r from-slate-900 to-slate-800',
    navBorder: 'border-slate-700/50',
    navText: 'text-white',
    divider: 'bg-slate-600',
    tabsBg: 'bg-slate-800/60 border border-slate-700/50',
    tabInactive: 'text-slate-400 hover:text-white hover:bg-slate-700/50',
    tabHover: '',
    managerBtnClass: 'bg-slate-700/60 border border-slate-600/50 text-slate-300 hover:bg-slate-600 hover:text-white hover:border-slate-500',
    logoutBtnClass: 'border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white',
    preview: ['#0f172a', '#1e293b'],
  },
  {
    key: 'indigo',
    label: 'Indigo',
    navBg: 'bg-gradient-to-r from-indigo-800 to-indigo-700',
    navBorder: 'border-indigo-600/50',
    navText: 'text-white',
    divider: 'bg-indigo-500',
    tabsBg: 'bg-indigo-900/60 border border-indigo-700/50',
    tabInactive: 'text-indigo-200 hover:text-white hover:bg-indigo-700/50',
    tabHover: '',
    managerBtnClass: 'bg-indigo-900/60 border border-indigo-700/50 text-indigo-200 hover:bg-indigo-700 hover:text-white',
    logoutBtnClass: 'border border-indigo-600 text-indigo-200 hover:bg-indigo-700 hover:text-white',
    preview: ['#3730a3', '#4338ca'],
  },
  {
    key: 'emerald',
    label: 'Tmavá zelená',
    navBg: 'bg-gradient-to-r from-emerald-900 to-emerald-800',
    navBorder: 'border-emerald-700/50',
    navText: 'text-white',
    divider: 'bg-emerald-600',
    tabsBg: 'bg-emerald-950/60 border border-emerald-800/50',
    tabInactive: 'text-emerald-200 hover:text-white hover:bg-emerald-800/50',
    tabHover: '',
    managerBtnClass: 'bg-emerald-950/60 border border-emerald-800/50 text-emerald-200 hover:bg-emerald-800 hover:text-white',
    logoutBtnClass: 'border border-emerald-700 text-emerald-200 hover:bg-emerald-800 hover:text-white',
    preview: ['#064e3b', '#065f46'],
  },
  {
    key: 'rose',
    label: 'Burgundy',
    navBg: 'bg-gradient-to-r from-rose-900 to-rose-800',
    navBorder: 'border-rose-700/50',
    navText: 'text-white',
    divider: 'bg-rose-600',
    tabsBg: 'bg-rose-950/60 border border-rose-800/50',
    tabInactive: 'text-rose-200 hover:text-white hover:bg-rose-800/50',
    tabHover: '',
    managerBtnClass: 'bg-rose-950/60 border border-rose-800/50 text-rose-200 hover:bg-rose-800 hover:text-white',
    logoutBtnClass: 'border border-rose-700 text-rose-200 hover:bg-rose-800 hover:text-white',
    preview: ['#881337', '#9f1239'],
  },
  {
    key: 'zinc',
    label: 'Světlá',
    navBg: 'bg-gradient-to-r from-zinc-100 to-zinc-50',
    navBorder: 'border-zinc-200',
    navText: 'text-zinc-800',
    divider: 'bg-zinc-300',
    tabsBg: 'bg-zinc-200/80 border border-zinc-300',
    tabInactive: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-300/60',
    tabHover: '',
    managerBtnClass: 'bg-zinc-200 border border-zinc-300 text-zinc-700 hover:bg-zinc-300 hover:text-zinc-900',
    logoutBtnClass: 'border border-zinc-300 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900',
    preview: ['#e4e4e7', '#f4f4f5'],
  },
];

export const DEFAULT_THEME = THEMES[0];

export function getTheme(key: string): Theme {
  return THEMES.find(t => t.key === key) ?? DEFAULT_THEME;
}
