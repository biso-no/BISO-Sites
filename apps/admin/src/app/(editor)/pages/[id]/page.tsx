import { resolvePageCampusId } from "@repo/api/page-builder";
import { isUnitPageSlug } from "@repo/shared/utils/unit-urls";
import { notFound } from "next/navigation";
import { listAllDepartments } from "@/app/(portal)/_actions/departments";
import { listCampuses } from "@/app/(portal)/_actions/lookups";
import {
  getPageEditorById,
  getPageEditorLocales,
} from "@/app/(portal)/_actions/pages";
import { getLocale } from "@/app/actions/locale";
import { getUserAuthContext, requireNavAccess } from "@/lib/authorization";
import { PageEditorClient } from "./_components/page-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PageEditorPage({ params }: Props) {
  await requireNavAccess("portal.pages");
  const { id } = await params;

  const isNew = id === "new";

  const [
    ctx,
    pageResult,
    departments,
    campuses,
    initialLocale,
    availableLocales,
  ] = await Promise.all([
    getUserAuthContext(),
    isNew ? null : getPageEditorById(id),
    listAllDepartments(),
    listCampuses(),
    getLocale(),
    getPageEditorLocales(),
  ]);

  if (!(ctx && (isNew || pageResult))) {
    notFound();
  }

  // Who may pick a campus: a global admin any, a campus admin those they
  // manage, everyone else none (their own campus is shown read-only).
  const isGlobalAdmin = ctx.roles.includes("globaladmin");
  const choosableCampuses = isGlobalAdmin
    ? campuses
    : campuses.filter((campus) => ctx.managedCampusIds.includes(campus.$id));
  const campusLocked = choosableCampuses.length === 0;

  // A unit page's slug IS its binding to a department and campus (see the
  // unit pages spec). Editing any of them here would orphan the page, so they
  // are shown read-only; savePageEditorDoc enforces it server-side.
  let locked:
    | { campus?: boolean; department?: boolean; slug?: boolean }
    | undefined;
  if (isUnitPageSlug(pageResult?.page.slug)) {
    locked = { campus: true, department: true, slug: true };
  } else if (campusLocked) {
    locked = { campus: true };
  }

  const editorDepartments = departments.map((d) => ({
    campusId: d.campus_id ?? null,
    id: d.$id,
    name: d.Name ?? d.$id,
  }));
  // Existing pages open on their own campus; a new page starts on the
  // editor's (the campus switcher for a global admin, else their own).
  const defaultCampusId =
    pageResult?.page.campusId ?? resolvePageCampusId(ctx) ?? "";

  return (
    <PageEditorClient
      availableLocales={availableLocales}
      campuses={campuses
        .filter(
          (campus) =>
            isGlobalAdmin ||
            choosableCampuses.includes(campus) ||
            campus.$id === defaultCampusId
        )
        .map((campus) => ({ id: campus.$id, name: campus.name }))}
      defaultCampusId={defaultCampusId}
      departments={editorDepartments}
      initialLocale={initialLocale}
      initialPage={pageResult}
      lockedMeta={locked}
      pageId={isNew ? null : id}
    />
  );
}
