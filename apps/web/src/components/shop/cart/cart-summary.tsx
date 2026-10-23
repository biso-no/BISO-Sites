"use client";

import { cn } from "@repo/ui/lib/utils";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { useCart } from "@/lib/contexts/cart-context";

interface CartSummaryProps {
  isMember: boolean;
  userId: string | null;
}

function SummaryRow({
  className = "text-ink",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="type-body-sm text-ink-muted">{label}</dt>
      <dd className={`type-data ${className}`}>{value}</dd>
    </div>
  );
}

/**
 * The cart's sticky summary rail.
 *
 * Every number is the cart context's, unchanged. The actions are links now
 * rather than `router.push` buttons, and "become a member" goes to
 * `/membership` — it used to filter the shop to `?category=Membership`, which
 * no product carries; memberships are bought through `/membership/join`.
 */
export function CartSummary({ isMember, userId: _userId }: CartSummaryProps) {
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
    <aside className="min-w-0">
      <div className="space-y-6 lg:sticky lg:top-24">
        <section className="rounded-biso-md border border-edge bg-surface-raised p-6">
          <h2 className="type-heading-section text-ink">
            {t("cart.summary.title")}
          </h2>

          <dl className="mt-4">
            <SummaryRow
              label={t("cart.summary.subtotal", {
                count: items.reduce((sum, item) => sum + item.quantity, 0),
              })}
              value={`${isMember ? subtotal : regularSubtotal} NOK`}
            />
            {isMember && totalSavings > 0 ? (
              <SummaryRow
                className="text-success"
                label={t("cart.summary.memberDiscount")}
                value={`-${totalSavings} NOK`}
              />
            ) : null}
          </dl>

          <div className="mt-3 flex items-baseline justify-between gap-4 border-edge border-t pt-4">
            <span className="type-heading-card text-ink">
              {t("cart.summary.total")}
            </span>
            <span className="type-heading-section text-ink">
              {subtotal} NOK
            </span>
          </div>

          {isMember && totalSavings > 0 ? (
            <p className="type-body-sm mt-3 text-success">
              {t("cart.summary.savingMsg", { amount: totalSavings })}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <Link
              className={cn(statusPanelPrimaryAction, "w-full justify-center")}
              href="/shop/checkout"
            >
              <CreditCard aria-hidden="true" className="size-4" />
              {t("cart.summary.checkout")}
            </Link>
            <Link
              className={cn(
                statusPanelSecondaryAction,
                "w-full justify-center"
              )}
              href="/shop"
            >
              {t("cart.summary.continue")}
            </Link>
          </div>
        </section>

        {hasUnlockableDiscounts && potentialSavings > 0 ? (
          <section className="rounded-biso-md border border-edge p-5">
            <h2 className="type-heading-card text-ink">
              {t("cart.summary.unlockTitle")}
            </h2>
            <p className="type-body-sm mt-2 text-ink-muted">
              {t("cart.summary.unlockDesc", { amount: potentialSavings })}
            </p>
            <Link
              className={cn(
                statusPanelSecondaryAction,
                "mt-4 w-full justify-center"
              )}
              href="/membership"
            >
              {t("cart.summary.joinCta")}
            </Link>
          </section>
        ) : null}

        <section className="rounded-biso-md bg-surface-sunken p-5">
          <h2 className="type-label text-ink">{t("pickup.cardTitle")}</h2>
          <p className="type-body-sm mt-2 text-ink-muted">
            {t("checkout.summary.pickupDesc")}
          </p>
        </section>
      </div>
    </aside>
  );
}
