import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";

export const ADMIN_PORTAL_SETTINGS_PREF_KEY = "adminPortalSettings";

export const ADMIN_TIMEZONE_OPTIONS = ["Europe/Oslo", "UTC"] as const;

export type AdminTimezone = (typeof ADMIN_TIMEZONE_OPTIONS)[number];

export interface AdminNotificationSettings {
  newApplications: boolean;
  newDrafts: boolean;
  systemAlerts: boolean;
}

export interface AdminPortalSettings {
  locale: Locale;
  notifications: AdminNotificationSettings;
  timezone: AdminTimezone;
}

export function coercePreferenceRecord(
  prefs: unknown
): Record<string, unknown> {
  return isRecord(prefs) ? prefs : {};
}

export function getDefaultAdminPortalSettings(): AdminPortalSettings {
  return {
    locale: DEFAULT_LOCALE,
    notifications: {
      newApplications: true,
      newDrafts: true,
      systemAlerts: false,
    },
    timezone: "Europe/Oslo",
  };
}

export function normalizeAdminPortalSettingsFromPrefs(
  prefs: unknown
): AdminPortalSettings {
  const preferenceRecord = coercePreferenceRecord(prefs);
  const settingsRecord = coercePreferenceRecord(
    preferenceRecord[ADMIN_PORTAL_SETTINGS_PREF_KEY]
  );
  const notificationsRecord = coercePreferenceRecord(
    settingsRecord.notifications
  );
  const defaults = getDefaultAdminPortalSettings();
  const rawLocale = preferenceRecord.locale ?? settingsRecord.locale;

  return {
    locale: isLocaleValue(rawLocale) ? rawLocale : defaults.locale,
    notifications: {
      newApplications: booleanOrDefault(
        notificationsRecord.newApplications,
        defaults.notifications.newApplications
      ),
      newDrafts: booleanOrDefault(
        notificationsRecord.newDrafts,
        defaults.notifications.newDrafts
      ),
      systemAlerts: booleanOrDefault(
        notificationsRecord.systemAlerts,
        defaults.notifications.systemAlerts
      ),
    },
    timezone: isAdminTimezone(settingsRecord.timezone)
      ? settingsRecord.timezone
      : defaults.timezone,
  };
}

export function normalizeAdminPortalSettingsInput(
  input: unknown
): AdminPortalSettings {
  const inputRecord = coercePreferenceRecord(input);
  const notificationsRecord = coercePreferenceRecord(inputRecord.notifications);

  if (!isLocaleValue(inputRecord.locale)) {
    throw new Error("Unsupported locale");
  }
  if (!isAdminTimezone(inputRecord.timezone)) {
    throw new Error("Unsupported timezone");
  }

  return {
    locale: inputRecord.locale,
    notifications: {
      newApplications: inputRecordToBoolean(
        notificationsRecord,
        "newApplications"
      ),
      newDrafts: inputRecordToBoolean(notificationsRecord, "newDrafts"),
      systemAlerts: inputRecordToBoolean(notificationsRecord, "systemAlerts"),
    },
    timezone: inputRecord.timezone,
  };
}

export function serializeAdminPortalSettings(
  settings: AdminPortalSettings
): Record<string, unknown> {
  return {
    locale: settings.locale,
    notifications: {
      newApplications: settings.notifications.newApplications,
      newDrafts: settings.notifications.newDrafts,
      systemAlerts: settings.notifications.systemAlerts,
    },
    timezone: settings.timezone,
  };
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function inputRecordToBoolean(
  record: Record<string, unknown>,
  key: keyof AdminNotificationSettings
): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`Invalid notification setting: ${key}`);
  }
  return value;
}

function isAdminTimezone(value: unknown): value is AdminTimezone {
  return (
    typeof value === "string" &&
    (ADMIN_TIMEZONE_OPTIONS as readonly string[]).includes(value)
  );
}

function isLocaleValue(value: unknown): value is Locale {
  return typeof value === "string" && isLocale(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
