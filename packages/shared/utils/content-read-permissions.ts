import { Permission, Role } from "@repo/api";
import { RECRUITMENT_STAFF_TEAMS } from "../recruitment";

const PUBLIC_EVENT_STATUSES = new Set(["published", "cancelled"]);

/**
 * Read permissions for an event row or one of its translation rows.
 * Published and cancelled events are visible to everyone (members-only limits
 * who can join, not who can see); any other status carries no read permission.
 */
export function eventReadPermissions(status: string): string[] {
  return PUBLIC_EVENT_STATUSES.has(status) ? [Permission.read(Role.any())] : [];
}

/** Read permissions for a benefit row: public only when published. */
export function benefitReadPermissions(status: string): string[] {
  return status === "published" ? [Permission.read(Role.any())] : [];
}

export type TranslationContentType =
  | "event"
  | "memberBenefit"
  | "news"
  | "product"
  | "job"
  | "department";

/**
 * Read entries for a `content_translations` row, decided by its parent's
 * content type and status. Members-only flags never narrow a translation's
 * read. Job translations are always readable by the recruitment staff teams.
 */
export function translationReadPermissions(
  contentType: TranslationContentType,
  parentStatus: string | null
): string[] {
  const published = parentStatus === "published";
  switch (contentType) {
    case "event":
      return eventReadPermissions(parentStatus ?? "");
    case "memberBenefit":
      return benefitReadPermissions(parentStatus ?? "");
    case "news":
    case "product":
      return published ? [Permission.read(Role.any())] : [];
    case "job":
      return [
        ...(published ? [Permission.read(Role.any())] : []),
        ...RECRUITMENT_STAFF_TEAMS.map((team) =>
          Permission.read(Role.team(team))
        ),
      ];
    case "department":
      return [Permission.read(Role.any())];
    default:
      return [];
  }
}
