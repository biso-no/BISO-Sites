import { Button } from "@repo/ui/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PublicPageHeader } from "@/components/public/public-page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businessHotspot.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function BusinessHotspotPage() {
  const t = await getTranslations("businessHotspot");
  return (
    <div className="space-y-6">
      <PublicPageHeader
        breadcrumbs={[{ label: "Home", href: "/" }, { label: t("title") }]}
        title={t("title")}
      />
      <div className="prose max-w-none">
        <p>{t("intro")}</p>
        <ul>
          <li>{t("features.0")}</li>
          <li>{t("features.1")}</li>
          <li>{t("features.2")}</li>
        </ul>
      </div>
      <div>
        <Button asChild variant="secondary">
          <Link href="/business">{t("cta")}</Link>
        </Button>
      </div>
    </div>
  );
}
