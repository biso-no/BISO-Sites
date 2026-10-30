import { resolvePageCampusId } from "@repo/api/page-builder";
import { parsePageTheme } from "@repo/shared/utils/page-theme";
import { unitPageSlug } from "@repo/shared/utils/unit-urls";
import { notFound } from "next/navigation";
import { listAllDepartments } from "@/app/(portal)/_actions/departments";
import { listCampuses } from "@/app/(portal)/_actions/lookups";
import {
  getPageEditorById,
  getPageEditorLocales,
} from "@/app/(portal)/_actions/pages";
import { getLocale } from "@/app/actions/locale";
import { getUserAuthContext, requireNavAccess } from "@/lib/authorization";
import { pageEditorLocks } from "@/lib/page-editor-locks";
import { PageEditorClient } from "./_components/page-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PageEditorPage({ params }: Props) {
  await requireNavAccess("portal.pages");
  const { id } = await params;

  const isNew = id === "new";

  const pagePromise = isNew ? null : getPageEditorById(id);
  const [
    ctx,
    pageResult,
    departments,
    campuses,
    initialLocale,
    availableLocales,
  ] = await Promise.all([
    getUserAuthContext(),
    pagePromise,
    // Only the departments this user can edit, plus the page's current one so
    // its value still displays.
    pagePromise
      ? pagePromise.then((result) =>
          listAllDepartments({
            keepId: result?.page.departmentId || undefined,
          })
        )
      : listAllDepartments(),
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

  // A department user (neither a global nor a campus admin) keeps their
  // pages below their unit; see pageEditorLocks for every rule.
  const departmentUser = !isGlobalAdmin && ctx.managedCampusIds.length === 0;
  const locked = pageEditorLocks({
    campusLocked,
    departmentUser,
    slug: pageResult?.page.slug ?? null,
  });

  const editorDepartments = departments.map((d) => ({
    campusId: d.campus_id ?? null,
    id: d.$id,
    name: d.Name ?? d.$id,
    theme: parsePageTheme({ dark: d.theme_dark, accent: d.theme_accent }),
    unitSlug: unitPageSlug({ campusId: d.campus_id, slug: d.slug }),
  }));
  // A department user's new page starts in their department when they have
  // exactly one with a web address; with several they pick one first.
  const unitDepartments = editorDepartments.filter((d) => d.unitSlug);
  const onlyUnit =
    isNew && departmentUser && unitDepartments.length === 1
      ? unitDepartments[0]
      : undefined;
  const newPageUnit = onlyUnit?.unitSlug
    ? { departmentId: onlyUnit.id, unitSlug: onlyUnit.unitSlug }
    : undefined;
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
      newPageUnit={newPageUnit}
      pageId={isNew ? null : id}
    />
  );
}
