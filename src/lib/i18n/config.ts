/**
 * i18n Configuration
 *
 * Story 4.2 Code Review - MEDIUM #5: Internationalization support
 *
 * Supported locales and configuration for internationalization.
 */

export const DEFAULT_LOCALE = "ko" as const;
export const SUPPORTED_LOCALES = ["ko", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Format configuration for each locale
 */
export const LOCALE_CONFIG = {
  ko: {
    name: "한국어",
    dateFormat: "yyyy. MM. dd.",
    datetimeFormat: "yyyy. MM. dd. HH:mm",
    currencyFormat: (value: number) =>
      new Intl.NumberFormat("ko-KR").format(value) + "원",
  },
  en: {
    name: "English",
    dateFormat: "MMM dd, yyyy",
    datetimeFormat: "MMM dd, yyyy HH:mm",
    currencyFormat: (value: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value),
  },
} as const satisfies Record<Locale, { name: string; dateFormat: string; datetimeFormat: string; currencyFormat: (value: number) => string }>;
