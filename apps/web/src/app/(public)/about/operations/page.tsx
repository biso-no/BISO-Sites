"use client";
import { useTranslations } from "next-intl";
import { PublicPageHeader } from "@/components/public/public-page-header";

export default function OperationsPage() {
  const t = useTranslations("about.pages.operations");
  return (
    <div className="space-y-6">
      <PublicPageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "About BISO", href: "/about" },
          { label: t("title") },
        ]}
        title={t("title")}
      />
      <p className="text-primary-70">{t("intro")}</p>
      <div className="prose prose-primary max-w-none whitespace-pre-line">
        {t("content")}
      </div>
    </div>
  );
}
