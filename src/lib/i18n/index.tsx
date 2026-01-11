/**
 * i18n Hook and Provider
 *
 * Story 4.2 Code Review - MEDIUM #5: Internationalization support
 *
 * Provides translation and locale formatting functionality.
 * Uses localStorage to persist user's language preference.
 */

"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_CONFIG } from "./config";
import type { Locale } from "./config";
import koMessages from "./locales/ko.json";
import enMessages from "./locales/en.json";

type Messages = typeof koMessages;

const messages = {
  ko: koMessages,
  en: enMessages,
} as const satisfies Record<Locale, Messages>;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof Messages | string) => string;
  formatMessage: (key: keyof Messages | string, params: Record<string, string | number>) => string;
  formatDate: (date: Date) => string;
  formatCurrency: (amount: number) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Load locale from localStorage on mount
  useEffect(() => {
    const savedLocale = localStorage.getItem("locale") as Locale | null;
    if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale)) {
      setLocaleState(savedLocale);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  };

  const t = (key: keyof Messages | string): string => {
    const keys = key.split(".");
    let value: any = messages[locale];

    for (const k of keys) {
      value = value?.[k];
    }

    return value ?? key;
  };

  const formatMessage = (
    key: keyof Messages | string,
    params: Record<string, string | number>
  ): string => {
    let message = t(key);

    // Replace placeholders like {count}, {total}, {progress}
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      message = message.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
    });

    return message;
  };

  const formatDate = (date: Date): string => {
    const config = LOCALE_CONFIG[locale];

    if (locale === "ko") {
      return new Date(date).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } else {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    }
  };

  const formatCurrency = (amount: number): string => {
    return LOCALE_CONFIG[locale].currencyFormat(amount);
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        formatMessage,
        formatDate,
        formatCurrency,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
