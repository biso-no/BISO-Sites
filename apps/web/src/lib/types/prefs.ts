import type { Models } from "@repo/api";
import type { Locale } from "@repo/api/types/appwrite";

export type UserPreferences = Models.Preferences & {
  campusId?: string;
  locale?: Locale;
};
