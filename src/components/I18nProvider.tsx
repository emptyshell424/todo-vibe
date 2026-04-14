'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { translations, Language } from '@/lib/translations';

type I18nContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en'], params?: Record<string, any>) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh');

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'zh')) {
      setLanguageState(savedLang);
    } else {
      const browserLang = navigator.language.startsWith('zh') ? 'zh' : 'en';
      setLanguageState(browserLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: keyof typeof translations['en'], params?: Record<string, any>) => {
    let text = translations[language][key] || translations['en'][key] || key;
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    
    return text;
  };

  const antdLocale = language === 'zh' ? zhCN : enUS;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      <ConfigProvider 
        locale={antdLocale}
        theme={{
          token: {
            colorPrimary: '#006592',
            borderRadius: 16,
            colorBgBase: '#f8f9fd',
            fontFamily: 'var(--font-sans)',
          },
        }}
      >
        {children}
      </ConfigProvider>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
