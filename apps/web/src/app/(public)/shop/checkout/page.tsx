import { createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopHeroShell } from "@/components/shop/shop-hero-shell";
import { getMembershipStatus } from "@/lib/actions/membership";
import {
  CheckoutPageClient,
  type PaymentProvider,
} from "./checkout-page-client";

export const metadata: Metadata = {
  title: "Checkout | BISO Shop",
};

export default async function CheckoutPage() {
  const t = await getTranslations("shop");
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
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <ShopHeroShell
        eyebrow={
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-medium text-sm text-white/85">
            {t("checkout.eyebrow")}
          </span>
        }
        heightClass="h-[34vh] min-h-[260px]"
        subtitle={t("checkout.subheading")}
        title={t("checkout.heading")}
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <CheckoutPageClient
          enabledProviders={enabledProviders}
          initialEmail={user?.email ?? undefined}
          initialName={profile?.name ?? undefined}
          isMember={isMember}
        />
      </div>
    </div>
  );
}
