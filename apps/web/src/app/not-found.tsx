import { ArrowLeft, Home } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

/**
 * The 404 page. It renders inside `SiteShell` — the `(public)` catch-all
 * commits the layout before calling `notFound()` — so it opens on the same
 * navy `PageHeader` as every other page and draws no `<main>` of its own
 * (`components/layout/shell.test.ts`).
 *
 * The navy band carries the actions, so they sit on `data-surface="deep"`:
 * the primary pill reads sky-on-navy and the secondary one an outline, the
 * same pair a `StatusPanel` uses on paper.
 */
export default async function NotFound() {
  const t = await getTranslations("common");

  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className={statusPanelPrimaryAction} href="/">
              <Home aria-hidden="true" className="size-4 shrink-0" />
              {t("notFound.cta.goToFrontPage")}
            </Link>
            <Link className={statusPanelSecondaryAction} href="/campus">
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
              {t("notFound.cta.goToCampus")}
            </Link>
          </>
        }
        eyebrow={`404 · ${t("notFound.tagline")}`}
        lede={t("notFound.description")}
        title={t("notFound.title")}
      />
      <Section tone="paper" width="prose">
        <p className="type-body-sm text-ink-muted">
          {t.rich("notFound.cta.needAssistance", {
            email: "contact@biso.no",
            link: (chunks) => (
              <a
                className="text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                href="mailto:contact@biso.no"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </Section>
    </>
  );
}
