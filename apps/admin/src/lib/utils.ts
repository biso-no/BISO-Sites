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

// C0 controls and DEL (tab, CR, LF among them): browsers strip tabs/newlines from URLs, so
// "/\t/evil.com" would become "//evil.com".
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
const CONTROL_OR_SPACE = /[\u0000-\u001f\u007f]/;

const PLAIN_ABSOLUTE_URL = /^https?:\/\/[^\s\\@]*$/i;

/**
 * True when `value` is a plain absolute http(s) URL whose origin exactly equals
 * the origin of `NEXT_PUBLIC_DOCS_URL`. Unset or invalid env: always false.
 */
function isDocsUrl(value: string): boolean {
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL;
  if (!(docsUrl && PLAIN_ABSOLUTE_URL.test(value))) {
    return false;
  }
  try {
    return new URL(value).origin === new URL(docsUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Restrict post-auth redirect targets to same-site relative paths, plus
 * absolute URLs on the docs origin (`NEXT_PUBLIC_DOCS_URL`).
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
  if (CONTROL_OR_SPACE.test(decoded)) {
    return "/";
  }
  // The docs site is the one cross-origin target allowed. Check the raw value
  // first so a docs URL whose query holds %-escapes is returned unchanged.
  if (isDocsUrl(input)) {
    return input;
  }
  if (isDocsUrl(decoded)) {
    return decoded;
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
 * webshop_product, page, benefit, document).
 *
 * Row permissions describe CONSUMER visibility only — authoring goes through
 * the admin client after application-level authorization, so no team ever
 * receives row-level create/update/delete:
 *  - published + public → `read(any)`;
 *  - published + members → read for the members team;
 *  - any other status (draft, archived, scheduled, …) → no permissions at
 *    all; the row is service-only.
 *
 * The `campusTeam`/`deptTeam` inputs are accepted for call-site compatibility
 * but intentionally ignored: dynamically mirrored teams must never appear in
 * row ACLs, or permissions drift the moment Azure groups change.
 */
export function buildContentRowPermissions(opts: {
  status: string;
  audience?: "public" | "members";
  campusTeam?: string | null;
  deptTeam?: string | null;
}): string[] {
  const { status, audience = "public" } = opts;
  if (!isPublishedStatus(status)) {
    return [];
  }
  return audience === "members"
    ? [Permission.read(Role.team(MEMBERS_TEAM))]
    : [Permission.read(Role.any())];
}

/**
 * Build Appwrite $permissions for a content_translations / page_translations
 * row. Translation rows receive visibility equivalent to their parent (see
 * `buildContentRowPermissions`): published public → `read(any)`, published
 * member-only → members-team read, anything else → service-only.
 *
 * The `writeTeams`/`readTeams`/`ownerUserId` inputs are accepted for call-site
 * compatibility but intentionally ignored — authoring never lives in row ACLs.
 * Omitting `status` preserves the previous published default. Recruitment
 * translations use `buildJobTranslationPermissions` instead, because their
 * staff read access is a static (non-mirrored) team list.
 */
export function buildContentTranslationPermissions(opts: {
  audience?: "public" | "members";
  status?: string;
  writeTeams: string[];
  readTeams?: string[];
  ownerUserId?: string;
}): string[] {
  const { audience = "public", status } = opts;
  const published = status === undefined || isPublishedStatus(status);
  if (!published) {
    return [];
  }
  return audience === "members"
    ? [Permission.read(Role.team(MEMBERS_TEAM))]
    : [Permission.read(Role.any())];
}
