import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getActiveCampus } from "@/app/actions/campus";
import { AboutHero } from "@/components/about/about-hero";
import { BusinessPageClient } from "./business-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partner.meta");

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function PartnerPage() {
  const t = await getTranslations("partner");
  const activeCampus = await getActiveCampus();

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      {/* Hero Section - Server-rendered with AboutHero component */}
      <AboutHero
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("hero.title") }]}
        icon={<Building2 className="h-8 w-8 text-white" />}
        subtitle={t("hero.description")}
        title={t("hero.title")}
      />

      {/* Client component for animations, receives activeCampus from server */}
      <BusinessPageClient activeCampus={activeCampus} />
    </div>
  );
}
