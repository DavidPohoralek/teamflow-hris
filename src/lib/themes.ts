export interface Theme {
  key: string;
  label: string;
  navBg: string;
  navBorder: string;
  divider: string;
  accent: string;        // active tab bg
  accentText: string;
  preview: string[];     // 2 hex colors for preview swatch
}

export const THEMES: Theme[] = [
  {
    key: 'slate',
    label: 'Noční modrá',
    navBg: 'bg-gradient-to-r from-slate-900 to-slate-800',
    navBorder: 'border-slate-700/50',
    divider: 'bg-slate-600',
    accent: 'bg-indigo-600',
    accentText: 'text-white',
    preview: ['#0f172a', '#1e293b'],
  },
  {
    key: 'indigo',
    label: 'Fialová',
    navBg: 'bg-gradient-to-r from-indigo-900 to-indigo-800',
    navBorder: 'border-indigo-700/50',
    divider: 'bg-indigo-600',
    accent: 'bg-purple-600',
    accentText: 'text-white',
    preview: ['#312e81', '#3730a3'],
  },
  {
    key: 'emerald',
    label: 'Tmavá zelená',
    navBg: 'bg-gradient-to-r from-emerald-900 to-emerald-800',
    navBorder: 'border-emerald-700/50',
    divider: 'bg-emerald-600',
    accent: 'bg-emerald-500',
    accentText: 'text-white',
    preview: ['#064e3b', '#065f46'],
  },
  {
    key: 'zinc',
    label: 'Světlá',
    navBg: 'bg-gradient-to-r from-zinc-100 to-white',
    navBorder: 'border-zinc-200',
    divider: 'bg-zinc-300',
    accent: 'bg-indigo-600',
    accentText: 'text-white',
    preview: ['#f4f4f5', '#ffffff'],
  },
  {
    key: 'rose',
    label: 'Burgundy',
    navBg: 'bg-gradient-to-r from-rose-950 to-rose-900',
    navBorder: 'border-rose-800/50',
    divider: 'bg-rose-700',
    accent: 'bg-rose-600',
    accentText: 'text-white',
    preview: ['#4c0519', '#881337'],
  },
];

export const DEFAULT_THEME = THEMES[0];

export function getTheme(key: string): Theme {
  return THEMES.find(t => t.key === key) ?? DEFAULT_THEME;
}
