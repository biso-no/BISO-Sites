"use client";
import { useTranslations } from "next-intl";
import { PublicPageHeader } from "@/components/public/PublicPageHeader";

export default function WhatIsBisoPage() {
  const t = useTranslations("about.pages.whatIsBiso");
  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={t("title")}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "About BISO", href: "/about" }, { label: t("title") }]}
      />
      <p className="text-primary-70">{t("intro")}</p>
      <div className="prose prose-primary max-w-none whitespace-pre-line">{t("content")}</div>
    </div>
  );
}


