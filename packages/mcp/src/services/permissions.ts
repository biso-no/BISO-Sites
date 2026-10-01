/**
 * Appwrite row permissions for content writes.
 *
 * A faithful port of `buildContentRowPermissions` and
 * `buildContentTranslationPermissions` in `apps/admin/src/lib/utils.ts`.
 *
 * The rule is deliberately narrow, and the admin module's own comment explains
 * why: **row permissions describe consumer visibility only**. Authoring goes
 * through the service key after application-level authorization, so no team
 * ever receives row-level create/update/delete. That is why the admin helpers
 * accept `writeTeams`/`readTeams`/`ownerUserId` and then ignore them — a
 * detail worth restating here, because a reader who assumes those arguments do
 * something would "fix" this port by granting team write access and silently
 * widen who can edit published content.
 *
 * - published + public  → `read(any)`
 * - published + members → `read(team:biso-members)`
 * - anything else (draft, archived, cancelled, closed, pending_approval) → `[]`
 *
 * An empty permission array on a table with `rowSecurity: true` means the row
 * is reachable only by the service key and by whoever the *table* grants — which
 * is how drafts stay invisible to the public.
 */

import { Permission, Role } from "@repo/api";
import { MEMBERS_TEAM_ID } from "../identity/campus";

export type ContentAudience = "public" | "members";

/**
 * Which status strings count as "published" across the content tables.
 *
 * Each table has its own enum (`jobs` has `closed`, `events` has `cancelled`,
 * `webshop_products` has `pending_approval`), but exactly one value in each
 * means publicly visible.
 */
export function isPublishedStatus(status: string | null | undefined): boolean {
  return status === "published";
}

export function buildContentRowPermissions(options: {
  status: string;
  audience?: ContentAudience;
}): string[] {
  if (!isPublishedStatus(options.status)) {
    return [];
  }
  return options.audience === "members"
    ? [Permission.read(Role.team(MEMBERS_TEAM_ID))]
    : [Permission.read(Role.any())];
}

/**
 * Translation rows get visibility equivalent to their parent.
 *
 * Recruitment translations are the one exception and use
 * `buildJobTranslationPermissions` in the admin app instead, because their
 * staff read access is a static team list rather than a mirrored one. This
 * package does not write job translations, so that path is not ported.
 */
export function buildTranslationRowPermissions(options: {
  status: string;
  audience?: ContentAudience;
}): string[] {
  return buildContentRowPermissions(options);
}
