// The BI student link itself: parse the OIDC identity, verify the claim is
// not held elsewhere, enrich from BI's directory and write the profile. This
// module is deliberately NOT a "use server" file: it takes a user id and
// writes through the admin client, so it must never be reachable as a server
// action. The session-bound action in ./actions/bi-identity.ts and the OAuth
// return route are its only callers.

import "server-only";

import { randomBytes } from "node:crypto";
import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { getBiDirectoryUser } from "@repo/connectors/azure/bi-directory";
import {
  BI_STUDENT_EMAIL_DOMAIN,
  identityBacksStudentId,
  parseBiStudentEmail,
} from "@repo/shared/utils/bi-student";
import { buildProfileRowPermissions } from "@repo/shared/utils/profile-fields";
import { unstable_rethrow } from "next/navigation";

// The bi_* columns are pending an `appwrite push tables`; extend locally until
// packages/api/types/appwrite.ts is regenerated.
type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
  bi_linked_at?: string | null;
};

/**
 * True when an Appwrite SDK error's `code` indicates the row was not found.
 * Mirrors the identical helper in
 * `packages/connectors/src/24sevenoffice/membership-sync.ts`.
 */
function isRowNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 404
  );
}

type AdminClients = Awaited<ReturnType<typeof createAdminClient>>;

/**
 * One BISO account per BI student account, checked before a link is written.
 *
 * Another account holding the same `student_id` blocks the link only when
 * that hold is verified — the other account has a BI (OIDC) identity for the
 * same student. The identity Appwrite just attached to the current account is
 * then removed, so it is not left holding a BI identity with no link. A hold
 * nothing verifies (written before profile rows were locked, or by the retired
 * app flow) is not a link: it is cleared and the verified student proceeds.
 *
 * Returns true when the link must be refused.
 */
async function refuseIfLinkedElsewhere(
  { db, users }: Pick<AdminClients, "db" | "users">,
  {
    currentUserId,
    identityId,
    studentId,
  }: { currentUserId: string; identityId: string; studentId: string }
): Promise<boolean> {
  const holders = await db.listRows<BiUser>("app", "user", [
    Query.equal("student_id", studentId),
    Query.notEqual("$id", currentUserId),
    Query.limit(25),
  ]);

  for (const holder of holders.rows) {
    const { identities } = await users.listIdentities({
      queries: [Query.equal("userId", holder.$id), Query.limit(25)],
    });

    if (identityBacksStudentId(identities, studentId)) {
      await users.deleteIdentity({ identityId }).catch((error: unknown) => {
        console.error(
          "[BI Identity] Could not remove the refused identity:",
          error
        );
      });
      console.warn(
        `[BI Identity] ${studentId} is already linked to ${holder.$id}; refused the link for ${currentUserId}`
      );
      return true;
    }

    await db.updateRow<BiUser>("app", "user", holder.$id, {
      bi_campus_id: null,
      bi_employee_id: null,
      bi_linked_at: null,
      student_id: null,
    });
    console.warn(
      `[BI Identity] Cleared an unverified claim to ${studentId} on ${holder.$id}`
    );
  }

  return false;
}

/**
 * The campus hint to write, or `null` to leave the existing value alone.
 *
 * Split out of `syncBiStudentIdentity` purely to keep that function's
 * cognitive complexity under the lint limit — the behavior (never overwrite
 * an already-set `bi_campus_id`) is unchanged.
 */
async function resolveCampusHintUpdate(
  db: Pick<AdminClients, "db">["db"],
  userId: string,
  campusHint: string | null
): Promise<string | null> {
  if (!campusHint) {
    return null;
  }
  const existing = (await db
    .getRow<BiUser>("app", "user", userId)
    .catch(() => null)) as BiUser | null;
  return existing?.bi_campus_id ? null : campusHint;
}

const DEV_STUDENT_OVERRIDE_ENV = "BI_DEV_STUDENT_EMAIL_OVERRIDE";
const DEV_OVERRIDE_ENTRY_SEPARATOR = ",";
const DEV_OVERRIDE_PAIR_SEPARATOR = "=";

