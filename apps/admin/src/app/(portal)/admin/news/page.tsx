import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listNews } from "../_actions/news";
import { PageHeader } from "../_components/page-header";
import { NewsListClient } from "./_components/news-list-client";

export default async function NewsPage() {
  const t = await getTranslations("adminPortal.news");
  const tc = await getTranslations("adminPortal.common");

  const articles = await listNews();

  return (
    <div className="pb-12">
      <PageHeader title={t("title")} description={t("description")}>
        <Link
          href="/admin/news/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#3DA9E0", color: "#001731", boxShadow: "0 0 20px rgba(61,169,224,0.25)" }}
        >
          <Plus size={15} />
          {t("create")}
        </Link>
      </PageHeader>

      <NewsListClient
        initialArticles={articles}
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
      />
    </div>
  );
}
