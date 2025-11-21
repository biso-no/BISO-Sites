// Core exports

export type { Locale } from "./config";
export { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES } from "./config";
// Message loader
export { loadMessages, messageNamespaces } from "./messages";
export type { LocaleMessages, MessageNamespace, Messages } from "./types";
