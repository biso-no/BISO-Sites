import { unitCanonicalPath } from "@repo/shared/utils/unit-urls";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { getDepartmentWithPage } from "../../_actions/departments";
import { listCampuses } from "../../_actions/lookups";
import { PageHeader } from "../../_components/page-header";
import { UnitPageCard } from "./_components/unit-page-card";

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

  const { department, page } = result;
  const campusName =
    campuses.find((c) => c.$id === department.campus_id)?.name ??
    department.campus_id;

  return (
    <div className="pb-12">
      <PageHeader
        description={[campusName, department.type].filter(Boolean).join(" · ")}
        title={department.Name}
      />

      <UnitPageCard
        canonicalUrl={unitCanonicalPath({
          campusId: department.campus_id,
          slug: department.slug,
        })}
        departmentId={department.$id}
        labels={{
          createPage: t("actions.createPage"),
          draft: t("actions.draft"),
          editPage: t("actions.editPage"),
          noPage: t("actions.noPage"),
          noSlug: t("actions.noSlug"),
          pageHeading: t("actions.pageHeading"),
          published: t("actions.published"),
          viewLive: t("actions.viewLive"),
        }}
        page={page}
      />
    </div>
  );
}
