"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { ChevronDown, ShoppingBag, Sparkles, Users } from "lucide-react";
import { motion } from "motion/react";

type ShopHeroProps = {
  isMember?: boolean;
};

export function ShopHero({ isMember = false }: ShopHeroProps) {
  return (
    <div className="relative h-[50vh] overflow-hidden">
      <ImageWithFallback
        alt="BISO logo"
        className="h-10 w-auto"
        height={40} // pick the intrinsic pixel width
        priority // and height that matches your asset ratio
        sizes="(max-width: 768px) 120px, 140px"
        src="/images/logo-home.png" // above-the-fold
        width={140} // control display size via CSS
      />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            <div className="mb-4 flex items-center justify-center gap-2">
              <ShoppingBag className="h-12 w-12 text-[#3DA9E0]" />
            </div>
            <h1 className="mb-6 text-white">
              BISO Shop
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Everything You Need
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-white/90">
              From exclusive merch to trip deductibles and campus lockers - all
              available for pickup at BISO office.
            </p>

            {!isMember && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 inline-block"
                initial={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.3 }}
              >
                <Badge className="border-0 bg-[#3DA9E0] px-4 py-2 text-base text-white">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Join BISO from just 350 NOK/semester - unlock exclusive
                  discounts!
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
                  Member prices activated!
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
