import { previewMembershipSync } from "@repo/connectors/24sevenoffice";
import { MembershipSyncClient } from "./_components/membership-sync-client";

export const dynamic = "force-dynamic";

export default async function MembershipsSettingsPage() {
    // Fetch initial preview data on server
    let initialItems;
    try {
        initialItems = await previewMembershipSync();
    } catch (error) {
        console.error("Failed to load membership preview:", error);
        initialItems = [];
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-bold text-2xl tracking-tight">Memberships</h1>
                <p className="text-muted-foreground">
                    Sync membership products from 24SevenOffice to the database.
                </p>
            </div>

            <MembershipSyncClient initialItems={initialItems} />
        </div>
    );
}
