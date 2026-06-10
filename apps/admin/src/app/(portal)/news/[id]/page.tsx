import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { listCampuses } from "../../_actions/lookups";
import { getNewsArticle } from "../../_actions/news";
import { NewsEditorClient } from "./_components/news-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewsEditorPage({ params }: Props) {
  const ctx = await requireNavAccess("portal.news");
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

  const isGlobalAdmin = ctx.roles.includes("globaladmin");
  const isCampusAdmin = ctx.roles.includes("campusadmin");

  const effectiveCampusId = (() => {
    if (isGlobalAdmin) {
      return ctx.activeCampusId ?? campuses[0]?.$id ?? "";
    }
    if (isCampusAdmin) {
      return ctx.managedCampusIds[0] ?? campuses[0]?.$id ?? "";
    }
    return ctx.resolvedCampusIds[0] ?? campuses[0]?.$id ?? "";
  })();

  const canChangeCampus = isGlobalAdmin;
  const filteredCampuses = isGlobalAdmin
    ? campuses
    : campuses.filter((c) => {
        const allowed = isCampusAdmin
          ? ctx.managedCampusIds
          : ctx.resolvedCampusIds;
        return allowed.includes(c.$id);
      });

  return (
    <NewsEditorClient
      article={article}
      campuses={filteredCampuses}
      canChangeCampus={canChangeCampus}
      defaultCampusId={effectiveCampusId}
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
