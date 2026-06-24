"use client";

import { ArrowLeft, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShopHeroShell } from "@/components/shop/shop-hero-shell";
import { useCart } from "@/lib/contexts/cart-context";

export function CartHero() {
  const t = useTranslations("shop");
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  return (
    <ShopHeroShell
      eyebrow={
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-medium text-sm text-white/85">
          <ShoppingCart className="h-4 w-4 text-brand-accent" />
          {t("hero.title")}
        </span>
      }
      subtitle={t("cart.itemsReady", { count: itemCount })}
      title={t("cart.title")}
      topLeft={
        <Link
          className="absolute top-8 left-6 z-10 flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white sm:left-8"
          href="/shop"
        >
          <ArrowLeft className="h-5 w-5" />
          {t("product.backToShop")}
        </Link>
      }
    />
  );
}
