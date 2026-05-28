import { Permission, Role } from "@repo/api";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

/**
 * Build Appwrite $permissions for a content_translations row.
 *
 * Public content (events, news, shop, pages, departments): readable by anyone.
 * Member-only content: readable by team:biso-members + write teams only.
 * Write teams (update/delete) are the department team(s) that own the content.
 */
export function buildContentTranslationPermissions(opts: {
  audience?: "public" | "members";
  writeTeams: string[];
  ownerUserId?: string;
}): string[] {
  const { audience = "public", writeTeams, ownerUserId } = opts;

  const readPerms =
    audience === "public"
      ? [Permission.read(Role.any())]
      : [
          Permission.read(Role.team("biso-members")),
          Permission.read(Role.team("admin")),
          ...writeTeams.map((t) => Permission.read(Role.team(t))),
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