/**
 * Dev-only escape hatch for exercising the BI link flow without a live student
 * account.
 *
 * `parseBiStudentEmail` accepts only `s<digits>@bi.no`, which is the correct
 * production rule — a staff address must never be able to assert a fabricated
 * student number. The cost is that anyone who has left BI, and so lost their
 * student mailbox, cannot walk this flow at all while developing against it.
 *
 * `BI_DEV_STUDENT_EMAIL_OVERRIDE` maps such an address onto a known student
 * id, comma-separating to map more than one:
 *
 *   BI_DEV_STUDENT_EMAIL_OVERRIDE="firstname.lastname@bi.no=s1715738"
 *
 * The right-hand side is put back through `parseBiStudentEmail`, so an
 * override can only ever yield an id the strict parser would have accepted on
 * its own: the variable relaxes *which address* is trusted, never *what shape*
 * a student id may take. A malformed or non-student right-hand side is
 * ignored rather than trusted.
 *
 * The variable is the ONLY gate. There is deliberately no `NODE_ENV` check:
 * Appwrite account linking cannot be exercised from `localhost` at all — a
 * page on `localhost:3000` cannot present any cookie to `appwrite.biso.no`,
 * so the OAuth redirect is always anonymous there — which means this feature
 * can only be tested against a real deployment.
 *
 * That makes an unset variable the whole of the security boundary, so treat
 * it as live credentials: setting it in production lets the named address
 * assert the mapped student number, and therefore that student's membership.
 * Set it only for as long as a test needs, and unset it immediately after.
 * Every resolution logs at `error` level precisely so a forgotten value is
 * loud in production logs rather than silent.
 *
 * The matched address comes back as `directoryEmail` so the caller can aim the
 * Graph lookup at the account that actually exists. Synthesizing
 * `<studentId>@bi.no` and querying that would always miss — the whole reason
 * the override is needed is that the student mailbox is gone — leaving
 * `bi_employee_id` unset and the directory half of this flow untested.
 */
function resolveDevStudentOverride(emails: Array<string | null | undefined>): {
  directoryEmail: string;
  studentId: string;
  studentNumber: number;
} | null {
  const raw = process.env[DEV_STUDENT_OVERRIDE_ENV];
  if (!raw) {
    return null;
  }

  const candidates = new Set(
    emails
      .map((email) => email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email))
  );
  if (candidates.size === 0) {
    return null;
  }

  for (const entry of raw.split(DEV_OVERRIDE_ENTRY_SEPARATOR)) {
    const separatorIndex = entry.indexOf(DEV_OVERRIDE_PAIR_SEPARATOR);
    if (separatorIndex <= 0) {
      continue;
    }

    const from = entry.slice(0, separatorIndex).trim().toLowerCase();
    if (!candidates.has(from)) {
      continue;
    }

    // Accept either a bare local part (`s1715738`) or a full address on the
    // right-hand side; both end up validated by the same strict parser.
    const to = entry
      .slice(separatorIndex + 1)
      .trim()
      .toLowerCase();
    const parsed = parseBiStudentEmail(
      to.includes("@") ? to : `${to}@${BI_STUDENT_EMAIL_DOMAIN}`
    );
    if (parsed) {
      // Deliberately `error`, not `warn`: this bypasses the student-email
      // check, and a value left set in production must be impossible to miss.
      console.error(
        `[BI Identity] ${DEV_STUDENT_OVERRIDE_ENV} is SET and matched: treating ${from} as ${parsed.studentId}@${BI_STUDENT_EMAIL_DOMAIN}. Unset this variable when testing is done.`
      );
      return { ...parsed, directoryEmail: from };
    }
  }

  return null;
}

export type BiIdentitySyncResult =
  | {
      campusHint: string | null;
      hasEmployeeId: boolean;
      studentId: string;
      success: true;
    }
  | {
      error:
        | "not_authenticated"
        | "no_bi_identity"
        | "invalid_bi_email"
        | "directory_unavailable"
        | "already_linked"
        | "sync_failed";
      success: false;
    };

export interface SyncSubject {
  email: string | null | undefined;
  identities: readonly {
    $createdAt?: string;
    $id: string;
    provider: string;
    providerEmail?: string | null;
    providerUid?: string | null;
  }[];
  userId: string;
}

/**
 * The same sync for an account that has just signed in with its BI student
 * account, before the session cookie exists on any request.
 *
 * Signing in through Appwrite's OIDC provider attaches the BI identity to the
 * account itself, so no browser-side link step is needed: the OAuth return
 * route calls this with the new session's user id and the student number is
 * on the profile from the first page load. Everything is read through the
 * admin client because the route is still holding the session secret it has
 * yet to set.
 */
/**
 * Whether a BI identity was just attached to an account someone had set up
 * earlier with a password.
 *
 * Appwrite merges a BI sign-in into the account that holds the same bi.no
 * email. With email/password sign-up open, anyone can register a student's
 * address ahead of time; the student's first BI sign-in then lands in that
 * account, and whoever set the password keeps a key to it. The tell is an
 * identity minutes old on an account that is older and has a password. A
 * legitimate student never has a password: this app signs in with BI or a
 * login link only.
 */
