"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { PLACEHOLDER_IMAGE } from "@repo/ui/lib/placeholder-images";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useUserMembership } from "@/components/context/membership-provider";
import { useCart } from "@/lib/contexts/cart-context";

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
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        side="right"
      >
        <SheetHeader className="border-border/60 border-b px-6 py-5 text-left">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-brand" />
            {t("cart.drawer.title")}
            {itemCount > 0 ? (
              <span className="ml-1 rounded-full bg-brand px-2 py-0.5 font-semibold text-white text-xs">
                {itemCount}
              </span>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-14 w-14 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">
              {t("cart.drawer.empty")}
            </p>
            <p className="text-muted-foreground text-sm">
              {t("cart.drawer.emptyDesc")}
            </p>
            <Button asChild className="mt-2" onClick={closeDrawer}>
              <Link href="/shop">{t("cart.drawer.browse")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {items.map((item) => {
                const unitPrice =
                  isMember && item.memberPrice
                    ? item.memberPrice
                    : item.regularPrice;

                return (
                  <div className="flex gap-3" key={item.id}>
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                      <ImageWithFallback
                        alt={item.name}
                        className="object-cover"
                        fill
                        src={item.image || PLACEHOLDER_IMAGE}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-medium text-foreground text-sm">
                          {item.name}
                        </p>
                        <button
                          aria-label={t("cart.item.remove")}
                          className="shrink-0 text-muted-foreground transition-colors hover:text-red-600"
                          onClick={() => removeItem(item.id)}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-lg border border-border">
                          <button
                            aria-label={t("cart.item.decrease")}
                            className="flex h-7 w-7 items-center justify-center text-foreground disabled:opacity-40"
                            disabled={item.quantity <= 1}
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            type="button"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-7 text-center font-medium text-sm">
                            {item.quantity}
                          </span>
                          <button
                            aria-label={t("cart.item.increase")}
                            className="flex h-7 w-7 items-center justify-center text-foreground disabled:opacity-40"
                            disabled={
                              item.stock !== null && item.quantity >= item.stock
                            }
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            type="button"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="font-semibold text-foreground text-sm">
                          {unitPrice * item.quantity} NOK
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 border-border/60 border-t px-6 py-5">
              {isMember && savings > 0 ? (
                <div className="flex items-center justify-between text-green-700 text-sm">
                  <span>{t("cart.drawer.memberSavings")}</span>
                  <span>-{savings} NOK</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">
                  {t("cart.drawer.subtotal")}
                </span>
                <span className="font-bold text-foreground text-lg">
                  {subtotal} NOK
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full" onClick={closeDrawer}>
                  <Link href="/shop/checkout">{t("cart.drawer.checkout")}</Link>
                </Button>
                <Button
                  asChild
                  className="w-full"
                  onClick={closeDrawer}
                  variant="outline"
                >
                  <Link href="/shop/cart">{t("cart.drawer.viewCart")}</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
