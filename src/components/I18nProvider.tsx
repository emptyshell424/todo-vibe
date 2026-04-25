'use client';

import React, { createContext, useContext, useState } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { translations, type Language, type TranslationKey } from '@/lib/translations';

type TranslationParams = Record<string, string | number>;

type I18nContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function resolveInitialLanguage(): Language {
  if (typeof window === 'undefined') {
    return 'zh';
  }

  const savedLang = localStorage.getItem('language');
  if (savedLang === 'en' || savedLang === 'zh') {
    return savedLang;
  }

  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => resolveInitialLanguage());

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
    }
  };

  const t = (key: TranslationKey, params?: TranslationParams) => {
    let text = translations[language][key] || translations.en[key] || key;

    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replace(`{${paramKey}}`, String(paramValue));
      }
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
