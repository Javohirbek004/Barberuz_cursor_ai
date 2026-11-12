import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { translations, Language } from './translations';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof typeof translations['uz']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>('uz');
  const chosenHere = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('barber_lang') as Language;
    if (saved && (saved === 'uz' || saved === 'ru')) {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Language) => {
    chosenHere.current = true;
    setLangState(newLang);
    localStorage.setItem('barber_lang', newLang);
    try {
      const raw = localStorage.getItem('barber_user');
      if (raw) {
        const user = JSON.parse(raw) as { lang?: string };
        user.lang = newLang;
        localStorage.setItem('barber_user', JSON.stringify(user));
      }
    } catch {
      // The phone copy is optional. The screen language already changed.
    }
    const token = localStorage.getItem('barber_token');
    if (!token || token.startsWith('barber_token_')) return;
    fetch('/api/settings/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lang: newLang }),
    }).catch(() => {});
  };

  useEffect(() => {
    const token = localStorage.getItem('barber_token');
    if (!token || token.startsWith('barber_token_')) return;
    let live = true;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((user: { lang?: string } | null) => {
        if (!live || chosenHere.current) return;
        if (user?.lang === 'ru' || user?.lang === 'uz') {
          setLangState(user.lang);
          localStorage.setItem('barber_lang', user.lang);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const t = (key: keyof typeof translations['uz']): string => {
    const dict = translations[lang] || translations['uz'];
    return dict[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return context;
};
