/**
 * Language context — manages the active UI language (Latvian / Russian).
 * Persists the user's choice in AsyncStorage across sessions.
 *
 * Usage:
 *   const { t, language, setLanguage } = useLanguage();
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lv, ru, type Translations } from './translations';

export type Lang = 'lv' | 'ru';

interface LanguageContextValue {
  language: Lang;
  t: Translations;
  setLanguage: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'lv',
  t: lv,
  setLanguage: () => {},
});

const STORAGE_KEY = '@b3hub_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Lang>('lv');

  // Restore persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val === 'lv' || val === 'ru') setLang(val);
      })
      .catch(() => {});
  }, []);

  const setLanguage = (lang: Lang) => {
    setLang(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  };

  const t: Translations = language === 'ru' ? ru : lv;

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
