import { Permission, Role } from "@repo/api";
import type { Users } from "@repo/api/types/appwrite";
import { z } from "zod";

/**
 * Profile columns a signed-in person may set on their own `user` row.
 *
 * Everything else on the row — `student_id`, the `bi_*` link columns,
 * `roles`, `membership_ids` — is written only by server code after its own
 * checks. Appwrite has no column permissions, so profile rows are read-only
 * to their owner (`buildProfileRowPermissions`) and this list is the whole of
 * self-service: the web's `updateProfile` and the API's `PUT /api/profile`
 * both write through it with the admin client.
 */
export const SELF_SERVICE_PROFILE_FIELDS = [
  "name",
  "phone",
  "address",
  "city",
  "zip",
  "bank_account",
  "swift",
  "avatar",
  "bio",
  "is_public",
  "campus_id",
  "departments",
] as const satisfies readonly (keyof Users)[];

export type SelfServiceProfileField =
  (typeof SELF_SERVICE_PROFILE_FIELDS)[number];

export function pickSelfServiceProfileFields(
  input: Partial<Users>
): Partial<Pick<Users, SelfServiceProfileField>> {
  const result: Partial<Pick<Users, SelfServiceProfileField>> = {};
  for (const key of SELF_SERVICE_PROFILE_FIELDS) {
    if (key in input) {
      // The conditional cast keeps the narrow per-key type from Users.
      result[key] = input[key] as never;
    }
  }
  return result;
}

const optionalText = (maxLength: number) =>
  z.string().trim().max(maxLength).nullable().optional();

/** Size of the `user.name` column. */
export const PROFILE_NAME_MAX_LENGTH = 30;

/**
 * Request-body validation for self-service profile writes. Lengths match the
 * `user` table's columns; unknown keys (including identity columns) are
 * stripped rather than rejected, so an older client sending extra fields
 * still saves what it may save.
 */
export const selfServiceProfileSchema = z.object({
  address: optionalText(100),
  avatar: optionalText(200),
  bank_account: optionalText(20),
  bio: optionalText(500),
  campus_id: optionalText(5),
  city: optionalText(50),
  departments: z.array(z.string().trim().min(1).max(36)).max(50).optional(),
  is_public: z.boolean().optional(),
  name: z.string().trim().min(1).max(PROFILE_NAME_MAX_LENGTH).optional(),
  phone: optionalText(20),
  swift: optionalText(15),
  zip: optionalText(20),
});

export type SelfServiceProfileInput = z.infer<typeof selfServiceProfileSchema>;

/** A `user` profile row is readable by its owner and writable by no client. */
export function buildProfileRowPermissions(userId: string): string[] {
  return [Permission.read(Role.user(userId))];
}

/** Size of the `user.email` column. */
export const PROFILE_EMAIL_MAX_LENGTH = 100;

/**
 * The `email` to stamp on an account's profile row: the address the account
 * signs in with. Never self-service — every server-side profile write takes it
 * from the account, never from the request. An address the column cannot hold
 * is left out, so the rest of the write still lands.
 */
export function accountEmailField(email: string | null | undefined): {
  email?: string;
} {
  const trimmed = email?.trim();
  if (!trimmed || trimmed.length > PROFILE_EMAIL_MAX_LENGTH) {
    return {};
  }
  return { email: trimmed };
}
