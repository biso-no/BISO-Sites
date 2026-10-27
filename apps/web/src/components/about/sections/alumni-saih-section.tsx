import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";
import { AboutSection, SectionCopy, SubHeading } from "./section-shell";

/** Alumni and SAIH share one section: a paragraph each, and SAIH's site. */
export async function AlumniSaihSection() {
  const [t, alumni, saih] = await Promise.all([
    getTranslations("about"),
    getTranslations("about.pages.alumni"),
    getTranslations("about.pages.saih"),
  ]);

  return (
    <AboutSection id="alumni" title={t("sections.alumni")}>
      <SubHeading>{alumni("title")}</SubHeading>
      <p className="type-body mb-4 max-w-(--measure) text-ink-muted">
        {alumni("intro")}
      </p>
      <SectionCopy text={alumni("content")} />
      {/* PLACEHOLDER-008: `alumni.cta` reads "Go to Alumni site", and the
          merged page pointed it at `/alumni`, which is not a route in this app
          (it answered 404 in RD-026's live sweep). No alumni URL exists in the
          repo, so no button is drawn rather than one that leads nowhere.
          Restore a real link here once the alumni site's address is known. */}

      <SubHeading>{saih("title")}</SubHeading>
      <p className="type-body mb-4 max-w-(--measure) text-ink-muted">
        {saih("intro")}
      </p>
      <SectionCopy text={saih("content")} />
      <p className="mt-6">
        <a
          className={statusPanelPrimaryAction}
          href="https://saih.no"
          rel="noopener noreferrer"
          target="_blank"
        >
          {saih("cta")}
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
        </a>
      </p>
    </AboutSection>
  );
}
