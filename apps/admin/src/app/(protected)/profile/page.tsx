import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import type { Metadata } from "next";
import { ProfileHead } from "@/components/profile/profile-head";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { getLoggedInUser, listIdentities } from "@/lib/actions/user";
import { checkMembership } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Your Profile | BISO",
  description: "View and manage your profile and privacy settings.",
};

export default async function PublicProfilePage() {
  const userData = await getLoggedInUser();
  let identitiesResp: any = null;
  let _membership: any = null;
  let hasBIIdentity = false;

  identitiesResp = await listIdentities();
  const ids: any[] = identitiesResp?.identities || [];
  hasBIIdentity =
    Array.isArray(ids) &&
    ids.some((i) => String(i?.provider || "").toLowerCase() === "oidc");
  if (hasBIIdentity) {
    _membership = await checkMembership();
  } else {
    _membership = null;
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
          <Card className="mb-6 overflow-hidden border border-primary/10 bg-white">
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
      <div className="mb-6" />

      <ProfileTabs
        identities={identitiesResp?.identities}
        userData={userData}
      />
    </div>
  );
}
