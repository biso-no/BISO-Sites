import { Metadata } from "next";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { ProfileHead } from "@/components/profile/profile-head";
import { getLoggedInUser } from "@/lib/actions/user";

export const metadata: Metadata = {
  title: "Your Profile | BISO",
  description: "Manage your profile settings and privacy preferences",
};

export default async function ProfilePage() {

const userData = await getLoggedInUser()

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <ProfileHead />
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      <ProfileTabs userData={userData} />
    </div>
  );
} 