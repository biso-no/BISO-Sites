import { notFound } from "next/navigation";
import { getUserAuthContext } from "@/lib/authorization";
import { listCampuses, listDepartmentsForCampus } from "../../_actions/lookups";
import { getProduct } from "../../_actions/shop";
import { ShopStudioEditor } from "./_components/shop-studio-editor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === "new";

  const [product, campuses, ctx] = await Promise.all([
    isNew ? null : getProduct(id),
    listCampuses(),
    getUserAuthContext(),
  ]);

  if (!(isNew || product)) {
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

  const canChangeCampus = isGlobalAdmin;
  const filteredCampuses = isGlobalAdmin
    ? campuses
    : campuses.filter((c) => {
        const allowed = isCampusAdmin
          ? (ctx?.managedCampusIds ?? [])
          : (ctx?.resolvedCampusIds ?? []);
        return allowed.includes(c.$id);
      });

  const campusIdForDepts = product?.campus_id ?? effectiveCampusId;
  const departments = campusIdForDepts
    ? await listDepartmentsForCampus(campusIdForDepts)
    : [];

  const isDepartmentUser = !isGlobalAdmin && !isCampusAdmin;
  const allowedDepartmentIds =
    isDepartmentUser && ctx?.departmentNames.length
      ? departments
          .filter((d) => ctx.departmentNames.includes(d.Name))
          .map((d) => d.$id)
      : undefined;

  const filteredDepartments = allowedDepartmentIds
    ? departments.filter((d) => allowedDepartmentIds.includes(d.$id))
    : departments;

  return (
    <ShopStudioEditor
      allowedDepartmentIds={allowedDepartmentIds}
      campuses={filteredCampuses}
      canChangeCampus={canChangeCampus}
      defaultCampusId={effectiveCampusId}
      departments={filteredDepartments}
      isNew={isNew}
      product={product}
    />
  );
}
