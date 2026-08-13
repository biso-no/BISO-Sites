import { Permission, Role } from "@repo/api";

/**
 * Row-level permissions for a user's own `user` profile row: read + update
 * scoped to that user.
 *
 * Shared between `updateProfile` (`src/lib/actions/user.ts`) and
 * `syncBiStudentIdentity` (`src/lib/actions/bi-identity.ts`) — both need to
 * create the profile row via the admin client when it doesn't exist yet, since
 * the row is created lazily (only at the final onboarding wizard step). Lives
 * outside both `"use server"` files because a `"use server"` file may only
 * export async functions — see CLAUDE.md.
 */
export function buildProfileRowPermissions(userId: string): string[] {
  const userRole = Role.user(userId);
  return [Permission.read(userRole), Permission.update(userRole)];
}
