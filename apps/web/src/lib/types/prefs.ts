import { Models } from "@repo/api";
import { Locale } from "@repo/api/types/appwrite";

export type UserPreferences = Models.Preferences & {
  campusId?: string;
  locale?: Locale;
};
