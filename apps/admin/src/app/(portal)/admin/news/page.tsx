import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listNews } from "../_actions/news";
import { PageHeader } from "../_components/page-header";
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
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/admin/news/new"
          style={{
            background: "#3DA9E0",
            color: "#001731",
            boxShadow: "0 0 20px rgba(61,169,224,0.25)",
          }}
        >
          <Plus size={15} />
          {t("create")}
        </Link>
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
