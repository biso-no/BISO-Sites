import { createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopPageShell } from "@/components/shop/v2/shop-page-shell";
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

  const checkout = (
    <CheckoutPageClient
      enabledProviders={enabledProviders}
      initialEmail={user?.email ?? undefined}
      initialName={profile?.name ?? undefined}
      isMember={isMember}
    />
  );

  const [tCommon, tNav] = await Promise.all([
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  return (
    <ShopPageShell
      breadcrumbs={[
        { label: tCommon("breadcrumbs.home"), href: "/" },
        { label: tNav("shop"), href: "/shop" },
        { label: t("cart.title"), href: "/shop/cart" },
        { label: t("checkout.heading") },
      ]}
      eyebrow={t("checkout.eyebrow")}
      lede={t("checkout.subheading")}
      title={t("checkout.heading")}
    >
      {checkout}
    </ShopPageShell>
  );
}
