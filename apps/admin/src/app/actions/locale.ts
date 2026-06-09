"use server";
import { createSessionClient } from "@repo/api/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

export async function getLocale() {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    const locale = user.prefs?.locale;
    return isLocale(locale) ? locale : DEFAULT_LOCALE;
  } catch (_error) {
    return DEFAULT_LOCALE;
  }
}
