import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listCampuses } from "../../_actions/jobs";
import { getNewsArticle } from "../../_actions/news";
import { NewsEditorClient } from "./_components/news-editor-client";

type Props = { params: Promise<{ id: string }> };

export default async function NewsEditorPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("adminPortal.news");

  const isNew = id === "new";
  const [article, campuses] = await Promise.all([
    isNew ? null : getNewsArticle(id),
    listCampuses(),
  ]);

  if (!(isNew || article)) {
    notFound();
  }

  return (
    <NewsEditorClient
      article={article}
      campuses={campuses}
      isNew={isNew}
      labels={{
        back: t("title"),
        title: t("fields.title"),
        author: t("fields.author"),
        category: t("fields.category"),
        coverImage: t("fields.coverImage"),
        body: t("fields.body"),
        locale: t("fields.locale"),
        status: t("fields.status"),
        campus: "Campus",
        discard: "Discard",
        saveDraft: "Save Draft",
        publish: "Publish",
        preview: t("preview"),
        saveSuccess: t("saveSuccess"),
        saveError: t("saveError"),
        publishSuccess: t("publishSuccess"),
      }}
    />
  );
}
