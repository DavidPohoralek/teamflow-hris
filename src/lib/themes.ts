export interface Theme {
  key: string;
  label: string;
  navBg: string;
  navBorder: string;
  navText: string;
  divider: string;
  tabsBg: string;
  tabInactive: string;
  tabHover: string;
  managerBtnClass: string;
  logoutBtnClass: string;
  preview: [string, string];
}

export const THEMES: Theme[] = [
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
