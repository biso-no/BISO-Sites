import type { Models } from "@repo/api";
import type { Locale } from "@repo/i18n";

export type UserPreferences = Models.Preferences & {
  campusId?: string;
  locale?: Locale;
};
