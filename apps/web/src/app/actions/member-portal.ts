"use server";
import { ID, Permission, Query } from "@repo/api";
import { appwriteErrorStatus } from "@repo/api/errors";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  BenefitReveals,
  PublicProfiles,
  Users,
} from "@repo/api/types/appwrite";
import {
  benefitsForCampus,
  type PublicBenefit,
} from "@repo/shared/utils/benefit-public";
import {
  type RevealDb,
  revealBenefitCode,
} from "@repo/shared/utils/benefit-reveal-server";
import { isTransientMembershipReason } from "@repo/shared/utils/membership-gate";
import { getLiveMembershipStatus } from "@/lib/actions/membership";
import { isAuthenticatedAccount } from "@/lib/auth-utils";
import { getPublicBenefits } from "@/lib/data/benefits";

const FEATURED_BENEFIT_LIMIT = 6;
const UNAUTHORIZED = 401;
const BENEFIT_DATABASE_ID = "app";

async function createOrUpdatePublicProfile(
  profile: Partial<PublicProfiles>,
  isPublic: boolean
): Promise<PublicProfiles | null> {
  if (!profile.$id) {
    return null;
  }
  if (!profile.name) {
    console.error("Cannot create/update public profile without name");
    return null;
  }
  if (!profile.user_id) {
    console.error("Cannot create/update public profile without user ID");
    return null;
  }
  const { db } = await createAdminClient();
  return await db.upsertRow<PublicProfiles>(
    "app",
    "public_profiles",
    profile.$id,
    {
      avatar: profile.avatar || null,
      campus_id: profile.campus_id || null,
      email: profile.email || null,
      phone: profile.phone || null,
      name: profile.name,
      email_visible: profile.email_visible,
      phone_visible: profile.phone_visible,
      user_id: profile.user_id,
    },
    [
      isPublic
        ? Permission.read("any")
        : Permission.read(`user:${profile.user_id}`),
      Permission.update(`user:${profile.user_id}`),
    ]
  );
}

/**
 * The member-section benefits a visitor can see on the portal: their campus
 * first, then national. Carries no redemption value; codes only leave the
 * server through `revealBenefit`.
 *
 * @param campusId - The selected campus id (null or "5" for national only)
 */
export async function getMemberPortalBenefits(
  campusId?: string | null
): Promise<PublicBenefit[]> {
  try {
    const benefits = await getPublicBenefits();
    return benefitsForCampus(benefits, campusId, ["member"]);
  } catch (error) {
    console.error("Error fetching member portal benefits:", error);
    return [];
  }
}

/**
 * Featured member benefits for the home tab hero section.
 */
export async function getFeaturedBenefits(
  campusId?: string | null
): Promise<PublicBenefit[]> {
  const benefits = await getMemberPortalBenefits(campusId);
  return benefits
    .filter((benefit) => benefit.isFeatured)
    .slice(0, FEATURED_BENEFIT_LIMIT);
}

