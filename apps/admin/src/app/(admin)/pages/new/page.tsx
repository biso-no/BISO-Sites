import { listPages } from "@repo/api/page-builder";
import { Locale, PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import { redirect } from "next/navigation";
import { getUserRolesForClient } from "@/lib/authorization";
import { UnifiedEditorClient } from "../_components/unified-editor-client";

const SUPPORTED_LOCALES: Locale[] = [Locale.NO, Locale.EN];

const EMPTY_DATA: Data = {
  root: { props: {} },
  content: [],
};

type SearchParams = Promise<{
  title?: string;
  slug?: string;
  locale?: string;
  description?: string;
}>;

export default async function NewPageEditor({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const userRoles = await getUserRolesForClient();

  const isDepartmentUser =
    userRoles.departmentNames.length > 0 &&
    !userRoles.isGlobalAdmin &&
    !userRoles.isCampusAdmin;

  const departmentName = isDepartmentUser ? userRoles.departmentNames[0] : null;
  const departmentSlug = departmentName
    ? departmentName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
    : null;

  if (isDepartmentUser && departmentName) {
    const existing = await listPages({
      useSession: true,
      departmentId: departmentName,
      limit: 1,
    });

    if (existing.length > 0) {
      redirect(`/pages/${existing[0]!.id}`);
    }
  }

  // Get initial values from query params (set by AI assistant)
  const initialTitle = departmentName ?? params.title ?? "";
  const initialSlug = departmentSlug ?? params.slug ?? "";
  const initialDescription = params.description || "";
  const initialLocale = (
    params.locale === "en" ? Locale.EN : Locale.NO
  ) as Locale;

  const initialLocaleData: Record<
    Locale,
    { title: string; description: string; data: Data } | null
  > = {
    [Locale.NO]: {
      title: initialLocale === Locale.NO ? initialTitle : "",
      description: initialLocale === Locale.NO ? initialDescription : "",
      data: EMPTY_DATA,
    },
    [Locale.EN]: {
      title: initialLocale === Locale.EN ? initialTitle : "",
      description: initialLocale === Locale.EN ? initialDescription : "",
      data: EMPTY_DATA,
    },
  };

  return (
    <UnifiedEditorClient
      availableLocales={SUPPORTED_LOCALES}
      currentLocale={initialLocale}
      initialLocaleData={initialLocaleData}
      initialSlug={initialSlug}
      pageContext={{
        departmentId: departmentName,
      }}
      status={PageStatus.DRAFT}
      userContext={{
        campusNames: userRoles.campusNames,
        departmentNames: userRoles.departmentNames,
        managedCampuses: userRoles.managedCampuses,
        isGlobalAdmin: userRoles.isGlobalAdmin,
        isCampusAdmin: userRoles.isCampusAdmin,
      }}
      visibility={PageVisibility.PUBLIC}
    />
  );
}
