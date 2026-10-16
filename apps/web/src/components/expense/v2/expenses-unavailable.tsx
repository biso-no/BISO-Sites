import { Ban } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

/**
 * Shown when the `expenses_module` feature flag is off — the reimbursements
 * feature has been paused platform-wide by an administrator.
 *
 * It brings its own `<PageHeader>` because it replaces the whole page, and a
 * route that renders no `<h1>` would otherwise leave the tab and the document
 * outline empty in exactly the situation where a visitor most needs to know
 * where they are.
 */
export async function ExpensesUnavailable() {
  const t = await getTranslations("expenses");
  return (
    <>
      <PageHeader breadcrumbs={[{ label: t("title") }]} title={t("title")} />
      <Section tone="paper" width="prose">
        <div className="flex flex-col items-start gap-4 rounded-biso-md border border-edge p-10">
          <Ban aria-hidden="true" className="size-8 text-ink-muted" />
          <h2 className="type-heading-card text-ink">
            {t("unavailableTitle")}
          </h2>
          <p className="type-body text-ink-muted">{t("unavailableBody")}</p>
        </div>
      </Section>
    </>
  );
}
