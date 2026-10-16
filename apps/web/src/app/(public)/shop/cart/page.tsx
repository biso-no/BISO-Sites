import { createSessionClient } from "@repo/api/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CartAlerts } from "@/components/shop/cart/cart-alerts";
import { CartPageClient } from "@/components/shop/cart/cart-page-client";
import { ShopPageShell } from "@/components/shop/v2/shop-page-shell";
import { DetailSkeleton } from "@/components/ui/loading-shell";
import { getMembershipStatus } from "@/lib/actions/membership";

export const metadata = {
  title: "Shopping Cart | BISO Shop",
  description: "Review your items and proceed to checkout",
};

export default async function CartPage() {
  const { isMember } = await getMembershipStatus();
  const { account } = await createSessionClient();
  const user = await account.get().catch(() => null);
  const userId = user?.$id ?? null;

  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("shop"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ShopPageShell
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("shop"), href: "/shop" },
          { label: t("cart.title") },
        ]}
        title={t("cart.title")}
      >
        <CartAlerts />
        <CartPageClient isMember={isMember} userId={userId} />
      </ShopPageShell>
    </Suspense>
  );
}
