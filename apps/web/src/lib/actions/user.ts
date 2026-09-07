"use server";
import type { Models } from "@repo/api";
import {
  createAdminClient,
  createSessionClient,
  createSessionJwt,
} from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { membershipCacheTag } from "@repo/shared/utils/membership-status";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { buildProfileRowPermissions } from "@/lib/actions/profile-permissions";
import { isAuthenticatedAccount } from "@/lib/auth-utils";
import { SESSION_COOKIE } from "@/lib/cookie-prefs";

const _BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

// The bi_* columns are pending an `appwrite push tables`; extend locally until
// packages/api/types/appwrite.ts is regenerated. Mirrors the pattern in
// src/lib/actions/bi-identity.ts.
type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
  bi_linked_at?: string | null;
};

function isOidcIdentity(identity: { provider?: string } | undefined): boolean {
  return String(identity?.provider ?? "").toLowerCase() === "oidc";
}

/**
 * Clears the BI student link (`student_id` + the `bi_*` enrichment columns)
 * after the linked OIDC identity has been removed. Writes go through the
 * admin client — these columns are deliberately outside the self-service
 * `PROFILE_WRITABLE_FIELDS` allow-list, same as `syncBiStudentIdentity`.
 *
 * The Appwrite identity is already deleted by the time this runs, so a
 * failure here must not fail the whole unlink action — it is logged and
 * swallowed, leaving `student_id` (and therefore member pricing/status)
 * stale until the next successful clear or relink.
 */
async function clearBiStudentLink(
  account: Awaited<ReturnType<typeof createSessionClient>>["account"]
) {
  try {
    const user = await account.get();
    const { db: adminDb } = await createAdminClient();
    const profile = (await adminDb
      .getRow<BiUser>("app", "user", user.$id)
      .catch(() => null)) as BiUser | null;
    const previousStudentId = profile?.student_id ?? null;

    await adminDb.updateRow<BiUser>("app", "user", user.$id, {
      student_id: null,
      bi_employee_id: null,
      bi_campus_id: null,
      bi_linked_at: null,
    });

    // The cached membership status is keyed by the numeric student id; bust
    // it so this account stops being reported as a member immediately
    // instead of for up to MEMBERSHIP_CACHE_TTL_SECONDS.
    const numericId = sanitizeStudentNumber(previousStudentId);
    if (numericId !== null) {
      revalidateTag(membershipCacheTag(numericId), { expire: 0 });
    }
  } catch (error) {
    console.error(
      "Failed to clear BI student link after identity removal",
      error
    );
  }
}

/**
 * Request-memoized: the public layout, membership resolution, and several
 * pages all need the current user in one render — `cache()` collapses those
 * into a single `account.get()` + profile read per request.
 */
const _getLoggedInUser = cache(
  async (): Promise<{
    user: Models.User<Models.Preferences>;
    profile: Users | null;
  } | null> => {
    try {
      const cookiesStore = await cookies();
      const session = cookiesStore.get(SESSION_COOKIE);
      if (!session) {
        return null;
      }
      const { account, db } = await createSessionClient();

      const user = await account.get();

      if (!isAuthenticatedAccount(user)) {
        return null;
      }

      try {
        const profile = await db.getRow<Users>("app", "user", user.$id);
        return { user, profile };
      } catch {
        // Profile row doesn't exist yet — return the account anyway.
        return { user, profile: null };
      }
    } catch (error) {
      // Never swallow Next.js control-flow signals (prerender bailout,
      // redirect, notFound) thrown by cookies() & co. — doing so lets
      // prerendering continue past the dynamic access and trips
      // blocking-prerender errors downstream.
      unstable_rethrow(error);
      console.error("Error getting logged in user!!", error);
      return null;
    }
  }
);

// biome-ignore lint/suspicious/useAwait: async required by "use server" — returns memoized promise
export async function getLoggedInUser(): Promise<{
  user: Models.User<Models.Preferences>;
  profile: Users | null;
} | null> {
  return _getLoggedInUser();
}

