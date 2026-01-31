'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Language } from '@/types';
import arTranslations from '@/locales/ar.json';
import enTranslations from '@/locales/en.json';

type TranslationsType = typeof arTranslations;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
}

const translations: Record<Language, TranslationsType> = {
  ar: arTranslations,
  en: enTranslations,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLanguage = localStorage.getItem('language') as Language | null;
    if (savedLanguage && (savedLanguage === 'ar' || savedLanguage === 'en')) {
      setLanguageState(savedLanguage);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    }
  }, [language, mounted]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  }, []);

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let value: unknown = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  }, [language]);

  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = language === 'ar';

  if (!mounted) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function useTranslation() {
  const { t, language, isRTL } = useLanguage();
  return { t, language, isRTL };
}
