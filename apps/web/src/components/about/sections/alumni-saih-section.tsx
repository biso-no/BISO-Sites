"use client";

import { HeartHandshake, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { CtaCard } from "./cta-card";
import { AboutSection } from "./section-shell";

/** Alumni and SAIH share one band: a paragraph and a button each. */
export function AlumniSaihSection() {
  const t = useTranslations("about");
  const alumni = useTranslations("about.pages.alumni");
  const saih = useTranslations("about.pages.saih");
  return (
    <AboutSection id="alumni" title={t("sections.alumni")} wide>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground leading-relaxed">
            {alumni("content")}
          </p>
          <CtaCard
            cta={alumni("cta")}
            description={alumni("intro")}
            href="/alumni"
            icon={Users}
            title={alumni("title")}
          />
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground leading-relaxed">
            {saih("content")}
          </p>
          <CtaCard
            cta={saih("cta")}
            description={saih("intro")}
            external
            href="https://saih.no"
            icon={HeartHandshake}
            title={saih("title")}
          />
        </div>
      </div>
    </AboutSection>
  );
}