export function isFreshMergeIntoPasswordAccount(input: {
  identityCreatedAt: string;
  now?: Date;
  passwordUpdate: string | null | undefined;
  userCreatedAt: string;
}): boolean {
  if (!input.passwordUpdate) {
    return false;
  }
  const now = (input.now ?? new Date()).getTime();
  const identityAt = new Date(input.identityCreatedAt).getTime();
  const userAt = new Date(input.userCreatedAt).getTime();
  if (!(Number.isFinite(identityAt) && Number.isFinite(userAt))) {
    return false;
  }
  return (
    now - identityAt <= FRESH_IDENTITY_WINDOW_MS &&
    identityAt - userAt >= PRE_EXISTING_ACCOUNT_GAP_MS
  );
}

const FRESH_IDENTITY_WINDOW_MS = 10 * 60 * 1000;
const PRE_EXISTING_ACCOUNT_GAP_MS = 60 * 1000;
const ROTATED_PASSWORD_BYTES = 32;

/**
 * Locks everyone but the student out of an account the sign-in just merged
 * into: every other session is ended and the password is replaced with one
 * nobody knows. The student is unaffected — they are in the session that
 * stays, and they sign in with BI or a login link, never a password.
 */
async function lockOutPriorHolders(
  users: AdminClients["users"],
  userId: string,
  currentSessionId: string
): Promise<void> {
  const { sessions } = await users.listSessions({ userId });
  await Promise.all(
    sessions
      .filter((session) => session.$id !== currentSessionId)
      .map((session) => users.deleteSession({ sessionId: session.$id, userId }))
  );
  await users.updatePassword({
    password: randomBytes(ROTATED_PASSWORD_BYTES).toString("base64url"),
    userId,
  });
  console.warn(
    `[BI Identity] ${userId} had a password before its BI identity was attached; other sessions ended and password rotated`
  );
}

export async function syncBiStudentIdentityAfterSignIn(
  userId: string,
  options: { currentSessionId?: string } = {}
): Promise<BiIdentitySyncResult> {
  const { db, users } = await createAdminClient();
  const [user, identities] = await Promise.all([
    users.get(userId).catch(() => null),
    users
      .listIdentities({
        queries: [Query.equal("userId", userId), Query.limit(25)],
      })
      .catch((error: unknown) => {
        console.error("[BI Identity] Could not list identities:", error);
        return null;
      }),
  ]);
  if (!user) {
    return { success: false, error: "not_authenticated" };
  }
  const subject: SyncSubject = {
    email: user.email,
    identities: identities?.identities ?? [],
    userId,
  };

  const biIdentity = subject.identities.find(
    (identity) => identity.provider.toLowerCase() === "oidc"
  );
  if (
    options.currentSessionId &&
    biIdentity?.$createdAt &&
    isFreshMergeIntoPasswordAccount({
      identityCreatedAt: biIdentity.$createdAt,
      passwordUpdate: user.passwordUpdate,
      userCreatedAt: user.$createdAt,
    })
  ) {
    await lockOutPriorHolders(users, userId, options.currentSessionId);
  }

  // A returning student is already linked: skip the directory round trip,
  // the duplicate check and the profile write, and keep `bi_linked_at` as
  // the time the link was first made rather than the last sign-in.
  const existing = await alreadyLinkedProfile(db, subject);
  if (existing) {
    return existing;
  }
  return await syncBiStudentIdentityFor(subject);
}

/**
 * The success result for a profile that already carries this identity's
 * student number and a directory record, or null when the full sync is
 * needed. Only the strict email parse counts here; the dev override is left
 * to the full path.
 */
async function alreadyLinkedProfile(
  db: AdminClients["db"],
  subject: SyncSubject
): Promise<BiIdentitySyncResult | null> {
  const biIdentity = subject.identities.find(
    (identity) => identity.provider.toLowerCase() === "oidc"
  );
  const parsed =
    parseBiStudentEmail(biIdentity?.providerEmail) ??
    parseBiStudentEmail(biIdentity?.providerUid);
  if (!parsed) {
    return null;
  }
  const profile = (await db
    .getRow<BiUser>("app", "user", subject.userId)
    .catch(() => null)) as BiUser | null;
  if (profile?.student_id !== parsed.studentId || !profile.bi_employee_id) {
    return null;
  }
  return {
    success: true,
    studentId: parsed.studentId,
    hasEmployeeId: true,
    campusHint: profile.bi_campus_id ?? null,
  };
}

