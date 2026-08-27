import { isUnitPageSlug } from "@repo/shared/utils/unit-urls";
import { notFound } from "next/navigation";
import { listDepartments } from "@/app/(portal)/_actions/departments";
import {
  getPageEditorById,
  getPageEditorLocales,
} from "@/app/(portal)/_actions/pages";
import { getLocale } from "@/app/actions/locale";
import { PageEditorClient } from "./_components/page-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PageEditorPage({ params }: Props) {
  const { id } = await params;

  const isNew = id === "new";

  const [pageResult, departments, initialLocale, availableLocales] =
    await Promise.all([
      isNew ? null : getPageEditorById(id),
      listDepartments(),
      getLocale(),
      getPageEditorLocales(),
    ]);

  if (!(isNew || pageResult)) {
    notFound();
  }

  // A unit page's slug IS its binding to a department (see the unit pages
  // spec). Editing either field here would orphan the page, so both are shown
  // read-only; savePageEditorDoc enforces it server-side.
  const locked = isUnitPageSlug(pageResult?.page.slug)
    ? { department: true, slug: true }
    : undefined;

  const editorDepartments = departments.map((d) => ({
    id: d.$id,
    name: d.Name ?? d.$id,
  }));

  return (
    <PageEditorClient
      availableLocales={availableLocales}
      departments={editorDepartments}
      initialLocale={initialLocale}
      initialPage={pageResult}
      lockedMeta={locked}
      pageId={isNew ? null : id}
    />
  );
}
