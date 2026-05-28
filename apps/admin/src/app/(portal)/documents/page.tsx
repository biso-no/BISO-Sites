import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { listDocuments } from "../_actions/documents";
import { PageHeader } from "../_components/page-header";
import { StudioLinkButton } from "../_components/studio";
import { DocumentsListClient } from "./_components/documents-list-client";

interface DocumentsPageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function DocumentsPage({
  searchParams,
}: DocumentsPageProps) {
  await requireNavAccess("portal.documents");
  const t = await getTranslations("adminPortal.documents");
  const tc = await getTranslations("adminPortal.common");
  const { page: pageParam, status } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const result = await listDocuments({ page, status });

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        <StudioLinkButton href="/documents/new" variant="primary">
          <Plus size={15} />
          {t("create")}
        </StudioLinkButton>
      </PageHeader>

      <DocumentsListClient
        initialDocuments={result.rows}
        labels={{
          empty: t("empty"),
          emptyDescription: t("emptyDescription"),
          searchPlaceholder: tc("search"),
          all: tc("all"),
          published: tc("status.published"),
          draft: tc("status.draft"),
          edit: t("actions.edit"),
          delete: t("actions.delete"),
          deleteConfirm: tc("confirmDelete"),
        }}
        page={page}
        total={result.total}
      />
    </div>
  );
}
