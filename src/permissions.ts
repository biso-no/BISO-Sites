import { buildRecruitmentStaffRowPermissions } from "../packages/shared/recruitment";
import { Permission, Role } from "node-appwrite";

/**
 * Visibility half of the row ACLs, mirroring buildJobRowPermissions() in
 * apps/admin/src/lib/recruitment.ts and buildContentTranslationPermissions()
 * in apps/admin/src/lib/utils.ts. The staff half is imported from
 * @repo/shared/recruitment rather than copied, so it cannot drift.
 *
 * Imported content is only visible on the public site when these strings are
 * right, so permissions.test.ts pins the behaviour.
 */
export function buildPublicContentPermissions(status: string): string[] {
  return status === "published" ? [Permission.read(Role.any())] : [];
}

export function buildJobPermissions(status: string): string[] {
  const visibility =
    status === "published" ? [Permission.read(Role.any())] : [];
  return [
    ...new Set([...visibility, ...buildRecruitmentStaffRowPermissions()]),
  ];
}
