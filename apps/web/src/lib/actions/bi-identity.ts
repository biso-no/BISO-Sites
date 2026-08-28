"use server";

import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { getBiDirectoryUser } from "@repo/connectors/azure/bi-directory";
import {
  BI_STUDENT_EMAIL_DOMAIN,
  parseBiStudentEmail,
} from "@repo/shared/utils/bi-student";
import { membershipCacheTag } from "@repo/shared/utils/membership-status";
import { revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { buildProfileRowPermissions } from "@/lib/actions/profile-permissions";

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
 * Two independent gates protect it. The variable must be set, and `NODE_ENV`
 * must not be "production" — the second exists so that a value left behind in
 * a production deploy is inert instead of a privilege-escalation path.
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
  if (process.env.NODE_ENV === "production") {
    return null;
  }

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
      console.warn(
        `[BI Identity] ${DEV_STUDENT_OVERRIDE_ENV} active: treating ${from} as ${parsed.studentId}@${BI_STUDENT_EMAIL_DOMAIN}`
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
        | "directory_unavailable";
      success: false;
    };

/**
 * Completes a BI student account link.
 *
 * Appwrite only supports identity linking client-side, so the OAuth2 session is
 * started in the browser and this runs on the return leg. It reads the OIDC
 * identity's BI address, derives the student id, and enriches the profile with
 * the Azure employee id that Finago uses as the customer number.
 *
 * Writes go through the admin client: these columns are identity assertions,
 * deliberately outside the self-service PROFILE_WRITABLE_FIELDS allow-list.
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

    const { db } = await createAdminClient();
    const update: Partial<BiUser> = {
      student_id: parsed.studentId,
      bi_linked_at: new Date().toISOString(),
    };
    if (employeeId) {
      update.bi_employee_id = employeeId;
    }
    if (campusHint) {
      const existing = (await db
        .getRow<BiUser>("app", "user", user.$id)
        .catch(() => null)) as BiUser | null;
      if (!existing?.bi_campus_id) {
        update.bi_campus_id = campusHint;
      }
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
      // gap. `PROFILE_WRITABLE_FIELDS` stays untouched — these bi_* columns
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
