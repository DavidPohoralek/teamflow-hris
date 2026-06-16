'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'cs' | 'en';

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'cs',
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('cs');

  useEffect(() => {
    const stored = localStorage.getItem('tf_lang') as Lang | null;
    if (stored === 'cs' || stored === 'en') setLangState(stored);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('tf_lang', l);
  }

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function useT() {
  const { lang } = useLang();
  return (cs: string, en: string) => (lang === 'en' ? en : cs);
}
