import { getSyncedMembers } from "@/app/actions/all-members";
import { AllMembersClient } from "./_components/all-members-client";

export const dynamic = "force-dynamic";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AllMembersPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const page = typeof params.page === "string" ? parseInt(params.page) : 1;
    const search = typeof params.search === "string" ? params.search : undefined;

    let data;
    try {
        // Fetch from Appwrite synced collection
        data = await getSyncedMembers(page, 20, search);
    } catch (error) {
        console.error("Failed to load active members:", error);
        data = { members: [], totalCount: 0, activeMembershipCount: 0, lastSynced: null };
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-bold text-2xl tracking-tight">All Members</h1>
                <p className="text-muted-foreground">
                    View all active members and their current membership status.
                    Data is synced from 24SevenOffice.
                </p>
            </div>

            <AllMembersClient
                members={data.members}
                activeMembershipCount={data.activeMembershipCount}
                totalCount={data.totalCount}
                lastSynced={data.lastSynced}
            />
        </div>
    );
}
