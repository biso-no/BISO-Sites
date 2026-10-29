import { Permission, Role } from "@repo/api";

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
