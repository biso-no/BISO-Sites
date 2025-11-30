"use server";
import { ID, Permission, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  BenefitReveals,
  MemberBenefit,
  PublicProfiles,
  Users,
} from "@repo/api/types/appwrite";
import { checkMembership } from "@/lib/profile";

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
  const { db } = await createSessionClient();
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
      $permissions: [
        isPublic
          ? Permission.read("any")
          : Permission.read(`user:${profile.user_id}`),
      ],
    }
  );
}

export async function getMemberBenefits(
  userId: string
): Promise<MemberBenefit[]> {
  try {
    const { db } = await createSessionClient();
    const response = await db.listRows<MemberBenefit>("app", "member_benefit", [
      Query.equal("user_id", userId),
      Query.orderDesc("$createdAt"),
    ]);
    return response.rows || [];
  } catch (error) {
    console.error("Error fetching member benefits:", error);
    return [];
  }
}

export async function verifyMembershipStatus() {
  try {
    const membership = await checkMembership();

    if (!membership.ok) {
      return { active: false, error: membership.error };
    }

    return {
      active: membership.active,
      membership: membership.membership,
      studentId: membership.studentId,
      categories: membership.categories,
    };
  } catch (error) {
    console.error("Error verifying membership:", error);
    return { active: false, error: "Failed to verify membership status" };
  }
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
    const { db } = await createSessionClient();
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

export async function revealBenefit(
  benefitId: string
): Promise<{ success: boolean; value?: string } | null> {
  try {
    const { account, db } = await createSessionClient();
    const user = await account.get();

    // Check if already revealed
    const existing = await db.listRows("app", "benefit_reveals", [
      Query.equal("user_id", user.$id),
      Query.equal("benefit_id", benefitId),
      Query.limit(1),
    ]);

    if (existing.rows && existing.rows.length > 0) {
      // Already revealed, fetch the benefit value
      const benefit = await db.getRow<MemberBenefit>(
        "app",
        "member_benefit",
        benefitId
      );
      return { success: true, value: benefit.value };
    }

    // Create reveal record
    await db.createRow("app", "benefit_reveals", ID.unique(), {
      user_id: user.$id,
      benefit_id: benefitId,
      revealed_at: new Date().toISOString(),
      $permissions: [
        Permission.read(`user:${user.$id}`),
        Permission.write(`user:${user.$id}`),
      ],
    });

    // Fetch and return benefit value
    const benefit = await db.getRow<MemberBenefit>(
      "app",
      "member_benefit",
      benefitId
    );
    return { success: true, value: benefit.value };
  } catch (error) {
    console.error("Error revealing benefit:", error);
    return null;
  }
}

export async function getBenefitReveals(userId: string): Promise<Set<string>> {
  try {
    const { db } = await createSessionClient();
    const response = await db.listRows<BenefitReveals>(
      "app",
      "benefit_reveals",
      [Query.equal("user_id", userId)]
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
