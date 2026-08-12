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

// Only three nav themes ship with the sidebar redesign. Legacy gradient themes
// (slate/indigo/emerald/rose/zinc) were retired — orgs still holding one of those
// keys fall back to DEFAULT_THEME (graphite) via getTheme().
export const THEMES: Theme[] = [
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
];

export const DEFAULT_THEME = THEMES[0];

export function getTheme(key: string): Theme {
  return THEMES.find(t => t.key === key) ?? DEFAULT_THEME;
}
