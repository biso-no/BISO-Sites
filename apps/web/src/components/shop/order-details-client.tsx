"use client";

import { cn } from "@repo/ui/lib/utils";
import { ExternalLink, Receipt } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PropsWithChildren } from "react";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

type ActionType = "back" | "cart" | "shop" | "print" | "receipt";

type OrderActionsClientProps = PropsWithChildren<{
  type: ActionType;
  receiptUrl?: string;
  className?: string;
}>;

/**
 * The order page's actions, as the design system's primary and secondary CTAs.
 *
 * Navigation is a real `<Link>` rather than a `router.push` button, so it works
 * before hydration and opens in a new tab. Only "print" needs the browser; it
 * is why this stays a Client Component.
 *
 * The receipt label names no provider: `payment_receipt_url` is written for
 * Stripe orders only (the Vipps ePayment API exposes no receipt URL), so the
 * old "View Vipps Receipt" was wrong on every order that showed it.
 */
export function OrderActionsClient({
  type,
  receiptUrl,
  className,
  children,
}: OrderActionsClientProps) {
  const t = useTranslations("shop.order");

  switch (type) {
    case "back":
      return (
        <Link className={className} href="/shop">
          {children}
        </Link>
      );

    case "cart":
      return (
        <Link
          className={cn(statusPanelPrimaryAction, className)}
          href="/shop/cart"
        >
          {t("actions.returnToCart")}
        </Link>
      );

    case "shop":
      return (
        <Link
          className={cn(
            statusPanelPrimaryAction,
            "w-full justify-center",
            className
          )}
          href="/shop"
        >
          {t("actions.continue")}
        </Link>
      );

    case "print":
      return (
        <button
          className={cn(
            statusPanelSecondaryAction,
            "w-full justify-center",
            className
          )}
          onClick={() => window.print()}
          type="button"
        >
          {children}
        </button>
      );

    case "receipt":
      return receiptUrl ? (
        <a
          className={cn(statusPanelSecondaryAction, className)}
          href={receiptUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Receipt aria-hidden="true" className="size-4" />
          {t("actions.viewReceipt")}
          <ExternalLink aria-hidden="true" className="size-3" />
        </a>
      ) : null;

    default:
      return null;
  }
}