export async function getUserProfile(): Promise<Users | null> {
  try {
    const { account, db } = await createSessionClient();
    const user = await account.get();

    try {
      const profile = await db.getRow<Users>("app", "user", user.$id);
      return profile;
    } catch (_error) {
      console.error("Profile not found for user:", user.$id);
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

export async function getPublicProfile(
  userId: string
): Promise<PublicProfiles | null> {
  try {
    const { account, db } = await createSessionClient();

    // Require a real authenticated session before allowing arbitrary
    // user-id lookups so anonymous callers can't iterate user IDs.
    const caller = await account.get().catch(() => null);
    if (!isAuthenticatedAccount(caller)) {
      return null;
    }

    const response = await db.listRows<PublicProfiles>(
      "app",
      "public_profiles",
      [Query.equal("user_id", userId), Query.limit(1)]
    );

    return response.rows?.[0] || null;
  } catch (error) {
    console.error("Error getting public profile:", error);
    return null;
  }
}

export async function updatePublicProfile(
  data: Partial<PublicProfiles>
): Promise<PublicProfiles | null> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();

    const profile = await getPublicProfile(user.$id);
    const isPublic = Boolean(data.email_visible || data.phone_visible);

    return await createOrUpdatePublicProfile(
      {
        ...profile,
        ...data,
        $id: profile?.$id || user.$id,
        user_id: user.$id,
      },
      isPublic
    );
  } catch (error) {
    console.error("Error updating public profile:", error);
    return null;
  }
}

export type RevealBenefitResult =
  | { success: true; value: string }
  | {
      success: false;
      reason: "no_code" | "not_found" | "not_member" | "unavailable";
    };

/** The reveal helper's database, bound to the "app" database with admin rights. */
async function createRevealDb(): Promise<RevealDb> {
  const { db } = await createAdminClient();
  return {
    createRow: (table, id, data, permissions) =>
      db.createRow(BENEFIT_DATABASE_ID, table, id, data, permissions),
    getRow: <T>(table: string, id: string) =>
      db.getRow(BENEFIT_DATABASE_ID, table, id) as unknown as Promise<T>,
    listRows: <T>(table: string, queries: string[]) =>
      db.listRows(BENEFIT_DATABASE_ID, table, queries) as unknown as Promise<{
        rows: T[];
      }>,
  };
}

async function readMembership(): Promise<
  "active" | "inactive" | "unavailable"
> {
  try {
    const status = await getLiveMembershipStatus();
    if (status.isMember) {
      return "active";
    }
    // An outage must never read as "not a member".
    return isTransientMembershipReason(status.reason)
      ? "unavailable"
      : "inactive";
  } catch (error) {
    console.error("Error checking membership for benefit reveal:", error);
    return "unavailable";
  }
}

/**
 * Reveal a benefit's code or link. The only path by which a code reaches the
 * browser, and only for an active member.
 */
export async function revealBenefit(
  benefitId: string
): Promise<RevealBenefitResult> {
  let userId: string;
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    if (!isAuthenticatedAccount(user)) {
      return { success: false, reason: "not_member" };
    }
    userId = user.$id;
  } catch (error) {
    // Only "no usable session" (401) reads as not a member; an outage never does.
    if (appwriteErrorStatus(error) === UNAUTHORIZED) {
      return { success: false, reason: "not_member" };
    }
    console.error("Error checking session for benefit reveal:", error);
    return { success: false, reason: "unavailable" };
  }

  try {
    const membership = await readMembership();
    // A non-member never reaches the admin client; the helper gates again.
    if (membership !== "active") {
      return {
        success: false,
        reason: membership === "inactive" ? "not_member" : "unavailable",
      };
    }
    const result = await revealBenefitCode(await createRevealDb(), {
      benefitId,
      membership,
      now: new Date(),
      userId,
    });
    return result.ok
      ? { success: true, value: result.value }
      : { success: false, reason: result.reason };
  } catch (error) {
    console.error("Error revealing benefit:", error);
    return { success: false, reason: "unavailable" };
  }
}

export async function getBenefitReveals(userId: string): Promise<Set<string>> {
  try {
    const { db } = await createSessionClient();
    const response = await db.listRows<BenefitReveals>(
      "app",
      "benefit_reveals",
      [Query.equal("user_id", userId), Query.limit(500)]
    );

    return new Set(response.rows?.map((r) => r.benefit_id) || []);
  } catch (error) {
    console.error("Error fetching benefit reveals:", error);
    return new Set();
  }
}

export async function uploadAvatar(formData: FormData): Promise<{
  success: boolean;
  fileId?: string;
  url?: string;
  error?: string;
}> {
  try {
    const { account, storage } = await createSessionClient();
    const _user = await account.get();
    const file = formData.get("avatar") as File;

    if (!file) {
      return { success: false, error: "No file provided" };
    }

    // Upload to avatars bucket
    const uploadedFile = await storage.createFile("avatars", ID.unique(), file);

    // Generate URL
    const url = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/avatars/files/${uploadedFile.$id}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT}`;

    return {
      success: true,
      fileId: uploadedFile.$id,
      url,
    };
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return { success: false, error: "Failed to upload avatar" };
  }
}
