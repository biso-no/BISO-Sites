"use server";

import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { getBiDirectoryUser } from "@repo/connectors/azure/bi-directory";
import {
  BI_STUDENT_EMAIL_DOMAIN,
  identityBacksStudentId,
  parseBiStudentEmail,
} from "@repo/shared/utils/bi-student";
import { membershipCacheTag } from "@repo/shared/utils/membership-status";
import { buildProfileRowPermissions } from "@repo/shared/utils/profile-fields";
import { revalidateTag } from "next/cache";
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
        | "already_linked";
      success: false;
    };

/**
 * Completes a BI student account link.
 *
 * Appwrite only supports identity linking client-side, so the OAuth2 session is
 * started in the browser and this runs on the return leg. It reads the OIDC
 * identity's BI address, derives the student id, and enriches the profile with
 * the Azure employee id that Finago stores as the customer's ExternalId.
 *
 * Writes go through the admin client: these columns are identity assertions,
 * deliberately outside the self-service SELF_SERVICE_PROFILE_FIELDS allow-list.
 */
export async function syncBiStudentIdentity(): Promise<BiIdentitySyncResult> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      return { success: false, error: "not_authenticated" };
    }

    const identities = await account.listIdentities().catch(() => null);
    const biIdentity = identities?.identities.find(
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

    // The live membership check is keyed by the numeric student id; drop the
    // cached "no_student_id" result so status is correct immediately. This is
    // wrapped on its own: `revalidateTag` throws unconditionally when called
    // during a Server Component render phase (verified against the pinned
    // next@16.3.0 in this repo), and `unstable_rethrow` below does not
    // recognize that error as one of its control-flow signals, so it would
    // otherwise fall through to the catch and misreport a write that just
    // succeeded as `directory_unavailable`. The write above has already
    // landed by this point regardless of what happens here.
    try {
      revalidateTag(membershipCacheTag(parsed.studentNumber), { expire: 0 });
    } catch (error) {
      unstable_rethrow(error);
      console.error("[BI Identity] Cache invalidation failed:", error);
    }

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
    return { success: false, error: "directory_unavailable" };
  }
}
