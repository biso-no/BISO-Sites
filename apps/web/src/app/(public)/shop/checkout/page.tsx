import { createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import type { Metadata } from "next";
import { PublicPageHeader } from "@/components/public/public-page-header";
import { getMembershipStatus } from "@/lib/actions/membership";
import {
  CheckoutPageClient,
  type PaymentProvider,
} from "./checkout-page-client";

export const metadata: Metadata = {
  title: "Checkout | BISO Shop",
};

export default async function CheckoutPage() {
  const { isMember } = await getMembershipStatus();

  const flags = await getFeatureFlagStates();
  const enabledProviders: PaymentProvider[] = [
    ...(flags.payments_vipps ? (["vipps"] as const) : []),
    ...(flags.payments_stripe ? (["stripe"] as const) : []),
  ];

  const { account, db } = await createSessionClient();
  const user = await account.get().catch(() => null);
  const profile = user
    ? await db.getRow<Users>("app", "user", user.$id).catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      <PublicPageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: "Checkout" },
        ]}
        subtitle="Secure payment with Vipps or card"
        title="Checkout"
      />
      <CheckoutPageClient
        enabledProviders={enabledProviders}
        initialEmail={user?.email ?? undefined}
        initialName={profile?.name ?? undefined}
        isMember={isMember}
      />
    </div>
  );
}
