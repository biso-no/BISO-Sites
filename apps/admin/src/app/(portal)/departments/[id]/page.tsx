import { PAGE_LOCALES } from "@repo/api/page-builder";
import type { Pages } from "@repo/api/types/appwrite";
import { unitCanonicalPath } from "@repo/shared/utils/unit-urls";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { getDepartmentWithPage } from "../../_actions/departments";
import { listCampuses } from "../../_actions/lookups";
import { PageHeader } from "../../_components/page-header";
import {
  UnitPageCard,
  type UnitPageLocaleStatus,
} from "./_components/unit-page-card";

const TRAILING_SLASH_RE = /\/$/;

const LOCALE_LABEL_KEY: Record<string, string> = {
  en: "actions.localeEn",
  no: "actions.localeNo",
};

/**
 * One row per editor locale, whether or not a translation exists.
 *
 * `pages.status` is page-level and flips to "published" as soon as any single
 * locale is published, while the public route gates on the per-locale
 * `page_translations.is_published`. Reporting the page-level flag would tell a
 * board that published only Norwegian that English is live as well.
 */
function toLocaleStatuses(
  page: Pages | null,
  label: (key: string) => string
): UnitPageLocaleStatus[] {
  const translations = page?.translation_refs ?? [];
  return PAGE_LOCALES.map((locale) => {
    const translation = translations.find((row) => row.locale === locale);
    return {
      exists: Boolean(translation),
      label: label(LOCALE_LABEL_KEY[locale] ?? locale),
      locale,
      published: translation?.is_published === true,
    };
  });
}

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireNavAccess("portal.departments");
  const { id } = await params;

  const [result, campuses, t] = await Promise.all([
    getDepartmentWithPage(id),
    listCampuses(),
    getTranslations("adminPortal.departments"),
  ]);

  // Null covers both "no such department" and "not yours" — the action does the
  // canManageDepartment check, and notFound() is what requireNavAccess uses for
  // an authenticated user without access.
  if (!result) {
    notFound();
  }

  const { department, page, slugConflict } = result;
  const campusName =
    campuses.find((c) => c.$id === department.campus_id)?.name ??
    department.campus_id;

  // canonicalPath is relative (for display); liveUrl is absolute against the
  // PUBLIC web app's origin (for the href). NEXT_PUBLIC_BASE_URL is admin's
  // own canonical origin (see lib/server.ts#getCanonicalOrigin) — using it
  // here would point "View live" at the admin host instead of biso.no.
  const canonicalPath = unitCanonicalPath({
    campusId: department.campus_id,
    slug: department.slug,
  });
  const webBaseUrl = (
    process.env.WEB_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_WEB_BASE_URL ??
    "https://biso.no"
  ).replace(TRAILING_SLASH_RE, "");
  // A sync that marks a department inactive deliberately keeps its slug and
  // page — but both public lookups (cachedDepartmentsBySlug,
  // cachedDepartmentBySlugAndCampus) filter `Query.equal("active", true)`,
  // which EXCLUDES a null value. `active` is nullable, and unlike
  // listDepartments' own `Query.or([equal("active", true),
  // isNull("active")])` — which governs whether a row appears in the admin
  // management LISTING, a question null answers "yes" to — this flag answers
  // "will this be reachable on the public site?", which null answers "no"
  // to. Treating null as active here would offer a "View live" link that can
  // never resolve for a legacy department with active: null. Do not "fix"
  // this to match listDepartments; the two questions are different.
  const isDepartmentActive = department.active === true;
  const liveUrl =
    canonicalPath && isDepartmentActive
      ? `${webBaseUrl}${canonicalPath}`
      : null;

  return (
    <div className="pb-12">
      <PageHeader
        description={[campusName, department.type].filter(Boolean).join(" · ")}
        title={department.Name}
      />

      <UnitPageCard
        canonicalPath={canonicalPath}
        departmentId={department.$id}
        isDepartmentActive={isDepartmentActive}
        labels={{
          createPage: t("actions.createPage"),
          createPageDisabledInactive: t("actions.createPageDisabledInactive"),
          draft: t("actions.draft"),
          editPage: t("actions.editPage"),
          inactiveLiveNotice: t("actions.inactiveLiveNotice"),
          noPage: t("actions.noPage"),
          noSlug: t("actions.noSlug"),
          notPublished: t("actions.notPublished"),
          pageHeading: t("actions.pageHeading"),
          published: t("actions.published"),
          slugConflict: t("actions.slugConflict"),
          viewLive: t("actions.viewLive"),
        }}
        liveUrl={liveUrl}
        localeStatuses={toLocaleStatuses(page, (key) => t(key))}
        pageId={page?.$id ?? null}
        slugConflict={slugConflict}
      />
    </div>
  );
}
