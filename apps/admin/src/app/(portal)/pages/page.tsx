import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { listPages } from "../_actions/pages";
import { PageHeader } from "../_components/page-header";
import { StudioLinkButton } from "../_components/studio";
import { PagesListClient } from "./_components/pages-list-client";

export default async function PagesPage() {
  await requireNavAccess("portal.pages");
  const t = await getTranslations("adminPortal.pages");

  const pages = await listPages();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        <StudioLinkButton href="/pages/new" variant="primary">
          <Plus size={15} />
          {t("create")}
        </StudioLinkButton>
      </PageHeader>

      <PagesListClient
        initialPages={pages}
        labels={{
          empty: t("empty"),
          all: t("filters.all"),
          published: t("filters.published"),
          draft: t("filters.draft"),
          edit: t("actions.edit"),
          delete: t("actions.delete"),
        }}
      />
    </div>
  );
}
