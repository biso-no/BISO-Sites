"use server";

import { createSessionClient } from "@repo/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getUserAuthContext } from "@/lib/authorization";
import {
  ADMIN_PORTAL_SETTINGS_PREF_KEY,
  type AdminPortalSettings,
  coercePreferenceRecord,
  normalizeAdminPortalSettingsFromPrefs,
  normalizeAdminPortalSettingsInput,
  serializeAdminPortalSettings,
} from "./settings-model";

async function requireSettingsAccess() {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (!ctx.roles.includes("globaladmin")) {
    throw new Error("Forbidden: only global admins can manage settings");
  }
}

export async function getAdminPortalSettings(): Promise<AdminPortalSettings> {
  await requireSettingsAccess();
  const { account } = await createSessionClient();
  const user = await account.get();
  return normalizeAdminPortalSettingsFromPrefs(user.prefs);
}

export async function saveAdminPortalSettings(
  input: AdminPortalSettings
): Promise<{ data: AdminPortalSettings } | { error: string }> {
  try {
    await requireSettingsAccess();
    const settings = normalizeAdminPortalSettingsInput(input);
    const { account } = await createSessionClient();
    const user = await account.get();
    const prefs = coercePreferenceRecord(user.prefs);

    await account.updatePrefs({
      ...prefs,
      locale: settings.locale,
      [ADMIN_PORTAL_SETTINGS_PREF_KEY]: serializeAdminPortalSettings(settings),
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings");
    return { data: settings };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error: error instanceof Error ? error.message : "Failed to save settings",
    };
  }
}
