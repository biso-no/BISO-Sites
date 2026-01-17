import {
  getMembershipSettings,
  type MembershipSettingsItem,
} from "@/app/actions/membership-settings";
import { executeSync } from "@/app/actions/membership-sync";
import { MembershipSettingsClient } from "./_components/membership-settings-client";

export const dynamic = "force-dynamic";

async function syncFromTwentyFourSevenOffice() {
  "use server";
  await executeSync();
}

export default async function SettingsPage() {
  let items: MembershipSettingsItem[] = [];
  try {
    items = await getMembershipSettings();
  } catch (error) {
    console.error("Failed to load membership settings:", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">
          Membership Settings
        </h1>
        <p className="text-muted-foreground">
          Configure which memberships are active and available for purchase.
        </p>
      </div>

      <MembershipSettingsClient
        initialItems={items}
        onSync={syncFromTwentyFourSevenOffice}
      />
    </div>
  );
}
