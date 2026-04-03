"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@repo/ui/components/ui/carousel";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BenefitPreviewCard } from "./benefit-preview-card";

import { CampusBenefit } from "@repo/api/types/appwrite";

export function BenefitsShowcase({ benefits }: { benefits: CampusBenefit[] }) {
  const t = useTranslations("memberPortal");
  const router = useRouter();

  const handleJoinClick = () => {
    router.push("/membership");
  };

  return (
    <section className="py-12">
      {/* Section Header */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 font-bold text-3xl text-foreground dark:text-foreground">
          {t("showcase.title")}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground dark:text-muted-foreground">
          {t("showcase.description")}
        </p>
      </motion.div>

      {/* Benefits Carousel */}
      <div className="relative">
        <Carousel
          className="w-full"
          opts={{
            align: "start",
            loop: true,
          }}
        >
          <CarouselContent className="-ml-4">
            {benefits.slice(0, 10).map((benefit, index) => (
              <CarouselItem
                className="basis-full pl-4 sm:basis-1/2 lg:basis-1/3"
                key={benefit.$id || index}
              >
                <BenefitPreviewCard
                  category={benefit.category}
                  discountText={benefit.teaser_en || "Unlock to see"}
                  index={index}
                  onJoinClick={handleJoinClick}
                  partnerName={benefit.partner_name || "Partner"}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-0 hidden border-brand-border bg-background/80 backdrop-blur-sm hover:bg-background md:flex" />
          <CarouselNext className="right-0 hidden border-brand-border bg-background/80 backdrop-blur-sm hover:bg-background md:flex" />
        </Carousel>

        {/* Gradient fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent md:w-12" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:w-12" />
      </div>

      {/* Stats Section */}
      <motion.div
        animate={{ opacity: 1 }}
        className="mt-12 grid gap-6 text-center sm:grid-cols-3"
        initial={{ opacity: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="rounded-xl bg-gradient-to-br from-brand-muted to-brand-muted-strong p-6">
          <div className="mb-2 font-bold text-3xl text-brand">50+</div>
          <div className="text-muted-foreground">
            {t("showcase.stats.partners")}
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-brand-muted to-brand-muted-strong p-6">
          <div className="mb-2 font-bold text-3xl text-brand">~3,000 NOK</div>
          <div className="text-muted-foreground">
            {t("showcase.stats.savings")}
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-brand-muted to-brand-muted-strong p-6">
          <div className="mb-2 font-bold text-3xl text-brand">10,000+</div>
          <div className="text-muted-foreground">
            {t("showcase.stats.members")}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
