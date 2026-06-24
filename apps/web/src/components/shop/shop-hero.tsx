"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { ShoppingBag, Sparkles, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { ShopHeroShell } from "./shop-hero-shell";

interface ShopHeroProps {
  isMember?: boolean;
}

export function ShopHero({ isMember = false }: ShopHeroProps) {
  const t = useTranslations("shop");

  return (
    <ShopHeroShell
      eyebrow={
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-medium text-sm text-white/85">
          <ShoppingBag className="h-4 w-4 text-brand-accent" />
          {t("hero.title")}
        </span>
      }
      heightClass="h-[50vh] min-h-[380px]"
      subtitle={t("hero.description")}
      title={t("hero.subtitle")}
    >
      {isMember ? (
        <Badge className="border-0 bg-green-500 px-4 py-2 text-base text-white">
          <Users className="mr-2 h-4 w-4" />
          {t("hero.memberBadge")}
        </Badge>
      ) : (
        <Badge className="border-0 bg-brand-accent px-4 py-2 text-base text-brand-dark">
          <Sparkles className="mr-2 h-4 w-4" />
          {t("hero.nonMemberBadge")}
        </Badge>
      )}
    </ShopHeroShell>
  );
}
