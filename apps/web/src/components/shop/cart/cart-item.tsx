"use client";

import { cn } from "@repo/ui/lib/utils";
import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Pill } from "@/components/ui/pill";
import { RowThumb } from "@/components/ui/row-thumb";
import type { CartItem as CartItemType } from "@/lib/contexts/cart-context";

interface CartItemProps {
  isMember: boolean;
  item: CartItemType;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, amount: number) => void;
}

const LOW_STOCK_THRESHOLD = 10;

/** The two stepper buttons and the remove button share one icon-button shape. */
const ICON_BUTTON =
  "flex size-9 items-center justify-center rounded-biso-pill text-ink transition-colors hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink";

function QuantityControl({
  quantity,
  stock,
  maxPerOrder,
  onIncrease,
  onDecrease,
}: {
  quantity: number;
  stock: number | null;
  maxPerOrder?: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const t = useTranslations("shop");
  const labelId = useId();
  const isMaxReached =
    (stock !== null && quantity >= stock) ||
    (maxPerOrder !== undefined && quantity >= maxPerOrder);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="type-body-sm text-ink-muted" id={labelId}>
        {t("cart.item.quantity")}
      </span>
      <fieldset
        aria-labelledby={labelId}
        className="inline-flex items-center rounded-biso-pill border border-edge"
      >
        <button
          aria-label={t("cart.item.decrease")}
          className={ICON_BUTTON}
          disabled={quantity <= 1}
          onClick={onDecrease}
          type="button"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <span className="type-data w-8 text-center text-ink">{quantity}</span>
        <button
          aria-label={t("cart.item.increase")}
          className={ICON_BUTTON}
          disabled={isMaxReached}
          onClick={onIncrease}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </fieldset>
      {stock !== null && stock <= LOW_STOCK_THRESHOLD ? (
        <span className="type-body-sm text-warning">
          {t("card.onlyAvailable", { count: stock })}
        </span>
      ) : null}
      {maxPerOrder && quantity >= maxPerOrder ? (
        <span className="type-body-sm text-danger">
          {t("cart.item.maxPerOrder", { count: maxPerOrder })}
        </span>
      ) : null}
    </div>
  );
}

function PriceDisplay({
  regularPrice,
  memberPrice,
  quantity,
  isMember,
}: {
  regularPrice: number;
  memberPrice: number | null;
  quantity: number;
  isMember: boolean;
}) {
  const t = useTranslations("shop");
  const itemPrice = isMember && memberPrice ? memberPrice : regularPrice;
  const itemTotal = itemPrice * quantity;
  const hasDiscount = Boolean(
    isMember && memberPrice && memberPrice < regularPrice
  );
  const savings = hasDiscount
    ? (regularPrice - (memberPrice ?? 0)) * quantity
    : 0;

  return (
    <div className="text-end">
      {hasDiscount ? (
        <>
          <p className="type-body-sm text-ink-muted line-through">
            {regularPrice * quantity} NOK
          </p>
          <p className="type-data text-ink">{itemTotal} NOK</p>
          <p className="type-body-sm text-success">
            {t("card.save", { amount: savings })}
          </p>
        </>
      ) : (
        <p className="type-data text-ink">{itemTotal} NOK</p>
      )}
      {!isMember && memberPrice && memberPrice < regularPrice ? (
        <p className="type-body-sm mt-1 text-ink-muted">
          {t("cart.item.membersPrice", {
            price: `${memberPrice * quantity} NOK`,
          })}
        </p>
      ) : null}
    </div>
  );
}

export function CartItem({
  item,
  isMember,
  onUpdateQuantity,
  onRemove,
}: CartItemProps) {
  const t = useTranslations("shop");
  const hasOptions =
    item.selectedOptions && Object.keys(item.selectedOptions).length > 0;

  return (
    <article className="flex gap-4 rounded-biso-md border border-edge bg-surface-raised p-4 sm:gap-6 sm:p-6">
      <RowThumb className="h-20 w-20 sm:h-24 sm:w-24" src={item.image} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="type-heading-card text-ink">
              {item.slug ? (
                <Link
                  className="underline-offset-4 hover:text-ink-accent hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  href={`/shop/${item.slug}`}
                >
                  {item.name}
                </Link>
              ) : (
                item.name
              )}
            </h3>
            {item.category || item.memberOnly ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.category ? (
                  <Pill tone="accent" uppercase>
                    {item.category}
                  </Pill>
                ) : null}
                {item.memberOnly ? (
                  <Pill tone="warning">{t("cart.item.membersOnly")}</Pill>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            aria-label={`${t("cart.item.remove")} ${item.name}`}
            className={cn(
              ICON_BUTTON,
              "shrink-0 text-ink-muted hover:text-danger"
            )}
            onClick={() => onRemove(item.id)}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* The buyer's answers to the product's questions, as they will be
            sent with the order. */}
        {hasOptions ? (
          <div className="mt-3 rounded-biso-sm bg-surface-sunken p-3">
            <p className="type-label text-ink-muted">
              {t("cart.item.selectedOptions")}
            </p>
            <dl className="type-body-sm mt-1 space-y-0.5">
              {Object.entries(item.selectedOptions ?? {}).map(
                ([label, value]) => (
                  <div key={label}>
                    <dt className="inline font-semibold text-ink">{label}:</dt>{" "}
                    <dd className="inline text-ink-muted">{value}</dd>
                  </div>
                )
              )}
            </dl>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <QuantityControl
            maxPerOrder={item.metadata?.max_per_order}
            onDecrease={() => onUpdateQuantity(item.id, -1)}
            onIncrease={() => onUpdateQuantity(item.id, 1)}
            quantity={item.quantity}
            stock={item.stock}
          />

          <PriceDisplay
            isMember={isMember}
            memberPrice={item.memberPrice}
            quantity={item.quantity}
            regularPrice={item.regularPrice}
          />
        </div>
      </div>
    </article>
  );
}
