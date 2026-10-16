"use client";

import type { WebshopProducts } from "@repo/api/types/appwrite";
import { cn } from "@repo/ui/lib/utils";
import { AlertCircle, CheckCircle2, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui/pill";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import { PriceDetails, PriceRow } from "./price-details";
import {
  buildFieldLabels,
  findMissingRequired,
  productFieldDomId,
  useProductCustomFields,
} from "./product-custom-fields-context";
import { StockStatusCard } from "./stock-status-card";
import { useProductActions } from "./use-product-actions";

interface AddToCartClientProps {
  availableStock?: number | null;
  displayPrice: number;
  hasDiscount: boolean;
  isMember: boolean;
  memberPrice?: number | null;
  product: WebshopProducts;
  /**
   * The product's checkout questions (`<ProductOptionsClient />`), placed
   * between the price and the button so they are answered where the purchase
   * is made. Both read the same ProductCustomFieldsProvider.
   */
  questions?: ReactNode;
  regularPrice: number;
  savings: number;
  stock: number | null;
  userId: string | null;
}

/**
 * The product page's buy card: price, live stock, the product's questions,
 * the members-only gate and the button — one card, sticky beside the
 * description on a wide screen and first on a phone.
 *
 * The purchase logic is main's, unchanged: required answers are checked here
 * and again server-side, a members-only product is refused to a non-member
 * here and again by the reservation and checkout actions, and stock and the
 * per-buyer limits run through `useProductActions`.
 */
export function AddToCartClient({
  product,
  isMember,
  userId,
  regularPrice,
  memberPrice,
  displayPrice,
  hasDiscount,
  questions,
  savings,
  stock,
  availableStock = null,
}: AddToCartClientProps) {
  const t = useTranslations("shop");
  // Answers are held by ProductCustomFieldsProvider, which the inputs write
  // to. Reading them here is what stops the buyer's input being discarded.
  const customFieldState = useProductCustomFields();

  const { handleAddToCart: addToCartAction, addedToCart } = useProductActions(
    product,
    userId
  );

  // Only tracked products (stock !== null) gate availability; for those, the
  // live availableStock (total stock minus everyone's active reservations) is
  // the real buyable figure.
  const isOutOfStock =
    stock !== null && availableStock !== null && availableStock <= 0;

  // A members-only product is shown to everyone — `member_only` limits who can
  // buy, not who can see — so this is where a non-member is stopped. The real
  // gate is server-side in `apps/api`; this only saves them the round trip.
  const isMemberOnlyBlocked = Boolean(product.member_only) && !isMember;

  const handleAddToCart = async () => {
    const fields = customFieldState?.fields ?? [];
    const answers = customFieldState?.answers ?? {};

    // Blocked here as well as server-side: this is the only place that can
    // point at the specific empty box rather than failing the whole checkout.
    const missing = findMissingRequired(fields, answers);
    if (missing.length > 0) {
      customFieldState?.setMissing(missing);
      // Take the buyer to the first box to fill rather than leaving them to
      // find the error text.
      document.getElementById(productFieldDomId(missing[0]))?.focus();
      return;
    }

    await addToCartAction({
      customFieldLabels: buildFieldLabels(fields),
      customFields: answers,
    });
  };

  const price = (amount: number) =>
    amount > 0 ? `${amount} NOK` : t("card.free");

  let buttonLabel = t("product.addToCart");
  if (isMemberOnlyBlocked) {
    buttonLabel = t("product.membersOnly");
  } else if (isOutOfStock) {
    buttonLabel = t("card.outOfStock");
  }

  const showMemberSaving =
    !(isMemberOnlyBlocked || isMember) &&
    Boolean(memberPrice) &&
    (memberPrice ?? 0) < regularPrice;

  return (
    <div className="rounded-biso-md border border-edge bg-surface-raised p-6">
      <p className="type-label text-ink-muted">
        {hasDiscount ? t("product.yourPrice") : t("product.price")}
      </p>
      <p className="type-display-sm mt-2 text-ink">{price(displayPrice)}</p>
      {hasDiscount ? (
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="type-data text-ink-muted line-through">
            {price(regularPrice)}
          </span>
          <Pill tone="success">{t("card.save", { amount: savings })}</Pill>
        </p>
      ) : null}

      {stock === null ? null : (
        <div className="mt-5">
          <StockStatusCard
            availableStock={availableStock}
            isLoading={false}
            totalStock={stock}
          />
        </div>
      )}

      {questions}

      {isMemberOnlyBlocked ? (
        <p className="type-body-sm mt-6 flex items-start gap-2 rounded-biso-sm border border-warning/30 bg-warning/10 p-3 text-ink">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          {t("product.membersOnlyNotice")}
        </p>
      ) : null}

      {showMemberSaving ? (
        <p className="type-body-sm mt-6 rounded-biso-sm bg-surface-sunken p-3 text-ink">
          {t("product.becomeMemberSave", {
            amount: regularPrice - (memberPrice ?? 0),
          })}
        </p>
      ) : null}

      <button
        className={cn(
          statusPanelPrimaryAction,
          "mt-6 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        )}
        disabled={isOutOfStock || isMemberOnlyBlocked}
        onClick={handleAddToCart}
        type="button"
      >
        <ShoppingCart aria-hidden="true" className="size-4" />
        {buttonLabel}
      </button>

      {/* Mounted empty so the confirmation is announced when it appears. */}
      <p
        aria-live="polite"
        className="type-body-sm mt-3 flex min-h-5 items-center justify-center gap-2 text-success"
        role="status"
      >
        {addedToCart ? (
          <>
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {t("product.addedToCart")}
          </>
        ) : null}
      </p>

      <div className="mt-4 border-edge border-t pt-5">
        <h2 className="type-label text-ink-muted">
          {t("product.priceDetails")}
        </h2>
        <dl className="mt-2">
          <PriceDetails
            displayPrice={displayPrice}
            hasDiscount={hasDiscount}
            isMember={isMember}
            memberPrice={memberPrice}
            regularPrice={regularPrice}
            savings={savings}
          />
          <PriceRow
            className="text-ink-muted"
            label={t("product.tax")}
            value={t("product.included")}
          />
        </dl>
      </div>
    </div>
  );
}
