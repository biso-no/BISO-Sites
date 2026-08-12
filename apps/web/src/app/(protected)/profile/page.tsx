import { ProfileHead } from "@repo/ui/components/profile-head";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { MembershipCheckResult } from "@/components/profile/membership-status-card";
import MembershipStatusCard from "@/components/profile/membership-status-card";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { syncBiStudentIdentity } from "@/lib/actions/bi-identity";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";
import { checkMembership } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Your Profile | BISO",
  description: "View and manage your profile and privacy settings.",
};

interface PublicProfilePageProps {
  searchParams: Promise<{ error?: string; linked?: string }>;
}

export default async function PublicProfilePage({
  searchParams,
}: PublicProfilePageProps) {
  const params = await searchParams;
  if (params.linked === "1") {
    await syncBiStudentIdentity();
  }

  const userData = await getLoggedInUser();
  let identitiesResp: {
    identities?: { $id: string; provider: string }[];
  } | null = null;
  let membership: MembershipCheckResult | null = null;
  let hasBIIdentity = false;

  identitiesResp = await listIdentities();
  const ids: { $id: string; provider: string }[] =
    identitiesResp?.identities || [];
  hasBIIdentity =
    Array.isArray(ids) &&
    ids.some((i) => String(i?.provider || "").toLowerCase() === "oidc");
  if (hasBIIdentity) {
    membership = await checkMembership();
  } else {
    membership = null;
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <ProfileHead />
      {/* Summary header */}
      {(() => {
        const displayName =
          userData?.profile?.name || userData?.user.name || "User";
        const initials = displayName
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s[0]?.toUpperCase())
          .join("");
        return (
          <Card className="mb-6 overflow-hidden border border-primary/10">
            <CardHeader className="flex flex-row items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary-80">
                  {initials || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <CardTitle className="truncate font-semibold text-primary-100 text-xl">
                  {displayName}
                </CardTitle>
                <CardDescription className="truncate text-primary-60">
                  {userData?.user.email || "No email on file"}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        );
      })()}
      {/* Membership status up-front */}
      <div className="mb-6">
        <MembershipStatusCard
          hasBIIdentity={hasBIIdentity}
          initial={membership}
        />
      </div>

      <Card className="mb-6 flex flex-row items-center justify-between gap-4 border border-primary/10 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary-80">
            <Briefcase className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-primary-100">My applications</p>
            <p className="text-primary-60 text-sm">
              Track positions you've applied for and upcoming interviews.
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/applications">Open</Link>
        </Button>
      </Card>

      {userData ? (
        <ProfileTabs
          identities={identitiesResp?.identities}
          userData={userData}
        />
      ) : null}
    </div>
  );
}
