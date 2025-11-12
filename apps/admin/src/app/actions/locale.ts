"use server";
import { createSessionClient } from "@repo/api/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

export async function getLocale() {
    try {
        const { account } = await createSessionClient();
        const user = await account.get();
        const locale = user.prefs?.locale;
        return isLocale(locale) ? locale : DEFAULT_LOCALE;
    } catch (error) {
        return DEFAULT_LOCALE;
    }
}

export async function setLocale(locale: string) {
    if (!isLocale(locale)) {
        throw new Error(`Unsupported locale: ${locale}`);
    }
    const { account } = await createSessionClient();
    const user = await account.get();
    const prefs = user.prefs;
    if (!user) {
        return null;
    }
    await account.updatePrefs({ ...prefs, locale });
}