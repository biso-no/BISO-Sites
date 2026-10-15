"use client";

import { Button } from "@repo/ui/components/ui/button";
import { FileText, Wine } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AboutHero } from "@/components/about/about-hero";

/**
 * The drug and alcohol policy, styled like the rest of Om BISO. The signed
 * policy document itself is published under code of conduct on /documents.
 */
export default function DrugsPolicyPage() {
  const t = useTranslations("policies.drugsPolicy");
  const tAbout = useTranslations("about");

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <AboutHero
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: tAbout("hub.title"), href: "/about" },
          { label: t("title") },
        ]}
        compact
        icon={<Wine className="h-8 w-8 text-white" />}
        subtitle={t("intro")}
        title={t("title")}
      />
      <section className="py-16">
        <div className="prose prose-lg mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h3>{t("sections.principles.title")}</h3>
          <ul>
            <li>{t("sections.principles.items.0")}</li>
            <li>{t("sections.principles.items.1")}</li>
            <li>{t("sections.principles.items.2")}</li>
          </ul>
          <h3>{t("sections.conduct.title")}</h3>
          <p>{t("sections.conduct.body")}</p>
          <h3>{t("sections.support.title")}</h3>
          <p>{t("sections.support.body")}</p>
        </div>
      </section>
      <section className="pb-16">
        <div className="mx-auto flex max-w-4xl flex-wrap gap-3 px-4 sm:px-6 lg:px-8">
          <Button asChild size="lg">
            <Link href="/documents?category=code-of-conduct">
              <FileText className="mr-2 h-4 w-4" />
              {tAbout("documents.items.conduct.title")}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/about#dokumenter">← {tAbout("hub.title")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