export async function listIdentities() {
  try {
    const { account } = await createSessionClient();
    const identities = await account.listIdentities();
    return identities;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function removeIdentity(identityId: string) {
  try {
    const { account } = await createSessionClient();

    // Determine before deleting whether this is the BI Student (OIDC)
    // identity — deleting it without clearing student_id would let a user
    // unlink and keep member status/pricing indefinitely (or hand off a
    // still-"member" account to someone else).
    const identities = await account.listIdentities().catch(() => null);
    const removedIdentity = identities?.identities.find(
      (identity) => identity.$id === identityId
    );
    const wasOidc = isOidcIdentity(removedIdentity);

    await account.deleteIdentity(identityId);

    if (wasOidc) {
      await clearBiStudentLink(account);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to remove identity", error);
    return { success: false, error: message };
  }
}

// Fields users may edit themselves via updateProfile. Everything else on
// the Users row (roles, isActive, campus_id, department_ids,
// membership_ids, student_id, email) is managed elsewhere — by the
// Microsoft / 24SO sync, by dedicated server actions, or by the admin
// CMS — so we don't accept caller-supplied writes to those columns.
const PROFILE_WRITABLE_FIELDS = [
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
] as const satisfies readonly (keyof Users)[];

type WritableProfileField = (typeof PROFILE_WRITABLE_FIELDS)[number];

function pickWritableProfileFields(
  input: Partial<Users>
): Partial<Pick<Users, WritableProfileField>> {
  const result: Partial<Pick<Users, WritableProfileField>> = {};
  for (const key of PROFILE_WRITABLE_FIELDS) {
    if (key in input) {
      // The conditional cast keeps the narrow per-key type from Users.
      result[key] = input[key] as never;
    }
  }
  return result;
}

/**
 * Appwrite row -> plain object.
 *
 * **`createRow` and `updateRow` return SDK class instances, and this is a
 * server action, so its return value is serialized to the client.** The `db`
 * proxy in `@repo/api/server` plain-ifies only `listRows` and `getRow`, so
 * returning a written row straight from here threw
 *
 *   "Only plain objects, and a few built-ins, can be passed to Client
 *    Components from Server Components."
 *
 * **after the write had already succeeded** — so onboarding, `/profile`'s save
 * and expense-v3's profile-completion banner all reported "Noe gikk galt. Prøv
 * igjen." on a row that was in fact saved. Retrying took the update branch and
 * failed identically, so a new user could not get past onboarding at all.
 *
 * Fixed here rather than in `@repo/api`, whose proxy is the real home for it:
 * that file is shared with `apps/admin` and widening it is a decision to raise,
 * not an implementation detail. The recommendation is recorded in STATUS.
 *
 * A JSON round-trip, not `structuredClone` — for the reason the proxy already
 * documents: node-appwrite responses carry a lazy serializer function that
 * `JSON.stringify` drops and `structuredClone` rejects.
 */
function toPlainRow<T>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T;
}

export async function updateProfile(profile: Partial<Users>) {
  try {
    const { account, db } = await createSessionClient();
    const user = await account.get();

    const writable = pickWritableProfileFields(profile);

    try {
      await db.getRow<Users>("app", "user", user.$id);
      if (typeof writable.name === "string" && writable.name.length > 0) {
        await account.updateName(writable.name);
      }
      return toPlainRow(
        await db.updateRow<Users>("app", "user", user.$id, writable)
      );
    } catch {
      // createRow's typed signature wants the full row; we're seeding a
      // partial profile that the user will fill in over time. Omit the
      // generic so the Appwrite SDK accepts the partial payload.
      const { db: adminDb } = await createAdminClient();
      return toPlainRow(
        await adminDb.createRow(
          "app",
          "user",
          user.$id,
          writable,
          buildProfileRowPermissions(user.$id)
        )
      );
    }
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return null;
  }
}

/**
 * Mints a one-time token the browser can trade for a *real* Appwrite session.
 *
 * Account linking is the one flow that cannot be driven from the server. When
 * `account.createOAuth2Session` runs, the Appwrite Web SDK does nothing but
 * `window.location.href = <endpoint>/account/sessions/oauth2/<provider>?…` —
 * a plain top-level navigation, carrying no headers. Appwrite decides then and
 * there whether to *link* the incoming identity or *create a user*, and it
 * makes that call purely on whether the request arrives with an active session:
 *
 *   "If there is already an active session, the new session will be attached
 *    to the logged-in account. […] If no matching user is found - the server
 *    will create a new user."
 *
 * A navigation can only carry a cookie, and this app's session secret lives in
 * `a_session_biso_web` — a name Appwrite ignores by design, because naming it
 * `a_session_biso` is what broke `admin.biso.no` sign-in with
 * `409 user_already_exists` (see LEGACY_SESSION_COOKIE). `client.setSession()`
 * does not help either: it only sets an `X-Appwrite-Session` header, which the
 * redirect never sends. So the browser genuinely has no Appwrite session, and
 * an OAuth link attempt silently becomes a signup.
 *
 * The fix is to let Appwrite issue its own cookie on its own domain. The
 * browser calls `account.createSession(userId, secret)` with this token — a
 * real XHR, so Appwrite replies with `Set-Cookie` for `appwrite.biso.no` — and
 * the subsequent OAuth navigation carries it.
 *
 * The token is derived solely from the caller's existing session; it never
 * accepts a user id. It therefore grants exactly the access the caller already
 * has, and nothing more.
 */
export async function createClientSessionToken(): Promise<{
  secret: string;
  userId: string;
} | null> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();

    // Same bar as getLoggedInUser: an anonymous session must not be able to
    // mint a client session and start linking identities onto itself.
    if (!isAuthenticatedAccount(user)) {
      return null;
    }

    const { users } = await createAdminClient();
    const token = await users.createToken({ userId: user.$id });
    return { userId: token.userId, secret: token.secret };
  } catch (error) {
    console.error("Failed to mint client session token:", error);
    return null;
  }
}

export async function createJWT(): Promise<string | null> {
  try {
    return await createSessionJwt();
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function deleteUserData() {
  const { account } = await createSessionClient();
  const { users } = await createAdminClient();
  const user = await account.get();
  await users.delete(user.$id);
  return true;
}
