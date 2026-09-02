"use client";

import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { CreditCard, Package, Sparkles, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/contexts/cart-context";

interface CartSummaryProps {
  isMember: boolean;
  userId: string | null;
}

export function CartSummary({ isMember, userId: _userId }: CartSummaryProps) {
  const router = useRouter();
  const t = useTranslations("shop");
  const { items, getSubtotal, getRegularSubtotal, getTotalSavings } = useCart();

  const subtotal = getSubtotal(isMember);
  const regularSubtotal = getRegularSubtotal();
  const totalSavings = getTotalSavings(isMember);

  const hasUnlockableDiscounts =
    !isMember && items.some((item) => item.memberPrice);
  const potentialSavings = isMember
    ? 0
    : regularSubtotal -
      items.reduce((sum, item) => {
        const price = item.memberPrice || item.regularPrice;
        return sum + price * item.quantity;
      }, 0);

  return (
    <div className="space-y-6">
      {/* Member Benefits Alert */}
      {hasUnlockableDiscounts && potentialSavings > 0 && (
        <div className="fade-in slide-in-from-bottom-2 animate-in duration-500">
          <Alert className="border-brand bg-linear-to-br from-brand-muted to-cyan-50">
            <Sparkles className="h-4 w-4 text-brand" />
            <AlertDescription>
              <p className="mb-2 text-foreground text-sm">
                <strong>{t("cart.summary.unlockTitle")}</strong>
              </p>
              <p className="mb-3 text-muted-foreground text-sm">
                {t("cart.summary.unlockDesc", { amount: potentialSavings })}
              </p>
              <Button
                className="w-full bg-brand text-white hover:bg-brand/90"
                onClick={() => router.push("/shop?category=Membership")}
                size="sm"
              >
                {t("cart.summary.joinCta")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Order Summary Card */}
      <div className="fade-in slide-in-from-bottom-2 animate-in delay-150 duration-500">
        <Card className="sticky top-24 border-0 p-6 shadow-lg">
          <h3 className="mb-4 font-bold text-foreground text-xl">
            {t("cart.summary.title")}
          </h3>

          <div className="mb-4 space-y-3">
            <div className="flex justify-between text-muted-foreground">
              <span>
                {t("cart.summary.subtotal", {
                  count: items.reduce((sum, item) => sum + item.quantity, 0),
                })}
              </span>
              <span className="font-medium">
                {isMember ? subtotal : regularSubtotal} NOK
              </span>
            </div>

            {isMember && totalSavings > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  {t("cart.summary.memberDiscount")}
                </span>
                <span className="font-medium">-{totalSavings} NOK</span>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Total — the one bold, yellow-accented moment */}
          <div className="mb-6 overflow-hidden rounded-2xl bg-deep text-white">
            <div className="h-1 w-full bg-brand-accent" />
            <div className="flex items-center justify-between p-4">
              <span className="font-medium">{t("cart.summary.total")}</span>
              <span className="font-bold text-2xl">{subtotal} NOK</span>
            </div>
          </div>

          {isMember && totalSavings > 0 && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-center">
              <p className="text-green-700 text-sm">
                🎉 {t("cart.summary.savingMsg", { amount: totalSavings })}
              </p>
            </div>
          )}

          <Button
            className="mb-3 w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90 disabled:opacity-70"
            onClick={() => router.push("/shop/checkout")}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {t("cart.summary.checkout")}
          </Button>

          <Button
            className="w-full border-brand-border text-brand-dark hover:bg-brand-muted"
            onClick={() => router.push("/shop")}
            variant="outline"
          >
            {t("cart.summary.continue")}
          </Button>
        </Card>
      </div>

      {/* Pickup Information */}
      <div className="fade-in slide-in-from-bottom-2 animate-in delay-300 duration-500">
        <Card className="border border-brand-border bg-brand-muted p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div>
              <h4 className="mb-2 font-semibold text-foreground">
                {t("pickup.cardTitle")}
              </h4>
              <p className="mb-2 text-muted-foreground text-sm">
                {t("checkout.summary.pickupDesc")}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
