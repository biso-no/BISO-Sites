import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listNews } from "../_actions/news";
import { PageHeader } from "../_components/page-header";
import { StudioLinkButton } from "../_components/studio";
import { NewsListClient } from "./_components/news-list-client";

interface NewsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const t = await getTranslations("adminPortal.news");
  const tc = await getTranslations("adminPortal.common");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const articles = await listNews({ page });

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        <StudioLinkButton href="/news/new" variant="primary">
          <Plus size={15} />
          {t("create")}
        </StudioLinkButton>
      </PageHeader>

      <NewsListClient
        initialArticles={articles.rows}
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
        total={articles.total}
      />
    </div>
  );
}
