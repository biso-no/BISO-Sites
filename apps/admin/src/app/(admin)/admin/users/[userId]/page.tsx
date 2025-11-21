import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCampuses } from "@/app/actions/campus";
import { getUserById } from "@/lib/actions/user";
import { UserForm } from "./user-form";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function UserDetails({ userId }: { userId: string }) {
  try {
    // Fetch user and campuses data in parallel
    const [userData, campusesData] = await Promise.all([
      getUserById(userId),
      getCampuses(),
    ]);

    const user = userData;

    if (!user) {
      notFound();
    }

    return <UserForm campuses={campusesData} user={user} />;
  } catch (error) {
    console.error("Error fetching user data:", error);
    notFound();
  }
}

export default async function UserDetailsPage({
  params,
}: {
  params: { userId: string };
}) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Suspense fallback={<div>Loading user details...</div>}>
        <UserDetails userId={params.userId} />
      </Suspense>
    </div>
  );
}