export async function syncBiStudentIdentityFor(
  subject: SyncSubject
): Promise<BiIdentitySyncResult> {
  try {
    const user = { $id: subject.userId, email: subject.email };
    const biIdentity = subject.identities.find(
      (identity) => identity.provider.toLowerCase() === "oidc"
    );
    if (!biIdentity) {
      return { success: false, error: "no_bi_identity" };
    }

    // The dev override runs last, only once both strict parses have failed,
    // and only for an account that has genuinely completed an OIDC link —
    // the `biIdentity` check above still stands. `user.email` joins the
    // candidates because the OIDC identity may carry a UPN that differs from
    // the address the developer actually signs in with.
    const strict =
      parseBiStudentEmail(biIdentity.providerEmail) ??
      parseBiStudentEmail(biIdentity.providerUid);
    const override = strict
      ? null
      : resolveDevStudentOverride([
          biIdentity.providerEmail,
          biIdentity.providerUid,
          user.email,
        ]);
    const parsed = strict ?? override;
    if (!parsed) {
      return { success: false, error: "invalid_bi_email" };
    }

    const { db, users } = await createAdminClient();
    if (
      await refuseIfLinkedElsewhere(
        { db, users },
        {
          currentUserId: user.$id,
          identityId: biIdentity.$id,
          studentId: parsed.studentId,
        }
      )
    ) {
      return { success: false, error: "already_linked" };
    }

    let employeeId: string | null = null;
    let campusHint: string | null = null;
    let directoryFailed = false;

    // Normally the student address the id was parsed out of. Under the dev
    // override it is the address the developer actually signed in with, which
    // is the one the tenant can still resolve — see `resolveDevStudentOverride`.
    const directoryEmail =
      override?.directoryEmail ??
      `${parsed.studentId}@${BI_STUDENT_EMAIL_DOMAIN}`;

    try {
      const directoryUser = await getBiDirectoryUser(directoryEmail);
      employeeId = directoryUser?.employeeId ?? null;
      campusHint = directoryUser?.campusHint ?? null;
    } catch (error) {
      directoryFailed = true;
      console.error("[BI Identity] Directory lookup failed:", error);
    }

    const update: Partial<BiUser> = {
      student_id: parsed.studentId,
      bi_linked_at: new Date().toISOString(),
    };
    if (employeeId) {
      update.bi_employee_id = employeeId;
    }
    const campusHintUpdate = await resolveCampusHintUpdate(
      db,
      user.$id,
      campusHint
    );
    if (campusHintUpdate) {
      update.bi_campus_id = campusHintUpdate;
    }

    try {
      await db.updateRow<BiUser>("app", "user", user.$id, update);
    } catch (error) {
      if (!isRowNotFoundError(error)) {
        throw error;
      }
      // The profile row is created LAZILY — only at the final onboarding
      // wizard step (see `updateProfile` in `src/lib/actions/user.ts`) —
      // while this BI-link step runs earlier, on the very first return leg.
      // A brand-new user linking during onboarding has no row yet for
      // updateRow to find, every time. Create it instead, using the same
      // shape/permissions `updateProfile` falls back to for the identical
      // gap. `SELF_SERVICE_PROFILE_FIELDS` stays untouched — these bi_* columns
      // remain outside self-service by design; this write goes through the
      // admin client, same as the update above.
      //
      // createRow's typed signature wants the full row; we're seeding a
      // partial profile the user fills in over time (same gap `updateProfile`
      // hits). Omit the generic so the Appwrite SDK accepts the partial
      // payload.
      await db.createRow(
        "app",
        "user",
        user.$id,
        update,
        buildProfileRowPermissions(user.$id)
      );
    }

    // Partial success: `student_id` is written, only the directory
    // enrichment (`bi_employee_id`) is missing. Callers treat this as linked
    // and let the join gate offer a retry. Distinct from `sync_failed`
    // below, where the write itself never landed.
    if (directoryFailed) {
      return { success: false, error: "directory_unavailable" };
    }

    return {
      success: true,
      studentId: parsed.studentId,
      hasEmployeeId: Boolean(employeeId),
      campusHint,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[BI Identity] Sync failed:", error);
    // Everything that can throw into here runs before or during the profile
    // write, so the link did NOT land. Reporting this as
    // `directory_unavailable` (a partial success) made the link route mark
    // the student as linked when nothing was written.
    return { success: false, error: "sync_failed" };
  }
}
