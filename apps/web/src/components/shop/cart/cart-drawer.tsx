"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useUserMembership } from "@/components/context/membership-provider";
import { RowThumb } from "@/components/ui/row-thumb";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import { useCart } from "@/lib/contexts/cart-context";

const STEP_BUTTON =
  "flex size-8 items-center justify-center rounded-biso-pill text-ink transition-colors hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink";

/**
 * The cart drawer the header's cart button opens, on every public page.
 *
 * Painted from the design system's paper surface: the sheet portals to
 * `<body>`, which still sits inside the `.biso-surface-v2` root, so the same
 * aliases resolve here as on the page behind it.
 */
export function CartDrawer() {
  const t = useTranslations("shop");
  const { isMember } = useUserMembership();
  const {
    items,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeItem,
    getItemCount,
    getSubtotal,
    getTotalSavings,
  } = useCart();

  const itemCount = getItemCount();
  const subtotal = getSubtotal(isMember);
  const savings = getTotalSavings(isMember);

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          closeDrawer();
        }
      }}
      open={isDrawerOpen}
    >
      <SheetContent
        className="flex w-full flex-col gap-0 border-edge bg-surface p-0 text-ink shadow-elev-2 sm:max-w-md"
        side="right"
      >
        <SheetHeader className="border-edge border-b px-6 py-5 text-left">
          {/* The type role sits on the inner span: `SheetTitle`'s own
              `text-lg font-semibold` are utilities, which outrank a role. */}
          <SheetTitle className="flex items-center gap-2 text-ink">
            <ShoppingBag
              aria-hidden="true"
              className="size-5 text-ink-accent"
            />
            <span className="type-heading-section">
              {t("cart.drawer.title")}
            </span>
            {itemCount > 0 ? (
              <span className="type-data ms-1 rounded-biso-pill bg-action px-2 py-0.5 text-action-ink">
                {itemCount}
              </span>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-3 px-6">
            <p className="type-heading-card text-ink">
              {t("cart.drawer.empty")}
            </p>
            <p className="type-body-sm text-ink-muted">
              {t("cart.drawer.emptyDesc")}
            </p>
            <Link
              className={cn(statusPanelPrimaryAction, "mt-2")}
              href="/shop"
              onClick={closeDrawer}
            >
              {t("cart.drawer.browse")}
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-edge overflow-y-auto px-6">
              {items.map((item) => {
                const unitPrice =
                  isMember && item.memberPrice
                    ? item.memberPrice
                    : item.regularPrice;

                return (
                  <li className="flex gap-3 py-4" key={item.id}>
                    <RowThumb
                      className="h-16 w-16 sm:h-16 sm:w-16"
                      src={item.image}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="type-body-sm truncate font-semibold text-ink">
                          {item.name}
                        </p>
                        <button
                          aria-label={`${t("cart.item.remove")} ${item.name}`}
                          className={cn(
                            STEP_BUTTON,
                            "shrink-0 text-ink-muted hover:text-danger"
                          )}
                          onClick={() => removeItem(item.id)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-biso-pill border border-edge">
                          <button
                            aria-label={t("cart.item.decrease")}
                            className={STEP_BUTTON}
                            disabled={item.quantity <= 1}
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            type="button"
                          >
                            <Minus aria-hidden="true" className="size-3.5" />
                          </button>
                          <span className="type-data w-7 text-center text-ink">
                            {item.quantity}
                          </span>
                          <button
                            aria-label={t("cart.item.increase")}
                            className={STEP_BUTTON}
                            disabled={
                              item.stock !== null && item.quantity >= item.stock
                            }
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            type="button"
                          >
                            <Plus aria-hidden="true" className="size-3.5" />
                          </button>
                        </div>
                        <span className="type-data text-ink">
                          {unitPrice * item.quantity} NOK
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-4 border-edge border-t px-6 py-5">
              {isMember && savings > 0 ? (
                <div className="type-body-sm flex items-center justify-between text-success">
                  <span>{t("cart.drawer.memberSavings")}</span>
                  <span className="type-data">-{savings} NOK</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between">
                <span className="type-body-sm text-ink-muted">
                  {t("cart.drawer.subtotal")}
                </span>
                <span className="type-heading-section text-ink">
                  {subtotal} NOK
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  className={cn(
                    statusPanelPrimaryAction,
                    "w-full justify-center"
                  )}
                  href="/shop/checkout"
                  onClick={closeDrawer}
                >
                  {t("cart.drawer.checkout")}
                </Link>
                <Link
                  className={cn(
                    statusPanelSecondaryAction,
                    "w-full justify-center"
                  )}
                  href="/shop/cart"
                  onClick={closeDrawer}
                >
                  {t("cart.drawer.viewCart")}
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
