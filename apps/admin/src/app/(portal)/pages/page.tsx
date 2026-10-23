import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { listPages } from "../_actions/pages";
import { PageHeader } from "../_components/page-header";
import { StudioLinkButton } from "../_components/studio";
import { CreateProjectHubButton } from "./_components/create-project-hub-button";
import { PagesListClient } from "./_components/pages-list-client";

export default async function PagesPage() {
  const ctx = await requireNavAccess("portal.pages");
  const t = await getTranslations("adminPortal.pages");

  const pages = await listPages();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        {ctx.roles.includes("globaladmin") ? (
          <CreateProjectHubButton
            label={t("createProject")}
            projectLabel={t("createProjectLabel")}
          />
        ) : null}
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
