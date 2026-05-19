import { notFound } from "next/navigation";
import type { PageDoc } from "@repo/editor";
import { getTranslations } from "next-intl/server";
import { getUserAuthContext } from "@/lib/authorization";
import { listCampuses } from "../../_actions/jobs";
import { listDepartments } from "../../_actions/departments";
import { getPageById } from "../../_actions/pages";
import { PageEditorClient } from "./_components/page-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PageEditorPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("adminPortal.pages");

  const isNew = id === "new";

  const [pageResult, campuses, departments, ctx] = await Promise.all([
    isNew ? null : getPageById(id, "no"),
    listCampuses(),
    listDepartments(),
    getUserAuthContext(),
  ]);

  if (!isNew && !pageResult) {
    notFound();
  }

  const isGlobalAdmin = ctx?.roles.includes("globaladmin") ?? false;
  const isCampusAdmin = ctx?.roles.includes("campusadmin") ?? false;

  const effectiveCampusId = (() => {
    if (!ctx) return campuses[0]?.$id ?? "";
    if (isGlobalAdmin) return ctx.activeCampusId ?? campuses[0]?.$id ?? "";
    if (isCampusAdmin) return ctx.managedCampusIds[0] ?? campuses[0]?.$id ?? "";
    return ctx.resolvedCampusIds[0] ?? campuses[0]?.$id ?? "";
  })();

  const filteredCampuses = isGlobalAdmin
    ? campuses
    : campuses.filter((c) => {
        const allowed = isCampusAdmin
          ? (ctx?.managedCampusIds ?? [])
          : (ctx?.resolvedCampusIds ?? []);
        return allowed.includes(c.$id);
      });

  const editorDepartments = departments.map((d) => ({
    id: d.$id,
    name: d.Name ?? d.$id,
  }));

  return (
    <PageEditorClient
      initial={(pageResult?.doc as PageDoc) ?? null}
      pageId={isNew ? null : id}
      campuses={filteredCampuses}
      defaultCampusId={effectiveCampusId}
      departments={editorDepartments}
      labels={{
        back: t("title"),
        save: t("editor.save"),
        saveDraft: t("editor.saveDraft"),
        publish: t("editor.publish"),
        unpublish: t("editor.unpublish"),
        saving: t("editor.saving"),
        saved: t("editor.saved"),
        error: t("editor.error"),
        saveSuccess: t("saveSuccess"),
        saveError: t("saveError"),
        publishSuccess: t("publishSuccess"),
        publishError: t("publishError"),
      }}
    />
  );
}
