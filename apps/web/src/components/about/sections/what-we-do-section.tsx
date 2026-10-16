import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { statusPanelSecondaryAction } from "@/components/ui/status-panel";
import { AboutSection } from "./section-shell";

const ITEM_KEYS = ["0", "1", "2", "3", "4"] as const;

/** What BISO does on each campus, and where to find it. */
export async function WhatWeDoSection() {
  const [t, tHome] = await Promise.all([
    getTranslations("about"),
    getTranslations("home"),
  ]);

  // The merged page showed these four as icon tiles with no destination. They
  // name things this site has a page for, so they lead there instead.
  const links = [
    { href: "/events", label: tHome("about.upcomingEvents") },
    { href: "/jobs", label: tHome("about.jobOpportunities") },
    { href: "/units", label: tHome("about.studentGroups") },
    { href: "#studiekvalitet", label: t("general.academics.title") },
  ];

  return (
    <AboutSection
      eyebrow={t("general.whatWeDo.title")}
      id="hva-vi-gjor"
      intro={t("general.whatWeDo.lead")}
      title={t("general.whatWeDo.subtitle")}
    >
      <ul className="type-body max-w-(--measure) list-disc space-y-2 ps-5 text-ink">
        {ITEM_KEYS.map((key) => (
          <li key={key}>{t(`general.whatWeDo.items.${key}`)}</li>
        ))}
      </ul>
      <ul className="mt-8 flex flex-wrap gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link className={statusPanelSecondaryAction} href={link.href}>
              {link.label}
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </AboutSection>
  );
}
