"use server";
import type { Models } from "@repo/api";
import { orNullIfNotFound } from "@repo/api/errors";
import {
  createAdminClient,
  createSessionClient,
  createSessionJwt,
} from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { membershipCacheTag } from "@repo/shared/utils/membership-status";
import {
  buildProfileRowPermissions,
  pickSelfServiceProfileFields,
} from "@repo/shared/utils/profile-fields";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
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

type SessionAccount = Awaited<
  ReturnType<typeof createSessionClient>
>["account"];

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

const CLEARED_BI_LINK = {
  student_id: null,
  bi_employee_id: null,
  bi_campus_id: null,
  bi_linked_at: null,
} as const;

/**
 * Clears the BI student link (`student_id` + the `bi_*` enrichment columns).
 * Writes go through the admin client — these columns are deliberately outside
 * the self-service `SELF_SERVICE_PROFILE_FIELDS` allow-list, same as
 * `syncBiStudentIdentity`.
 *
 * Runs BEFORE the OIDC identity is deleted and throws on failure, so a failed
 * clear aborts the unlink instead of leaving an unlinked account that still
 * holds `student_id` (and therefore member status/pricing).
 *
 * Returns the columns as they were, so the caller can put them back if the
 * identity deletion that follows fails, or `null` when there was no profile
 * row (nothing to clear).
 */
async function clearBiStudentLink(
  adminDb: AdminDb,
  userId: string
): Promise<Partial<BiUser> | null> {
  const profile = await orNullIfNotFound(
    adminDb.getRow<BiUser>("app", "user", userId)
  );
  if (!profile) {
    return null;
  }

  await adminDb.updateRow<BiUser>("app", "user", userId, CLEARED_BI_LINK);

  // The cached membership status is keyed by the numeric student id; bust it
  // so this account stops being reported as a member immediately instead of
  // for up to MEMBERSHIP_CACHE_TTL_SECONDS.
  const numericId = sanitizeStudentNumber(profile.student_id ?? null);
  if (numericId !== null) {
    revalidateTag(membershipCacheTag(numericId), { expire: 0 });
  }

  return {
    student_id: profile.student_id ?? null,
    bi_employee_id: profile.bi_employee_id ?? null,
    bi_campus_id: profile.bi_campus_id ?? null,
    bi_linked_at: profile.bi_linked_at ?? null,
  };
}

/**
 * Best-effort undo of `clearBiStudentLink` when the identity it prepared for
 * could not be deleted, so the still-linked account keeps its link. If this
 * fails too, the account is left unlinked-but-holding-the-identity, which
 * fails safe (no member status) and is fixed by relinking.
 */
async function restoreBiStudentLink(
  adminDb: AdminDb,
  userId: string,
  previous: Partial<BiUser>
): Promise<void> {
  try {
    await adminDb.updateRow<BiUser>("app", "user", userId, previous);
  } catch (error) {
    console.error(
      "Failed to restore BI student link after identity removal failed",
      error
    );
  }
}

async function removeOidcIdentity(
  account: SessionAccount,
  identityId: string
): Promise<void> {
  const user = await account.get();
  const { db: adminDb } = await createAdminClient();

  const previous = await clearBiStudentLink(adminDb, user.$id);

  try {
    await account.deleteIdentity(identityId);
  } catch (error) {
    if (previous) {
      await restoreBiStudentLink(adminDb, user.$id, previous);
    }
    throw error;
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
    const { identities } = await account.listIdentities();
    // The SDK returns class instances that also carry the provider's access
    // and refresh tokens. Pages hand this result to Client Components, so
    // return plain objects with only the non-secret fields.
    return {
      identities: identities.map((identity) => ({
        $id: identity.$id,
        provider: identity.provider,
        providerUid: identity.providerUid,
        providerEmail: identity.providerEmail,
      })),
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function removeIdentity(
  identityId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { account } = await createSessionClient();

    // Determine before deleting whether this is the BI Student (OIDC)
    // identity — deleting it without clearing student_id would let a user
    // unlink and keep member status/pricing indefinitely (or hand off a
    // still-"member" account to someone else). A failed lookup must fail the
    // action: treating it as "not OIDC" is exactly how that clear got skipped.
    const { identities } = await account.listIdentities();
    const removedIdentity = identities.find(
      (identity) => identity.$id === identityId
    );
    if (!removedIdentity) {
      return { success: false, error: "Identity not found" };
    }

    if (isOidcIdentity(removedIdentity)) {
      await removeOidcIdentity(account, identityId);
    } else {
      await account.deleteIdentity(identityId);
    }

    return { success: true };
  } catch (error) {
    unstable_rethrow(error);
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to remove identity", error);
    return { success: false, error: message };
  }
}

/**
 * Saves the signed-in person's own profile.
 *
 * Profile rows are read-only to their owner, so the self-service allow-list
 * is what stands between this request and the row; the write itself uses the
 * admin client. A missing row is created here, because onboarding creates the
 * profile lazily at its last step.
 */
export async function updateProfile(profile: Partial<Users>) {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    const writable = pickSelfServiceProfileFields(profile);
    const { db: adminDb } = await createAdminClient();

    const existing = await orNullIfNotFound(
      adminDb.getRow<Users>("app", "user", user.$id)
    );

    if (!existing) {
      // createRow's typed signature wants the full row; we're seeding a
      // partial profile that the user will fill in over time. Omit the
      // generic so the Appwrite SDK accepts the partial payload.
      return await adminDb.createRow(
        "app",
        "user",
        user.$id,
        writable,
        buildProfileRowPermissions(user.$id)
      );
    }

    if (typeof writable.name === "string" && writable.name.length > 0) {
      await account.updateName(writable.name);
    }
    return await adminDb.updateRow<Users>("app", "user", user.$id, writable);
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
