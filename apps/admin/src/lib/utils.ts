import { type Models, Permission, Role } from "@repo/api";
import type { RecruitmentLookups } from "@repo/shared/recruitment";

const GUEST_NAME_PREFIX = "guest_";

/**
 * Single definition of "authenticated" used across the admin app.
 *
 * Appwrite treats anonymous and authenticated users uniformly in the Account
 * API — both have a $id. We treat the user as authenticated when they have
 * an email, or a real (non-guest_) display name AND a verified email.
 *
 * Keep this in sync with the server-side gating in getUserAuthContext and
 * the protected-route check in /(protected)/layout.tsx.
 */
export function isAuthenticatedAppwriteUser(
  user: Pick<
    Models.User<Models.Preferences>,
    "$id" | "email" | "name" | "emailVerification"
  >
): boolean {
  if (!user.$id) {
    return false;
  }
  const hasEmail = !!user.email && user.email.length > 0;
  const hasRealName =
    !!user.name &&
    user.name.length > 0 &&
    !user.name.startsWith(GUEST_NAME_PREFIX);
  return hasEmail || (hasRealName && user.emailVerification);
}

export const isProd =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

/**
 * Restrict post-auth redirect targets to same-site relative paths.
 *
 * Accepts a `redirectTo` value from a query parameter (typically URL-encoded
 * once already) and returns either a safe relative path beginning with a
 * single "/" or the fallback "/". Rejects absolute URLs, protocol-relative
 * URLs ("//..."), backslash tricks ("/\..."), and anything that fails to
 * decode. Use this anywhere a user-controlled string is passed to
 * `redirect()` after login or callback.
 */
export function sanitizeRedirectTarget(
  input: string | null | undefined
): string {
  if (!input) {
    return "/";
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    return "/";
  }
  // Must be a same-site path. Reject absolute URLs and protocol-relative or
  // backslash-prefixed paths that browsers treat as cross-origin.
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.startsWith("/\\")
  ) {
    return "/";
  }
  return decoded;
}

export function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ADMIN_TEAM = "admin";
const MEMBERS_TEAM = "biso-members";

/**
 * A content row is considered published (and therefore eligible for a public
 * `read(any)` permission) only when its status is exactly "published". Any
 * other status (draft, archived, scheduled, …) must never be `read(any)`.
 */
function isPublishedStatus(status: string | null | undefined): boolean {
  return status === "published";
}

/**
 * Derive the Appwrite team IDs that own a content row from its campus and
 * department, using the same sanitization rule as `buildJobRowPermissions`
 * (lowercase the display name, strip whitespace).
 *
 * - campusTeam (`sg-app-campus-*`) is read-only — campus teams NEVER get write.
 * - deptTeam (`sg-app-dept-*`) is the owning department team — read + write.
 *
 * Returns `null` for either when the id is missing or absent from `lookups`.
 */
export function deriveContentRowTeams(
  lookups: RecruitmentLookups,
  row: { campus_id?: string | null; department_id?: string | null }
): { campusTeam: string | null; deptTeam: string | null } {
  const campusName = row.campus_id
    ? lookups.campusNamesById.get(row.campus_id)
    : null;
  const campusTeam = campusName
    ? `sg-app-campus-${campusName.toLowerCase().replace(/\s+/g, "")}`
    : null;

  const deptName = row.department_id
    ? lookups.departmentNamesById.get(row.department_id)
    : null;
  const deptTeam = deptName
    ? `sg-app-dept-${deptName.toLowerCase().replace(/\s+/g, "")}`
    : null;

  return { campusTeam, deptTeam };
}

/**
 * Build Appwrite $permissions for a top-level content row (event, news,
 * webshop_product, page).
 *
 * READ:
 *  - published + public → `read(any)` (publicly visible).
 *  - otherwise (draft/archived OR members-only) → team-scoped reads only:
 *    admin, the owning campus team, the owning department team, and
 *    biso-members ONLY when the row is published AND member-only.
 *    This guarantees unpublished rows are never `read(any)`.
 *
 * WRITE (update/delete):
 *  - always team:admin + the owning department team. The campus team NEVER
 *    receives write access.
 */
export function buildContentRowPermissions(opts: {
  status: string;
  audience?: "public" | "members";
  campusTeam?: string | null;
  deptTeam?: string | null;
}): string[] {
  const { status, audience = "public", campusTeam, deptTeam } = opts;
  const published = isPublishedStatus(status);

  const writeTeams = [
    ...new Set([ADMIN_TEAM, ...(deptTeam ? [deptTeam] : [])]),
  ];

  const readPerms =
    published && audience === "public"
      ? [Permission.read(Role.any())]
      : [
          Permission.read(Role.team(ADMIN_TEAM)),
          ...(campusTeam ? [Permission.read(Role.team(campusTeam))] : []),
          ...(deptTeam ? [Permission.read(Role.team(deptTeam))] : []),
          ...(published && audience === "members"
            ? [Permission.read(Role.team(MEMBERS_TEAM))]
            : []),
        ];

  return [
    ...new Set([
      ...readPerms,
      ...writeTeams.flatMap((t) => [
        Permission.update(Role.team(t)),
        Permission.delete(Role.team(t)),
      ]),
    ]),
  ];
}

/**
 * Build Appwrite $permissions for a content_translations / page_translations
 * row.
 *
 * Public content (events, news, shop, pages, departments): readable by anyone.
 * Member-only content: readable by team:biso-members + write teams only.
 * Write teams (update/delete) are the department team(s) that own the content.
 *
 * Read access mirrors the parent content row (see `buildContentRowPermissions`):
 *  - published + public → `read(any)`.
 *  - otherwise → team-only: admin, the owning department team(s) (`writeTeams`),
 *    the owning campus team (`readTeams`, read-only), the owner, and
 *    biso-members ONLY when the parent is published AND member-only.
 * A draft/archived parent is therefore never `read(any)` and never readable by
 * biso-members. Omitting `status` preserves the previous published default.
 */
export function buildContentTranslationPermissions(opts: {
  audience?: "public" | "members";
  status?: string;
  writeTeams: string[];
  readTeams?: string[];
  ownerUserId?: string;
}): string[] {
  const {
    audience = "public",
    status,
    writeTeams,
    readTeams = [],
    ownerUserId,
  } = opts;
  const published = status === undefined || isPublishedStatus(status);

  const readPerms =
    published && audience === "public"
      ? [Permission.read(Role.any())]
      : [
          Permission.read(Role.team(ADMIN_TEAM)),
          ...writeTeams.map((t) => Permission.read(Role.team(t))),
          ...readTeams.map((t) => Permission.read(Role.team(t))),
          ...(published && audience === "members"
            ? [Permission.read(Role.team(MEMBERS_TEAM))]
            : []),
          ...(ownerUserId ? [Permission.read(Role.user(ownerUserId))] : []),
        ];

  const writePerms = [
    ...writeTeams.flatMap((t) => [
      Permission.update(Role.team(t)),
      Permission.delete(Role.team(t)),
    ]),
    ...(ownerUserId
      ? [
          Permission.update(Role.user(ownerUserId)),
          Permission.delete(Role.user(ownerUserId)),
        ]
      : []),
  ];

  return [...new Set([...readPerms, ...writePerms])];
}
