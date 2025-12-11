"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { ChevronDown, ShoppingBag, Sparkles, Users } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

type ShopHeroProps = {
  isMember?: boolean;
};

export function ShopHero({ isMember = false }: ShopHeroProps) {
  const t = useTranslations("shop");
  
  return (
    <div className="relative h-[50vh] overflow-hidden">
      <ImageWithFallback
        alt="Hero background"
        className="h-full w-full"
        height={40} // pick the intrinsic pixel width
        priority // and height that matches your asset ratio
        sizes="(max-width: 768px) 120px, 140px"
        src="/images/hero-bg.png" // above-the-fold
        width={140} // control display size via CSS
      />
      <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            <div className="mb-4 flex items-center justify-center gap-2">
              <ShoppingBag className="h-12 w-12 text-brand" />
            </div>
            <h1 className="mb-6 text-white">
              {t("hero.title")}
              <br />
              <span className="bg-linear-to-r from-brand-gradient-from via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                {t("hero.subtitle")}
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-white/90">
              {t("hero.description")}
            </p>

            {!isMember && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 inline-block"
                initial={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.3 }}
              >
                <Badge className="border-0 bg-brand px-4 py-2 text-base text-white">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("hero.nonMemberBadge")}
                </Badge>
              </motion.div>
            )}

            {isMember && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 inline-block"
                initial={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.3 }}
              >
                <Badge className="border-0 bg-green-500 px-4 py-2 text-base text-white">
                  <Users className="mr-2 h-4 w-4" />
                  {t("hero.memberBadge")}
                </Badge>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        className="-translate-x-1/2 absolute bottom-8 left-1/2"
        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
      >
        <ChevronDown className="h-8 w-8 text-white/70" />
      </motion.div>
    </div>
  );
}
