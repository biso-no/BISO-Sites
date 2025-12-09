import { Models } from "@repo/api";

export type UserPreferences = Models.Preferences & {
    campusId?: string;
    locale?: string;
}