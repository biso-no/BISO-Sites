import { Locale } from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import { notFound } from "next/navigation";
import { getManagedPage } from "@/app/actions/pages/actions";
import { getUserRolesForClient } from "@/lib/authorization";
import { UnifiedEditorClient } from "../_components/unified-editor-client";

type EditorPageProps = {
  params: Promise<{
    pageId: string;
  }>;
};

const SUPPORTED_LOCALES: Locale[] = [Locale.NO, Locale.EN];

export default async function EditPageEditor({ params }: EditorPageProps) {
  const { pageId } = await params;
  const page = await getManagedPage(pageId);
  const userRoles = await getUserRolesForClient();

  if (!page) {
    notFound();
  }

  const initialLocaleData: Record<
    Locale,
    { title: string; description: string; data: Data } | null
  > = {
    [Locale.NO]: null,
    [Locale.EN]: null,
  };

  for (const translation of page.translations) {
    const draftDoc = translation.draftDocument as unknown as Data;
    const initialData: Data = draftDoc?.content
      ? draftDoc
      : { content: [], root: { props: { title: translation.title } } };

    initialLocaleData[translation.locale] = {
      title: translation.title,
      description: translation.description || "",
      data: initialData,
    };
  }

  const defaultLocale = page.translations[0]?.locale ?? Locale.NO;

  return (
    <UnifiedEditorClient
      availableLocales={SUPPORTED_LOCALES}
      currentLocale={defaultLocale}
      initialLocaleData={initialLocaleData}
      initialSlug={page.slug}
      pageContext={{ campusId: page.campusId, departmentId: page.departmentId }}
      pageId={pageId}
      status={page.status}
      userContext={{
        campusNames: userRoles.campusNames,
        departmentNames: userRoles.departmentNames,
        managedCampuses: userRoles.managedCampuses,
        isGlobalAdmin: userRoles.isGlobalAdmin,
        isCampusAdmin: userRoles.isCampusAdmin,
      }}
      visibility={page.visibility}
    />
  );
}
