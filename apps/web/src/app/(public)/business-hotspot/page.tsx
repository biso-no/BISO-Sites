import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/app/actions/locale";
import { AboutHero } from "@/components/about/about-hero";
import { getMembershipTextItems } from "@/lib/data/membership-texts";
import { BusinessHotspotClient } from "./business-hotspot-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businessHotspot.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function BusinessHotspotPage() {
  const t = await getTranslations("businessHotspot");
  const items = await getMembershipTextItems(
    "business_hotspot",
    await getLocale()
  );

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      {/* Hero Section - Server-rendered with AboutHero component */}
      <AboutHero
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Business", href: "/business" },
          { label: t("title") },
        ]}
        icon={<Building2 className="h-8 w-8 text-white" />}
        subtitle={t("intro")}
        title={t("title")}
      />

      {/* Client component for animations */}
      <BusinessHotspotClient items={items} />
    </div>
  );
}
